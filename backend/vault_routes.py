# backend/vault_routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from jose import JWTError, jwt
from utils.favicon import favicon_url_for
import os

from database import db
from utils.domain import normalize_domain
from premium_guard import require_premium_user   # ✅ premium lock

router = APIRouter()

# ---------- Auth dependency (local fallback) ----------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

def _oid(v) -> ObjectId:
    return v if isinstance(v, ObjectId) else ObjectId(str(v))

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub") or payload.get("_id") or payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    u = db["users"].find_one({"_id": _oid(user_id)})
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {"_id": str(u["_id"]), "email": u.get("email"), "status": u.get("status", "normal")}
# -----------------------------------------------------

# ---------- Models ----------
class VaultIn(BaseModel):
    label: str = Field(..., max_length=120)
    login: Optional[str] = None
    url: Optional[str] = None
    salt: str
    iv: str
    ciphertext: str

class VaultUpdate(BaseModel):
    label: Optional[str] = None
    login: Optional[str] = None
    url: Optional[str] = None
    salt: Optional[str] = None
    iv: Optional[str] = None
    ciphertext: Optional[str] = None

class VaultOut(BaseModel):
    id: str
    label: Optional[str] = None
    login: Optional[str] = None
    url: Optional[str] = None
    domain: Optional[str] = None
    faviconUrl: Optional[str] = None
    salt: Optional[str] = None
    iv: Optional[str] = None
    ciphertext: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class SuggestOut(BaseModel):
    domain: str
    exact: List[VaultOut]
    near: List[VaultOut]

# ---------- Collection & Index ----------
if db is None:
    raise RuntimeError("DB not initialized")
COLL = db["vault_entries"]
try:
    COLL.create_index([("userId", 1), ("createdAt", -1)])
except Exception:
    pass

# ---------- Helpers ----------
def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    domain = doc.get("domain")
    return {
        "id": str(doc["_id"]),
        "label": doc.get("label"),
        "login": doc.get("login"),
        "url": doc.get("url"),
        "domain": domain,
        "faviconUrl": favicon_url_for(domain),
        "salt": doc.get("salt"),
        "iv": doc.get("iv"),
        "ciphertext": doc.get("ciphertext"),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _preflight_dupe_check(user_id: ObjectId, domain: Optional[str], login: Optional[str], exclude_id: Optional[ObjectId] = None):
    if not domain or not login:
        return
    q: Dict[str, Any] = {"userId": user_id, "domain": domain, "login": login.strip().lower()}
    if exclude_id is not None:
        q["_id"] = {"$ne": exclude_id}
    exists = COLL.find_one(q, {"_id": 1})
    if exists:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_ACCOUNT",
                "message": f"An entry for login '{login}' already exists for {domain}.",
                "existing_id": str(exists["_id"])
            }
        )

# ---------- ROUTES (Normal: 5 entries max / Premium: unlimited) ----------

@router.post("/", response_model=dict, summary="Store an encrypted password entry (Normal: 5 entries max)")
def store_secret(
    payload: VaultIn,
    user=Depends(get_current_user),   # ✅ allow both normal & premium
    force: bool = Query(False, description="Allow duplicate (override unique check)")
):
    if db is None:
        raise HTTPException(500, "DB not available")

    user_id = _oid(user["_id"])
    user_plan = user.get("status", "normal")

    # 🛡️ Limit normal users to 5 entries
    if user_plan != "premium":
        entry_count = COLL.count_documents({"userId": user_id})
        if entry_count >= 5:
            raise HTTPException(
                status_code=403,
                detail="Free plan limit reached. Upgrade to Premium for unlimited Vault storage."
            )

    # Normalize and insert
    label = payload.label.strip()
    login_norm = (payload.login or "").strip().lower() or None
    url_norm = (payload.url or "").strip() or None
    domain = normalize_domain(url_norm) if url_norm else None

    if not force:
        _preflight_dupe_check(user_id, domain, login_norm)

    doc = {
        "userId": user_id,
        "label": label,
        "login": login_norm,
        "url": url_norm,
        "domain": domain,
        "salt": payload.salt,
        "iv": payload.iv,
        "ciphertext": payload.ciphertext,
        "createdAt": _now_utc(),
        "updatedAt": _now_utc(),
    }
    res = COLL.insert_one(doc)
    return {"id": str(res.inserted_id)}


@router.get("/", response_model=dict, summary="List your stored entries")
def list_secrets(user=Depends(get_current_user)):   # ✅ everyone can list
    if db is None:
        raise HTTPException(500, "DB not available")
    items: List[Dict[str, Any]] = []
    for d in COLL.find({"userId": _oid(user["_id"])}).sort("createdAt", -1):
        items.append(_serialize(d))
    return {"entries": items}


@router.delete("/{entry_id}", response_model=dict, summary="Delete an entry")
def delete_secret(entry_id: str, user=Depends(get_current_user)):
    if db is None:
        raise HTTPException(500, "DB not available")
    try:
        q = {"_id": _oid(entry_id), "userId": _oid(user["_id"])}
    except Exception:
        raise HTTPException(400, "Invalid id")
    res = COLL.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.put("/{entry_id}", response_model=dict, summary="Update an entry")
def update_secret(entry_id: str, payload: VaultUpdate, user=Depends(get_current_user), force: bool = Query(False)):
    if db is None:
        raise HTTPException(500, "DB not available")
    try:
        oid = _oid(entry_id)
    except Exception:
        raise HTTPException(400, "Invalid id")

    cur = COLL.find_one({"_id": oid, "userId": _oid(user["_id"])})
    if not cur:
        raise HTTPException(404, "Not found")

    updates: Dict[str, Any] = {}
    if payload.label is not None:
        updates["label"] = payload.label.strip()
    if payload.login is not None:
        updates["login"] = payload.login.strip().lower() if payload.login else None
    if payload.url is not None:
        updates["url"] = payload.url.strip() if payload.url else None
        updates["domain"] = normalize_domain(updates["url"]) if updates["url"] else None

    for k in ["salt", "iv", "ciphertext"]:
        v = getattr(payload, k)
        if v is not None:
            updates[k] = v

    if not updates:
        return {"ok": True}

    eff_login = updates.get("login", cur.get("login"))
    eff_domain = updates.get("domain", cur.get("domain"))
    if not force:
        _preflight_dupe_check(_oid(user["_id"]), eff_domain, eff_login, exclude_id=oid)

    updates["updatedAt"] = _now_utc()
    COLL.update_one({"_id": oid, "userId": _oid(user["_id"])}, {"$set": updates})
    return {"ok": True}


@router.get("/by-domain/{domain}", response_model=List[VaultOut], summary="List entries for a domain")
def list_by_domain(domain: str, user=Depends(get_current_user)):
    d = normalize_domain(domain)
    cur = COLL.find({"userId": _oid(user["_id"]), "domain": d}).sort("label", 1)
    return [VaultOut(**_serialize(x)) for x in cur]


@router.get("/suggest", response_model=SuggestOut, summary="Suggest matching/near-matching entries for a URL")
def suggest_for_url(url: str = Query(..., description="Full URL or hostname"), user=Depends(get_current_user)):
    user_id = _oid(user["_id"])
    d = normalize_domain(url)
    exact = list(COLL.find({"userId": user_id, "domain": d}))
    near = []
    if d:
        near = list(COLL.find({
            "userId": user_id,
            "domain": {"$exists": True, "$type": "string"},
            "domain": {"$regex": f"{d}$"}
        }))
        exact_ids = {str(x["_id"]) for x in exact}
        near = [n for n in near if str(n["_id"]) not in exact_ids]

    return {
        "domain": d,
        "exact": [VaultOut(**_serialize(x)) for x in exact],
        "near": [VaultOut(**_serialize(x)) for x in near],
    }

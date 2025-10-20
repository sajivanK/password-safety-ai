# backend/auth_routes.py
"""
👤 User Registration API
Stores user info in MongoDB and checks password safety via Pattern + Coach agents.
"""

from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordRequestForm
from auth_utils import hash_password, verify_password, create_access_token, decode_token

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from database import db
from agents.new_advisor import pattern_agent, coach_agent

from pymongo.errors import DuplicateKeyError

from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from auth_utils import hash_password, verify_password, create_access_token



router = APIRouter(prefix="/auth", tags=["Authentication"])

# Ensure unique username index (idempotent)
try:
    db.users.create_index("username", unique=True)
except Exception as e:
    print("Index ensure warning:", e)


def get_current_user(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    claims = decode_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.users.find_one({"_id": ObjectId(claims["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "status": user.get("status", "normal"),
        "name": user.get("name"),
        "email": user.get("email"),
        "phone": user.get("phone"),
    }



# ---------- Data Model ----------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    phone: str
    username: str
    password: str
    confirm_password: str
    
# IMPORTANT: ignore unknown fields (so old frontends that still send "status" won't break)
    model_config = {"extra": "ignore"}

# ---------- Helper ----------
def user_exists(username: str):
    return db.users.find_one({"username": username})

# ---------- API Endpoint ---------
@router.post("/register")
def register_user(data: RegisterInput):
    try:
        if data.password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match ❌")

        if db.users.find_one({"username": data.username}):
            raise HTTPException(status_code=400, detail="Username already exists")

        # Run advisors (unchanged)
        features = pattern_agent.extract_features(data.password)
        tips = coach_agent.rule_based_tips(features, habits=[])

        from auth_utils import hash_password
        hashed = hash_password(data.password)

        # ⬇️ always save new users as NORMAL
        doc = {
            "name": data.name,
            "email": str(data.email),
            "phone": data.phone,
            "username": data.username,
            "password_hash": hashed,
            "status": "normal",  # <— forced here
        }

        res = db.users.insert_one(doc)

        return {
            "message": "User registered successfully ✅",
            "user_id": str(res.inserted_id),
            "password_tips": tips,
        }

    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Username already exists")
    except HTTPException:
        raise
    except Exception as e:
        print("Register error:", repr(e))
        raise HTTPException(status_code=500, detail=f"Register failed: {e}")


    
    
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2-compatible login.
    Accept legacy hashes (bcrypt / bcrypt_sha256) or even plain 'password' field,
    and migrate to PBKDF2 on successful login.
    """
    user = db.users.find_one({"username": form_data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored_hash = user.get("password_hash", "")
    ok = False

    # 1) Try current PBKDF2 verifier first
    try:
        if stored_hash:
            ok = verify_password(form_data.password, stored_hash)
    except UnknownHashError:
        ok = False
    except Exception:
        ok = False

    # 2) If not OK, try legacy schemes (bcrypt / bcrypt_sha256 / pbkdf2_sha256)
    if not ok and stored_hash:
        try:
            legacy_ctx = CryptContext(schemes=["pbkdf2_sha256", "bcrypt", "bcrypt_sha256"], deprecated="auto")
            ok = legacy_ctx.verify(form_data.password, stored_hash)
        except Exception:
            ok = False

    # 3) If still not OK, last resort: maybe the DB still has a plain 'password' field (pre-hash)
    if not ok and "password" in user:
        ok = (form_data.password == user["password"])

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 4) If login succeeded via legacy or plain, migrate to PBKDF2 and remove plaintext
    try:
        new_hash = hash_password(form_data.password)
        update_ops = {"$set": {"password_hash": new_hash}}
        if "password" in user:
            update_ops["$unset"] = {"password": ""}  # remove plaintext if present
        db.users.update_one({"_id": user["_id"]}, update_ops)
    except Exception:
        # non-fatal: if migration fails, still allow login this time
        pass

    # 5) Issue token
    token = create_access_token({
        "sub": str(user["_id"]),
        "username": user["username"],
        "status": user.get("status", "normal"),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "status": user.get("status", "normal"),
        "username": user["username"],
        "name": user.get("name"),
    }

    
    
@router.get("/me")
def me(current = Depends(get_current_user)):
    return {"ok": True, "user": current}


class ChangePasswordInput(BaseModel):
    new_password: str
    confirm_password: str

@router.put("/change-password")
def change_password(body: ChangePasswordInput, current = Depends(get_current_user)):
    # 1) match check
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match ❌")

    # 2) run Pattern + Coach for tips (no raw storage)
    features = pattern_agent.extract_features(body.new_password)
    tips = coach_agent.rule_based_tips(features, habits=[])

    # 3) hash and update
    from auth_utils import hash_password
    hashed = hash_password(body.new_password)
    db.users.update_one(
        {"_id": ObjectId(current["id"])},
        {"$set": {"password_hash": hashed}}
    )

    return {
        "message": "Password updated successfully ✅",
        "features": features,
        "tips": tips,
        "note": "We analyzed only safe patterns — never your real password."
    }



class UpdateProfileInput(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    status: str | None = None  # "normal" | "premium"

@router.get("/profile")
def get_profile(current = Depends(get_current_user)):
    # Return whatever we already assembled in get_current_user
    return {"ok": True, "profile": current}
    
@router.put("/profile")
def update_profile(body: UpdateProfileInput, current = Depends(get_current_user)):
    updates = {}

    if body.name is not None:
        updates["name"] = body.name

    if body.email is not None:
        # Optional: ensure not taken by another user
        exists = db.users.find_one({"email": str(body.email), "_id": {"$ne": ObjectId(current["id"])}})
        if exists:
            raise HTTPException(status_code=400, detail="Email already in use")
        updates["email"] = str(body.email)

    if body.phone is not None:
        updates["phone"] = body.phone

    if body.status is not None:
        if body.status not in ("normal", "premium"):
            raise HTTPException(status_code=400, detail="Status must be 'normal' or 'premium'")
        updates["status"] = body.status

    if not updates:
        return {"ok": True, "message": "Nothing to update"}

    db.users.update_one({"_id": ObjectId(current["id"])}, {"$set": updates})

    # return refreshed view
    user = db.users.find_one({"_id": ObjectId(current["id"])})
    return {
        "ok": True,
        "message": "Profile updated ✅",
        "profile": {
            "id": str(user["_id"]),
            "username": user["username"],
            "status": user.get("status", "normal"),
            "name": user.get("name"),
            "email": user.get("email"),
            "phone": user.get("phone"),
        },
    }

@router.put("/upgrade-to-premium")
def upgrade_to_premium(current = Depends(get_current_user)):
    """
    Mark the current user as premium.
    (Payment integration will call this after success.)
    """
    db.users.update_one(
        {"_id": ObjectId(current["id"])},
        {"$set": {"status": "premium"}}
    )

    # return refreshed view
    user = db.users.find_one({"_id": ObjectId(current["id"])})
    return {
        "ok": True,
        "message": "Upgraded to Premium ✅",
        "profile": {
            "id": str(user["_id"]),
            "username": user["username"],
            "status": user.get("status", "normal"),
            "name": user.get("name"),
            "email": user.get("email"),
            "phone": user.get("phone"),
        },
    }



class DeleteAccountInput(BaseModel):
    current_password: str
    confirm: bool = True  # must be true to proceed

@router.delete("/delete-account")
def delete_account(body: DeleteAccountInput, current = Depends(get_current_user)):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Please confirm delete_account=true")

    # fetch full user doc to verify password
    user = db.users.find_one({"_id": ObjectId(current["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid password")

    # delete user
    db.users.delete_one({"_id": ObjectId(current["id"])})

    # (Optional) clear any in-memory traces (advisor demo store)
    try:
        from agents.advisor import USER_FEATURE_HISTORY
        USER_FEATURE_HISTORY.pop(current["username"], None)
    except Exception:
        pass

    return {"ok": True, "message": "Account deleted permanently ✅"}



from datetime import datetime, timedelta

@router.put("/upgrade-to-premium")
def upgrade_to_premium(current = Depends(get_current_user)):
    """
    Mark the current user as premium for 30 days.
    Automatically stores expiry date in MongoDB.
    """
    expiry_date = datetime.utcnow() + timedelta(days=30)

    db.users.update_one(
        {"_id": ObjectId(current["id"])},
        {"$set": {"status": "premium", "premium_expires_at": expiry_date}}
    )

    user = db.users.find_one({"_id": ObjectId(current["id"])})

    return {
        "ok": True,
        "message": f"Upgraded to Premium ✅ (valid until {expiry_date.strftime('%Y-%m-%d')})",
        "profile": {
            "id": str(user["_id"]),
            "username": user["username"],
            "status": user.get("status", "normal"),
            "premium_expires_at": expiry_date.isoformat(),
            "name": user.get("name"),
            "email": user.get("email"),
            "phone": user.get("phone"),
        },
    }

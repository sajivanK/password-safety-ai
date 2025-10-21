# backend/auth_routes.py
"""
👤 Authentication Routes
- Email unique & normalized (lowercase).
- Login accepts Username OR Email (email matched lowercase).
- Register & change-password regenerate memory story (safe tokens only).
- change_password uses current["id"] instead of _id and verifies current_password first.
- PUT /auth/edit-profile supports updating username (unique), name, email, phone.
- POST /auth/upgrade and PUT /auth/upgrade-to-premium set current user to 'premium'.
- 🆕 DELETE /auth/delete-account removes the user and their related records.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from typing import Optional

from database import db
from auth_utils import hash_password, verify_password, create_access_token, decode_token
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from pymongo.errors import DuplicateKeyError

from agents.new_advisor import pattern_agent, coach_agent
from agents.new_advisor import story_agent  # story generator/saver

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------- index helper ----------
def _ensure_unique_index(collection, field: str, name: str):
    try:
        existing = list(collection.list_indexes())
        for idx in existing:
            keys = idx.get("key", {})
            if list(keys.keys()) == [field]:
                if idx.get("unique", False):
                    return
                print(f"⚠️ Existing index on '{field}' is not unique. Consider fixing manually.")
                return
        collection.create_index([(field, 1)], name=name, unique=True, background=True)
    except Exception as e:
        msg = str(e)
        if "IndexOptionsConflict" in msg or "already exists" in msg:
            return
        print(f"⚠️ ensure_unique_index('{field}') error:", e)

_ensure_unique_index(db.users, "username", name="uniq_username")
_ensure_unique_index(db.users, "email",    name="uniq_email")

# ---------- helpers ----------
def get_current_user(authorization: str = Header(default=None)):
    """
    Returns:
      { "id": str(ObjectId), "username": ..., "status": ..., "name": ..., "email": ..., "phone": ... }
    NOTE: id key is 'id'.
    """
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

# ---------- models ----------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    phone: str
    username: str
    password: str
    confirm_password: str
    model_config = {"extra": "ignore"}

class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class EditProfileInput(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    username: str  # editable & unique

# 🆕 Optional payload for delete (current password verification)
class DeleteAccountInput(BaseModel):
    current_password: Optional[str] = None

# ---------- routes ----------
@router.post("/register")
def register_user(data: RegisterInput):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match ❌")

    email_lc = str(data.email).strip().lower()
    username = data.username.strip()

    if db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.users.find_one({"email": email_lc}):
        raise HTTPException(status_code=400, detail="Email already exists")

    features = pattern_agent.extract_features(data.password)
    tips = coach_agent.rule_based_tips(features, habits=[])

    hashed = hash_password(data.password)
    doc = {
        "name": data.name.strip(),
        "email": email_lc,
        "phone": data.phone.strip(),
        "username": username,
        "password_hash": hashed,
        "status": "normal",
    }
    try:
        res = db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Username or Email already exists")

    user_id = str(res.inserted_id)

    try:
        out = story_agent.generate_story_for_password(data.password)
        story_agent.save_for_user(user_id, out["story"])
    except Exception as e:
        print("⚠️ Story generation failed on register:", e)

    return {"message": "User registered successfully ✅", "user_id": user_id, "password_tips": tips}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 'username' accepts username OR email. Email matched lowercase.
    """
    identifier = form_data.username.strip()
    query = {"email": identifier.lower()} if "@" in identifier else {"username": identifier}
    user = db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored_hash = user.get("password_hash", "")
    ok = False
    try:
        if stored_hash:
            ok = verify_password(form_data.password, stored_hash)
    except UnknownHashError:
        ok = False
    except Exception:
        ok = False

    if not ok and stored_hash:
        try:
            legacy_ctx = CryptContext(schemes=["pbkdf2_sha256","bcrypt","bcrypt_sha256"], deprecated="auto")
            ok = legacy_ctx.verify(form_data.password, stored_hash)
        except Exception:
            ok = False

    if not ok and "password" in user:
        ok = (form_data.password == user["password"])

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # migrate to current hash if needed
    try:
        new_hash = hash_password(form_data.password)
        ops = {"$set": {"password_hash": new_hash}}
        if "password" in user:
            ops["$unset"] = {"password": ""}
        db.users.update_one({"_id": user["_id"]}, ops)
    except Exception:
        pass

    token = create_access_token({
        "sub": str(user["_id"]),
        "username": user["username"],
        "status": user.get("status", "normal"),
    })

    return {"access_token": token, "token_type": "bearer", "status": user.get("status", "normal"),
            "username": user["username"], "name": user.get("name")}

@router.get("/me")
def me(current = Depends(get_current_user)):
    return {"ok": True, "user": current}

@router.put("/change-password")
def change_password(body: ChangePasswordInput, current = Depends(get_current_user)):
    user = db.users.find_one({"_id": ObjectId(current["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stored_hash = user.get("password_hash", "")
    ok = False
    try:
        if stored_hash:
            ok = verify_password(body.current_password, stored_hash)
    except UnknownHashError:
        ok = False
    except Exception:
        ok = False

    if not ok and stored_hash:
        try:
            legacy_ctx = CryptContext(schemes=["pbkdf2_sha256","bcrypt","bcrypt_sha256"], deprecated="auto")
            ok = legacy_ctx.verify(body.current_password, stored_hash)
        except Exception:
            ok = False

    if not ok and "password" in user:
        ok = (body.current_password == user["password"])

    if not ok:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match ❌")

    try:
        if stored_hash and verify_password(body.new_password, stored_hash):
            raise HTTPException(status_code=400, detail="New password must be different from the current password")
    except Exception:
        pass

    new_hash = hash_password(body.new_password)
    update_ops = {"$set": {"password_hash": new_hash}}
    if "password" in user:
        update_ops["$unset"] = {"password": ""}
    db.users.update_one({"_id": user["_id"]}, update_ops)

    try:
        out = story_agent.generate_story_for_password(body.new_password)
        story_agent.save_for_user(current["id"], out["story"])
    except Exception as e:
        print("⚠️ Story generation failed on change-password:", e)

    features = pattern_agent.extract_features(body.new_password)
    tips = coach_agent.rule_based_tips(features, habits=[])

    return {"message": "Password updated successfully ✅", "features": features, "tips": tips,
            "note": "We analyzed only safe patterns — never your real password."}

@router.put("/edit-profile")
def edit_profile(body: EditProfileInput, current = Depends(get_current_user)):
    uid = ObjectId(current["id"])
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    name = body.name.strip()
    email_lc = str(body.email).strip().lower()
    phone = (body.phone or "").strip()
    username = body.username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    if email_lc != (user.get("email") or "").lower():
        if db.users.find_one({"email": email_lc, "_id": {"$ne": uid}}):
            raise HTTPException(status_code=400, detail="Email already in use")

    if username != user.get("username"):
        if db.users.find_one({"username": username, "_id": {"$ne": uid}}):
            raise HTTPException(status_code=400, detail="Username already in use")

    db.users.update_one(
        {"_id": uid},
        {"$set": {"name": name, "email": email_lc, "phone": phone, "username": username}}
    )

    updated = db.users.find_one({"_id": uid}, {"password_hash": 0})
    return {
        "ok": True,
        "user": {
            "id": str(updated["_id"]),
            "username": updated["username"],
            "status": updated.get("status", "normal"),
            "name": updated.get("name"),
            "email": updated.get("email"),
            "phone": updated.get("phone"),
        },
        "message": "Profile updated successfully ✅"
    }

# ---------- PREMIUM UPGRADE ----------
def _upgrade_user_to_premium(current):
    uid = ObjectId(current["id"])
    res = db.users.update_one({"_id": uid}, {"$set": {"status": "premium"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = db.users.find_one({"_id": uid})
    token = create_access_token({
        "sub": str(user["_id"]),
        "username": user["username"],
        "status": user.get("status", "premium"),
    })
    return {"ok": True, "status": user.get("status", "premium"), "access_token": token}

@router.post("/upgrade")
def upgrade_post(current = Depends(get_current_user)):
    return _upgrade_user_to_premium(current)

@router.put("/upgrade-to-premium")
def upgrade_put_alias(current = Depends(get_current_user)):
    return _upgrade_user_to_premium(current)

# ---------- 🆕 DELETE ACCOUNT ----------
@router.delete("/delete-account")
def delete_account(body: DeleteAccountInput = DeleteAccountInput(), current = Depends(get_current_user)):
    """
    Deletes the current user's account and related data.
    - If current_password is provided, verify it before deleting.
    - Removes user record and story mnemonics. (Extend here if you have more user-linked collections.)
    """
    uid = ObjectId(current["id"])
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Optional current password verification (recommended if your UI asks for it)
    if body and body.current_password:
        stored_hash = user.get("password_hash", "")
        ok = False
        try:
            if stored_hash:
                ok = verify_password(body.current_password, stored_hash)
        except Exception:
            ok = False
        if not ok and "password" in user:
            ok = (body.current_password == user["password"])
        if not ok:
            raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Delete related records (mnemonics etc.)
    try:
        db["mnemonics"].delete_many({"userId": uid})
    except Exception:
        pass

    # If you have additional user-owned collections, clean them here:
    # try: db["vault_items"].delete_many({"userId": uid}) except: pass
    # try: db["sessions"].delete_many({"userId": uid}) except: pass

    # Finally, delete user
    db.users.delete_one({"_id": uid})

    return {"ok": True, "message": "Account deleted permanently"}

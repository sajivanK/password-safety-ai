# backend/premium_guard.py
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
from bson import ObjectId
from datetime import datetime, timezone
from database import db
import os

# --------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")


def _oid(v):
    """Ensure value is an ObjectId."""
    return v if isinstance(v, ObjectId) else ObjectId(str(v))


# --------------------------------------------------------------------
# Premium User Guard
# --------------------------------------------------------------------
def require_premium_user(authorization: str = Header(default=None)):
    """
    ✅ Validates Bearer token & checks premium status.

    🔹 In production:
        - Decodes JWT and ensures the user in DB has status='premium'
        - Checks optional 'premium_until' expiry
    🔹 In local testing:
        - If Authorization: Bearer testtoken → always treated as premium
    """

    # --------------------------------------------------
    # 🧩 Local development bypass (for dashboard/orchestrator testing)
    # --------------------------------------------------
    if authorization and authorization.strip() == "Bearer testtoken":
        # ⚠️ Bypass only when running locally (localhost / 127.*)
        return {
            "_id": "local-test-user",
            "email": "dev@localhost",
            "status": "premium",
            "note": "Local testtoken bypass active"
        }

    # --------------------------------------------------
    # 🧠 Real token validation (production mode)
    # --------------------------------------------------
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token"
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("sub") or payload.get("_id") or payload.get("user_id")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    # Lookup user from MongoDB
    user = db["users"].find_one({"_id": _oid(uid)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Check plan status
    status_val = user.get("status", "normal")
    if status_val.lower() != "premium":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium plan required"
        )

    # Check premium expiration (if any)
    premium_until = user.get("premium_until")
    if premium_until:
        if isinstance(premium_until, str):
            try:
                premium_until = datetime.fromisoformat(
                    premium_until.replace("Z", "+00:00")
                )
            except Exception:
                premium_until = None

        if premium_until and premium_until.astimezone(timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Premium has expired"
            )

    # ✅ Return minimal user info for dependency
    return {
        "_id": str(user["_id"]),
        "email": user.get("email"),
        "status": status_val
    }

import os
import hashlib
import requests
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional

# ✅ import Guardian with an alias to avoid name clash
from agents.guardian import analyze_password as guardian_analyze, PasswordInput as GuardianInput
from premium_guard import require_premium_user

router = APIRouter()

# Toggle for auth requirement (kept; not used for the premium combo route)
WATCHDOG_REQUIRE_AUTH = os.getenv("WATCHDOG_REQUIRE_AUTH", "0").lower() in ("1", "true", "yes")


# ---------- Input model ----------
class PasswordInput(BaseModel):
    password: str


# ---------- HIBP breach check helper ----------
def check_password_breach(password: str):
    try:
        sha1_hash = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = sha1_hash[:5], sha1_hash[5:]

        url = f"https://api.pwnedpasswords.com/range/{prefix}"
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="HIBP API error")

        count = 0
        for line in resp.text.splitlines():
            parts = line.split(":")
            if len(parts) != 2:
                continue
            hash_suffix, cnt = parts
            if hash_suffix == suffix:
                try:
                    count = int(cnt)
                except Exception:
                    count = 0
                break

        breached = count > 0
        if not breached:
            risk_level = "None"
            recommendation = "This password was not found in breaches ✅"
        elif count < 10:
            risk_level = "Low"
            recommendation = "This password has been leaked a few times. Consider changing it."
        elif count < 1000:
            risk_level = "Medium"
            recommendation = "This password appears in breach data. Avoid reusing it."
        else:
            risk_level = "High"
            recommendation = "⚠️ This password has been leaked many times. Change it immediately!"

        return {
            "breached": breached,
            "count": count,
            "risk_level": risk_level,
            "recommendation": recommendation,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Watchdog internal error: {str(e)}")


# ---------- Existing /check-breach route (dev-friendly) ----------
if WATCHDOG_REQUIRE_AUTH:
    @router.post("/check-breach")
    def breach_check(payload: PasswordInput, user=Depends(require_premium_user)):
        return check_password_breach(payload.password)
else:
    @router.post("/check-breach")
    def breach_check(payload: PasswordInput, authorization: Optional[str] = Header(default=None)):
        # dev mode: no auth enforced
        return check_password_breach(payload.password)


# ===============================================================
# ✅ Premium combo route — Guardian (strength) + Watchdog (breach)
# ===============================================================
@router.post("/analyze-password")
def premium_analyze_password(payload: PasswordInput, user=Depends(require_premium_user)):
    """
    Combine Guardian strength + Watchdog breach for premium users.
    """
    pw = (payload.password or "").strip()
    if not pw:
        raise HTTPException(status_code=400, detail="Password cannot be empty")

    # 1) Guardian
    # Guardian analyzer expects its own Pydantic model in your repo
    g = guardian_analyze(GuardianInput(password=pw))
    # Normalize Guardian result -> always {score, feedback}
    if isinstance(g, dict) and "strength" in g:
        strength = {
            "score": int((g.get("strength") or {}).get("score", 0) or 0),
            "feedback": (g.get("strength") or {}).get("feedback") or {},
        }
    else:
        strength = {
            "score": int(g.get("score", 0) or 0),
            "feedback": g.get("feedback") or {},
        }

    # 2) Watchdog (breach)
    breach = check_password_breach(pw)

    # 3) Safety score (simple scheme)
    # base 25 per strength point, +25 bonus if not breached
    safety_score = min(100, strength["score"] * 25 + (0 if breach["breached"] else 25))

    return {
        "password": pw,
        "strength": strength,          # {score, feedback{warning, suggestions}}
        "breach": breach,              # {breached, count, risk_level, recommendation}
        "safety_score": safety_score,  # 0..100
        "note": "Combined Guardian + Watchdog premium password analysis.",
    }

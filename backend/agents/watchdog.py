import hashlib
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Import Guardian functions
from agents.guardian import analyze_password as guardian_analyze, PasswordInput

router = APIRouter()


# -------- Helper Functions --------

def check_password_breach(password: str):
    """Check password against HaveIBeenPwned API"""
    try:
        # Step 1: Hash password
        sha1_hash = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = sha1_hash[:5], sha1_hash[5:]

        # Step 2: Call HIBP API
        url = f"https://api.pwnedpasswords.com/range/{prefix}"
        response = requests.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="HIBP API error")

        # Step 3: Check if suffix in response
        hashes = (line.split(":") for line in response.text.splitlines())
        count = 0
        for hash_suffix, c in hashes:
            if hash_suffix == suffix:
                count = int(c)
                break

        breached = count > 0

        # Risk levels
        if not breached:
            risk_level = "None"
            recommendation = "This password was not found in breaches ✅"
        elif count < 10:
            risk_level = "Low"
            recommendation = "This password has been leaked a few times. Better to change it."
        elif count < 1000:
            risk_level = "Medium"
            recommendation = "This password is somewhat risky. Please avoid reusing it."
        else:
            risk_level = "High"
            recommendation = "⚠️ This password has been leaked many times. Change it immediately!"

        return {
            "breached": breached,
            "count": count,
            "risk_level": risk_level,
            "recommendation": recommendation
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def calculate_safety_score(strength_score: int, breach_count: int) -> int:
    """Compute password safety score out of 100"""
    # Convert zxcvbn score (0–4) into 0–80
    base_score = strength_score * 20

    # Deduct points based on breach severity
    if breach_count == 0:
        penalty = 0
    elif breach_count < 10:
        penalty = 10
    elif breach_count < 1000:
        penalty = 30
    else:
        penalty = 50

    final_score = max(0, base_score - penalty)
    return final_score


# -------- API Endpoints --------

@router.post("/check-breach")
def breach_check(data: PasswordInput):
    """Standalone breach check"""
    return check_password_breach(data.password)


@router.post("/analyze-password")
def full_report(data: PasswordInput):
    """Combined Guardian + Watchdog + Safety Score"""
    # Get Guardian result
    guardian_result = guardian_analyze(data)

    # Get Watchdog result
    watchdog_result = check_password_breach(data.password)

    # Calculate final score
    safety_score = calculate_safety_score(
        guardian_result["score"], watchdog_result["count"]
    )

    return {
        "password": data.password,
        "strength": guardian_result,
        "breach": watchdog_result,
        "safety_score": safety_score
    }

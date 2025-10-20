from fastapi import APIRouter
from pydantic import BaseModel
from zxcvbn import zxcvbn

router = APIRouter()

class PasswordInput(BaseModel):
    password: str


@router.post("/analyze-password")
def analyze_password(data: PasswordInput):
    """
    Analyze password strength using zxcvbn.
    Returns score (0–4), feedback, warning, and suggestions.
    Also computes a normalized safety_score (0–100).
    """

    # --- Run zxcvbn analysis ---
    result = zxcvbn(data.password)

    # --- Extract main components ---
    score = result.get("score", 0)  # 0–4
    feedback = result.get("feedback", {}) or {}

    # 🟡 Added: default fallbacks so dashboard never breaks
    warning = feedback.get("warning") or "None"
    suggestions = feedback.get("suggestions", []) or []

    # --- Compute safety score ---
    # 4 * 25 = 100 max
    safety_score = min(100, (score or 0) * 25)

    # 🟢 Added: structured and consistent format
    return {
        "password": data.password,
        "strength": {
            "score": score,
            "feedback": {
                "warning": warning,
                "suggestions": suggestions,
            },
        },
        "safety_score": safety_score,
        # 🟣 Added: optional text summary for debugging or display
        "note": "This analysis checks common patterns, dictionary words, and entropy strength.",
    }

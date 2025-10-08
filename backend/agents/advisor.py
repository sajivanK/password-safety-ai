# backend/agents/advisor.py
"""
🤝 Advisor Controller
This combines Pattern Agent, Behavior Agent, and Coach Agent.
Each can work alone or together safely.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.new_advisor import pattern_agent, behavior_agent, coach_agent

router = APIRouter()

# ---------- Data Models ----------
class PasswordInput(BaseModel):
    password: str

# In-memory temporary store for user patterns (simulate behavior tracking)
# ⚠️ Not persistent; only for demonstration, never stores real passwords.
USER_FEATURE_HISTORY = {}

# ---------- Endpoints ----------

@router.post("/pattern")
def analyze_pattern(data: PasswordInput):
    """Step 1: Extract safe password features."""
    return pattern_agent.extract_features(data.password)

@router.post("/behavior")
def analyze_behavior(username: str):
    """
    Step 2: Analyze habits based on previously stored feature history.
    Normally, you'd use a user_id from the database.
    """
    user_features = USER_FEATURE_HISTORY.get(username, [])
    habits = behavior_agent.detect_habits(user_features)
    return {"username": username, "habits": habits}

@router.post("/coach")
def generate_tips(data: PasswordInput, username: str = "guest"):
    """
    Step 3: Full pipeline — Pattern + Behavior + Coach.
    Extract features → detect habits → generate Gemini tips.
    """
    # Step 1: extract features (safe)
    features = pattern_agent.extract_features(data.password)

    # Store for this user
    if username not in USER_FEATURE_HISTORY:
        USER_FEATURE_HISTORY[username] = []
    USER_FEATURE_HISTORY[username].append(features)

    # Step 2: detect habits
    habits = behavior_agent.detect_habits(USER_FEATURE_HISTORY[username])

    # Step 3: coach advice (use internal Gemini logic directly)
    tips = coach_agent.gemini_tips(features, habits)
    note = "We never store or share your password — only safe patterns are analyzed."

    output = {"tips": tips, "note": note}


    return {
        "features": features,
        "habits": habits,
        "coach": output,
    }

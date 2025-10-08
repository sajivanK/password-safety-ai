# backend/agents/new_advisor/coach_agent.py
"""
🧑‍🏫 Coach Agent
Takes input from Pattern Agent (features) + Behavior Agent (habits)
and generates human-friendly password improvement tips.

Uses Gemini for smart suggestions.
Falls back to rule-based tips if Gemini is unavailable.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
import os

router = APIRouter()

# Configure Gemini safely
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
except Exception as e:
    print("⚠️ Gemini not configured:", e)

# ---------- Input / Output ----------
class CoachInput(BaseModel):
    features: dict
    habits: list[str]

class CoachOutput(BaseModel):
    tips: list[str]
    note: str

# ---------- Fallback rule-based generator ----------
def rule_based_tips(features: dict, habits: list[str]) -> list[str]:
    tips = []

    # From features
    if features["length"] < 12:
        tips.append("Use 12–16 characters for better strength.")
    if not features["has_symbol"]:
        tips.append("Add at least one symbol like ! or #.")
    if not features["has_digit"]:
        tips.append("Include numbers (0–9) to improve complexity.")
    if not features["has_upper"]:
        tips.append("Add uppercase letters for stronger variation.")

    # From habits
    if "ends_with_numbers" in habits:
        tips.append("Avoid always ending with numbers; mix them inside.")
    if "uses_common_words" in habits:
        tips.append("Avoid using common words like 'password' or 'laptop'.")
    if "makes_passwords_too_short" in habits:
        tips.append("Try longer passwords or use a 3–4 word passphrase.")

    if not tips:
        tips.append("Your habits look good! Keep maintaining password diversity.")

    return tips[:5]

# ---------- Gemini-based generator ----------
def gemini_tips(features: dict, habits: list[str]) -> list[str]:
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
        You are a password safety advisor AI.
        The user’s password features: {features}
        The user's habits: {habits}

        Generate 3–5 short, clear, friendly tips to improve password safety.
        Never repeat the raw password, only refer to habits/features.
        Keep it safe, helpful, and professional.
        """
        response = model.generate_content(prompt)
        text = response.text.strip()
        tips = [line.strip("-• ").strip() for line in text.split("\n") if line.strip()]
        return tips[:5]
    except Exception as e:
        print("⚠️ Gemini fallback due to error:", e)
        return rule_based_tips(features, habits)

# ---------- API Endpoint ----------
@router.post("/coach-tips", response_model=CoachOutput)
def coach_agent(data: CoachInput):
    """
    Combines Pattern Agent features + Behavior Agent habits,
    generates friendly password safety tips using Gemini or fallback rules.
    """
    tips = gemini_tips(data.features, data.habits)
    note = "We never store or share your password — only safe patterns are analyzed."
    return {"tips": tips, "note": note}

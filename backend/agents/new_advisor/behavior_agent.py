# backend/agents/new_advisor/behavior_agent.py
"""
👁️ User Behavior Agent
This agent observes multiple password attempts by the same user
(using only extracted safe features) and identifies common habits.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# ---------- Input / Output Models ----------
class FeatureInput(BaseModel):
    features: list[dict]  # list of feature dicts from Pattern Agent

class BehaviorOutput(BaseModel):
    habits: list[str]

# ---------- Main Logic ----------
def detect_habits(feature_list: list[dict]) -> list[str]:
    if not feature_list:
        return ["no_data"]

    habits = set()

    # If most passwords are short
    short_count = sum(1 for f in feature_list if f["length"] < 8)
    if short_count / len(feature_list) > 0.6:
        habits.add("makes_passwords_too_short")

    # If often ends with numbers
    end_num_count = sum(1 for f in feature_list if f.get("ends_with_numbers"))
    if end_num_count / len(feature_list) > 0.6:
        habits.add("ends_with_numbers")

    # If commonly uses years
    year_count = sum(1 for f in feature_list if f.get("contains_year"))
    if year_count / len(feature_list) > 0.4:
        habits.add("uses_years")

    # If uses common words frequently
    word_count = sum(1 for f in feature_list if f.get("common_words"))
    if word_count / len(feature_list) > 0.4:
        habits.add("uses_common_words")

    # If lacks symbols often
    no_symbol_count = sum(1 for f in feature_list if not f.get("has_symbol"))
    if no_symbol_count / len(feature_list) > 0.6:
        habits.add("rarely_uses_symbols")

    return sorted(list(habits))

# ---------- API Endpoint ----------
@router.post("/analyze-behavior", response_model=BehaviorOutput)
def analyze_behavior(data: FeatureInput):
    """
    Accepts a list of password features (not raw passwords),
    identifies repeating patterns or habits, and returns a list.
    """
    habits = detect_habits(data.features)
    return {"habits": habits}

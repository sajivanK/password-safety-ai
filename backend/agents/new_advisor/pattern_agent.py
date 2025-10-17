# backend/agents/new_advisor/pattern_agent.py
"""
🕵️ Pattern Agent
This agent identifies risky patterns in a given password safely
without ever storing or exposing the real password.
"""

import re
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# ---------- Input / Output Models ----------
class PasswordInput(BaseModel):
    password: str

class PatternOutput(BaseModel):
    length: int
    has_upper: bool
    has_lower: bool
    has_digit: bool
    has_symbol: bool
    contains_year: bool
    ends_with_numbers: bool
    common_words: list[str]

# ---------- Common word list ----------
COMMON_WORDS = {"password", "laptop", "admin", "user", "qwerty", "welcome", "test"}

# ---------- Helper Function ----------
def extract_features(pwd: str) -> dict:
    # Safe feature extraction (no storage, no leaks)
    features = {
        "length": len(pwd),
        "has_upper": any(c.isupper() for c in pwd),
        "has_lower": any(c.islower() for c in pwd),
        "has_digit": any(c.isdigit() for c in pwd),
        "has_symbol": any(not c.isalnum() for c in pwd),
        "contains_year": bool(re.search(r"(19|20)\d{2}", pwd)),
        "ends_with_numbers": bool(re.search(r"\d+$", pwd)),
        "common_words": [w for w in COMMON_WORDS if w.lower() in pwd.lower()],
    }
    return features

# ---------- API Endpoint ----------
@router.post("/extract-pattern", response_model=PatternOutput)
def pattern_agent(data: PasswordInput):
    """
    Accepts a password input, extracts safe structural features,
    and returns them in JSON (without saving the password).
    """
    features = extract_features(data.password)
    return features

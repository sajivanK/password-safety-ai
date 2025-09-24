# backend/agents/advisor.py
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class PasswordInput(BaseModel):
    password: str

def make_tips(pwd: str) -> list[str]:
    tips = []

    # Length checks
    if len(pwd) < 8:
        tips.append("Password is too short. Use at least 8–12 characters.")
    elif len(pwd) < 12:
        tips.append("Good start. Make it 12+ characters for more safety.")

    # Character variety checks
    if pwd.lower() == pwd:
        tips.append("Add UPPERCASE letters.")
    if pwd.upper() == pwd:
        tips.append("Add lowercase letters.")
    if not any(c.isdigit() for c in pwd):
        tips.append("Add numbers (0–9).")
    if not any(c in "!@#$%^&*()-_=+[]{};:,.<>?/" for c in pwd):
        tips.append("Add symbols (e.g., !@#$).")

    # Simple pattern checks
    if pwd.isalpha():
        tips.append("Avoid letters only. Mix numbers & symbols.")
    if pwd.isdigit():
        tips.append("Avoid numbers only. Add letters & symbols.")
    if "password" in pwd.lower():
        tips.append("Avoid common words like 'password'.")
    if any(seq in pwd for seq in ["1234", "0000", "1111", "abcd"]):
        tips.append("Avoid simple sequences like 1234 or abcd.")

    # If no tips, it's already good
    if not tips:
        tips.append("Great! Your password looks strong ✅")

    return tips

@router.post("/tips")
def give_tips(data: PasswordInput):
    return {
        "password": data.password,
        "tips": make_tips(data.password)
    }

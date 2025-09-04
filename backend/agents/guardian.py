from fastapi import APIRouter
from pydantic import BaseModel
from zxcvbn import zxcvbn

# Create a router for Guardian
router = APIRouter()

# Request body schema
class PasswordInput(BaseModel):
    password: str

@router.post("/analyze-password")
def analyze_password(data: PasswordInput):
    result = zxcvbn(data.password)
    return {
        "password": data.password,
        "score": result["score"],  # 0 (weak) → 4 (strong)
        "feedback": result["feedback"],  # suggestions & warnings
    }

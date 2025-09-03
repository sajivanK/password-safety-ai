from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from zxcvbn import zxcvbn

app = FastAPI()

# Allow frontend (Next.js) to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request body schema
class PasswordInput(BaseModel):
    password: str

@app.get("/")
def root():
    return {"message": "Password Safety Backend is running 🚀"}

@app.post("/analyze-password")
def analyze_password(data: PasswordInput):
    result = zxcvbn(data.password)
    return {
        "password": data.password,
        "score": result["score"],  # 0 (weak) → 4 (strong)
        "feedback": result["feedback"],  # suggestions & warnings
    }

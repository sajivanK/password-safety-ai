from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agents import guardian, watchdog,generator,advisor,orchestrator

from auth_routes import router as auth_router


# --- NEW: load .env and configure Gemini ---
import os
from dotenv import load_dotenv
import google.generativeai as genai

from database import db


# Load environment variables from .env file
load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise RuntimeError("❌ GOOGLE_API_KEY not set in environment or .env file")

# Configure Gemini once here
genai.configure(api_key=API_KEY)
print("✅ Gemini configured successfully")


app = FastAPI()

# Allow frontend (Next.js) to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Password Safety Backend is running 🚀"}

app.include_router(guardian.router,     prefix="/guardian")
app.include_router(watchdog.router,     prefix="/watchdog")  
app.include_router(watchdog.router, prefix="/report",  tags=["Report (alias, deprecated)"])
app.include_router(generator.router,    prefix="/generator")
app.include_router(orchestrator.router, prefix="/orchestrator")
app.include_router(advisor.router,      prefix="/advisor")

app.include_router(auth_router)


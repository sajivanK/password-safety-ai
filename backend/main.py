# backend/main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from agents import guardian, watchdog, generator, advisor, orchestrator

from auth_routes import router as auth_router
from vault_routes import router as vault_router
from agents.new_advisor import story_agent   # 🆕 mount /story

import os
from dotenv import load_dotenv
import google.generativeai as genai
from database import db
from premium_guard import require_premium_user

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise RuntimeError("❌ GOOGLE_API_KEY not set in environment or .env file")
genai.configure(api_key=API_KEY)
print("✅ Gemini configured in main.py")

app = FastAPI()

# 🆕 CORS relaxed for dev to avoid “waiting” issues
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # DEV: allow all. (Harden for prod)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Password Safety Backend is running 🚀"}

# Existing routers
app.include_router(guardian.router,     prefix="/guardian")
app.include_router(watchdog.router,     prefix="/watchdog")
app.include_router(generator.router,    prefix="/generator")
app.include_router(orchestrator.router, prefix="/orchestrator")
app.include_router(advisor.router,      prefix="/advisor")

# 🆕 story endpoints
app.include_router(story_agent.router,  prefix="/story", tags=["story"])

# Auth + Vault
app.include_router(auth_router)
app.include_router(vault_router, prefix="/api/vault", tags=["vault"])

@app.get("/api/premium-test")
def premium_check(user=Depends(require_premium_user)):
    return {"message": "✅ You are a premium user"}

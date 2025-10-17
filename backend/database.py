# backend/database.py
"""
🔗 MongoDB Connection Setup
This file safely connects to MongoDB Atlas using the URI in .env.
"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")

if not MONGO_URI:
    raise RuntimeError("❌ MONGODB_URI not found in .env file")

try:
    client = MongoClient(MONGO_URI)
    db = client["password_safety_ai"]  # database name
    print("✅ MongoDB connected successfully")
except Exception as e:
    print("⚠️ MongoDB connection failed:", e)
    db = None

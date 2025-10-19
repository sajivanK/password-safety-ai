
# backend/database.py
import os, certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
URI = os.getenv("MONGODB_URI")  

client = MongoClient(
    URI,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=30000,
)
db = client["password_safety_ai"]
client.admin.command("ping")
print("✅ MongoDB connected")



from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

client = MongoClient(MONGODB_URI)
db = client["intento"]

users_collection      = db["users"]
goals_collection      = db["goals"]
executions_collection = db["executions"]
progress_collection   = db["progress"]
stress_collection     = db["stress"]
memory_collection     = db["memory"]
goal_checkins_collection = db["goal_checkins"]

# Test connection
try:
    client.admin.command('ping')
    print("[DB] MongoDB connected successfully")
except Exception as e:
    print(f"[DB ERROR] MongoDB connection failed: {e}")

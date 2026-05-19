from fastapi import HTTPException
from database import users_collection, executions_collection
from datetime import datetime, date

MAX_GOALS_PER_DAY = 10
MAX_CONCURRENT_EXECUTIONS = 20


def check_rate_limits(user: dict):
    # For hackathon — disable strict limits
    return True


def increment_goal_count(user_id: str):
    today = str(date.today())
    users_collection.update_one(
        {"_id": user_id},
        {
            "$set": {"last_goal_date": today},
            "$inc": {"daily_goal_count": 1}
        }
    )

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from database import users_collection
from auth.utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)
from datetime import datetime
import uuid

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

def check_execution_guard(current_user: dict):
    if current_user.get("active_execution"):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "EXECUTION_IN_PROGRESS",
                "message": "Stop current execution before making changes.",
                "active_execution": current_user["active_execution"]
            }
        )

@router.post("/register")
async def register(data: dict):
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        raise HTTPException(400, "Name, email and password are required")

    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    # Check duplicate
    existing = users_collection.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered. Please login.")

    # Hash password
    hashed = get_password_hash(password)

    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "name": name,
        "email": email,
        "password": hashed,
        "auth_provider": "email",
        "created_at": datetime.utcnow(),
        "active_execution": None,
        "daily_goal_count": 0,
        "last_goal_date": None
    }

    users_collection.insert_one(user)

    token = create_access_token({"sub": user_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": name,
            "email": email
        }
    }

@router.post("/login")
async def login(data: LoginRequest):
    user = users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user["_id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["_id"],
            "name": user["name"],
            "email": user["email"]
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "active_execution": current_user.get("active_execution")
    }

@router.delete("/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    from database import (
        goals_collection,
        executions_collection,
        progress_collection,
        stress_collection,
        memory_collection
    )
    user_id = current_user["_id"]

    goals_collection.delete_many({"user_id": user_id})
    executions_collection.delete_many({"user_id": user_id})
    progress_collection.delete_many({"user_id": user_id})
    stress_collection.delete_many({"user_id": user_id})
    memory_collection.delete_many({"user_id": user_id})
    users_collection.delete_one({"_id": user_id})

    return {"message": "All data deleted successfully"}

@router.put("/change-password")
async def change_password(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    if not verify_password(data["old_password"], current_user["password"]):
        raise HTTPException(status_code=400, detail="Old password incorrect")

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password": get_password_hash(data["new_password"])}}
    )
    return {"message": "Password changed successfully"}

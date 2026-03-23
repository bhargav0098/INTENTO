from fastapi import APIRouter, Depends, HTTPException
from auth.utils import get_current_user
from database import executions_collection, goal_checkins_collection
from datetime import datetime, date
import uuid

router = APIRouter()

@router.get("/goal/{goal_id}/steps")
async def get_steps_for_checkin(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all steps for a goal to show in daily checkin."""
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        raise HTTPException(404, "Goal not found")

    steps = execution.get("steps", [])
    today = str(date.today())

    user_id = current_user.get("id") or current_user.get("user_id") or str(current_user.get("_id", ""))
    # Get today's checkin if exists
    existing = goal_checkins_collection.find_one({
        "goal_id": goal_id,
        "user_id": user_id,
        "date": today
    })

    return {
        "goal_id": goal_id,
        "goal_text": execution.get("goal_text", ""),
        "steps": [
            {
                "id": s.get("id"),
                "action": s.get("action", "").replace("_", " ").title(),
                "status": s.get("status", "unknown")
            }
            for s in steps
        ],
        "today_checkin": existing.get("step_responses", {}) if existing else {},
        "date": today
    }


@router.post("/goal/{goal_id}/submit")
async def submit_goal_checkin(
    goal_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit daily step checkin.
    body = {
        "step_responses": {"1": "done", "2": "partial", "3": "skip"},
        "mood": "great" | "okay" | "hard",
        "note": "optional note"
    }
    """
    step_responses = body.get("step_responses", {})
    mood          = body.get("mood", "okay")
    note          = body.get("note", "")
    today         = str(date.today())

    # Calculate completion score for today
    total   = len(step_responses)
    done    = sum(1 for v in step_responses.values() if v == "done")
    partial = sum(1 for v in step_responses.values() if v == "partial")
    score   = round(((done + partial * 0.5) / total) * 100) if total > 0 else 0

    user_id = current_user.get("id") or current_user.get("user_id") or str(current_user.get("_id", ""))
    
    checkin = {
        "checkin_id":     str(uuid.uuid4()),
        "goal_id":        goal_id,
        "user_id":        user_id,
        "date":           today,
        "step_responses": step_responses,
        "mood":           mood,
        "note":           note,
        "completion_score": score,
        "created_at":     datetime.utcnow()
    }

    # Upsert — one checkin per goal per day
    goal_checkins_collection.update_one(
        {
            "goal_id": goal_id,
            "user_id": user_id,
            "date":    today
        },
        {"$set": checkin},
        upsert=True
    )

    # Update overall goal real_progress
    all_checkins = list(goal_checkins_collection.find({
        "goal_id": goal_id,
        "user_id": user_id
    }))
    avg_score = round(
        sum(c.get("completion_score", 0) for c in all_checkins) / len(all_checkins)
    ) if all_checkins else 0

    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$set": {
            "real_progress":   avg_score,
            "checkin_count":   len(all_checkins),
            "last_checkin":    today
        }}
    )

    # Calculate streak
    streak = calculate_streak(goal_id, user_id)

    return {
        "status":           "saved",
        "completion_score": score,
        "real_progress":    avg_score,
        "streak":           streak,
        "message":          f"Great job! {score}% completion today."
    }


@router.get("/goal/{goal_id}/history")
async def get_checkin_history(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all checkins for a goal."""
    user_id = current_user.get("id") or current_user.get("user_id") or str(current_user.get("_id", ""))
    checkins = list(goal_checkins_collection.find(
        {"goal_id": goal_id, "user_id": user_id},
        {"_id": 0}
    ).sort("date", -1))

    return {"goal_id": goal_id, "checkins": checkins}


@router.get("/active-goals")
async def get_active_goals(
    current_user: dict = Depends(get_current_user)
):
    """Get all completed goals that need daily checkin and still exist."""
    from database import goals_collection, db
    user_id = current_user["_id"]
    
    # Only get completed executions
    executions = list(executions_collection.find({
        "user_id": user_id,
        "execution_status": "completed"
    }))

    active = []
    for exe in executions:
        # Check goal still exists in goals_collection
        goal_exists = goals_collection.find_one({
            "_id": exe["goal_id"],
            "user_id": user_id
        })
        if not goal_exists:
            # Fallback for different ID keys
            goal_exists = goals_collection.find_one({
                "goal_id": exe["goal_id"],
                "user_id": user_id
            })
            if not goal_exists:
                continue

        # Skip if already checked in today
        from datetime import date
        today = str(date.today())
        already_checked = db["goal_checkins"].find_one({
            "user_id": user_id,
            "goal_id": exe["goal_id"],
            "date":    today
        })
        if already_checked:
            continue

        active.append({
            "goal_id":       exe["goal_id"],
            "goal_text":     exe.get("goal_text", ""),
            "real_progress": exe.get("real_progress", 0),
            "streak":        calculate_streak(exe["goal_id"], user_id)
        })

    return {"active_goals": active}


def calculate_streak(goal_id: str, user_id: str) -> int:
    """Calculate consecutive days of checkins."""
    from datetime import date, timedelta
    checkins = list(goal_checkins_collection.find(
        {"goal_id": goal_id, "user_id": user_id},
        {"date": 1}
    ).sort("date", -1))

    if not checkins:
        return 0

    streak = 0
    check_date = date.today()

    for c in checkins:
        c_date = date.fromisoformat(c["date"])
        if c_date == check_date:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    return streak

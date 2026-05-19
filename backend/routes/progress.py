from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from auth.utils import get_current_user
from database import (
    progress_collection,
    stress_collection,
    goals_collection,
    executions_collection
)
from datetime import datetime, timedelta
import asyncio

router = APIRouter()

EMOTION_MAP = {
    "great": {"stress": 0.2, "confidence": +0.1},
    "okay":  {"stress": 0.5, "confidence": 0.0},
    "hard":  {"stress": 0.8, "confidence": -0.1}
}


# ─── Process Emotion ──────────────────────────────────────────────────────────
async def process_emotion(feeling: str, user_id: str, goal_id: str, completion_rate: float = 100) -> dict:
    progress = progress_collection.find_one({
        "user_id": user_id, "goal_id": goal_id, "type": "state"
    }) or {
        "user_id": user_id, "goal_id": goal_id, "type": "state",
        "hard_count": 0, "streak": 0, "stress_score": 0.0,
        "confidence": 1.0, "completion_rate": 100
    }

    signal = EMOTION_MAP.get(feeling, EMOTION_MAP["okay"])
    new_stress = min(1.0, (progress["stress_score"] + signal["stress"]) / 2)
    new_confidence = max(0.0, progress["confidence"] + signal["confidence"])

    stress_collection.insert_one({
        "user_id": user_id, "goal_id": goal_id,
        "feeling": feeling, "stress_score": new_stress,
        "timestamp": datetime.utcnow()
    })

    if feeling == "great":
        progress["hard_count"] = 0
        progress["streak"] = progress.get("streak", 0) + 1
        progress["stress_score"] = new_stress
        progress["confidence"] = new_confidence
        progress["completion_rate"] = completion_rate
        progress_collection.update_one(
            {"user_id": user_id, "goal_id": goal_id, "type": "state"},
            {"$set": progress}, upsert=True
        )
        if progress["streak"] >= 3:
            return {"action": "suggest_increase", "message": "🔥 Amazing! 3-day streak! Want to increase difficulty?", "streak": progress["streak"]}
        return {"action": "motivate", "message": f"🔥 Awesome! Day {progress['streak']} streak! Keep going!", "streak": progress["streak"]}

    elif feeling == "okay":
        progress["stress_score"] = new_stress
        progress["completion_rate"] = completion_rate
        progress_collection.update_one(
            {"user_id": user_id, "goal_id": goal_id, "type": "state"},
            {"$set": progress}, upsert=True
        )
        return {"action": "neutral", "message": "👍 Good consistency. Same pace tomorrow?"}

    elif feeling == "hard":
        progress["hard_count"] = progress.get("hard_count", 0) + 1
        progress["stress_score"] = new_stress
        progress["confidence"] = new_confidence
        progress["completion_rate"] = completion_rate
        progress_collection.update_one(
            {"user_id": user_id, "goal_id": goal_id, "type": "state"},
            {"$set": progress}, upsert=True
        )

        if new_stress >= 0.8:
            return {"action": "burnout_detected", "message": "⚠️ High stress detected. Want me to adjust your schedule?", "stress_score": new_stress, "show_burnout_alert": True}
        if progress["hard_count"] == 1:
            return {"action": "diagnose", "message": "💬 That's completely normal. What made it hard?",
                    "options": ["Topic was difficult", "I was tired", "Not enough time"]}
        if progress["hard_count"] >= 2:
            return {"action": "suggest_replan", "message": "⚠️ Last few days felt difficult. Want me to adjust?",
                    "options": ["Reduce daily load", "Add more revision time", "Extend plan by 3 days"]}
        if completion_rate < 50:
            return {"action": "force_replan", "message": "You're pushing too hard. Let me optimize your schedule."}

    return {"action": "none", "message": ""}


# ─── Burnout Checks ───────────────────────────────────────────────────────────
async def check_burnout_threshold(user_id: str, goal_id: str):
    progress = progress_collection.find_one({"user_id": user_id, "goal_id": goal_id, "type": "state"})
    if not progress:
        return
    if progress.get("stress_score", 0) >= 0.95 and progress.get("completion_rate", 100) < 30 and progress.get("hard_count", 0) >= 4:
        await delayed_auto_adjust(user_id, goal_id)


async def delayed_auto_adjust(user_id: str, goal_id: str):
    from utils.websocket import notify_user, send_update
    await notify_user(goal_id, "burnout_critical", "⚠️ Critical stress detected. I will adjust your schedule in 1 hour unless you respond.")
    await asyncio.sleep(3600)
    progress = progress_collection.find_one({"user_id": user_id, "goal_id": goal_id, "type": "state"})
    if not progress:
        return
    if progress.get("stress_score", 0) >= 0.95 and progress.get("completion_rate", 100) < 30 and progress.get("hard_count", 0) >= 4:
        progress_collection.update_one(
            {"user_id": user_id, "goal_id": goal_id, "type": "state"},
            {"$set": {"auto_adjusted": True, "auto_adjusted_at": datetime.utcnow()}}
        )
        await notify_user(goal_id, "auto_adjusted", "⚠️ I reduced tomorrow's load by 20% due to high stress. You can undo anytime.")
        await send_update(goal_id, {"type": "burnout_auto_adjusted", "message": "Schedule automatically adjusted.", "reduction": "20%"})


# ─── Routes ───────────────────────────────────────────────────────────────────
@router.post("/checkin")
async def daily_checkin(data: dict, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    goal_id = data.get("goal_id")
    completed = data.get("completed")
    hours_studied = data.get("hours_studied", 0)
    feeling = data.get("feeling", "okay")
    notes = data.get("notes", "")
    day_number = data.get("day_number", 1)

    progress_collection.insert_one({
        "user_id": user_id, "goal_id": goal_id, "day_number": day_number,
        "completed": completed, "hours_studied": hours_studied,
        "feeling": feeling, "notes": notes, "timestamp": datetime.utcnow()
    })

    all_checkins = list(progress_collection.find({"user_id": user_id, "goal_id": goal_id}))
    total = len(all_checkins)
    completed_count = len([c for c in all_checkins if c.get("completed") == "yes"])
    completion_rate = (completed_count / total) * 100 if total > 0 else 100

    emotion_response = await process_emotion(feeling, user_id, goal_id, completion_rate)
    background_tasks.add_task(check_burnout_threshold, user_id, goal_id)

    return {"status": "checkin_saved", "day": day_number, "completion_rate": completion_rate, "emotion_response": emotion_response}


@router.post("/burnout/accept")
async def accept_burnout_adjustment(data: dict, current_user: dict = Depends(get_current_user)):
    goal_id = data.get("goal_id")
    adjustment_type = data.get("adjustment_type")
    progress_collection.update_one(
        {"user_id": current_user["_id"], "goal_id": goal_id, "type": "state"},
        {"$set": {"burnout_adjustment": adjustment_type, "adjustment_accepted_at": datetime.utcnow(), "stress_score": 0.3}},
        upsert=True
    )
    return {"status": "adjustment_accepted", "adjustment": adjustment_type, "message": "✅ Schedule adjusted successfully. Undo anytime."}


@router.post("/burnout/undo")
async def undo_burnout_adjustment(data: dict, current_user: dict = Depends(get_current_user)):
    goal_id = data.get("goal_id")
    progress_collection.update_one(
        {"user_id": current_user["_id"], "goal_id": goal_id, "type": "state"},
        {"$unset": {"burnout_adjustment": "", "adjustment_accepted_at": ""}}
    )
    return {"status": "adjustment_undone", "message": "↩️ Schedule restored to original."}


@router.get("/burnout/diff/{goal_id}")
async def get_burnout_diff(goal_id: str, current_user: dict = Depends(get_current_user)):
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        raise HTTPException(404, "Goal not found")
    structured_goal = execution.get("structured_goal", {})
    duration = structured_goal.get("duration_days", 14)
    daily_hours = structured_goal.get("constraints", {}).get("daily_hours", 3) if isinstance(structured_goal.get("constraints"), dict) else 3
    return {
        "before": {"daily_hours": daily_hours, "breaks": "None", "duration_days": duration},
        "after": {"daily_hours": round(daily_hours * 0.8, 1), "breaks": "15 min every 45 mins", "duration_days": round(duration * 1.2)},
        "stress_reduction_estimate": "28%"
    }


@router.get("/stress/history")
async def get_stress_history(current_user: dict = Depends(get_current_user), days: int = 7):
    cutoff = datetime.utcnow() - timedelta(days=days)
    logs = list(stress_collection.find({"user_id": current_user["_id"], "timestamp": {"$gte": cutoff}}).sort("timestamp", 1))
    history = []
    for log in logs:
        score = log["stress_score"]
        level = "high" if score >= 0.7 else "moderate" if score >= 0.4 else "low"
        history.append({"date": log["timestamp"].strftime("%a"), "full_date": log["timestamp"].strftime("%Y-%m-%d"), "stress_score": round(score, 2), "level": level, "feeling": log.get("feeling", "okay")})
    return {"history": history, "days": days, "current_stress": history[-1]["stress_score"] if history else 0.0, "current_level": history[-1]["level"] if history else "low"}


@router.get("/stress/current/{goal_id}")
async def get_current_stress(goal_id: str, current_user: dict = Depends(get_current_user)):
    progress = progress_collection.find_one({"user_id": current_user["_id"], "goal_id": goal_id, "type": "state"})
    if not progress:
        return {"stress_score": 0.0, "level": "low", "streak": 0, "hard_count": 0, "completion_rate": 100}
    score = progress.get("stress_score", 0)
    level = "high" if score >= 0.7 else "moderate" if score >= 0.4 else "low"
    return {"stress_score": round(score, 2), "level": level, "streak": progress.get("streak", 0), "hard_count": progress.get("hard_count", 0), "completion_rate": progress.get("completion_rate", 100), "confidence": round(progress.get("confidence", 1.0), 2)}


@router.get("/goal/{goal_id}")
async def get_goal_progress(goal_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    checkins = list(progress_collection.find({"user_id": user_id, "goal_id": goal_id, "type": {"$ne": "state"}}).sort("day_number", 1))
    execution = executions_collection.find_one({"goal_id": goal_id, "user_id": user_id}, {"_id": 0})
    state = progress_collection.find_one({"user_id": user_id, "goal_id": goal_id, "type": "state"}) or {}
    total_days = execution.get("structured_goal", {}).get("duration_days", 14) if execution else 14
    completed_days = len([c for c in checkins if c.get("completed") == "yes"])
    current_day = len(checkins) + 1
    total_hours = sum(c.get("hours_studied", 0) for c in checkins)
    return {
        "goal_id": goal_id, "total_days": total_days, "current_day": current_day,
        "completed_days": completed_days, "percentage": round((completed_days / total_days) * 100, 1) if total_days else 0,
        "streak": state.get("streak", 0), "total_hours_studied": round(total_hours, 1),
        "completion_rate": state.get("completion_rate", 100),
        "stress_level": "high" if state.get("stress_score", 0) >= 0.7 else "moderate" if state.get("stress_score", 0) >= 0.4 else "low",
        "checkins": [{"day": c["day_number"], "completed": c["completed"], "feeling": c["feeling"], "hours": c.get("hours_studied", 0)} for c in checkins]
    }


@router.get("/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user), period: str = "week"):
    user_id = current_user["_id"]
    if period == "week":
        cutoff = datetime.utcnow() - timedelta(days=7)
    elif period == "month":
        cutoff = datetime.utcnow() - timedelta(days=30)
    else:
        cutoff = datetime.utcnow() - timedelta(days=3650)

    # Use executions collection for more accurate status tracking
    completed = executions_collection.count_documents({
        "user_id": user_id,
        "execution_status": "completed",
        "created_at": {"$gte": cutoff}
    })

    total = executions_collection.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": cutoff}
    })

    failed = executions_collection.count_documents({
        "user_id": user_id,
        "execution_status": "failed",
        "created_at": {"$gte": cutoff}
    })

    success_rate = round((completed / total * 100)) if total > 0 else 0

    all_goals = list(goals_collection.find({"user_id": user_id, "created_at": {"$gte": cutoff}}).sort("created_at", -1))

    categories = {}
    for goal in all_goals:
        gt = goal.get("structured_goal", {}).get("goal_type", "other")
        categories[gt] = categories.get(gt, 0) + 1

    executions = list(executions_collection.find({"user_id": user_id, "execution_status": "completed", "created_at": {"$gte": cutoff}}))
    avg_time = executions[0].get("time_taken", "N/A") if executions else "N/A"

    return {
        "total_goals": total,
        "completed": completed,
        "success_rate": success_rate,
        "avg_time": avg_time,
        "goals": [{"goal_id": str(g.get("goal_id") or g.get("_id")), "goal_text": g["goal_text"], "status": g.get("execution_status", "unknown"), "created_at": g["created_at"].strftime("%b %d")} for g in all_goals]
    }


@router.get("/goals/history")
async def search_goals(current_user: dict = Depends(get_current_user), search: str = None, status: str = "all"):
    user_id = current_user["_id"]
    query = {"user_id": user_id}
    if search:
        query["goal_text"] = {"$regex": search, "$options": "i"}
    if status != "all":
        query["execution_status"] = status
    goals = list(goals_collection.find(query, {"_id": 0}).sort("created_at", -1).limit(50))
    return {"goals": goals, "total": len(goals)}

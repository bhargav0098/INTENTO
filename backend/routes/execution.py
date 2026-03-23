from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse
from auth.utils import get_current_user
from agent.interpreter import (
    validate_goal_input,
    goal_ambiguity_detector,
    interpret_goal,
    estimate_goal_complexity
)
from agent.planner import (
    generate_execution_plan,
    plan_validator,
    dependency_resolver,
    execution_timeline_estimator
)
from agent.engine import run_execution_engine
from utils.rate_limit import check_rate_limits, increment_goal_count
from database import executions_collection, goals_collection, users_collection
from datetime import datetime
import uuid

router = APIRouter()


def update_execution_status(goal_id: str):
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        return

    steps = execution.get("steps", [])
    total = len(steps)
    if total == 0:
        return

    completed = len([s for s in steps if s.get("status") == "completed"])
    failed    = len([s for s in steps if s.get("status") == "failed"])
    percentage = round((completed / total) * 100, 1)

    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$set": {
            "completed_steps": completed,
            "failed_steps":    failed,
            "percentage":      percentage
        }}
    )
    return completed, failed, percentage


def revert_plan(goal_id: str, version: str) -> dict:
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        raise HTTPException(404, "Execution not found")

    history = execution.get("version_history", [])
    target = next((v for v in history if v["version"] == version), None)

    if not target:
        raise HTTPException(404, f"Version {version} not found")

    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$set": {
            "steps": target["plan_snapshot"],
            "version": version,
            "reverted_at": datetime.utcnow()
        }}
    )
    return {"success": True, "reverted_to": version}


from pydantic import BaseModel

class StartRequest(BaseModel):
    goal_text: str
    priority: str = "high"

@router.post("/start")
async def start_execution(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    try:
        body = await request.json()
        print(f"[START] Received body: {body}")
        
        goal_text = body.get("goal_text", "").strip()
        priority  = body.get("priority", "high")
        
        if not goal_text:
            raise HTTPException(400, "goal_text is required")
        if len(goal_text) < 10:
            raise HTTPException(400, "Goal too short. Please describe in more detail.")
        if len(goal_text) > 500:
            raise HTTPException(400, "Goal too long. Max 500 characters.")

        check_rate_limits(current_user)

        validated = validate_goal_input(goal_text)

        ambiguity = await goal_ambiguity_detector(goal_text)
        if ambiguity["ambiguous"]:
            return {"status": "clarification_needed", "question": ambiguity["question"]}

        structured_goal = await interpret_goal(goal_text)
        complexity = estimate_goal_complexity(structured_goal)
        steps = await generate_execution_plan(structured_goal)

        validation = plan_validator(steps)
        if not validation["valid"]:
            steps = await generate_execution_plan(structured_goal)
            validation = plan_validator(steps)
            if not validation["valid"]:
                return {"status": "error", "message": f"Plan generation failed: {validation['reason']}"}

        layers = dependency_resolver(steps)
        timeline = execution_timeline_estimator(steps, layers)
        goal_id = str(uuid.uuid4())

        goals_collection.insert_one({
            "_id": goal_id,
            "user_id": current_user["_id"],
            "goal_text": goal_text,
            "structured_goal": structured_goal,
            "execution_status": "awaiting_approval",
            "created_at": datetime.utcnow()
        })

        executions_collection.insert_one({
            "goal_id": goal_id,
            "user_id": current_user["_id"],
            "goal_text": goal_text,
            "structured_goal": structured_goal,
            "steps": steps,
            "execution_layers": layers,
            "execution_status": "awaiting_approval",
            "version": "v1.0",
            "version_history": [],
            "replans": 0,
            "percentage": 0,
            "created_at": datetime.utcnow()
        })

        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"active_execution": goal_id}}
        )
        increment_goal_count(current_user["_id"])

        return {
            "status": "awaiting_approval",
            "goal_id": goal_id,
            "structured_goal": structured_goal,
            "complexity": complexity,
            "timeline": timeline,
            "steps": steps,
            "layers": layers
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[START ERROR] {e}")
        raise HTTPException(400, f"Invalid request: {str(e)}")


@router.post("/approve/{goal_id}")
async def approve_execution(
    goal_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    execution = executions_collection.find_one({
        "goal_id": goal_id,
        "user_id": current_user["_id"]
    })
    if not execution:
        raise HTTPException(404, "Execution not found")

    background_tasks.add_task(
        run_execution_engine,
        goal_id,
        current_user["_id"],
        execution["steps"],
        execution["structured_goal"]
    )

    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$set": {"execution_status": "executing"}}
    )

    return {"status": "executing", "goal_id": goal_id}


@router.post("/pause/{goal_id}")
async def pause_execution(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        raise HTTPException(404, "Execution not found")

    current_status = execution.get("execution_status")
    if current_status == "paused":
        # Resume
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {"execution_status": "running"}}
        )
        return {"status": "resumed", "message": "Execution resumed"}
    else:
        # Pause
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {"execution_status": "paused"}}
        )
        return {"status": "paused", "message": "Execution paused"}


@router.post("/stop/{goal_id}")
async def stop_execution(goal_id: str, current_user: dict = Depends(get_current_user)):
    executions_collection.update_one(
        {"goal_id": goal_id, "user_id": current_user["_id"]},
        {"$set": {"execution_status": "aborted"}}
    )
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"active_execution": None}}
    )
    return {"status": "aborted"}


@router.get("/status/{goal_id}")
async def get_execution_status(goal_id: str, current_user: dict = Depends(get_current_user)):
    execution = executions_collection.find_one(
        {"goal_id": goal_id, "user_id": current_user["_id"]},
        {"_id": 0}
    )
    if not execution:
        raise HTTPException(404, "Execution not found")
    return execution


@router.post("/revert/{goal_id}")
async def revert_execution(
    goal_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    return revert_plan(goal_id, data.get("version"))

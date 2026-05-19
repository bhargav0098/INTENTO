from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
from datetime import datetime
import json
import asyncio

router = APIRouter()

STREAM_LIMITS = {
    "max_thoughts_per_step": 5,
    "max_chars_per_thought": 300
}

RECONNECT_ATTEMPTS = 5
RECONNECT_DELAY = 2

thought_counts: Dict[str, int] = {}
active_connections: Dict[str, WebSocket] = {}


async def stream_agent_thoughts(step_id: str, thought: str, websocket: WebSocket):
    count = thought_counts.get(step_id, 0)
    if count >= STREAM_LIMITS["max_thoughts_per_step"]:
        return
    truncated = thought[:STREAM_LIMITS["max_chars_per_thought"]]
    await websocket.send_json({
        "type": "thought",
        "step_id": step_id,
        "content": truncated,
        "count": count + 1
    })
    thought_counts[step_id] = count + 1


@router.websocket("/ws/{goal_id}")
async def websocket_endpoint(websocket: WebSocket, goal_id: str):
    await websocket.accept()
    active_connections[goal_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.pop(goal_id, None)


async def send_update(goal_id: str, data: dict):
    ws = active_connections.get(goal_id)
    if ws:
        try:
            await ws.send_json(data)
        except Exception:
            active_connections.pop(goal_id, None)


async def send_update_safe(goal_id: str, data: dict) -> bool:
    ws = active_connections.get(goal_id)
    if not ws:
        return False
    try:
        await ws.send_json(data)
        return True
    except Exception as e:
        print(f"[WS ERROR] Failed to send to {goal_id}: {e}")
        active_connections.pop(goal_id, None)
        return False


async def notify_user(goal_id: str, event_type: str, message: str):
    await send_update(goal_id, {
        "type": "notification",
        "event": event_type,
        "message": message,
        "timestamp": str(datetime.utcnow())
    })


NOTIFICATION_EVENTS = {
    "step_completed": "✅ Step completed",
    "step_failed": "❌ Step failed",
    "goal_completed": "🎉 Goal completed!",
    "replan_triggered": "🔄 Replan triggered",
    "burnout_detected": "⚠️ High stress detected",
    "data_deleted": "🗑️ Data deleted",
    "reconnected": "✅ Reconnected"
}


async def reconnect_websocket(goal_id: str, websocket: WebSocket) -> bool:
    for attempt in range(RECONNECT_ATTEMPTS):
        try:
            await websocket.accept()
            active_connections[goal_id] = websocket
            from database import executions_collection
            execution = executions_collection.find_one(
                {"goal_id": goal_id}, {"_id": 0}
            )
            if execution:
                await websocket.send_json({
                    "type": "sync_state",
                    "execution": {
                        "status": execution.get("execution_status"),
                        "percentage": execution.get("percentage", 0),
                        "current_layer": execution.get("current_layer", 0),
                        "steps": execution.get("steps", []),
                        "replans": execution.get("replans", 0)
                    }
                })
            return True
        except Exception as e:
            print(f"[WS RECONNECT] Attempt {attempt+1} failed: {e}")
            await asyncio.sleep(RECONNECT_DELAY)
    return False

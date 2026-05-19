from agent.gemini import call_agent
from database import db
from datetime import datetime


async def save_to_memory(user_id: str, goal: dict, steps: list, results: list):
    memory_data = await call_agent("memory", {
        "goal": goal,
        "steps": steps,
        "results": results
    })

    db["memories"].update_one(
        {"user_id": user_id},
        {"$push": {
            "entries": {
                "goal_type": goal.get("goal_type"),
                "key_facts": memory_data.get("key_facts", []),
                "preferences": memory_data.get("user_preferences", {}),
                "patterns": memory_data.get("patterns", []),
                "summary": memory_data.get("context_summary", ""),
                "timestamp": datetime.utcnow()
            }
        }},
        upsert=True
    )


def recall_user_context(user_id: str) -> dict:
    memory = db["memories"].find_one({"user_id": user_id})
    if not memory:
        return {"has_context": False}

    entries = memory.get("entries", [])
    recent = entries[-5:] if len(entries) > 5 else entries

    all_facts = []
    all_preferences = {}
    all_patterns = []

    for entry in recent:
        all_facts.extend(entry.get("key_facts", []))
        all_preferences.update(entry.get("preferences", {}))
        all_patterns.extend(entry.get("patterns", []))

    return {
        "has_context": True,
        "key_facts": all_facts,
        "preferences": all_preferences,
        "patterns": all_patterns,
        "total_goals": len(entries)
    }

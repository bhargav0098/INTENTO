from fastapi import HTTPException


def validate_goal_input(goal_text: str) -> dict:
    if not goal_text or len(goal_text.strip()) == 0:
        raise HTTPException(400, "Goal cannot be empty")
    if len(goal_text.strip()) < 10:
        raise HTTPException(400, "Goal too vague. Please describe more.")
    if len(goal_text) > 500:
        goal_text = goal_text[:500]
    forbidden = ["hack", "crack", "illegal", "weapon"]
    for word in forbidden:
        if word in goal_text.lower():
            raise HTTPException(400, "Invalid goal detected")
    return {"valid": True, "goal_text": goal_text.strip()}


async def goal_ambiguity_detector(goal_text: str) -> dict:
    vague_phrases = [
        "help me", "make me better", "improve",
        "do something", "fix things"
    ]
    for phrase in vague_phrases:
        if goal_text.lower().strip() == phrase:
            return {
                "ambiguous": True,
                "question": "Could you be more specific? Better at what — studies, health, or work?"
            }
    if len(goal_text.split()) < 4:
        return {
            "ambiguous": True,
            "question": "Can you provide more details about your goal?"
        }
    return {"ambiguous": False}


async def interpret_goal(goal_text: str) -> dict:
    from agent.gemini import call_agent
    result = await call_agent("planner", {
        "task": "interpret_goal",
        "goal": goal_text,
        "output_format": {
            "goal_type": "study_plan|fitness|finance|startup|schedule|other",
            "duration_days": "number or null",
            "constraints": [],
            "priority": "high|medium|low",
            "complexity": "high|medium|low",
            "weak_subjects": [],
            "work_hours": "number or null",
            "preferences": {}
        }
    })
    return result


def estimate_goal_complexity(structured_goal: dict) -> dict:
    constraints = len(structured_goal.get("constraints", []))
    duration = structured_goal.get("duration_days", 1) or 1
    complexity = structured_goal.get("complexity", "low")

    if complexity == "high" or constraints > 3 or duration > 30:
        steps = 8
        time = "3-4 mins"
        agents = 4
    elif complexity == "medium" or constraints > 1:
        steps = 5
        time = "1-2 mins"
        agents = 3
    else:
        steps = 3
        time = "30 secs"
        agents = 2

    return {
        "complexity": complexity,
        "estimated_steps": steps,
        "estimated_time": time,
        "agents_needed": agents
    }

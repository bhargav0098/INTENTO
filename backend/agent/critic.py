from agent.gemini import call_agent


async def agent_self_evaluation(plan: list, results: list, replans: int) -> dict:
    result = await call_agent("critic", {
        "plan": plan,
        "results": results,
        "replans": replans,
        "evaluate": [
            "plan efficiency",
            "execution success rate",
            "replan necessity",
            "overall quality"
        ]
    })
    return {
        "efficiency_score": result.get("efficiency_score", 0.8),
        "confidence_score": result.get("confidence_score", 0.9),
        "optimization_suggestions": result.get("optimization_suggestions", []),
        "overall_rating": result.get("overall_rating", "good")
    }

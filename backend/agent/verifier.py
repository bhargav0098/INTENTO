from agent.gemini import call_agent

# ─── Confidence Rules ─────────────────────────────────────────────────────────
CONFIDENCE_RULES = {
    "PROCEED": 0.75,
    "REPLAN": 0.50,
    "ESCALATE": 0.25,
    "HARD_STOP": 0.0
}


async def verify_step(step_result: dict, step: dict) -> dict:
    result = await call_agent("verifier", {
        "step": step,
        "result": step_result,
        "checks": [
            "Did API return valid schema?",
            "Is data complete?",
            "Did output meet expected condition?",
            "Is result logically correct?"
        ]
    })
    return {
        "step_id": step["id"],
        "status": result.get("status", "failed"),
        "confidence": float(result.get("confidence", 0.0)),
        "reason": result.get("reason", ""),
        "retry_count": step.get("retry_count", 0),
        "fallback_used": result.get("fallback_used", False)
    }


def confidence_threshold_controller(raw_confidence: float, retry_count: int = 0) -> dict:
    decayed = raw_confidence - (retry_count * 0.1)
    effective = max(0.0, decayed)

    if effective >= 0.75:
        return {"decision": "PROCEED", "score": effective}
    elif effective >= 0.50:
        return {"decision": "REPLAN", "score": effective}
    elif effective > 0:
        return {"decision": "ESCALATE", "score": effective}
    else:
        return {"decision": "HARD_STOP", "score": 0.0}


def apply_confidence_safety(
    raw_confidence: float,
    retry_count: int = 0,
    is_critical: bool = False
) -> dict:
    decayed = raw_confidence - (retry_count * 0.1)
    effective = max(0.0, decayed)
    threshold = 0.85 if is_critical else 0.75

    if effective >= threshold:
        return {"decision": "PROCEED", "score": effective, "safe": True}
    elif effective >= CONFIDENCE_RULES["REPLAN"]:
        return {"decision": "REPLAN", "score": effective, "safe": False}
    elif effective >= CONFIDENCE_RULES["ESCALATE"]:
        return {"decision": "ESCALATE", "score": effective, "safe": False}
    else:
        return {"decision": "HARD_STOP", "score": 0.0, "safe": False}

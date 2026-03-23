GLOBAL_LIMITS = {
    "MAX_TOTAL_STEPS": 60,
    "MAX_TOTAL_REPLANS": 10,
    "MAX_RETRIES_PER_STEP": 3,
    "MAX_CONCURRENT_EXECUTIONS": 20,
    "MAX_GOALS_PER_DAY": 10,
    "STEP_TIMEOUT_SECONDS": 30,
    "REPLAN_WAIT_SECONDS": 1,
    "BURNOUT_AUTO_ADJUST_DELAY": 3600
}

EXECUTION_STATUS = {
    "IDLE": "idle",
    "ANALYSING": "analysing",
    "PLANNING": "planning",
    "AWAITING_APPROVAL": "awaiting_approval",
    "EXECUTING": "executing",
    "REPLANNING": "replanning",
    "PAUSED": "paused",
    "COMPLETED": "completed",
    "ABORTED": "aborted",
    "FAILED": "failed"
}

FAILURE_DECISION = {
    "ABORT": "abort",
    "REPLAN_BRANCH": "replan_branch",
    "LOG_CONTINUE": "log_continue",
    "ESCALATE": "escalate"
}


def check_plan_limits(plan: list, replan_count: int) -> dict:
    if len(plan) > GLOBAL_LIMITS["MAX_TOTAL_STEPS"]:
        return {
            "abort": True,
            "reason": f"Plan exceeded {GLOBAL_LIMITS['MAX_TOTAL_STEPS']} steps"
        }
    if replan_count > GLOBAL_LIMITS["MAX_TOTAL_REPLANS"]:
        return {
            "abort": True,
            "reason": f"Replan limit of {GLOBAL_LIMITS['MAX_TOTAL_REPLANS']} exceeded"
        }
    return {"abort": False}

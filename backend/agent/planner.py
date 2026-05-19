from collections import defaultdict, deque
from database import executions_collection
from datetime import datetime

# ─── Safety Rules ────────────────────────────────────────────────────────────
PLAN_SAFETY_RULES = {
    "MAX_STEPS": 60,
    "MAX_REPLANS": 10,
    "MAX_RETRIES_PER_STEP": 3,
    "MAX_STEP_TIMEOUT": 30,
    "MIN_ROOT_STEPS": 1,
    "MAX_PLAN_DEPTH": 10
}


def apply_plan_safety(steps: list) -> dict:
    issues = []

    if len(steps) > PLAN_SAFETY_RULES["MAX_STEPS"]:
        issues.append(f"Too many steps: {len(steps)}")

    ids = [s["id"] for s in steps]
    if len(ids) != len(set(ids)):
        issues.append("Duplicate step IDs found")

    for step in steps:
        if not step.get("action"):
            issues.append(f"Step {step['id']} has no action")

    if issues:
        return {"safe": False, "issues": issues}
    return {"safe": True, "issues": []}


# ─── Generate Plan ────────────────────────────────────────────────────────────
async def generate_execution_plan(structured_goal: dict) -> list:
    from agent.gemini import call_agent
    result = await call_agent("planner", {
        "task": "generate_plan",
        "structured_goal": structured_goal,
        "output_format": {
            "steps": [
                {
                    "id": 1,
                    "action": "action_name",
                    "description": "what this does",
                    "depends_on": [],
                    "est_time_sec": 10,
                    "priority": "critical|normal|optional"
                }
            ]
        },
        "rules": [
            "Each step must have unique id",
            "depends_on must reference existing step ids",
            "At least one root step with empty depends_on",
            "No circular dependencies",
            "Maximum 15 steps for simple goals",
            "Maximum 30 steps for complex goals"
        ]
    })
    return result.get("steps", [])


# ─── Plan Validator ───────────────────────────────────────────────────────────
def plan_validator(steps: list) -> dict:
    if not steps:
        return {"valid": False, "reason": "Empty plan"}

    if len(steps) > 60:
        return {"valid": False, "reason": "Plan exceeds 60 steps"}

    ids = {step["id"] for step in steps}

    for step in steps:
        for dep in step.get("depends_on", []):
            if dep not in ids:
                return {
                    "valid": False,
                    "reason": f"Step {step['id']} references missing step {dep}"
                }

    root_steps = [s for s in steps if not s.get("depends_on")]
    if not root_steps:
        return {"valid": False, "reason": "No root step found"}

    def has_cycle(steps):
        graph = {s["id"]: s.get("depends_on", []) for s in steps}
        visited = set()
        rec_stack = set()

        def dfs(node):
            visited.add(node)
            rec_stack.add(node)
            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
            rec_stack.discard(node)
            return False

        for node in graph:
            if node not in visited:
                if dfs(node):
                    return True
        return False

    if has_cycle(steps):
        return {"valid": False, "reason": "Circular dependency detected"}

    return {"valid": True}


# ─── Dependency Resolver (Kahn's Algorithm) ───────────────────────────────────
def dependency_resolver(steps: list) -> list:
    graph = defaultdict(list)
    in_degree = {step["id"]: 0 for step in steps}

    for step in steps:
        for dep in step.get("depends_on", []):
            graph[dep].append(step["id"])
            in_degree[step["id"]] += 1

    queue = deque([sid for sid in in_degree if in_degree[sid] == 0])
    execution_layers = []

    while queue:
        layer = list(queue)
        execution_layers.append(layer)
        queue.clear()
        for step_id in layer:
            for neighbor in graph[step_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

    return execution_layers


# ─── Timeline Estimator ────────────────────────────────────────────────────────
def execution_timeline_estimator(steps: list, layers: list) -> dict:
    step_map = {s["id"]: s for s in steps}
    total_time = 0

    for layer in layers:
        layer_max = max(
            step_map[sid].get("est_time_sec", 10)
            for sid in layer
        )
        total_time += layer_max

    critical_path = []
    for layer in layers:
        critical = max(
            layer,
            key=lambda sid: step_map[sid].get("est_time_sec", 10)
        )
        critical_path.append(critical)

    minutes = total_time // 60
    seconds = total_time % 60
    time_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"

    return {
        "total_steps": len(steps),
        "parallel_layers": len(layers),
        "estimated_total": time_str,
        "critical_path": critical_path
    }


# ─── Replan on Failure ────────────────────────────────────────────────────────
async def replan_on_failure(failed_step: dict, context: dict, replan_count: int) -> dict:
    from agent.gemini import call_agent

    MAX_REPLANS = 10
    if replan_count >= MAX_REPLANS:
        return {
            "abort": True,
            "reason": "Maximum replans reached"
        }

    result = await call_agent("planner", {
        "task": "replan",
        "failed_step": failed_step,
        "failure_reason": failed_step.get("reason"),
        "context": context,
        "instruction": "Generate 2-3 alternative sub-steps to replace the failed step"
    })

    return {
        "abort": False,
        "new_steps": result.get("steps", []),
        "replan_count": replan_count + 1
    }


# ─── Plan Version Controller ──────────────────────────────────────────────────
def plan_version_controller(goal_id: str, plan: list, reason: str, current_version: str) -> str:
    parts = current_version.split(".")
    new_version = f"{parts[0]}.{int(parts[1]) + 1}"

    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$push": {
            "version_history": {
                "version": new_version,
                "plan_snapshot": plan,
                "reason": reason,
                "timestamp": datetime.utcnow()
            }
        }}
    )
    return new_version


# ─── Plan Diff ────────────────────────────────────────────────────────────────
def generate_plan_diff(old_plan: list, new_plan: list) -> dict:
    old_ids = {s["id"]: s for s in old_plan}
    new_ids = {s["id"]: s for s in new_plan}

    added = [s for sid, s in new_ids.items() if sid not in old_ids]
    removed = [s for sid, s in old_ids.items() if sid not in new_ids]
    modified = [
        {"old": old_ids[sid], "new": s}
        for sid, s in new_ids.items()
        if sid in old_ids and old_ids[sid] != s
    ]

    return {
        "added_steps": added,
        "removed_steps": removed,
        "modified_steps": modified,
        "total_changes": len(added) + len(removed) + len(modified)
    }

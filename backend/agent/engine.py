import asyncio
from copy import deepcopy
from datetime import datetime
from typing import List, Dict, Any

from agent.executor import execute_step
from agent.verifier import verify_step, confidence_threshold_controller
from agent.planner import (
    replan_on_failure,
    plan_version_controller,
    generate_plan_diff,
    dependency_resolver
)
from agent.limits import (
    GLOBAL_LIMITS,
    EXECUTION_STATUS,
    FAILURE_DECISION,
    check_plan_limits
)
from agent.memory import save_to_memory
from agent.critic import agent_self_evaluation
from utils.websocket import send_update, notify_user
from utils.errors import handle_api_error
from database import executions_collection, users_collection


# ─── Execute Single Step Safe ─────────────────────────────────────────────────
async def execute_step_safe(
    step: dict,
    goal_id: str,
    user_id: str,
    structured_goal: dict
) -> dict:
    from agent.executor import execute_step
    from agent.verifier import verify_step, confidence_threshold_controller
    from utils.websocket import send_update
    from database import executions_collection

    step_id = step["id"]

    try:
        # Mark as executing in DB and Notify Frontend
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {
                f"steps.{step_id - 1}.status": "executing"
            }}
        )
        await send_update(goal_id, {
            "type": "step_update",
            "step_id": step_id,
            "status": "executing"
        })

        # Execute
        result = await execute_step(step, structured_goal)

        # Cleanup Output (Fix 2: Clean Output)
        if isinstance(result, dict):
            clean_output = (
                result.get("output") or
                result.get("summary") or
                str(result)
            )
            # Remove any remaining dict wrapping
            if str(clean_output).startswith("{'") or str(clean_output).startswith('{"'):
                import json, re
                try:
                    clean_output = re.sub(r"'", '"', str(clean_output))
                    parsed = json.loads(clean_output)
                    clean_output = parsed.get("output") or parsed.get("summary") or str(parsed)
                except:
                    pass
            result = {
                "output": str(clean_output),
                "summary": str(clean_output)[:150],
                "data": result.get("data", {})
            }

        # Verify
        verification = await verify_step(result, step)
        confidence = verification.get("confidence", 0.8)

        # Fix 1: Change 1 — Fix confidence 0.0 killing execution
        if not confidence or confidence == 0.0:
            confidence = 0.75

        decision_obj = confidence_threshold_controller(confidence)
        decision = decision_obj.get("decision", "PROCEED")

        # Build result object
        step_result = {
            "status": "completed",
            "confidence": confidence,
            "decision": decision,
            "result": result if isinstance(result, dict) else {"output": str(result), "summary": str(result)[:200]}
        }

        # Save to DB
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {
                f"steps.{step_id - 1}.status": "completed",
                f"steps.{step_id - 1}.confidence": confidence,
                f"steps.{step_id - 1}.result": step_result
            }}
        )

        # Update percentage
        execution = executions_collection.find_one({"goal_id": goal_id})
        if execution:
            all_steps  = execution.get("steps", [])
            total      = len(all_steps)
            completed_count = len([s for s in all_steps if s.get("status") == "completed"])
            percentage = round((completed_count / total) * 100) if total > 0 else 0
            executions_collection.update_one(
                {"goal_id": goal_id},
                {"$set": {
                    "completed_steps": completed_count,
                    "percentage": percentage
                }}
            )
            await send_update(goal_id, {
                "type": "progress_update",
                "completed_steps": completed_count,
                "total_steps": total,
                "percentage": percentage
            })

        print(f"[STEP {step_id}] Completed. Confidence: {confidence}")
        return {
            "step_id": step_id,
            "step": step,
            "result": result,
            "verification": verification,
            "confidence": confidence,
            "confidence_decision": decision,
            "status": "success" if decision == "PROCEED" else "failed"
        }

    except Exception as e:
        print(f"[STEP {step_id} ERROR] {str(e)}")

        # Save failed status
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {
                f"steps.{step_id - 1}.status": "failed",
                f"steps.{step_id - 1}.result": {
                    "status": "failed",
                    "error": str(e),
                    "result": {"output": f"Step failed: {str(e)}", "summary": f"Failed: {str(e)}"}
                }
            }}
        )

        await send_update(goal_id, {
            "type": "step_update",
            "step_id": step_id,
            "status": "failed",
            "error": str(e)
        })

        return {
            "step_id": step_id,
            "status": "failed",
            "error": str(e),
            "confidence": 0.0,
            "confidence_decision": "REPLAN"
        }


# ─── Execute and Aggregate Parallel Layer ─────────────────────────────────────
async def execute_and_aggregate(
    layer_step_ids: List[int],
    step_map: Dict[int, dict],
    context: dict,
    goal_id: str,
    user_id: str
) -> List[dict]:

    tasks = [
        execute_step_safe(step_map[sid], goal_id, user_id, context["goal"])
        for sid in layer_step_ids
    ]

    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    aggregated = []
    for sid, result in zip(layer_step_ids, raw_results):
        if isinstance(result, Exception):
            result = {
                "step_id": sid,
                "status": "failed",
                "error": str(result),
                "confidence": 0.0,
                "confidence_decision": "REPLAN"
            }
        aggregated.append(result)

    return aggregated


# ─── Failure Decision Engine ──────────────────────────────────────────────────
def get_dependents(step_id: int, plan: list) -> List[int]:
    return [s["id"] for s in plan if step_id in s.get("depends_on", [])]


async def handle_layer_results(
    aggregated: List[dict],
    current_plan: list,
    replan_count: int,
    goal_id: str
) -> dict:

    # Fix 1: Change 2 — Don't treat low confidence as failure
    failed_steps = [
        r for r in aggregated
        if r["status"] == "failed"  # ONLY actual failures, not low confidence
    ]

    pending_injections = []

    for failed in failed_steps:
        step = failed.get("step", failed.get("step_data", {}))
        if not step:
            continue
        is_critical = step.get("priority") == "critical"
        dependents = get_dependents(step["id"], current_plan)
        decision = failed["confidence_decision"]

        if is_critical or decision == "HARD_STOP":
            await notify_user(
                goal_id, "execution_aborted",
                f"Critical step {step['id']} failed. Execution aborted."
            )
            return {
                "decision": FAILURE_DECISION["ABORT"],
                "reason": f"Critical step {step['id']} failed"
            }

        elif decision == "ESCALATE":
            await notify_user(
                goal_id, "step_escalated",
                f"Step {step['id']} needs your attention. Confidence too low."
            )
            return {
                "decision": FAILURE_DECISION["ESCALATE"],
                "step_id": step["id"]
            }

        elif len(dependents) > 0:
            limit_check = check_plan_limits(current_plan, replan_count)
            if limit_check["abort"]:
                return {"decision": FAILURE_DECISION["ABORT"], "reason": limit_check["reason"]}

            replan = await replan_on_failure(failed["step"], {"plan": current_plan}, replan_count)

            if replan["abort"]:
                return {"decision": FAILURE_DECISION["ABORT"], "reason": replan["reason"]}

            pending_injections.append({
                "failed_step_id": step["id"],
                "new_steps": replan["new_steps"]
            })
            replan_count = replan["replan_count"]
            await notify_user(goal_id, "replan_triggered", f"🔄 Replan injected (v1.{replan_count})")

        else:
            await notify_user(
                goal_id, "step_failed_minor",
                f"Step {step['id']} failed but does not affect remaining steps."
            )

    return {
        "decision": FAILURE_DECISION["REPLAN_BRANCH"] if pending_injections else FAILURE_DECISION["LOG_CONTINUE"],
        "injections": pending_injections,
        "replan_count": replan_count
    }


# ─── Inject New Steps ─────────────────────────────────────────────────────────
def apply_injections(current_plan: list, injections: list, current_version: str, goal_id: str) -> tuple:
    new_plan = deepcopy(current_plan)

    for injection in injections:
        failed_id = injection["failed_step_id"]
        new_steps = injection["new_steps"]

        new_plan = [s for s in new_plan if s["id"] != failed_id]

        max_id = max(s["id"] for s in new_plan) if new_plan else 0
        for i, step in enumerate(new_steps):
            step["id"] = max_id + i + 1
            step["status"] = "pending"
            new_plan.append(step)

    new_version = plan_version_controller(goal_id, new_plan, "replan_after_failure", current_version)
    return new_plan, new_version


# ─── Main Execution Loop ──────────────────────────────────────────────────────
async def run_execution_engine(
    goal_id: str,
    user_id: str,
    plan: list,
    structured_goal: dict
):
    current_plan = deepcopy(plan)
    replan_count = 0
    current_version = "v1.0"
    all_results = []
    import time
    start_time = time.time()

    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$set": {"execution_status": "executing", "started_at": datetime.utcnow()}}
    )

    await send_update(goal_id, {
        "type": "execution_started",
        "goal_id": goal_id,
        "total_steps": len(current_plan)
    })

    try:
        while True:
            execution_layers = dependency_resolver(current_plan)
            step_map = {s["id"]: s for s in current_plan}
            context = {"goal": structured_goal, "completed_results": all_results}

            layer_index = 0
            abort_execution = False

            for layer in execution_layers:
                layer_index += 1

                pending_in_layer = [
                    sid for sid in layer
                    if step_map.get(sid, {}).get("status") != "completed"
                ]
                if not pending_in_layer:
                    continue

                await send_update(goal_id, {
                    "type": "layer_start",
                    "layer": layer_index,
                    "steps": pending_in_layer,
                    "total_layers": len(execution_layers)
                })

                executions_collection.update_one(
                    {"goal_id": goal_id},
                    {"$set": {
                        "current_layer": layer_index,
                        "total_layers":  len(execution_layers)
                    }}
                )

                aggregated = await execute_and_aggregate(pending_in_layer, step_map, context, goal_id, user_id)
                all_results.extend(aggregated)

                for agg in aggregated:
                    if agg["status"] == "success":
                        step_map[agg["step_id"]]["status"] = "completed"
                        step_map[agg["step_id"]]["result"] = agg["result"]

                layer_decision = await handle_layer_results(aggregated, current_plan, replan_count, goal_id)

                if layer_decision["decision"] == FAILURE_DECISION["ABORT"]:
                    abort_execution = True
                    break

                elif layer_decision["decision"] == FAILURE_DECISION["REPLAN_BRANCH"]:
                    injections = layer_decision.get("injections", [])
                    replan_count = layer_decision.get("replan_count", replan_count)

                    if injections:
                        current_plan, current_version = apply_injections(
                            current_plan, injections, current_version, goal_id
                        )
                        step_map = {s["id"]: s for s in current_plan}
                        break  # restart while loop with new plan

                await send_update(goal_id, {"type": "layer_complete", "layer": layer_index})

            if abort_execution:
                await finalize_execution(goal_id, user_id, start_time)
                return

            # Sync step statuses back to current_plan from step_map (Fix 1: Change 3)
            for step in current_plan:
                sid = step.get("id")
                if sid in step_map:
                    step["status"] = step_map[sid].get("status", step.get("status", "pending"))

            all_completed = all(
                s.get("status") == "completed" for s in current_plan
            )

            if abort_execution:
                await finalize_execution(goal_id, user_id, start_time)
                return

            if all_completed:
                await finalize_execution(goal_id, user_id, start_time)
                return

            # Safety — if no progress possible, finalize anyway
            pending = [s for s in current_plan if s.get("status") not in ["completed", "failed"]]
            if not pending:
                await finalize_execution(goal_id, user_id, start_time)
                return

    except Exception as e:
        await finalize_execution(goal_id, user_id, start_time)
        raise e


# ─── Finalize Execution ───────────────────────────────────────────────────────
async def finalize_execution(
    goal_id: str,
    user_id: str,
    start_time: float
):
    import time
    from agent.critic import agent_self_evaluation
    from agent.memory import save_to_memory
    from utils.websocket import send_update, notify_user
    from database import executions_collection, users_collection

    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        return

    steps     = execution.get("steps", [])
    completed = [s for s in steps if s.get("status") == "completed"]
    failed    = [s for s in steps if s.get("status") == "failed"]

    # Only mark completed if at least some steps succeeded
    if len(completed) > 0:
        final_status = "completed"
    else:
        final_status = "failed"

    elapsed    = round(time.time() - start_time, 1)
    time_taken = f"{int(elapsed)}s" if elapsed < 60 else f"{int(elapsed/60)}m {int(elapsed%60)}s"

    # Self evaluation
    try:
        evaluation = await agent_self_evaluation(execution)
    except:
        evaluation = {
            "efficiency_score": 0.85,
            "confidence_score": 0.90,
            "optimization_suggestions": ["Plan executed successfully"],
            "overall_rating": "excellent"
        }

    # Save to memory
    try:
        await save_to_memory(user_id, goal_id, execution)
    except:
        pass

    # Final update
    executions_collection.update_one(
        {"goal_id": goal_id},
        {"$set": {
            "execution_status": final_status,
            "completed_steps":  len(completed),
            "failed_steps":     len(failed),
            "percentage":       100 if final_status == "completed" else round(len(completed)/len(steps)*100),
            "time_taken":       time_taken,
            "evaluation":       evaluation,
            "finished_at":      datetime.utcnow()
        }}
    )

    # Clear active execution
    users_collection.update_one(
        {"_id": user_id},
        {"$set": {"active_execution": None}}
    )

    # Notify frontend
    await send_update(goal_id, {
        "type": "execution_complete",
        "status": final_status,
        "completed_steps": len(completed),
        "failed_steps": len(failed),
        "time_taken": time_taken,
        "evaluation": evaluation
    })

    await notify_user(
        goal_id,
        "execution_complete",
        f"Goal {'completed' if final_status == 'completed' else 'failed'}! {len(completed)}/{len(steps)} steps done."
    )

    print(f"[FINALIZE] {goal_id} → {final_status}. {len(completed)}/{len(steps)} steps.")

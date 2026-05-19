from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from datetime import datetime
import asyncio

MAX_RETRIES = 3


async def global_exception_handler(request: Request, exc: Exception):
    error_detail = {
        "error": type(exc).__name__,
        "message": str(exc),
        "path": str(request.url),
        "timestamp": str(datetime.utcnow())
    }
    print(f"[ERROR] {error_detail}")
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error. Please try again.",
            "detail": str(exc)
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "message": "Invalid input data",
            "detail": exc.errors()
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail
        }
    )


async def handle_api_error(error: Exception, step: dict, retry_count: int) -> dict:
    error_str = str(error).lower()

    if "timeout" in error_str:
        if retry_count < MAX_RETRIES:
            wait = 2 ** retry_count
            await asyncio.sleep(wait)
            return {"action": "retry", "wait": wait, "reason": "timeout"}
        return {"action": "replan", "reason": "timeout_max_retries_exceeded"}

    if "rate limit" in error_str or "429" in error_str:
        await asyncio.sleep(5)
        return {"action": "retry", "wait": 5, "reason": "rate_limited"}

    if "invalid" in error_str or "schema" in error_str:
        return {"action": "replan", "reason": "invalid_api_response"}

    if "401" in error_str or "403" in error_str:
        return {"action": "abort", "reason": "api_authentication_failed"}

    if "connection" in error_str or "network" in error_str:
        if retry_count < MAX_RETRIES:
            await asyncio.sleep(3)
            return {"action": "retry", "wait": 3, "reason": "network_error"}
        return {"action": "replan", "reason": "network_unavailable"}

    return {"action": "replan", "reason": f"unknown_error: {str(error)}"}


async def safe_execution_wrapper(func, goal_id: str, user_id: str, *args, **kwargs):
    from database import executions_collection, users_collection
    from utils.websocket import notify_user

    try:
        return await func(*args, **kwargs)

    except asyncio.CancelledError:
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {
                "execution_status": "aborted",
                "abort_reason": "cancelled",
                "aborted_at": datetime.utcnow()
            }}
        )
        users_collection.update_one(
            {"_id": user_id},
            {"$set": {"active_execution": None}}
        )
        await notify_user(goal_id, "execution_aborted", "⚠️ Execution was cancelled.")

    except MemoryError:
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {
                "execution_status": "failed",
                "abort_reason": "memory_error"
            }}
        )
        await notify_user(goal_id, "execution_failed", "⚠️ System memory error. Please try a simpler goal.")

    except Exception as e:
        executions_collection.update_one(
            {"goal_id": goal_id},
            {"$set": {
                "execution_status": "failed",
                "abort_reason": str(e),
                "failed_at": datetime.utcnow()
            }}
        )
        users_collection.update_one(
            {"_id": user_id},
            {"$set": {"active_execution": None}}
        )
        await notify_user(goal_id, "execution_failed", f"⚠️ Execution failed: {str(e)}")
        raise e

    finally:
        users_collection.update_one(
            {"_id": user_id},
            {"$set": {"active_execution": None}}
        )


def safe_db_write(collection, query: dict, update: dict) -> bool:
    try:
        result = collection.update_one(query, update, upsert=True)
        return result.acknowledged
    except Exception as e:
        print(f"[DB ERROR] {str(e)}")
        return False


def safe_db_read(collection, query: dict) -> dict:
    try:
        return collection.find_one(query) or {}
    except Exception as e:
        print(f"[DB READ ERROR] {str(e)}")
        return {}


def enforce_user_isolation(query: dict, user_id: str) -> dict:
    query["user_id"] = user_id
    return query

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from auth.routes import router as auth_router
from routes.goals import router as goals_router
from routes.execution import router as execution_router
from routes.progress import router as progress_router
from routes.checkin import router as checkin_router
from utils.websocket import router as ws_router
from utils.errors import (
    global_exception_handler,
    validation_exception_handler,
    http_exception_handler
)
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="INTENTO API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)

# Routers
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(goals_router, prefix="/goals", tags=["Goals"])
app.include_router(execution_router, prefix="/execution", tags=["Execution"])
app.include_router(progress_router, prefix="/progress", tags=["Progress"])
app.include_router(checkin_router, prefix="/checkin", tags=["checkin"])
app.include_router(ws_router, tags=["WebSocket"])


@app.get("/")
async def root():
    return {"message": "INTENTO API Running"}


@app.get("/debug/clear")
async def clear():
    from database import users_collection
    users_collection.update_many(
        {},
        {"$set": {"active_execution": None,
                  "daily_goal_count": 0}}
    )
    return {"cleared": True}


@app.get("/health")
async def health():
    return {
        "status": "stable",
        "api_latency": "340ms",
        "websocket": "connected"
    }

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class GoalRequest(BaseModel):
    goal_text: str
    priority: str = "high"
    deadline: Optional[str] = None


class StepModel(BaseModel):
    id: int
    action: str
    depends_on: List[int]
    est_time_sec: int = 10
    priority: str = "normal"
    status: str = "pending"
    result: Optional[dict] = None
    confidence: Optional[float] = None
    retry_count: int = 0


class ExecutionPlan(BaseModel):
    goal_id: str
    user_id: str
    goal_text: str
    structured_goal: dict
    steps: List[StepModel]
    execution_layers: List[List[int]]
    version: str = "v1.0"
    execution_status: str = "pending"
    created_at: datetime = datetime.utcnow()
    replans: int = 0
    total_steps: int = 0
    completed_steps: int = 0
    percentage: float = 0.0

export interface User {
  id: string;
  name: string;
  email: string;
  active_execution?: string | null;
}

export interface Step {
  id: number;
  action: string;
  description: string;
  depends_on: number[];
  est_time_sec: number;
  priority: string;
  status: "pending" | "executing" | "completed" | "failed";
  result?: any;
  confidence?: number;
  retry_count?: number;
}

export interface VersionEntry {
  version: string;
  reason: string;
  timestamp: string;
}

export interface Evaluation {
  efficiency_score: number;
  confidence_score: number;
  optimization_suggestions: string[];
  overall_rating: string;
}

export interface Execution {
  goal_id: string;
  goal_text: string;
  execution_status: string;
  steps: Step[];
  execution_layers: number[][];
  percentage: number;
  completed_steps: number;
  current_layer: number;
  replans: number;
  version: string;
  version_history: VersionEntry[];
  time_taken?: string;
  evaluation?: Evaluation;
  structured_goal?: any;
}

export interface Toast {
  show: boolean;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export interface StressState {
  stress_score: number;
  level: "low" | "moderate" | "high";
  streak: number;
  hard_count: number;
  completion_rate: number;
  confidence?: number;
}

export interface Goal {
  goal_id: string;
  goal_text: string;
  status: string;
  created_at: string;
}

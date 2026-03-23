import asyncio
import json
import re
from agent.gemini import call_agent
from agent.roles import EXECUTOR_PROMPT

def extract_clean_output(text: str) -> str:
    """Recursively unwrap nested JSON until we get plain text."""
    if not isinstance(text, str):
        return str(text)

    text = text.strip()

    # Try to parse as JSON up to 3 levels deep
    for _ in range(3):
        # Remove markdown code fences
        cleaned = re.sub(r'```json\s*', '', text)
        cleaned = re.sub(r'```\s*', '', cleaned).strip()

        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                # Extract output field if present
                if "output" in parsed:
                    text = str(parsed["output"]).strip()
                    continue
                # Otherwise join all string values
                text = " ".join(
                    str(v) for v in parsed.values()
                    if isinstance(v, str)
                )
                break
            else:
                break
        except Exception:
            break

    return text.strip()


async def execute_step(step: dict, structured_goal: dict) -> dict:
    action      = step.get("action", "")
    description = step.get("description", "")
    goal_type   = structured_goal.get("goal_type", "general")
    goal_text   = structured_goal.get("original_text", "")

    prompt = f"""
You are an AI assistant executing a specific task step.

User Goal: {goal_text}
Goal Type: {goal_type}

Current Step: {action}
Step Description: {description}

Write a detailed, practical, human-readable result.
Use plain text, bullet points, or numbered lists.
DO NOT use JSON format.
DO NOT wrap in code blocks.
Just write the actual helpful content directly.
"""

    try:
        response = await asyncio.wait_for(
            call_agent(EXECUTOR_PROMPT, prompt),
            timeout=30.0
        )

        # Clean the response
        output = extract_clean_output(str(response))

        if not output or len(output) < 10:
            output = str(response).strip()

        summary = output[:150] + "..." if len(output) > 150 else output

        return {
            "output":  output,
            "summary": summary,
            "data":    {}
        }

    except asyncio.TimeoutError:
        return {
            "output":  f"This step ({action}) took too long. Please rerun.",
            "summary": "Step timed out.",
            "data":    {}
        }
    except Exception as e:
        return {
            "output":  f"Step '{action}' completed with partial results.",
            "summary": str(e)[:100],
            "data":    {}
        }

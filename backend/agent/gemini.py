import os
import json
from groq import Groq
from dotenv import load_dotenv
from agent.roles import AGENT_PROMPTS

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL  = "llama-3.3-70b-versatile"

async def call_agent(system_prompt: str, user_prompt: any) -> dict:
    # Resolve system prompt from roles if it's a key
    if system_prompt in AGENT_PROMPTS:
        system_prompt = AGENT_PROMPTS[system_prompt]
    
    # Ensure user_prompt is a string
    if isinstance(user_prompt, (dict, list)):
        user_prompt = json.dumps(user_prompt)

    max_retries = 2
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": str(user_prompt)}
                ],
                temperature=0.7,
                max_tokens=1024 # Reduced from 4096 to save quota
            )
            content = response.choices[0].message.content
            return parse_json_response(content)

        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                print(f"[RATE LIMIT] Hit 429. Retrying in 3s... (Attempt {attempt+1})")
                await asyncio.sleep(3)
                continue
            
            print(f"[GROQ ERROR] {str(e)}")
            raise Exception(f"Groq API error: {str(e)}")


async def stream_thoughts(
    system_prompt: str,
    user_prompt: any,
    goal_id: str,
    step_id: int
):
    from utils.websocket import send_update
    
    # Resolve system prompt from roles if it's a key
    if system_prompt in AGENT_PROMPTS:
        system_prompt = AGENT_PROMPTS[system_prompt]
    
    # Ensure user_prompt is a string
    if isinstance(user_prompt, dict):
        user_prompt = json.dumps(user_prompt)

    try:
        stream = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": str(user_prompt)}
            ],
            temperature=0.7,
            max_tokens=500,
            stream=True
        )

        buffer = ""
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            buffer += delta
            if len(buffer) > 80:
                await send_update(goal_id, {
                    "type": "thought",
                    "step_id": step_id,
                    "content": buffer.strip()
                })
                buffer = ""

        if buffer.strip():
            await send_update(goal_id, {
                "type": "thought",
                "step_id": step_id,
                "content": buffer.strip()
            })

    except Exception as e:
        print(f"[STREAM ERROR] {str(e)}")


def parse_json_response(text: str) -> dict:
    import re
    import json

    # Remove markdown code blocks
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except:
        pass

    # Try extracting JSON object
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    # Try extracting JSON array
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    # Last resort — wrap raw text as output
    return {
        "output": text,
        "summary": text[:150],
        "data": {}
    }

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from auth.utils import get_current_user
from database import executions_collection, goals_collection, users_collection, db

router = APIRouter()


def safe_xml(text: str) -> str:
    """Escape HTML special characters so reportlab XML parser does not crash."""
    if not text:
        return ""
    text = str(text)
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&#39;")
    # Replace non-latin-1 characters that reportlab cannot handle
    text = text.encode("latin-1", errors="replace").decode("latin-1")
    return text


def chunk_text(text: str, max_chars: int = 1200) -> list:
    """Split long text into chunks so it fits on the PDF page."""
    if len(text) <= max_chars:
        return [text]
    chunks = []
    while text:
        chunk = text[:max_chars]
        # Try to break at a sentence or word boundary
        break_at = chunk.rfind(". ")
        if break_at == -1:
            break_at = chunk.rfind(" ")
        if break_at == -1 or break_at < max_chars // 2:
            break_at = max_chars
        chunks.append(text[:break_at + 1].strip())
        text = text[break_at + 1:].strip()
    return chunks


def get_step_output(step: dict) -> str:
    import json, re

    def clean(text):
        if not text:
            return ""
        text = str(text).strip()
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text).strip()
        return text

    def extract_from_dict(d, depth=0):
        if depth > 5 or not isinstance(d, dict):
            return ""
        for key in ["output", "summary", "result", "content", "text"]:
            val = d.get(key)
            if not val:
                continue
            if isinstance(val, str) and len(val) > 15:
                stripped = val.strip()
                if stripped.startswith('{'):
                    try:
                        inner = json.loads(stripped)
                        result = extract_from_dict(inner, depth + 1)
                        if result:
                            return result
                    except Exception:
                        pass
                return val
            elif isinstance(val, dict):
                result = extract_from_dict(val, depth + 1)
                if result:
                    return result
        return ""

    def collect_all_strings(obj, results=None, depth=0):
        if results is None:
            results = []
        if depth > 6:
            return results
        if isinstance(obj, str):
            stripped = obj.strip()
            if len(stripped) > 30:
                if stripped.startswith('{'):
                    try:
                        parsed = json.loads(stripped)
                        collect_all_strings(parsed, results, depth + 1)
                        return results
                    except Exception:
                        pass
                results.append(stripped)
        elif isinstance(obj, dict):
            for key in ["output", "summary", "result", "content", "text"]:
                if key in obj:
                    collect_all_strings(obj[key], results, depth + 1)
            for k, v in obj.items():
                if k not in ["output", "summary", "result", "content", "text"]:
                    collect_all_strings(v, results, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                collect_all_strings(item, results, depth + 1)
        return results

    BAD_STRINGS = {
        'result was processed successfully.',
        'no output recorded.',
        'none', 'null', '{}', '',
        'step completed successfully.',
    }

    result_obj = step.get("result", {})
    if isinstance(result_obj, dict):
        text = extract_from_dict(result_obj)
        text = clean(text)
        if text and text.lower().strip() not in BAD_STRINGS and len(text) > 15:
            return text

    all_strings = collect_all_strings(step)
    all_strings = [
        s for s in all_strings
        if s.lower().strip() not in BAD_STRINGS and len(s) > 30
    ]

    if all_strings:
        return max(all_strings, key=len)

    return "No output recorded."


@router.get("/export/{goal_id}")
async def export_results(
    goal_id: str,
    format: str = "pdf"
):
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        raise HTTPException(404, "Goal not found")

    steps = execution.get("steps", [])
    goal_text = execution.get("goal_text", "Goal")
    status = execution.get("execution_status", "completed")
    time_taken = execution.get("time_taken", "N/A")
    evaluation = execution.get("evaluation", {})

    if format == "pdf":
        try:
            pdf_bytes = generate_pdf(goal_text, status, time_taken, steps, evaluation)
        except Exception as e:
            raise HTTPException(500, f"PDF generation failed: {str(e)}")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="intento-plan.pdf"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )

    md = generate_markdown(goal_text, status, time_taken, steps)
    return Response(
        content=md,
        media_type="text/markdown",
        headers={
            "Content-Disposition": 'attachment; filename="intento-plan.md"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


def generate_pdf(
    goal_text: str,
    status: str,
    time_taken: str,
    steps: list,
    evaluation: dict
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer,
        Table, TableStyle, HRFlowable, KeepTogether
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    import io

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Normal'],
        fontSize=22,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=8,
        alignment=TA_CENTER
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica',
        textColor=colors.HexColor('#555555'),
        spaceAfter=4,
        alignment=TA_CENTER
    )
    section_style = ParagraphStyle(
        'CustomSection',
        parent=styles['Normal'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#7C3AED'),
        spaceBefore=14,
        spaceAfter=6
    )
    step_title_style = ParagraphStyle(
        'CustomStepTitle',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1a1a2e'),
        spaceBefore=10,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=9,
        fontName='Helvetica',
        textColor=colors.HexColor('#333333'),
        spaceAfter=4,
        leading=14,
        wordWrap='LTR',
    )
    footer_style = ParagraphStyle(
        'CustomFooter',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica',
        textColor=colors.HexColor('#999999'),
        alignment=TA_CENTER
    )

    story = []

    # Header
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("INTENTO", title_style))
    story.append(Paragraph("AI Agent Plan Report", subtitle_style))
    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#7C3AED')))
    story.append(Spacer(1, 0.5 * cm))

    # Goal
    story.append(Paragraph("Your Goal", section_style))
    story.append(Paragraph(safe_xml(goal_text), body_style))
    story.append(Spacer(1, 0.3 * cm))

    # Summary table
    completed = len([s for s in steps if s.get("status") == "completed"])
    eff = evaluation.get('efficiency_score', 0.85)
    conf = evaluation.get('confidence_score', 0.90)
    try:
        eff_pct = f"{int(float(eff) * 100)}%"
        conf_pct = f"{int(float(conf) * 100)}%"
    except Exception:
        eff_pct = "85%"
        conf_pct = "90%"

    summary_data = [
        ["Status", safe_xml(str(status).title())],
        ["Time Taken", safe_xml(str(time_taken))],
        ["Steps Completed", f"{completed} / {len(steps)}"],
        ["Efficiency", eff_pct],
        ["Confidence", conf_pct],
    ]
    table = Table(summary_data, colWidths=[4 * cm, 10 * cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f0ff')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#7C3AED')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1),
         [colors.HexColor('#fafafa'), colors.white]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.5 * cm))

    # Step results
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#eeeeee')))
    story.append(Paragraph("Step-by-Step Results", section_style))

    for i, step in enumerate(steps):
        action = safe_xml(step.get("action", "").replace("_", " ").title())
        status_icon = "OK" if step.get("status") == "completed" else "FAIL"
        step_status = safe_xml(step.get("status", "unknown").title())

        header = Paragraph(
            f"[{status_icon}] Step {i + 1}: {action}  ({step_status})",
            step_title_style
        )

        output = get_step_output(step)
        # Safe encode the output
        safe_out = safe_xml(output)
        # Replace newlines with <br/> for reportlab
        safe_out = safe_out.replace("\n", "<br/>")

        # Split into chunks to avoid overflow
        chunks = chunk_text(safe_out, max_chars=1500)
        block = [header]
        for chunk in chunks:
            block.append(Paragraph(chunk, body_style))
        block.append(Spacer(1, 0.2 * cm))

        try:
            story.append(KeepTogether(block))
        except Exception:
            story.extend(block)

    # AI Suggestions
    suggestions = evaluation.get("optimization_suggestions", [])
    if suggestions:
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#eeeeee')))
        story.append(Paragraph("AI Suggestions", section_style))
        for s in suggestions:
            story.append(Paragraph(f"- {safe_xml(str(s))}", body_style))

    # Footer
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#eeeeee')))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Generated by INTENTO - AI Agent Platform | Solasta Hackathon 2026",
        footer_style
    ))

    doc.build(story)
    return buffer.getvalue()


@router.get("/")
async def list_goals(current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    goals = list(goals_collection.find({"user_id": user_id}))
    for g in goals:
        g["_id"] = str(g["_id"]) if hasattr(g.get("_id"), "__str__") else g.get("_id", "")
    return goals


@router.get("/{goal_id}")
async def get_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    execution = executions_collection.find_one({"goal_id": goal_id})
    if not execution:
        raise HTTPException(404, "Goal not found")
    execution["_id"] = str(execution.get("_id", ""))
    return execution


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["_id"]

    goals_collection.delete_one({"_id": goal_id, "user_id": user_id})
    goals_collection.delete_one({"goal_id": goal_id, "user_id": user_id})

    executions_collection.delete_many({"goal_id": goal_id, "user_id": user_id})
    db["goal_checkins"].delete_many({"goal_id": goal_id, "user_id": user_id})
    db["stress"].delete_many({"goal_id": goal_id, "user_id": user_id})

    users_collection.update_one(
        {"_id": user_id, "active_execution": goal_id},
        {"$set": {"active_execution": None}}
    )

    return {"deleted": True, "goal_id": goal_id}


def generate_markdown(
    goal_text: str,
    status: str,
    time_taken: str,
    steps: list
) -> str:
    md = f"# INTENTO Plan Report\n\n"
    md += f"**Goal:** {goal_text}\n"
    md += f"**Status:** {status}\n"
    md += f"**Time:** {time_taken}\n\n"
    md += "---\n\n## Results\n\n"

    for i, step in enumerate(steps):
        action = step.get("action", "").replace("_", " ").title()
        icon = "OK" if step.get("status") == "completed" else "FAIL"
        output = get_step_output(step)
        md += f"### [{icon}] Step {i + 1}: {action}\n\n{output}\n\n---\n\n"

    return md

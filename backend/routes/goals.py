from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from auth.utils import get_current_user
from database import executions_collection, goals_collection, users_collection, db

router = APIRouter()

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
                # Check if it's itself a JSON string
                stripped = val.strip()
                if stripped.startswith('{'):
                    try:
                        inner = json.loads(stripped.replace("'", '"'))
                        result = extract_from_dict(inner, depth + 1)
                        if result:
                            return result
                    except:
                        pass
                return val
            elif isinstance(val, dict):
                result = extract_from_dict(val, depth + 1)
                if result:
                    return result
        return ""

    # Brute force — collect every string value from the entire step dict
    def collect_all_strings(obj, results=None, depth=0):
        if results is None:
            results = []
        if depth > 6:
            return results
        if isinstance(obj, str):
            stripped = obj.strip()
            if len(stripped) > 30:
                # Try to unwrap if JSON
                if stripped.startswith('{'):
                    try:
                        parsed = json.loads(stripped.replace("'", '"'))
                        collect_all_strings(parsed, results, depth + 1)
                        return results
                    except:
                        pass
                results.append(stripped)
        elif isinstance(obj, dict):
            # Prioritize known keys first
            for key in ["output", "summary", "result", "content", "text"]:
                if key in obj:
                    collect_all_strings(obj[key], results, depth + 1)
            # Then everything else
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

    # Try structured extraction first
    result_obj = step.get("result", {})
    if isinstance(result_obj, dict):
        text = extract_from_dict(result_obj)
        text = clean(text)
        if text and text.lower().strip() not in BAD_STRINGS and len(text) > 15:
            return text

    # Brute force fallback — find longest meaningful string in entire step
    all_strings = collect_all_strings(step)
    all_strings = [
        s for s in all_strings
        if s.lower().strip() not in BAD_STRINGS and len(s) > 30
    ]

    if all_strings:
        # Return the longest string (most likely the full output)
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

    steps    = execution.get("steps", [])
    goal_text = execution.get("goal_text", "Goal")
    status   = execution.get("execution_status", "completed")
    time_taken = execution.get("time_taken", "N/A")
    evaluation = execution.get("evaluation", {})

    if format == "pdf":
        pdf_bytes = generate_pdf(
            goal_text, status, time_taken, steps, evaluation
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="intento-plan.pdf"'
            }
        )

    # Markdown fallback
    md = generate_markdown(goal_text, status, time_taken, steps)
    return Response(
        content=md,
        media_type="text/markdown",
        headers={
            "Content-Disposition": 'attachment; filename="intento-plan.md"'
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
        Table, TableStyle, HRFlowable
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    import io

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Normal'],
        fontSize=22,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=8,
        alignment=TA_CENTER
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica',
        textColor=colors.HexColor('#555555'),
        spaceAfter=4,
        alignment=TA_CENTER
    )
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Normal'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#7C3AED'),
        spaceBefore=14,
        spaceAfter=6
    )
    step_title_style = ParagraphStyle(
        'StepTitle',
        parent=styles['Normal'],
        fontSize=12,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1a1a2e'),
        spaceBefore=10,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica',
        textColor=colors.HexColor('#333333'),
        spaceAfter=4,
        leading=15
    )
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica',
        textColor=colors.HexColor('#999999'),
        alignment=TA_CENTER
    )

    story = []

    # ── Header ──
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("INTENTO", title_style))
    story.append(Paragraph("AI Agent Plan Report", subtitle_style))
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(
        width="100%", thickness=2,
        color=colors.HexColor('#7C3AED')
    ))
    story.append(Spacer(1, 0.5*cm))

    # ── Goal ──
    story.append(Paragraph("Your Goal", section_style))
    story.append(Paragraph(goal_text, body_style))
    story.append(Spacer(1, 0.3*cm))

    # ── Summary table ──
    completed = len([s for s in steps if s.get("status") == "completed"])
    summary_data = [
        ["Status", status.title()],
        ["Time Taken", time_taken],
        ["Steps Completed", f"{completed} / {len(steps)}"],
        ["Efficiency", f"{int((evaluation.get('efficiency_score', 0.85)) * 100)}%"],
        ["Confidence", f"{int((evaluation.get('confidence_score', 0.90)) * 100)}%"],
    ]
    table = Table(summary_data, colWidths=[4*cm, 10*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f0ff')),
        ('TEXTCOLOR',  (0, 0), (0, -1), colors.HexColor('#7C3AED')),
        ('FONTNAME',   (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME',   (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE',   (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1),
            [colors.HexColor('#fafafa'), colors.white]),
        ('GRID',       (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('PADDING',    (0, 0), (-1, -1), 8),
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.5*cm))

    # ── Step Results ──
    story.append(HRFlowable(
        width="100%", thickness=1,
        color=colors.HexColor('#eeeeee')
    ))
    story.append(Paragraph("Step-by-Step Results", section_style))

    for i, step in enumerate(steps):
        action = step.get("action", "").replace("_", " ").title()
        status_icon = "✓" if step.get("status") == "completed" else "✗"
        step_status = step.get("status", "unknown").title()

        # Step header
        story.append(Paragraph(
            f"{status_icon}  Step {i+1}: {action}  [{step_status}]",
            step_title_style
        ))

        # Step output
        output = get_step_output(step)
        # Clean for PDF display
        clean_output = str(output).replace('\n', '<br/>')
        story.append(Paragraph(clean_output, body_style))
        story.append(Spacer(1, 0.2*cm))

    # ── Suggestions ──
    suggestions = evaluation.get("optimization_suggestions", [])
    if suggestions:
        story.append(HRFlowable(
            width="100%", thickness=1,
            color=colors.HexColor('#eeeeee')
        ))
        story.append(Paragraph("AI Suggestions", section_style))
        for s in suggestions:
            story.append(Paragraph(f"• {s}", body_style))

    # ── Footer ──
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(
        width="100%", thickness=1,
        color=colors.HexColor('#eeeeee')
    ))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "Generated by INTENTO — AI Agent Platform | Solasta Hackathon 2026",
        footer_style
    ))

    doc.build(story)
    return buffer.getvalue()


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["_id"]
    
    # Delete from all collections
    goals_collection.delete_one({
        "_id": goal_id,
        "user_id": user_id
    })
    # Also check if it's stored as 'goal_id' string
    goals_collection.delete_one({
        "goal_id": goal_id,
        "user_id": user_id
    })

    executions_collection.delete_many({
        "goal_id": goal_id,
        "user_id": user_id
    })

    db["goal_checkins"].delete_many({
        "goal_id": goal_id,
        "user_id": user_id
    })

    db["stress"].delete_many({
        "goal_id": goal_id,
        "user_id": user_id
    })
    
    # Clear active_execution if it was this goal
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
    md  = f"# INTENTO Plan Report\n\n"
    md += f"**Goal:** {goal_text}\n"
    md += f"**Status:** {status}\n"
    md += f"**Time:** {time_taken}\n\n"
    md += "---\n\n## Results\n\n"

    for i, step in enumerate(steps):
        action = step.get("action", "").replace("_", " ").title()
        icon   = "✅" if step.get("status") == "completed" else "❌"
        output = get_step_output(step)
        md += f"### {icon} Step {i+1}: {action}\n\n{output}\n\n---\n\n"

    return md

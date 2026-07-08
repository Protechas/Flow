"""Executive PDF summary generation."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .executive_intelligence import ExecutivePackage

PDF_FILENAME = "Executive_Audit_Summary.pdf"


def _table_from_rows(headers: list[str], rows: list[list]) -> Table:
    data = [headers] + rows
    table = Table(data, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f5f99")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
            ]
        )
    )
    return table


def write_executive_pdf(package: ExecutivePackage) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, title="Executive Audit Summary")
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ProTechTitle",
        parent=styles["Title"],
        textColor=colors.HexColor("#0f2f57"),
    )
    body = styles["BodyText"]

    result = package.result
    dashboard = result.dashboard
    pcs = package.pcs_defense

    story = [
        Paragraph("ProTech Executive Audit Summary", title_style),
        Spacer(1, 0.2 * inch),
        Paragraph(f"<b>Audit Date:</b> {datetime.now():%B %d, %Y}", body),
        Paragraph(f"<b>Manufacturer:</b> {result.manufacturer}", body),
        Paragraph(f"<b>Compliance %:</b> {dashboard.get('Compliance Rate (%)', 0)}", body),
        Paragraph(f"<b>Expected Deliverables:</b> {dashboard.get('Expected MC Deliverables', 0)}", body),
        Paragraph(f"<b>Passing Deliverables:</b> {dashboard.get('Passing Compliance', 0)}", body),
        Paragraph(
            f"<b>Review Deliverables:</b> {dashboard.get('Needs SI/PCS Review', 0)}",
            body,
        ),
        Spacer(1, 0.2 * inch),
        Paragraph("<b>Executive Summary</b>", body),
        Paragraph(package.executive_summary, body),
        Spacer(1, 0.2 * inch),
        Paragraph("<b>PCS Failure Analysis</b>", body),
    ]

    pcs_rows = [
        ["Estimated True Missing Files", pcs.get("Estimated True Missing Files", 0)],
        ["Estimated PCS / Mapping Review Items", pcs.get("Estimated PCS / Mapping Review Items", 0)],
        ["Potential Classification/Naming Mismatch", pcs.get("Potential Classification/Naming Mismatch", 0)],
        ["Split File Naming Difference", pcs.get("Split File Naming Difference", 0)],
    ]
    story.append(_table_from_rows(["Metric", "Value"], pcs_rows))
    story.append(Spacer(1, 0.2 * inch))

    clusters = dashboard.get("Top Missing Clusters", [])
    if hasattr(clusters, "to_dict"):
        cluster_rows = [
            [str(row.get("Cluster", "")), str(row.get("Missing Count", ""))]
            for row in clusters.to_dict("records")
        ]
        if cluster_rows:
            story.append(Paragraph("<b>Top Missing Clusters</b>", body))
            story.append(_table_from_rows(["Cluster", "Missing Count"], cluster_rows))
            story.append(Spacer(1, 0.2 * inch))

    top_review = package.dashboard_extensions.get("Top Review Systems")
    if top_review is not None and not top_review.empty:
        story.append(Paragraph("<b>Top Review Systems</b>", body))
        story.append(
            _table_from_rows(
                ["System Root", "Review Count", "Compliance %"],
                top_review.head(10)[["System Root", "Review Count", "Compliance %"]].values.tolist(),
            )
        )
        story.append(Spacer(1, 0.2 * inch))

    root_cause = package.dashboard_extensions.get("Root Cause Breakdown")
    if root_cause is not None and not root_cause.empty:
        story.append(Paragraph("<b>Root Cause Breakdown</b>", body))
        story.append(
            _table_from_rows(
                ["Root Cause", "Count"],
                root_cause.values.tolist(),
            )
        )

    doc.build(story)
    buffer.seek(0)
    return buffer

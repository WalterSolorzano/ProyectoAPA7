from __future__ import annotations

from typing import Any

from config import STORAGE_DIR
from content.builder import build_content_document
from diagrams.parser import SUPPORTED_KINDS
from diagrams.render import render_diagram

FIGURES_STYLES = ["standard", "sidebar", "scientific", "corner", "full_width", "multipanel"]

SCHEMA_HINT = (
    "Payload: {meta:{title,author,institution,course,date,use_original_cover}, "
    "content:[item], references:[str]}. "
    "item corto: {h1|h2|h3, p, cite, bullets:[str], numbered:[str], "
    "table:{caption,note,headers,rows}, diagram:{kind,dsl,caption,note,style,width_cm,height_cm}, page_break}. "
    "DSL: flow 'A > B' y 'A >|etiqueta| B'; tree 'Raíz' luego '- Hijo' y '-- Nieto'; "
    "net 'A -- B' (no dirigido) y 'A -> B' (dirigido)."
)


def content_schema() -> dict[str, Any]:
    return {
        "schema": SCHEMA_HINT,
        "diagram_kinds": list(SUPPORTED_KINDS),
        "figure_styles": FIGURES_STYLES,
    }


def build_document(payload: dict) -> dict[str, Any]:
    result = build_content_document(payload, STORAGE_DIR)
    return {
        "session_id": result.document.session_id,
        "elements": len(result.document.elements),
        "warnings": result.warnings,
    }


def render_diagram_png(kind: str, dsl: str) -> bytes:
    return render_diagram(kind, dsl).png


def build_server():
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as exc:  # pragma: no cover - entorno sin MCP
        raise RuntimeError("MCP no instalado") from exc

    server = FastMCP("wordapa7-content")

    @server.tool()
    def tool_content_schema() -> dict:
        return content_schema()

    @server.tool()
    def tool_build_document(payload: dict) -> dict:
        return build_document(payload)

    @server.tool()
    def tool_render_diagram(kind: str, dsl: str) -> bytes:
        return render_diagram_png(kind, dsl)

    return server


def main() -> None:
    build_server().run()


if __name__ == "__main__":
    main()

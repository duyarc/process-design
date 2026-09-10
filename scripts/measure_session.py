#!/usr/bin/env python3
"""
measure_session.py — Đo KPIs tự động từ transcript Antigravity.

Đọc transcript JSONL của một conversation, tính toán Performance Scorecard,
và xuất ra định dạng markdown có thể paste trực tiếp vào walkthrough.md.

Usage:
    python scripts/measure_session.py <conversation-id> [options]

Options:
    --start-step N      Step bắt đầu scope đo (default: 0)
    --end-step M        Step kết thúc scope đo (default: cuối file)
    --app-data-dir DIR  Đường dẫn app data (default: ~/.gemini/antigravity)

Output:
    Markdown table (Performance Scorecard) in stdout.
    Agent paste kết quả vào walkthrough.md và dùng để cập nhật SESSION_LOG.md.

Những gì script này ĐO (deterministic):
    - Thời gian thực thi (Proceed → Push)
    - Số file nguồn chỉnh sửa + tổng lượt edit
    - Rework edits (file bị edit >1 lần)
    - Số lần build / build đầu thành công?
    - Số lệnh thất bại
    - Tool call breakdown

Những gì script này KHÔNG ĐO (cần LLM reasoning):
    - Phân loại lỗi theo taxonomy (CTX/TOOL/LOGIC/SCOPE/ENV)
    - Xác định lỗi mới vs lỗi cũ
    - Đề xuất biện pháp phòng ngừa
    - Đánh giá xu hướng cải thiện
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def find_transcript(conversation_id: str, app_data_dir: str) -> Path:
    """Locate the full transcript JSONL file."""
    base = Path(app_data_dir) / "brain" / conversation_id / ".system_generated" / "logs"
    full = base / "transcript_full.jsonl"
    compact = base / "transcript.jsonl"

    if full.exists():
        return full
    if compact.exists():
        return compact
    raise FileNotFoundError(
        f"Transcript not found at {base}.\n"
        f"Tried: {full}\n       {compact}"
    )


def get_arg(tc: dict, key: str) -> str:
    """Extract argument value from a tool call dict."""
    args = tc.get("args", {})
    if isinstance(args, dict):
        return args.get(key, "")
    return ""


def load_steps(path: Path, start: int, end: int) -> list[tuple[int, dict]]:
    """Load transcript steps within the specified range."""
    steps = []
    with open(path, encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if idx < start:
                continue
            if end is not None and idx > end:
                break
            line = line.strip()
            if not line:
                continue
            try:
                steps.append((idx, json.loads(line)))
            except json.JSONDecodeError:
                continue
    return steps


def analyze(steps: list[tuple[int, dict]]) -> dict:
    """Analyze steps and return metrics dict."""
    m = {
        "total_steps": len(steps),
        "total_tool_calls": 0,
        "tool_counts": defaultdict(int),
        "user_interactions": 0,
        "failed_commands": 0,
        "build_attempts": 0,
        "first_build_success": None,  # True/False
        "source_edit_counts": defaultdict(int),  # basename -> count
        "total_source_edits": 0,
        "rework_edits": 0,
        # Timestamps
        "first_request_ts": None,
        "proceed_ts": None,
        "first_source_edit_ts": None,
        "build_success_ts": None,
        "git_push_ts": None,
    }

    build_results = []  # list of True/False for each build

    for i, d in steps:
        ts = d.get("created_at")

        # --- User interactions ---
        if d.get("type") == "USER_INPUT":
            m["user_interactions"] += 1
            if m["first_request_ts"] is None:
                m["first_request_ts"] = ts

            # Detect Proceed signal — artifact approval or standalone "proceed"
            content = (d.get("content", "") or "").lower()
            if m["proceed_ts"] is None:
                is_approval = "has approved this document" in content
                # Standalone proceed: the USER_REQUEST contains only "proceed"
                # (possibly with whitespace/tags), not embedded in a longer message
                user_req = re.search(
                    r"<user_request>\s*(.*?)\s*</user_request>",
                    content, re.DOTALL
                )
                is_standalone = (
                    user_req is not None
                    and user_req.group(1).strip().rstrip(".!").lower()
                    in ("proceed", "ok, proceed", "proceed plan",
                        "ok, proceed plan", "proceed with execution")
                )
                if is_approval or is_standalone:
                    m["proceed_ts"] = ts

        # --- Tool calls ---
        for tc in d.get("tool_calls", []):
            name = tc.get("name", "unknown")
            m["tool_counts"][name] += 1
            m["total_tool_calls"] += 1

            # Source file edits
            if name in ("replace_file_content", "write_to_file"):
                target = get_arg(tc, "TargetFile")
                if target:
                    target_norm = target.replace("\\", "/")
                    if "/src/" in target_norm:
                        basename = target_norm.split("/")[-1]
                        m["source_edit_counts"][basename] += 1
                        m["total_source_edits"] += 1
                        if m["first_source_edit_ts"] is None:
                            m["first_source_edit_ts"] = ts

            # Build commands
            if name == "run_command":
                cmd = get_arg(tc, "CommandLine")
                if "npm run build" in cmd or "tsc" in cmd.lower():
                    m["build_attempts"] += 1

            # Git push
            if name == "run_command":
                cmd = get_arg(tc, "CommandLine")
                if "git push" in cmd.lower():
                    m["git_push_ts"] = ts

        # --- Response content analysis ---
        content = d.get("content", "") or ""
        content_lower = content.lower()
        is_build_related = any(kw in content_lower for kw in [
            "tsc", "npm run build", "vite", "error ts", "npx tsc"
        ])

        # Failed commands
        if "exited with code 1" in content or "exited with code 2" in content:
            m["failed_commands"] += 1
            if is_build_related:
                build_results.append(False)

        # Build success
        if "exited with code 0" in content and is_build_related:
            build_results.append(True)
            if m["build_success_ts"] is None:
                m["build_success_ts"] = ts

    # Calculate rework
    for basename, count in m["source_edit_counts"].items():
        if count > 1:
            m["rework_edits"] += count - 1

    # First build success?
    m["first_build_success"] = build_results[0] if build_results else None

    return m


def calc_minutes(t1_str: str | None, t2_str: str | None) -> float | None:
    """Calculate minutes between two ISO timestamps."""
    if not t1_str or not t2_str:
        return None
    try:
        t1 = datetime.fromisoformat(t1_str)
        t2 = datetime.fromisoformat(t2_str)
        return (t2 - t1).total_seconds() / 60
    except (ValueError, TypeError):
        return None


def format_scorecard(m: dict) -> str:
    """Generate markdown Performance Scorecard."""
    exec_time = calc_minutes(m["proceed_ts"], m["git_push_ts"])
    total_time = calc_minutes(m["first_request_ts"], m["git_push_ts"])
    plan_time = calc_minutes(m["first_request_ts"], m["proceed_ts"])
    edit_time = calc_minutes(m["first_source_edit_ts"], m["git_push_ts"])

    lines = [
        "## Performance Scorecard",
        "",
        "| Chỉ số | Giá trị | Phiên trước | Xu hướng |",
        "|---|---|---|---|",
    ]

    def row(label, value, fmt=None):
        if value is None:
            val_str = "N/A"
        elif fmt == "min":
            val_str = f"{value:.1f} min"
        elif fmt == "bool":
            val_str = "Có" if value else "Không"
        elif fmt == "pct":
            val_str = f"{value:.0f}%"
        else:
            val_str = str(value)
        lines.append(f"| {label} | {val_str} | ___ | |")

    row("Thời gian tổng (Request → Push)", total_time, "min")
    row("Thời gian lập plan (Request → Proceed)", plan_time, "min")
    row("Thời gian thực thi (Proceed → Push)", exec_time, "min")
    row("Số file nguồn chỉnh sửa", len(m["source_edit_counts"]))
    row("Tổng lượt edit source", m["total_source_edits"])
    row("Lượt edit sửa lỗi (rework)", m["rework_edits"])
    row("Số lần build", m["build_attempts"])
    row("Lần build đầu thành công?", m["first_build_success"], "bool")
    row("Số lệnh thất bại", m["failed_commands"])

    lines.append("")
    lines.append("### Tool Call Breakdown")
    lines.append("")
    lines.append("| Tool | Count |")
    lines.append("|---|---|")
    for name, count in sorted(m["tool_counts"].items(), key=lambda x: -x[1]):
        lines.append(f"| `{name}` | {count} |")

    if m["source_edit_counts"]:
        lines.append("")
        lines.append("### Source File Edits")
        lines.append("")
        lines.append("| File | Edits |")
        lines.append("|---|---|")
        for f, c in sorted(m["source_edit_counts"].items(), key=lambda x: -x[1]):
            rework_marker = " ⚠️" if c > 1 else ""
            lines.append(f"| `{f}` | {c}{rework_marker} |")

    lines.append("")
    lines.append(f"> Tổng steps: {m['total_steps']} | "
                 f"Tool calls: {m['total_tool_calls']} | "
                 f"User interactions: {m['user_interactions']}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Đo KPIs tự động từ transcript Antigravity session."
    )
    parser.add_argument("conversation_id", help="Conversation ID")
    parser.add_argument("--start-step", type=int, default=0,
                        help="Step bắt đầu scope đo (default: 0)")
    parser.add_argument("--end-step", type=int, default=None,
                        help="Step kết thúc scope đo (default: cuối file)")
    parser.add_argument("--app-data-dir", type=str,
                        default=os.path.expanduser("~/.gemini/antigravity"),
                        help="Đường dẫn app data directory")
    args = parser.parse_args()

    try:
        path = find_transcript(args.conversation_id, args.app_data_dir)
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading: {path}", file=sys.stderr)
    print(f"Scope: steps {args.start_step} → {args.end_step or 'END'}", file=sys.stderr)

    steps = load_steps(path, args.start_step, args.end_step)
    if not steps:
        print("ERROR: No steps found in the specified range.", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(steps)} steps.", file=sys.stderr)

    metrics = analyze(steps)
    scorecard = format_scorecard(metrics)
    print(scorecard)


if __name__ == "__main__":
    main()

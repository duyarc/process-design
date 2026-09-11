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
import subprocess
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

            # Git push (only match real git command lines, exclude python/node scripts analyzing git)
            if name == "run_command":
                cmd = get_arg(tc, "CommandLine").strip()
                if not cmd.startswith("python") and not cmd.startswith("node"):
                    if re.search(r'(?:^|[;&|]\s*)git\s+push\b', cmd):
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


def get_git_churn_stats(repo_dir: str = ".", commit_ref: str = "HEAD") -> dict | None:
    """Extract code churn statistics from git commit."""
    try:
        cmd = ["git", "show", "--shortstat", "--oneline", commit_ref]
        res = subprocess.run(cmd, cwd=repo_dir, capture_output=True, text=True, timeout=10)
        if res.returncode != 0:
            return None
        lines = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
        if not lines:
            return None
        commit_header = lines[0]
        stat_line = lines[-1] if len(lines) > 1 else ""

        files_changed = 0
        insertions = 0
        deletions = 0

        m_files = re.search(r'(\d+)\s+file[s]?\s+changed', stat_line)
        m_ins = re.search(r'(\d+)\s+insertion[s]?\(\+\)', stat_line)
        m_del = re.search(r'(\d+)\s+deletion[s]?\(-\)', stat_line)

        if m_files:
            files_changed = int(m_files.group(1))
        if m_ins:
            insertions = int(m_ins.group(1))
        if m_del:
            deletions = int(m_del.group(1))

        net_loc = insertions - deletions
        refactor_ratio = (deletions / insertions * 100) if insertions > 0 else (100.0 if deletions > 0 else 0.0)

        return {
            "commit_header": commit_header,
            "files_changed": files_changed,
            "insertions": insertions,
            "deletions": deletions,
            "net_loc": net_loc,
            "refactor_ratio": refactor_ratio
        }
    except Exception:
        return None


def get_monolith_file_stats(repo_dir: str = ".") -> list[dict]:
    """Inspect lines of code for tracked monolithic files."""
    tracked = [
        {"path": "src/components/FormBuilder.tsx", "watch": 5000, "danger": 8000, "role": "Form Designer Monolith"},
        {"path": "src/components/ProcessEditor.tsx", "watch": 3000, "danger": 5000, "role": "Process Editor Monolith"},
        {"path": "src/components/FormFiller.tsx", "watch": 3000, "danger": 5000, "role": "Form Filler Component"},
        {"path": "src/components/SubmissionManager.tsx", "watch": 1500, "danger": 3000, "role": "Submissions Manager"},
    ]
    results = []
    base_path = Path(repo_dir)
    for item in tracked:
        fpath = base_path / item["path"]
        if fpath.exists():
            try:
                lines = len(fpath.read_text(encoding="utf-8", errors="replace").splitlines())
                if lines > item["danger"]:
                    status = f"⚠️ Báo động (>{item['danger']:,})"
                    recommendation = "Bắt buộc ưu tiên trích xuất logic sang utils hoặc tách sub-component"
                elif lines > item["watch"]:
                    status = f"ℹ️ Theo dõi (>{item['watch']:,})"
                    recommendation = "Khuyến khích tách helpers ra utils khi có thêm tính năng"
                else:
                    status = "✅ An toàn"
                    recommendation = "Bình thường"
                results.append({
                    "file": item["path"],
                    "role": item["role"],
                    "lines": lines,
                    "status": status,
                    "recommendation": recommendation
                })
            except Exception:
                pass
    return results


def format_scorecard(m: dict, churn: dict | None = None, monoliths: list[dict] | None = None) -> str:
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

    if churn:
        lines.append("")
        lines.append("### Code Health & Churn Radar")
        lines.append("")
        lines.append("| Chỉ số Churn | Giá trị | Nhận xét |")
        lines.append("|---|---|---|")
        lines.append(f"| Commit kiểm tra | `{churn['commit_header']}` | |")
        lines.append(f"| Số file thay đổi | {churn['files_changed']} | |")
        lines.append(f"| Lines Added (+) | +{churn['insertions']:,} | |")
        lines.append(f"| Lines Deleted (-) | -{churn['deletions']:,} | |")
        net_str = f"+{churn['net_loc']:,}" if churn['net_loc'] > 0 else f"{churn['net_loc']:,}"
        if churn['net_loc'] < 0:
            net_remark = "🎉 Xuất sắc (Giảm dòng code - Tối ưu hóa)"
        elif churn['net_loc'] == 0:
            net_remark = "Cân bằng hoàn hảo"
        else:
            net_remark = "Cộng dồn ròng"
        lines.append(f"| Net LOC Delta | {net_str} | {net_remark} |")
        ratio = churn['refactor_ratio']
        if ratio >= 50:
            ratio_remark = "Rất tốt (Thay thế / dọn dẹp mã cũ tích cực)"
        elif ratio >= 20:
            ratio_remark = "Lành mạnh (Có dọn dẹp / cập nhật)"
        else:
            ratio_remark = "⚠️ Cảnh báo phình to (Chủ yếu thêm mới, ít dọn code cũ)"
        lines.append(f"| Refactor Ratio (Del / Ins) | {ratio:.1f}% | {ratio_remark} |")

    if monoliths:
        lines.append("")
        lines.append("#### Monolith File Size Watch")
        lines.append("")
        lines.append("| Monolith Component | Lines | Trạng thái | Khuyến nghị |")
        lines.append("|---|---|---|---|")
        for mono in monoliths:
            lines.append(f"| `{mono['file']}` | {mono['lines']:,} | {mono['status']} | {mono['recommendation']} |")

    lines.append("")
    lines.append(f"> Tổng steps: {m['total_steps']} | "
                 f"Tool calls: {m['total_tool_calls']} | "
                 f"User interactions: {m['user_interactions']}")

    return "\n".join(lines)


def detect_last_task_range(path: Path) -> tuple[int, int | None]:
    """Auto-detect the start and end step of the most recent task.
    
    Principle: A task begins at the first substantive USER_INPUT immediately following
    the PREVIOUS git push, and ends at the git push completing the current task.
    """
    all_steps = []
    with open(path, encoding="utf-8") as f:
        for idx, line in enumerate(f):
            line = line.strip()
            if line:
                try:
                    all_steps.append((idx, json.loads(line)))
                except json.JSONDecodeError:
                    continue

    # Find all actual git pushes (exclude python/node analysis scripts)
    git_pushes = []
    for idx, d in all_steps:
        for tc in d.get("tool_calls", []):
            if tc.get("name") == "run_command":
                cmd = get_arg(tc, "CommandLine").strip()
                if not cmd.startswith("python") and not cmd.startswith("node"):
                    if re.search(r'(?:^|[;&|]\s*)git\s+push\b', cmd):
                        git_pushes.append((idx, d.get("created_at", "")))

    if not git_pushes:
        return 0, None

    # Find the feature git push (the most recent or second-to-last if the very last was a doc-only push)
    # The current task's push is the last push before any subsequent user questions
    last_push_step, _ = git_pushes[-1]
    
    # If there are previous pushes, the previous task ended at git_pushes[-2]
    prev_push_step = git_pushes[-2][0] if len(git_pushes) >= 2 else 0

    # The current task starts at the first USER_INPUT after prev_push_step
    task_start = None
    for idx, d in all_steps:
        if idx > prev_push_step and idx < last_push_step:
            if d.get("type") == "USER_INPUT":
                task_start = idx
                break

    if task_start is None:
        task_start = prev_push_step

    return task_start, last_push_step


def main():
    parser = argparse.ArgumentParser(
        description="Đo KPIs tự động từ transcript Antigravity session."
    )
    parser.add_argument("conversation_id", help="Conversation ID")
    parser.add_argument("--start-step", type=int, default=None,
                        help="Step bắt đầu scope đo (default: tự động phát hiện task gần nhất)")
    parser.add_argument("--end-step", type=int, default=None,
                        help="Step kết thúc scope đo (default: tự động phát hiện git push của task)")
    parser.add_argument("--last-task", action="store_true",
                        help="Tự động phát hiện phạm vi task gần nhất (mặc định nếu không truyền start-step)")
    parser.add_argument("--app-data-dir", type=str,
                        default=os.path.expanduser("~/.gemini/antigravity"),
                        help="Đường dẫn app data directory")
    parser.add_argument("--repo-dir", type=str, default=".",
                        help="Đường dẫn repository root để đo git churn & file sizes (default: .)")
    parser.add_argument("--commit", type=str, default="HEAD",
                        help="Git commit ref để trích xuất git churn (default: HEAD)")
    parser.add_argument("--no-churn", action="store_true",
                        help="Không đo git churn & monolith file stats")
    args = parser.parse_args()

    try:
        path = find_transcript(args.conversation_id, args.app_data_dir)
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    # Auto-detect task boundary if start-step not provided
    start_step = args.start_step
    end_step = args.end_step
    if start_step is None:
        auto_start, auto_end = detect_last_task_range(path)
        start_step = auto_start
        if end_step is None:
            end_step = auto_end
        print(f"Auto-detected last task scope: steps {start_step} → {end_step}", file=sys.stderr)

    print(f"Reading: {path}", file=sys.stderr)
    print(f"Scope: steps {start_step} → {end_step or 'END'}", file=sys.stderr)

    steps = load_steps(path, start_step, end_step)
    if not steps:
        print("ERROR: No steps found in the specified range.", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(steps)} steps.", file=sys.stderr)

    metrics = analyze(steps)
    churn = None
    monoliths = None
    if not args.no_churn:
        churn = get_git_churn_stats(repo_dir=args.repo_dir, commit_ref=args.commit)
        monoliths = get_monolith_file_stats(repo_dir=args.repo_dir)

    scorecard = format_scorecard(metrics, churn=churn, monoliths=monoliths)
    print(scorecard)


if __name__ == "__main__":
    main()

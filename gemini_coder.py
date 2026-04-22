from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path

from google import genai


DEFAULT_MODEL = "models/gemini-1.5-pro"
DEFAULT_EXTENSIONS = {".py", ".txt", ".md", ".json", ".yaml", ".yml", ".sql", ".js", ".ts", ".tsx", ".jsx"}
DEFAULT_MAX_FILES = 6
DEFAULT_MAX_CONTEXT_CHARS = 48000
DEFAULT_SAMPLE_CHARS = 4000


@dataclass
class FileContext:
    path: Path
    size_bytes: int
    content: str
    sampling_note: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ask Gemini for coding help using local project files as context."
    )
    parser.add_argument(
        "question",
        nargs="?",
        help="Question for Gemini. If omitted, interactive mode starts.",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Folder to scan for files. Default: current folder.",
    )
    parser.add_argument(
        "--path",
        action="append",
        dest="paths",
        default=[],
        help="Specific file or folder to include. Can be used multiple times.",
    )
    parser.add_argument(
        "--ext",
        action="append",
        dest="extensions",
        default=[],
        help="Extra file extension to include, for example --ext .log",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=DEFAULT_MAX_FILES,
        help=f"Maximum files to send as context. Default: {DEFAULT_MAX_FILES}",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Gemini model name. Default: {DEFAULT_MODEL}",
    )
    return parser.parse_args()


def require_api_key() -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit(
            "GEMINI_API_KEY belum di-set. Contoh PowerShell: "
            '$env:GEMINI_API_KEY="your_api_key_here"'
        )
    return api_key


def should_skip(path: Path) -> bool:
    skip_parts = {
        ".git",
        "node_modules",
        "dist",
        ".venv",
        "__pycache__",
    }
    return any(part in skip_parts for part in path.parts)


def collect_candidate_files(root: Path, extensions: set[str], explicit_paths: list[str]) -> list[Path]:
    if explicit_paths:
        candidates: list[Path] = []
        for raw in explicit_paths:
            target = (root / raw).resolve() if not Path(raw).is_absolute() else Path(raw)
            if target.is_file():
                candidates.append(target)
            elif target.is_dir():
                for file_path in target.rglob("*"):
                    if file_path.is_file() and file_path.suffix.lower() in extensions and not should_skip(file_path):
                        candidates.append(file_path)
        return sorted(dict.fromkeys(candidates))

    files = []
    for file_path in root.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in extensions and not should_skip(file_path):
            files.append(file_path)
    return sorted(files)


def sample_large_text(text: str, sample_chars: int = DEFAULT_SAMPLE_CHARS) -> tuple[str, str]:
    if len(text) <= sample_chars * 3:
        return text, "full file included"

    head = text[:sample_chars]
    mid_start = max((len(text) // 2) - (sample_chars // 2), 0)
    middle = text[mid_start:mid_start + sample_chars]
    tail = text[-sample_chars:]
    sampled = (
        "[HEAD]\n"
        f"{head}\n\n"
        "[MIDDLE]\n"
        f"{middle}\n\n"
        "[TAIL]\n"
        f"{tail}"
    )
    note = (
        "sampled file because it is large; included head, middle, and tail excerpts "
        f"(approx {sample_chars} chars each)"
    )
    return sampled, note


def read_file_context(path: Path) -> FileContext | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return None
    except OSError:
        return None

    sampled_text, sampling_note = sample_large_text(raw)
    return FileContext(
        path=path,
        size_bytes=path.stat().st_size,
        content=sampled_text,
        sampling_note=sampling_note,
    )


def build_context(root: Path, paths: list[Path], max_files: int) -> list[FileContext]:
    files: list[FileContext] = []
    for path in paths:
        if len(files) >= max_files:
            break
        context = read_file_context(path)
        if context:
            files.append(context)
    return files


def trim_context_blocks(blocks: list[str], max_chars: int = DEFAULT_MAX_CONTEXT_CHARS) -> str:
    joined = []
    total = 0
    for block in blocks:
        next_total = total + len(block)
        if next_total > max_chars:
            remaining = max_chars - total
            if remaining > 0:
                joined.append(block[:remaining])
            break
        joined.append(block)
        total = next_total
    return "\n\n".join(joined)


def make_prompt(question: str, root: Path, contexts: list[FileContext]) -> str:
    file_overview = "\n".join(
        f"- {ctx.path.relative_to(root)} ({ctx.size_bytes} bytes, {ctx.sampling_note})"
        for ctx in contexts
    ) or "- no matching files found"

    context_blocks = []
    for ctx in contexts:
        relative = ctx.path.relative_to(root)
        context_blocks.append(
            f"[FILE: {relative}]\n"
            f"[SIZE_BYTES: {ctx.size_bytes}]\n"
            f"[NOTE: {ctx.sampling_note}]\n"
            f"{ctx.content}"
        )

    trimmed_context = trim_context_blocks(context_blocks)
    return (
        "You are a coding assistant helping with local project files.\n"
        "Answer in Indonesian unless the user asks otherwise.\n"
        "Prioritize practical code, terminal commands, and implementation guidance.\n"
        "If the user asks about very large files such as 500MB, explain a chunked/streaming approach.\n\n"
        f"Project root: {root}\n"
        f"Selected files:\n{file_overview}\n\n"
        f"User question:\n{question}\n\n"
        "Local file context:\n"
        f"{trimmed_context}"
    )


def ask_gemini(model_name: str, prompt: str, api_key: str) -> str:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
    )
    return getattr(response, "text", "") or "Gemini tidak mengembalikan teks."


def interactive_loop(root: Path, file_paths: list[Path], max_files: int, model_name: str, api_key: str) -> None:
    print("Gemini Coder siap. Ketik pertanyaan, atau ketik 'exit' untuk keluar.\n")
    while True:
        try:
            question = input("gemini> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nKeluar.")
            return

        if not question:
            continue
        if question.lower() in {"exit", "quit"}:
            print("Keluar.")
            return

        contexts = build_context(root, file_paths, max_files)
        prompt = make_prompt(question, root, contexts)
        answer = ask_gemini(model_name, prompt, api_key)
        print("\n" + answer + "\n")


def main() -> None:
    args = parse_args()
    api_key = require_api_key()
    root = Path(args.root).resolve()
    extensions = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in args.extensions} | DEFAULT_EXTENSIONS
    file_paths = collect_candidate_files(root, extensions, args.paths)

    if args.question:
        contexts = build_context(root, file_paths, args.max_files)
        prompt = make_prompt(args.question, root, contexts)
        answer = ask_gemini(args.model, prompt, api_key)
        print(answer)
        return

    interactive_loop(root, file_paths, args.max_files, args.model, api_key)


if __name__ == "__main__":
    main()

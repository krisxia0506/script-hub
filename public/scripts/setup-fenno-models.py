#!/usr/bin/env python3
"""Idempotent Fenno catalog setup for local Codex."""

from __future__ import annotations

import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path

CODEX_HOME = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
CONFIG = CODEX_HOME / "config.toml"
CATALOG_DIR = CODEX_HOME / "model-catalogs"
CATALOG = CATALOG_DIR / "fenno.json"
PROVIDER_URL = "https://llmapi.qiniu.io/v1"

EFFORTS = {
    "low": "Fast responses with lighter reasoning",
    "medium": "Balances speed and reasoning depth for everyday tasks",
    "high": "Greater reasoning depth for complex problems",
    "xhigh": "Extra high reasoning depth for complex problems",
    "max": "Maximum reasoning depth for the hardest problems",
    "ultra": "Maximum reasoning with automatic task splitting",
}

def efforts(*names: str) -> list[dict[str, str]]:
    return [{"effort": name, "description": EFFORTS[name]} for name in names]

def model(
    slug: str,
    display_name: str,
    description: str,
    *,
    ctx: int,
    max_ctx: int,
    priority: int,
    default: str,
    effort_names: tuple[str, ...],
    visibility: str = "list",
) -> dict:
    return {
        "slug": slug,
        "display_name": display_name,
        "description": description,
        "default_reasoning_level": default,
        "supported_reasoning_levels": efforts(*effort_names),
        "shell_type": "unified_exec",
        "visibility": visibility,
        "supported_in_api": True,
        "priority": priority,
        "additional_speed_tiers": [],
        "service_tiers": [],
        "context_window": ctx,
        "max_context_window": max_ctx,
        "effective_context_window_percent": 95,
        "input_modalities": ["text", "image"],
        "used_fallback_model_metadata": False,
    }

MODELS = [
    model("gpt-5.4-mini", "GPT-5.4 Mini", "Small, fast GPT-5.4 for simpler coding tasks.",
          ctx=272000, max_ctx=272000, priority=8, default="medium",
          effort_names=("low", "medium", "high", "xhigh")),
    model("gpt-5.6-luna", "GPT-5.6 Luna", "Fast and affordable GPT-5.6.",
          ctx=1050000, max_ctx=1050000, priority=5, default="medium",
          effort_names=("low", "medium", "high", "xhigh", "max")),
    model("gpt-5.6-sol", "GPT-5.6 Sol", "Balanced GPT-5.6 for most coding work.",
          ctx=1050000, max_ctx=1050000, priority=3, default="low",
          effort_names=("low", "medium", "high", "xhigh", "max", "ultra")),
    model("gpt-5.6-terra", "GPT-5.6 Terra", "Higher-capability GPT-5.6.",
          ctx=1050000, max_ctx=1050000, priority=4, default="medium",
          effort_names=("low", "medium", "high", "xhigh", "max", "ultra")),
    model("gpt-5.5", "GPT-5.5", "GPT-5.5 coding model.",
          ctx=1050000, max_ctx=1050000, priority=6, default="medium",
          effort_names=("low", "medium", "high", "xhigh")),
    model("gpt-5.4", "GPT-5.4", "GPT-5.4 coding model.",
          ctx=1050000, max_ctx=1050000, priority=7, default="medium",
          effort_names=("low", "medium", "high", "xhigh")),
    model("codex-auto-review", "Codex Auto Review", "Automatic approval review model for Codex.",
          ctx=272000, max_ctx=872000, priority=9, default="medium",
          effort_names=("low", "medium", "high", "xhigh", "max"),
          visibility="none"),
    model("grok-4.5", "Grok 4.5", "xAI Grok 4.5: 500k-context coding model. Official efforts: low/medium/high.",
          ctx=500000, max_ctx=500000, priority=2, default="high",
          effort_names=("low", "medium", "high", "max")),
    model("grok-4.6", "Grok 4.6", "xAI Grok 4.6: 500k-context frontier model. Official efforts: low/medium/high/xhigh.",
          ctx=500000, max_ctx=500000, priority=1, default="high",
          effort_names=("low", "medium", "high", "xhigh", "max")),
]

ROOT_KEYS = {
    "model": '"grok-4.6"',
    "model_reasoning_effort": '"max"',
    "model_provider": '"fenno"',
    "model_catalog_json": f'"{CATALOG}"',
    "model_context_window": "500000",
}

PROVIDER_BLOCK = f'''[model_providers.fenno]
request_max_retries = 15
name = "Fenno"
base_url = "{PROVIDER_URL}"
wire_api = "responses"
'''

def existing_token(text: str) -> str | None:
    env = os.environ.get("FENNO_API_KEY") or os.environ.get("CODEX_FENNO_TOKEN")
    if env:
        return env.strip()
    match = re.search(r'experimental_bearer_token\s*=\s*"([^"]+)"', text)
    return match.group(1) if match else None

def upsert_root_key(text: str, key: str, value: str) -> str:
    pattern = rf"(?m)^{re.escape(key)}\s*=\s*.*$"
    line = f"{key} = {value}"
    if re.search(pattern, text):
        return re.sub(pattern, line, text, count=1)
    first_table = re.search(r"(?m)^\[", text)
    insert = line + "\n"
    if first_table:
        idx = first_table.start()
        return text[:idx] + insert + text[idx:]
    return text.rstrip() + "\n" + insert

def upsert_provider(text: str, token: str | None) -> str:
    block = PROVIDER_BLOCK
    if token:
        block += f'experimental_bearer_token = "{token}"\n'
    if re.search(r"(?m)^\[model_providers\.fenno\]", text):
        return re.sub(
            r"(?ms)^\[model_providers\.fenno\]\n(?:^(?!\[).*\n)*",
            block + "\n",
            text,
            count=1,
        )
    return text.rstrip() + "\n\n" + block

def main() -> None:
    CODEX_HOME.mkdir(parents=True, exist_ok=True)
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    old = CONFIG.read_text() if CONFIG.exists() else ""
    token = existing_token(old)
    if CONFIG.exists():
        backup = CONFIG.with_name(
            f"config.toml.bak-fenno-{datetime.now():%Y%m%d%H%M%S}"
        )
        shutil.copy2(CONFIG, backup)
        print(f"backup {backup}")

    CATALOG.write_text(json.dumps({"models": MODELS}, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {CATALOG} ({len(MODELS)} models)")

    text = old
    if not text.lstrip().startswith("#:schema"):
        text = "#:schema https://developers.openai.com/codex/config-schema.json\n" + text
    for key, value in ROOT_KEYS.items():
        text = upsert_root_key(text, key, value)
    text = upsert_provider(text, token)
    CONFIG.write_text(text)
    print(f"updated {CONFIG}")
    if not token:
        print("missing Fenno token: set FENNO_API_KEY or add experimental_bearer_token")
    print("fully quit Codex TUI/Desktop, then run: codex")

if __name__ == "__main__":
    main()

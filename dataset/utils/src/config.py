"""YAML configuration loader for crawl-utils."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

DEFAULTS: dict[str, Any] = {
    "target": {
        "url": "",
        "allowed_domains": [],
        "blocked_paths": [],
    },
    "crawl": {
        "strategy": "bfs",
        "max_depth": 3,
        "max_pages": 500,
        "include_external": False,
    },
    "markdown": {
        "citations": True,
        "body_width": 0,
        "skip_internal_links": False,
        "content_filter": "none",
    },
    "performance": {
        "prefetch": True,
        "stream": True,
    },
    "recovery": {
        "enabled": True,
        "state_file": "output/.crawl_state.json",
    },
    "output": {
        "dir": "output",
        "naming": "url_path",
    },
}


def deep_merge(base: dict, override: dict) -> dict:
    """Deep merge two dicts. override takes precedence."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def load_config(config_path: str | Path) -> dict[str, Any]:
    """Load YAML config and merge with defaults."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path) as f:
        user_config = yaml.safe_load(f) or {}

    return deep_merge(DEFAULTS, user_config)

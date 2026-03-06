"""Custom URL filters for crawl-utils."""

from __future__ import annotations

from urllib.parse import urlparse


class BlockedPathFilter:
    """Filter that blocks URLs matching specific path prefixes.

    Compatible with crawl4ai's FilterChain interface.
    """

    def __init__(self, blocked_paths: list[str]) -> None:
        self.blocked_paths = blocked_paths
        self.name = "BlockedPathFilter"

    async def apply(self, url: str, **kwargs) -> bool:
        parsed = urlparse(url)
        path = parsed.path
        return not any(path.startswith(blocked) for blocked in self.blocked_paths)

"""Crawl4AI wrapper for website-to-markdown conversion."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy, DFSDeepCrawlStrategy
from crawl4ai.deep_crawling.filters import FilterChain, DomainFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

from .filters import BlockedPathFilter

logger = logging.getLogger(__name__)

# Non-HTML extensions to skip (PDFs, images, etc.)
_SKIP_EXTENSIONS = frozenset({
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg",
    ".webp", ".ico", ".bmp", ".tiff", ".mp4", ".mp3",
    ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
})


def _is_binary_url(url: str) -> bool:
    """Return True if URL points to a non-HTML resource."""
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in _SKIP_EXTENSIONS)


def build_filter_chain(config: dict[str, Any]) -> FilterChain | None:
    """Build a FilterChain from config."""
    filters = []
    target = config.get("target", {})

    allowed_domains = target.get("allowed_domains", [])
    if allowed_domains:
        filters.append(DomainFilter(allowed_domains=allowed_domains))

    blocked_paths = target.get("blocked_paths", [])
    if blocked_paths:
        filters.append(BlockedPathFilter(blocked_paths=blocked_paths))

    return FilterChain(filters) if filters else None


def build_crawl_strategy(config: dict[str, Any], filter_chain: FilterChain | None):
    """Build deep crawl strategy from config."""
    crawl_config = config.get("crawl", {})
    strategy_name = crawl_config.get("strategy", "bfs")

    kwargs: dict[str, Any] = {
        "max_depth": crawl_config.get("max_depth", 3),
        "max_pages": crawl_config.get("max_pages", 500),
        "include_external": crawl_config.get("include_external", False),
    }
    if filter_chain:
        kwargs["filter_chain"] = filter_chain

    strategies = {
        "bfs": BFSDeepCrawlStrategy,
        "dfs": DFSDeepCrawlStrategy,
    }
    strategy_cls = strategies.get(strategy_name)
    if not strategy_cls:
        raise ValueError(f"Unknown strategy: {strategy_name}. Use: {list(strategies)}")

    return strategy_cls(**kwargs)


def build_md_generator(config: dict[str, Any]) -> DefaultMarkdownGenerator:
    """Build markdown generator from config."""
    md_config = config.get("markdown", {})
    options: dict[str, Any] = {}

    if md_config.get("citations"):
        options["citations"] = True
    body_width = md_config.get("body_width")
    if body_width is not None:
        options["body_width"] = body_width
    if md_config.get("skip_internal_links"):
        options["skip_internal_links"] = True

    return DefaultMarkdownGenerator(options=options)


def url_to_filepath(url: str, output_dir: str) -> Path:
    """Convert URL to output file path, preserving site directory structure."""
    parsed = urlparse(url)
    path = parsed.path.strip("/")

    if not path or path == "index.html":
        return Path(output_dir) / "index.md"

    if path.endswith(".html"):
        return Path(output_dir) / path.replace(".html", ".md")

    # Directory-like paths
    return Path(output_dir) / path / "index.md"


def save_state(crawled_urls: list[str], state_file: str) -> None:
    """Save crawl state for recovery."""
    path = Path(state_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump({"crawled_urls": crawled_urls, "count": len(crawled_urls)}, f)


def load_state(state_file: str) -> set[str]:
    """Load crawled URLs from state file."""
    path = Path(state_file)
    if path.exists():
        with open(path) as f:
            data = json.load(f)
            return set(data.get("crawled_urls", []))
    return set()


def rewrite_links(url_to_file: dict[str, Path], output_dir: str) -> int:
    """Replace URLs in saved markdown files with relative paths to local files."""
    output_path = Path(output_dir)
    replaced_count = 0

    link_pattern = re.compile(r"(!?\[[^\]]*\])\(([^)]+)\)")

    for filepath in output_path.rglob("*.md"):
        content = filepath.read_text(encoding="utf-8")
        original = content

        def replace_url(match: re.Match, _fp: Path = filepath) -> str:
            prefix = match.group(1)
            url = match.group(2)

            target_file = url_to_file.get(url)
            if target_file is None:
                return match.group(0)

            rel_path = os.path.relpath(
                Path(target_file).resolve(), _fp.resolve().parent
            )
            return f"{prefix}({rel_path})"

        content = link_pattern.sub(replace_url, content)

        if content != original:
            filepath.write_text(content, encoding="utf-8")
            replaced_count += 1
            logger.info(f"Rewritten links: {filepath}")

    return replaced_count


async def crawl_site(config: dict[str, Any], resume: bool = False) -> list:
    """Crawl a website and save results as markdown files."""
    target_url = config["target"]["url"]
    output_dir = config["output"]["dir"]

    filter_chain = build_filter_chain(config)
    deep_strategy = build_crawl_strategy(config, filter_chain)
    md_generator = build_md_generator(config)

    # Content filtering options
    content_config = config.get("content", {})
    content_kwargs: dict[str, Any] = {}
    excluded_tags = content_config.get("excluded_tags")
    if excluded_tags:
        content_kwargs["excluded_tags"] = excluded_tags
    excluded_selector = content_config.get("excluded_selector")
    if excluded_selector:
        content_kwargs["excluded_selector"] = excluded_selector
    word_count_threshold = content_config.get("word_count_threshold")
    if word_count_threshold:
        content_kwargs["word_count_threshold"] = word_count_threshold

    run_config = CrawlerRunConfig(
        deep_crawl_strategy=deep_strategy,
        markdown_generator=md_generator,
        stream=config.get("performance", {}).get("stream", True),
        verbose=True,
        cache_mode=CacheMode.BYPASS,
        **content_kwargs,
    )

    recovery_config = config.get("recovery", {})
    state_file = recovery_config.get("state_file", "")

    # Load previously crawled URLs for resume
    already_crawled: set[str] = set()
    if resume and recovery_config.get("enabled") and state_file:
        already_crawled = load_state(state_file)
        if already_crawled:
            logger.info(f"Resuming: {len(already_crawled)} pages already crawled")

    results = []
    crawled_urls: list[str] = list(already_crawled)
    url_to_file: dict[str, Path] = {}

    browser_conf = BrowserConfig(headless=True)

    async with AsyncWebCrawler(config=browser_conf) as crawler:
        async for result in await crawler.arun(target_url, config=run_config):
            if not result.success:
                logger.warning(f"Failed: {result.url} - {result.error_message}")
                continue

            # Skip already crawled pages on resume
            if result.url in already_crawled:
                logger.debug(f"Skip (already crawled): {result.url}")
                continue

            # Skip non-HTML resources (PDFs, images, etc.)
            if _is_binary_url(result.url):
                logger.debug(f"Skip (binary): {result.url}")
                continue

            filepath = url_to_filepath(result.url, output_dir)
            filepath.parent.mkdir(parents=True, exist_ok=True)

            md_content = ""
            if result.markdown:
                md_content = result.markdown.raw_markdown or ""

            if md_content:
                filepath.write_text(md_content, encoding="utf-8")
                depth = result.metadata.get("depth", 0)
                logger.info(f"[Depth {depth}] Saved: {filepath} ({len(md_content)} chars)")

            results.append(result)
            crawled_urls.append(result.url)
            url_to_file[result.url] = filepath

            # Save state for recovery
            if recovery_config.get("enabled") and state_file:
                save_state(crawled_urls, state_file)

    # Rewrite URLs to relative local paths
    if config.get("output", {}).get("rewrite_links", True) and url_to_file:
        count = rewrite_links(url_to_file, output_dir)
        logger.info(f"Rewrote links in {count} files")

    return results

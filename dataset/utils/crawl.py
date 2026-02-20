#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["crawl4ai>=0.8.0", "pyyaml>=6.0", "psutil>=5.9"]
# ///
"""Crawl4AI Website-to-Markdown CLI.

Usage:
    uv run crawl.py --config config/examples/otoko.yaml
    uv run crawl.py --config config/examples/otoko.yaml --max-pages 10
    uv run crawl.py --config config/examples/otoko.yaml --resume
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Ensure src/ package is importable
sys.path.insert(0, str(Path(__file__).parent))

from src.config import load_config
from src.crawler import crawl_site


def parse_args():
    parser = argparse.ArgumentParser(
        description="Crawl websites and convert to Markdown for RAG knowledge bases"
    )
    parser.add_argument("--config", required=True, help="YAML config file path")
    parser.add_argument("--resume", action="store_true", help="Resume from saved state")
    parser.add_argument("--max-pages", type=int, help="Override max pages")
    parser.add_argument("--max-depth", type=int, help="Override max depth")
    parser.add_argument("--url", help="Override target URL")
    parser.add_argument("--output", help="Override output directory")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    return parser.parse_args()


def main():
    args = parse_args()

    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    config = load_config(args.config)

    # CLI overrides
    if args.url:
        config["target"]["url"] = args.url
    if args.max_pages:
        config["crawl"]["max_pages"] = args.max_pages
    if args.max_depth:
        config["crawl"]["max_depth"] = args.max_depth
    if args.output:
        config["output"]["dir"] = args.output

    if not config["target"]["url"]:
        logging.error("No target URL specified in config or --url")
        sys.exit(1)

    logging.info(f"Target: {config['target']['url']}")
    logging.info(f"Output: {config['output']['dir']}")
    logging.info(
        f"Strategy: {config['crawl']['strategy']} "
        f"(depth={config['crawl']['max_depth']}, pages={config['crawl']['max_pages']})"
    )

    results = asyncio.run(crawl_site(config, resume=args.resume))

    logging.info(f"Complete: {len(results)} pages saved")


if __name__ == "__main__":
    main()

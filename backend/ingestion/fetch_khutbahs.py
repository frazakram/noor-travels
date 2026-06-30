#!/usr/bin/env python3
"""Scrape English Friday khutbahs from khutbah.info and load into DB."""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite
from app.services.khutbah_match import build_match_text, clear_khutbah_index_cache

INDEX_URL = "https://www.khutbah.info/khutbahs/"
SITEMAP_URL = "https://www.khutbah.info/post-sitemap.xml"
DATA_DIR = Path(__file__).resolve().parents[2] / "data/sources/khutbahs"
JSON_PATH = DATA_DIR / "khutbahs.json"

SKIP_PATH_PARTS = {
    "category",
    "tag",
    "page",
    "author",
    "wp-content",
    "feed",
    "comments",
}

CATEGORY_SLUGS = {
    "knowing-allah",
    "quran",
    "the-prophet",
    "virtuous-months",
    "ramadan-khutbahs",
    "eid-khutbahs",
    "gems",
    "thikr",
    "quranic-dua",
    "priority",
    "our-priority",
    "about",
    "khutbahs",
}


def slug_from_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return path.split("/")[-1] if path else ""


def is_khutbah_url(url: str) -> bool:
    if not url.startswith("https://www.khutbah.info/"):
        return False
    slug = slug_from_url(url)
    if not slug or slug in CATEGORY_SLUGS:
        return False
    return not any(part in url for part in SKIP_PATH_PARTS)


def parse_sitemap(xml: str) -> list[str]:
    urls = re.findall(r"<loc><!\[CDATA\[(https://www\.khutbah\.info/[^\]]+)\]\]></loc>", xml)
    if not urls:
        urls = re.findall(r"<loc>(https://www\.khutbah\.info/[^<]+)</loc>", xml)
    return [u for u in urls if is_khutbah_url(u)]


def parse_index(html: str) -> list[dict[str, str]]:
    links: dict[str, str] = {}
    for href, title in re.findall(
        r'href="(https://www\.khutbah\.info/[^"]+/)"[^>]*>([^<]+)</a>',
        html,
        flags=re.I,
    ):
        if not is_khutbah_url(href):
            continue
        title = re.sub(r"\s+", " ", title).strip()
        if len(title) < 3 or "Nourishment of the Soul" in title:
            continue
        links[href.rstrip("/") + "/"] = title

    return [{"url": url, "title": title} for url, title in sorted(links.items(), key=lambda x: x[1].lower())]


def extract_title(html: str, fallback: str) -> str:
    m = re.search(r'<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>(.*?)</h1>', html, re.S | re.I)
    if m:
        title = re.sub(r"<[^>]+>", "", m.group(1))
        title = re.sub(r"\s+", " ", title).strip()
        title = title.replace("&#8217;", "'").replace("&#8211;", "–").replace("&amp;", "&")
        if title:
            return title
    m = re.search(r"<title>([^<|]+)", html, re.I)
    if m:
        return m.group(1).strip()
    return fallback


def extract_article_text(html: str) -> str:
    start = html.find("<article")
    if start < 0:
        return ""
    end = html.find("</article>", start)
    if end < 0:
        return ""
    article = html[start:end]

    article = re.sub(r"<script[^>]*>.*?</script>", "", article, flags=re.S | re.I)
    article = re.sub(r"<style[^>]*>.*?</style>", "", article, flags=re.S | re.I)
    article = re.sub(r"<br\s*/?>", "\n", article, flags=re.I)
    article = re.sub(r"</p>", "\n\n", article, flags=re.I)
    article = re.sub(r"</h[1-6]>", "\n\n", article, flags=re.I)
    article = re.sub(r"<li[^>]*>", "\n• ", article, flags=re.I)
    article = re.sub(r"<[^>]+>", " ", article)
    article = re.sub(r"&nbsp;", " ", article)
    article = re.sub(r"&#8217;", "'", article)
    article = re.sub(r"&[a-z#0-9]+;", " ", article, flags=re.I)

    lines: list[str] = []
    for raw in article.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        if line.lower().startswith("click here to download"):
            continue
        if "subscribe:" in line.lower() and "email" in line.lower():
            continue
        lines.append(line)

    return "\n\n".join(lines).strip()


def fetch_all(limit: int | None, delay: float) -> list[dict]:
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        sitemap_xml = client.get(SITEMAP_URL).text
        urls = parse_sitemap(sitemap_xml)
        if not urls:
            index_html = client.get(INDEX_URL).text
            urls = [e["url"] for e in parse_index(index_html)]
        if limit:
            urls = urls[:limit]
        print(f"Found {len(urls)} khutbah URLs")

        results: list[dict] = []
        for i, url in enumerate(urls, 1):
            slug = slug_from_url(url)
            try:
                resp = client.get(url)
                resp.raise_for_status()
                title = extract_title(resp.text, slug.replace("-", " ").title())
                if "Nourishment of the Soul" in title:
                    print(f"  skip {slug}: category page")
                    continue
                english_text = extract_article_text(resp.text)
                if len(english_text) < 200:
                    print(f"  skip {slug}: content too short")
                    continue
                results.append(
                    {
                        "slug": slug,
                        "title": title,
                        "source_url": url,
                        "english_text": english_text,
                        "match_text": build_match_text(english_text),
                    }
                )
                print(f"  [{i}/{len(urls)}] {title[:60]}", flush=True)
            except Exception as exc:
                print(f"  error {slug}: {exc}", flush=True)
            time.sleep(delay)
    return results


def save_json(items: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(items)} khutbahs to {JSON_PATH}")


def load_db(items: list[dict]) -> None:
    is_sqlite = use_sqlite()
    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM preloaded_khutbahs")
        else:
            cur.execute("TRUNCATE preloaded_khutbahs RESTART IDENTITY")

        for item in items:
            if is_sqlite:
                cur.execute(
                    """
                    INSERT INTO preloaded_khutbahs (slug, title, source_url, english_text, match_text)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        item["slug"],
                        item["title"],
                        item["source_url"],
                        item["english_text"],
                        item["match_text"],
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO preloaded_khutbahs (slug, title, source_url, english_text, match_text)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        item["slug"],
                        item["title"],
                        item["source_url"],
                        item["english_text"],
                        item["match_text"],
                    ),
                )
        conn.commit()
    clear_khutbah_index_cache()
    print(f"Loaded {len(items)} khutbahs into database")


def apply_migration() -> None:
    mig = (
        Path(__file__).resolve().parents[1] / "migrations/005_khutbahs_sqlite.sql"
        if use_sqlite()
        else Path(__file__).resolve().parents[1] / "migrations/005_khutbahs.sql"
    )
    sql = mig.read_text()
    with get_conn() as conn:
        if use_sqlite():
            conn.executescript(sql)
        else:
            cur = conn.cursor()
            cur.execute(sql)
        conn.commit()
    print("Khutbah migration applied.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch khutbahs from khutbah.info")
    parser.add_argument("--limit", type=int, default=None, help="Max khutbahs to fetch")
    parser.add_argument("--delay", type=float, default=0.35, help="Delay between requests (seconds)")
    parser.add_argument("--from-json", action="store_true", help="Load existing JSON into DB only")
    args = parser.parse_args()

    apply_migration()

    if args.from_json:
        if not JSON_PATH.exists():
            raise FileNotFoundError(f"Missing {JSON_PATH}")
        items = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    else:
        items = fetch_all(args.limit, args.delay)
        save_json(items)

    load_db(items)


if __name__ == "__main__":
    main()

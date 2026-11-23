"""Lists the errors the app has reported (table client_errors, filled by /api/telemetry/errors).

Usage (production: uses POSTGRES_URL from backend/.env; local: FORCE_SQLITE=1):
  .venv/bin/python ingestion/client_errors.py            # top 20 by last seen
  .venv/bin/python ingestion/client_errors.py --top 50 --stack
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_cursor  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--top", type=int, default=20)
    parser.add_argument("--stack", action="store_true", help="print the first lines of each stack")
    args = parser.parse_args()
    with get_cursor() as cur:
        cur.execute(
            "SELECT occurrences, last_seen, platform, kind, app_version, path, message, stack "
            "FROM client_errors ORDER BY last_seen DESC LIMIT %s",
            (args.top,),
        )
        rows = cur.fetchall()
    if not rows:
        print("No errors reported.")
        return 0
    cols = ("occurrences", "last_seen", "platform", "kind", "app_version", "path", "message", "stack")
    for row in rows:
        r = row if isinstance(row, dict) else dict(zip(cols, row))
        occ, last, platform, kind, version, path, message, stack = (r[c] for c in cols)
        print(f"{occ:>5}x  {str(last)[:19]}  {platform}/{kind}  v{version or '?'}  {path or ''}")
        print(f"       {message[:200]}")
        if args.stack and stack:
            for line in stack.splitlines()[:6]:
                print(f"         {line[:160]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

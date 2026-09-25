"""Fail when pyproject.toml (what Vercel installs) and requirements.txt (local venv) disagree.

A package present in only one of them installs locally and passes every local test,
then is missing in production.
"""

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Deliberately local-only: quran_identify treats the numpy import as optional.
REQUIREMENTS_ONLY = {"numpy"}


def _name(spec: str) -> str:
    return re.split(r"[\[=<>~!]", spec, maxsplit=1)[0].strip().lower()


def main() -> int:
    pyproject = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["dependencies"]
    requirements = [
        line.strip()
        for line in (ROOT / "requirements.txt").read_text().splitlines()
        if line.strip() and not line.startswith(("#", "-"))
    ]
    vercel = {_name(s): s for s in pyproject}
    local = {_name(s): s for s in requirements}

    problems = []
    for name, spec in local.items():
        if name in REQUIREMENTS_ONLY:
            continue
        if name not in vercel:
            problems.append(f"{spec}: in requirements.txt but missing from pyproject.toml (won't install on Vercel)")
        elif vercel[name] != spec:
            problems.append(f"{name}: pyproject.toml has {vercel[name]!r}, requirements.txt has {spec!r}")
    for name, spec in vercel.items():
        if name not in local:
            problems.append(f"{spec}: in pyproject.toml but missing from requirements.txt (untested locally)")

    for problem in problems:
        print(f"::error::{problem}")
    print("dependency lists agree" if not problems else f"{len(problems)} dependency mismatch(es)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

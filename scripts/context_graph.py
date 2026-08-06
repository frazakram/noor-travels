#!/usr/bin/env python3
"""Generate docs/CONTEXT_GRAPH.md — an auto-derived context graph of the repo.

Scans backend Python imports, frontend TS/TSX imports and /api/* call sites,
and recent git history. Runs on plain python3 (stdlib only):

    python3 scripts/context_graph.py

Installed as a git pre-commit hook so the graph stays current with every commit
(see scripts/hooks/pre-commit).
"""

from __future__ import annotations

import re
import subprocess
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend" / "app"
FRONTEND = ROOT / "frontend"
OUT = ROOT / "docs" / "CONTEXT_GRAPH.md"

RECENT_COMMITS = 15


# ---------------------------------------------------------------- backend ----

def scan_backend():
    """Return (routers, prefixes, router_deps, service_deps, uses_db)."""
    routers = sorted(
        p.stem for p in (BACKEND / "api").glob("*.py") if p.stem != "__init__"
    )
    services = sorted(
        p.stem for p in (BACKEND / "services").glob("*.py") if p.stem != "__init__"
    )

    prefixes = {}  # router module -> url prefix
    main_src = (BACKEND / "main.py").read_text()
    for mod, prefix in re.findall(
        r"include_router\(\s*(\w+)\.router,\s*prefix=\"([^\"]+)\"", main_src
    ):
        prefixes[mod] = prefix

    imp_re = re.compile(r"^\s*(?:from|import)\s+app\.(\w+)(?:\.(\w+))?", re.M)

    def deps_of(path: Path):
        src = path.read_text()
        svc, db, mounts, imports = set(), False, set(), set()
        for pkg, name in imp_re.findall(src):
            if pkg == "services" and name in services:
                svc.add(name)
            elif pkg == "db" or (pkg, name) == ("app", "db"):
                db = True
            elif pkg == "api" and name in routers:
                # distinguish mounting a sub-router from importing a helper
                if re.search(rf"include_router\(\s*{name}\.", src):
                    mounts.add(name)
                else:
                    imports.add(name)
        return svc, db, mounts, imports

    router_deps, service_deps, uses_db = {}, {}, {}
    for r in routers:
        svc, db, mounts, imports = deps_of(BACKEND / "api" / f"{r}.py")
        router_deps[r] = {"services": svc, "sub_routers": mounts, "imports": imports}
        uses_db[f"api.{r}"] = db
        # a sub-router mounted by another router inherits that router's prefix
        for sub in mounts:
            prefixes.setdefault(sub, prefixes.get(r, "") + f" (via {r})")
    for s in services:
        svc, db, _, _ = deps_of(BACKEND / "services" / f"{s}.py")
        svc.discard(s)
        service_deps[s] = svc
        uses_db[f"services.{s}"] = db
    return routers, services, prefixes, router_deps, service_deps, uses_db


# --------------------------------------------------------------- frontend ----

LIB_IMP = re.compile(r"from\s+[\"']@/(lib|hooks|components)/([\w/-]+)[\"']")
API_LIT = re.compile(r"[\"'`]/api/([a-z][\w-]*)")


def ts_files(d: Path):
    return [p for p in d.rglob("*") if p.suffix in (".ts", ".tsx")]


def scan_frontend():
    """Return (routes, lib_api, hook_api) where routes maps a page route to the
    lib/hook modules and /api/<seg> endpoints it uses, including transitively
    through the @/components/* it renders."""
    comp_dir = FRONTEND / "components"
    comps = {}  # "ChatWidget" / "home/PrayerCard" -> {libs, hooks, apis, comps}
    for f in ts_files(comp_dir):
        name = str(f.relative_to(comp_dir)).rsplit(".", 1)[0]
        src = f.read_text()
        info = {"libs": set(), "hooks": set(), "apis": set(API_LIT.findall(src)),
                "comps": set()}
        for kind, imp in LIB_IMP.findall(src):
            key = {"lib": "libs", "hooks": "hooks", "components": "comps"}[kind]
            info[key].add(imp)
        comps[name] = info

    def component_closure(seed: set, libs: set, hooks: set, apis: set):
        seen, stack = set(), list(seed)
        while stack:
            c = stack.pop()
            if c in seen or c not in comps:
                continue
            seen.add(c)
            libs |= comps[c]["libs"]
            hooks |= comps[c]["hooks"]
            apis |= comps[c]["apis"]
            stack.extend(comps[c]["comps"])

    app_dir = FRONTEND / "app"
    route_dirs = {p.parent for p in app_dir.rglob("page.tsx")}

    def route_of(f: Path):
        # deepest route dir containing f; app-shell files (layout etc.) -> "/"
        best = None
        for d in route_dirs:
            if f.is_relative_to(d) and (best is None or len(d.parts) > len(best.parts)):
                best = d
        return best

    raw = defaultdict(lambda: {"libs": set(), "hooks": set(), "apis": set(),
                               "comps": set()})
    for f in ts_files(app_dir):
        if f.is_relative_to(app_dir / "api"):
            continue  # Next.js API routes (e.g. /api/embed), not pages
        d = route_of(f)
        if d is None:
            continue  # file outside any route dir other than app/ root shell
        rel = d.relative_to(app_dir)
        route = "/" + str(rel).replace("\\", "/") if str(rel) != "." else "/"
        info = raw[route]
        src = f.read_text()
        for kind, name in LIB_IMP.findall(src):
            key = {"lib": "libs", "hooks": "hooks", "components": "comps"}[kind]
            info[key].add(name)
        info["apis"].update(API_LIT.findall(src))

    routes = {}
    for route, info in raw.items():
        libs, hooks, apis = set(info["libs"]), set(info["hooks"]), set(info["apis"])
        component_closure(info["comps"], libs, hooks, apis)
        routes[route] = {"libs": libs, "hooks": hooks, "apis": apis}

    def api_refs(d: Path):
        out = {}
        for f in ts_files(d):
            hits = set(API_LIT.findall(f.read_text()))
            if hits:
                out[f.stem] = hits
        return out

    return routes, api_refs(FRONTEND / "lib"), api_refs(FRONTEND / "hooks")


# -------------------------------------------------------------------- git ----

AREA_RULES = [
    (r"^backend/app/api/(\w+)\.py", lambda m: f"backend api/{m.group(1)}"),
    (r"^backend/app/services/(\w+)\.py", lambda m: f"backend services/{m.group(1)}"),
    (r"^backend/app/", lambda m: "backend core"),
    (r"^backend/ingestion/", lambda m: "ingestion"),
    (r"^backend/migrations/", lambda m: "migrations"),
    (r"^backend/", lambda m: "backend misc"),
    (r"^frontend/app/([\w\[\]-]+)/", lambda m: f"page /{m.group(1)}"),
    (r"^frontend/components/", lambda m: "components"),
    (r"^frontend/(lib|hooks)/([\w-]+)\.", lambda m: f"{m.group(1)}/{m.group(2)}"),
    (r"^frontend/", lambda m: "frontend misc"),
    (r"^docs/", lambda m: "docs"),
    (r"^scripts/", lambda m: "scripts"),
]


def recent_commits():
    fmt = "%h\x01%as\x01%s"
    out = subprocess.run(
        ["git", "log", f"-n{RECENT_COMMITS}", f"--pretty={fmt}", "--name-only"],
        cwd=ROOT, capture_output=True, text=True,
    ).stdout
    commits, current = [], None
    for line in out.splitlines():
        if "\x01" in line:
            h, d, s = line.split("\x01")
            current = {"hash": h, "date": d, "subject": s, "areas": set()}
            commits.append(current)
        elif line.strip() and current is not None:
            for pat, label in AREA_RULES:
                m = re.match(pat, line.strip())
                if m:
                    current["areas"].add(label(m))
                    break
            else:
                current["areas"].add("repo root")
    return commits


def head_hash():
    return subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=ROOT, capture_output=True, text=True,
    ).stdout.strip()


# ---------------------------------------------------------------- mermaid ----

def nid(prefix: str, name: str) -> str:
    return prefix + "_" + re.sub(r"\W", "_", name)


def build_mermaid(routes, lib_api, hook_api, routers, prefixes,
                  router_deps, service_deps, uses_db):
    lines = ["flowchart LR"]

    def prefix_to_router(seg: str):
        # /api/<seg> -> backend router module whose prefix starts with /api/<seg>
        for mod, pref in prefixes.items():
            if pref.split(" ")[0].strip("/").split("/")[1:2] == [seg.replace("-", "_")] \
               or pref.split(" ")[0] == f"/api/{seg}":
                return mod
        return None

    # frontend shared modules worth drawing: those that call the backend
    fe_shared = {**{f"lib/{k}": v for k, v in lib_api.items()},
                 **{f"hooks/{k}": v for k, v in hook_api.items()}}

    lines.append("  subgraph FE[Frontend — Next.js]")
    lines.append("    direction TB")
    for route in sorted(routes):
        lines.append(f"    {nid('pg', route)}[\"{route}\"]")
    for mod in sorted(fe_shared):
        lines.append(f"    {nid('fe', mod)}([\"{mod}\"])")
    lines.append("    fe_embed([\"/api/embed (Next route)\"])")
    lines.append("  end")

    lines.append("  subgraph BE[Backend — FastAPI]")
    lines.append("    direction TB")
    used_routers = set()
    edges = []

    # page -> shared module (only modules drawn above)
    for route, info in sorted(routes.items()):
        for lib in sorted(info["libs"]):
            if f"lib/{lib}" in fe_shared:
                edges.append((nid("pg", route), nid("fe", f"lib/{lib}")))
        for hook in sorted(info["hooks"]):
            if f"hooks/{hook}" in fe_shared:
                edges.append((nid("pg", route), nid("fe", f"hooks/{hook}")))

    # page/shared-module -> backend router
    def api_edges(src_id, segs):
        for seg in sorted(segs):
            if seg == "embed":
                edges.append((src_id, "fe_embed"))
                continue
            mod = prefix_to_router(seg)
            if mod:
                edges.append((src_id, nid("be", mod)))
                used_routers.add(mod)

    for route, info in sorted(routes.items()):
        api_edges(nid("pg", route), info["apis"])
    for mod, segs in sorted(fe_shared.items()):
        api_edges(nid("fe", mod), segs)

    # router -> service / sub-router, service -> service
    used_services = set()
    for r in sorted(routers):
        for s in sorted(router_deps[r]["services"]):
            edges.append((nid("be", r), nid("sv", s)))
            used_routers.add(r)
            used_services.add(s)
        for sub in sorted(router_deps[r]["sub_routers"]):
            edges.append((nid("be", r), nid("be", sub)))
            used_routers.update((r, sub))
        for imp in sorted(router_deps[r]["imports"]):
            edges.append((nid("be", r), nid("be", imp), "-.->|imports|"))
            used_routers.update((r, imp))

    grow = True
    while grow:  # pull in transitive service deps
        grow = False
        for s in list(used_services):
            for t in service_deps.get(s, ()):
                if t not in used_services:
                    used_services.add(t)
                    grow = True
    for s in sorted(used_services):
        for t in sorted(service_deps.get(s, ())):
            edges.append((nid("sv", s), nid("sv", t)))

    for r in sorted(used_routers):
        pref = prefixes.get(r, "helper, not mounted")
        lines.append(f"    {nid('be', r)}[\"api/{r}<br/><small>{pref}</small>\"]")
    for s in sorted(used_services):
        lines.append(f"    {nid('sv', s)}([\"services/{s}\"])")
    lines.append("  end")

    lines.append("  DB[(\"Postgres+pgvector / SQLite<br/>document_chunks\")]")
    for mod, db in sorted(uses_db.items()):
        if not db:
            continue
        kind, name = mod.split(".", 1)
        node = nid("be", name) if kind == "api" else nid("sv", name)
        if (kind == "api" and name in used_routers) or (kind == "services" and name in used_services):
            edges.append((node, "DB"))

    for e in dict.fromkeys(edges):  # dedupe, keep order
        a, b, arrow = e if len(e) == 3 else (*e, "-->")
        lines.append(f"  {a} {arrow} {b}")
    return "\n".join(lines)


# ----------------------------------------------------------------- output ----

def main():
    routers, services, prefixes, router_deps, service_deps, uses_db = scan_backend()
    routes, lib_api, hook_api = scan_frontend()
    commits = recent_commits()

    mermaid = build_mermaid(routes, lib_api, hook_api, routers, prefixes,
                            router_deps, service_deps, uses_db)

    md = []
    md.append("# Noor Safar — Context Graph")
    md.append("")
    md.append(f"_Auto-generated by `scripts/context_graph.py` on {date.today().isoformat()}"
              f" at commit `{head_hash()}`. Do not edit by hand — regenerate with"
              f" `python3 scripts/context_graph.py` (a pre-commit hook keeps it current)._")
    md.append("")
    md.append("## System graph")
    md.append("")
    md.append("Edges are derived from real imports and `/api/*` call sites. Frontend lib/hook"
              " nodes are shown only when they call the backend; page→module edges for"
              " purely-local libs are listed in the tables below.")
    md.append("")
    md.append("```mermaid")
    md.append(mermaid)
    md.append("```")
    md.append("")

    md.append("## Frontend routes")
    md.append("")
    md.append("| Route | Shared modules used | API endpoints referenced |")
    md.append("|---|---|---|")
    for route in sorted(routes):
        info = routes[route]
        mods = sorted([f"lib/{x}" for x in info["libs"]] + [f"hooks/{x}" for x in info["hooks"]])
        apis = sorted(f"/api/{a}" for a in info["apis"])
        md.append(f"| `{route}` | {', '.join(f'`{m}`' for m in mods) or '—'} "
                  f"| {', '.join(f'`{a}`' for a in apis) or '—'} |")
    md.append("")

    md.append("## Backend routers")
    md.append("")
    md.append("| Router | Mounted at | Services used | DB |")
    md.append("|---|---|---|---|")
    for r in routers:
        svc = ", ".join(f"`{s}`" for s in sorted(router_deps[r]["services"])) or "—"
        subs = router_deps[r]["sub_routers"]
        if subs:
            svc += (" · mounts " + ", ".join(f"`api/{x}`" for x in sorted(subs)))
        imps = router_deps[r]["imports"]
        if imps:
            svc += (" · imports " + ", ".join(f"`api/{x}`" for x in sorted(imps)))
        db = "✓" if uses_db.get(f"api.{r}") else "—"
        mounted = f"`{prefixes[r]}`" if r in prefixes else "not mounted (helper module)"
        md.append(f"| `api/{r}` | {mounted} | {svc} | {db} |")
    md.append("")

    md.append("## Backend services")
    md.append("")
    md.append("| Service | Depends on | DB |")
    md.append("|---|---|---|")
    for s in services:
        deps = ", ".join(f"`{d}`" for d in sorted(service_deps[s])) or "—"
        db = "✓" if uses_db.get(f"services.{s}") else "—"
        md.append(f"| `services/{s}` | {deps} | {db} |")
    md.append("")

    md.append(f"## Recent commits (last {len(commits)})")
    md.append("")
    md.append("| Commit | Date | Subject | Areas touched |")
    md.append("|---|---|---|---|")
    for c in commits:
        areas = ", ".join(sorted(c["areas"])) or "—"
        subject = c["subject"].replace("|", "\\|")
        md.append(f"| `{c['hash']}` | {c['date']} | {subject} | {areas} |")
    md.append("")

    md.append(f"_Stats: {len(routes)} frontend routes · {len(routers)} backend routers ·"
              f" {len(services)} services · {len(list((FRONTEND / 'lib').glob('*.ts')))} lib modules._")
    md.append("")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(md))
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

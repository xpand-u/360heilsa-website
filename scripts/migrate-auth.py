#!/usr/bin/env python3
"""
Transform API routes from hardcoded RAFN_ATHLETE_ID to per-user getAthleteId().

For each route:
1. Removes: const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;
2. Adds import for getAthleteId
3. Inserts auth check inside each exported handler
4. Renames ATHLETE_ID -> athleteId
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

# Routes to transform (authenticated user routes)
TRANSFORM = [
    "app/api/dashboard/chat/route.ts",
    "app/api/dashboard/foundation-debrief/route.ts",
    "app/api/dashboard/assessment/route.ts",
    "app/api/dashboard/state/route.ts",
    "app/api/dashboard/assess/screen/route.ts",
    "app/api/dashboard/assess/save/route.ts",
    "app/api/dashboard/assess/discuss/route.ts",
    "app/api/dashboard/log/route.ts",
    "app/api/dashboard/morning-brief/route.ts",
    "app/api/dashboard/nutrition/route.ts",
    "app/api/dashboard/mark-done/route.ts",
    "app/api/dashboard/session/route.ts",
    "app/api/program/pivot/route.ts",
    "app/api/program/reveal/route.ts",
    "app/api/program/exercise-history/route.ts",
    "app/api/program/block-debrief/route.ts",
    "app/api/program/generate/route.ts",
    "app/api/onboarding/status/route.ts",
    "app/api/onboarding/save/route.ts",
    "app/api/health/manual/route.ts",
    "app/api/cycle/log/route.ts",
    "app/api/strava/activities/route.ts",
    "app/api/strava/sync/route.ts",
    "app/api/terra/connections/route.ts",
    "app/api/terra/connect/route.ts",
]

AUTH_IMPORT = 'import { getAthleteId } from "@/lib/get-athlete-id";'
AUTH_CHECK = (
    '  const athleteId = await getAthleteId();\n'
    '  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n'
)

# Matches: export async function GET/POST/etc(...) {
HANDLER_RE = re.compile(
    r'(export async function (?:GET|POST|PUT|DELETE|PATCH|HEAD)\([^)]*\)\s*\{)',
    re.MULTILINE
)


def transform(content: str) -> str:
    # 1. Remove the hardcoded ATHLETE_ID line
    content = re.sub(
        r'\nconst ATHLETE_ID = process\.env\.RAFN_ATHLETE_ID!;\n',
        '\n',
        content
    )

    # 2. Add import if not already there
    if AUTH_IMPORT not in content:
        # Insert after the last existing import line
        last_import_match = None
        for m in re.finditer(r'^import .+;$', content, re.MULTILINE):
            last_import_match = m
        if last_import_match:
            pos = last_import_match.end()
            content = content[:pos] + '\n' + AUTH_IMPORT + content[pos:]
        else:
            content = AUTH_IMPORT + '\n' + content

    # 3. Insert auth check at the start of each exported handler body
    def inject_auth(match: re.Match) -> str:
        return match.group(1) + '\n' + AUTH_CHECK

    content = HANDLER_RE.sub(inject_auth, content)

    # 4. Rename ATHLETE_ID -> athleteId (only standalone occurrences)
    content = re.sub(r'\bATHLETE_ID\b', 'athleteId', content)

    return content


def main():
    changed = 0
    errors = []

    for rel_path in TRANSFORM:
        path = ROOT / rel_path
        if not path.exists():
            print(f"  SKIP (not found): {rel_path}")
            continue
        original = path.read_text()
        if 'RAFN_ATHLETE_ID' not in original and 'ATHLETE_ID' not in original:
            print(f"  SKIP (already done): {rel_path}")
            continue
        try:
            transformed = transform(original)
            path.write_text(transformed)
            print(f"  OK: {rel_path}")
            changed += 1
        except Exception as e:
            errors.append((rel_path, str(e)))
            print(f"  ERROR: {rel_path}: {e}")

    print(f"\nDone: {changed} files updated, {len(errors)} errors")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()

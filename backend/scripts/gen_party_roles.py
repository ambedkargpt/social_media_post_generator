"""
Generate the backend and frontend role tables from one source.

    python backend/scripts/gen_party_roles.py

Edit _party_roles_source.py and re-run; do not edit the generated files, since
the next run overwrites them and the two sides would drift.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _party_roles_source import ROWS, LEVELS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

# --------------------------------------------------------------- backend
be = ROOT / "backend" / "pipeline" / "party_roles.py"
lines = [
    '"""',
    "Where a user sits in their party, and what that does to a post.",
    "",
    "Position is a different axis from user_role. user_role is who someone is",
    "ideologically; this is how far their remit reaches and whether they can",
    "speak for the party at all. A booth worker writing about national policy in",
    "the party's voice is the failure this prevents.",
    "",
    "Generated from one source shared with frontend/src/utils/partyRoles.js.",
    "Edit both or neither.",
    '"""',
    "",
    "from __future__ import annotations",
    "",
    "# What each level means for the scope a post may claim.",
    "LEVEL_SCOPE = {",
]
for k, v in LEVELS.items():
    lines.append(f"    {k!r}: {v!r},")
lines += ["}", "", "", "# id -> label per party, level, and the instruction handed to the writer.", "ROLES: dict[str, dict] = {"]
for rid, group, level, sp, inc, generic, voice in ROWS:
    lines.append(f"    {rid!r}: {{")
    lines.append(f"        'group': {group!r},")
    lines.append(f"        'level': {level!r},")
    lines.append(f"        'labels': {{'sp': {sp!r}, 'inc': {inc!r}, 'generic': {generic!r}}},")
    lines.append(f"        'voice': {voice!r},")
    lines.append("    },")
lines += [
    "}",
    "",
    "",
    "def _party_key(party: str | None) -> str:",
    '    """Which naming a party uses. Everything else gets the generic wording."""',
    '    p = (party or "").lower()',
    '    if "samajwadi" in p:',
    '        return "sp"',
    '    if "indian national congress" in p or "(inc)" in p:',
    '        return "inc"',
    '    return "generic"',
    "",
    "",
    "def label_for(role_id: str | None, party: str | None) -> str:",
    '    """The title this party actually uses for the role, or empty if unknown."""',
    "    role = ROLES.get((role_id or '').strip())",
    "    if not role:",
    "        return ''",
    "    return role['labels'].get(_party_key(party)) or role['labels']['generic']",
    "",
    "",
    "def guidance_for(role_id: str | None, party: str | None) -> str:",
    '    """',
    "    One block describing the position, for the post prompt.",
    "",
    "    Empty when no position is set, so the prompt stays exactly as it was for",
    "    a user who never chose one.",
    '    """',
    "    role = ROLES.get((role_id or '').strip())",
    "    if not role:",
    "        return ''",
    "    label = label_for(role_id, party)",
    "    scope = LEVEL_SCOPE.get(role['level'], '')",
    "    return f\"{label}. {role['voice']} {scope}\".strip()",
    "",
]
be.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {be.relative_to(ROOT)}  ({len(ROWS)} roles)")

# -------------------------------------------------------------- frontend
groups = []
for rid, group, level, sp, inc, generic, voice in ROWS:
    if not groups or groups[-1]["group"] != group:
        groups.append({"group": group, "roles": []})
    groups[-1]["roles"].append({"id": rid, "sp": sp, "inc": inc, "generic": generic})

fe = ROOT / "frontend" / "src" / "utils" / "partyRoles.js"
js = [
    "// Party positions offered on the profile screen.",
    "//",
    "// Generated from the same source as backend/pipeline/party_roles.py, which",
    "// owns what each position does to a generated post. The ids here are what",
    "// gets stored; the labels are only what a person reads.",
    "",
    "export const ROLE_GROUPS = " + json.dumps(groups, ensure_ascii=False, indent=2) + ";",
    "",
    "// Samajwadi and Congress have their own vocabulary for the same posts.",
    "// Every other party in the list gets neutral wording.",
    "export function partyKey(party) {",
    "  const p = (party || '').toLowerCase();",
    "  if (p.includes('samajwadi')) return 'sp';",
    "  if (p.includes('indian national congress') || p.includes('(inc)')) return 'inc';",
    "  return 'generic';",
    "}",
    "",
    "export function roleLabel(role, party) {",
    "  return role[partyKey(party)] || role.generic;",
    "}",
    "",
    "export function labelForId(id, party) {",
    "  for (const g of ROLE_GROUPS) {",
    "    const hit = g.roles.find((r) => r.id === id);",
    "    if (hit) return roleLabel(hit, party);",
    "  }",
    "  return '';",
    "}",
    "",
]
fe.write_text("\n".join(js), encoding="utf-8")
print(f"wrote {fe.relative_to(ROOT)}  ({len(groups)} groups)")

"""
Tenant registry.

A "tenant" is a news audience segment — a political party the user can follow,
plus the special ``general`` tenant that carries neutral/journalistic news
(currently Ravish Kumar). Every news document is stamped with ``tenant_id`` and
``tenant_slug`` at publish time so the API can serve:

  * party news    -> tenant_id == <chosen party>
  * general news  -> tenant_id == the general tenant

The registry is data, not code: edit ``config/tenants.json`` to add a party.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


_REGISTRY_PATH = Path(__file__).resolve().parent / "config" / "tenants.json"


@dataclass(frozen=True)
class Tenant:
    tenant_id: int
    slug: str
    name: str
    source_name: str
    is_general: bool = False
    # The opposition's own channel(s) — scraped so a post can be written
    # against their material, never as a selectable "my party" option and
    # never folded into the general/neutral feed.
    is_opposition: bool = False


@lru_cache(maxsize=1)
def load_tenants() -> tuple[Tenant, ...]:
    """Load and validate the tenant registry (cached)."""
    if not _REGISTRY_PATH.is_file():
        raise FileNotFoundError(f"Tenant registry not found: {_REGISTRY_PATH}")
    payload = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    rows = payload.get("tenants") or []
    tenants: list[Tenant] = []
    seen_ids: set[int] = set()
    seen_slugs: set[str] = set()
    for row in rows:
        tenant = Tenant(
            tenant_id=int(row["tenant_id"]),
            slug=str(row["slug"]).strip().lower(),
            name=str(row["name"]).strip(),
            source_name=str(row.get("source_name") or row["name"]).strip(),
            is_general=bool(row.get("is_general", False)),
            is_opposition=bool(row.get("is_opposition", False)),
        )
        if tenant.tenant_id in seen_ids:
            raise ValueError(f"Duplicate tenant_id in registry: {tenant.tenant_id}")
        if tenant.slug in seen_slugs:
            raise ValueError(f"Duplicate tenant slug in registry: {tenant.slug}")
        seen_ids.add(tenant.tenant_id)
        seen_slugs.add(tenant.slug)
        tenants.append(tenant)
    if not tenants:
        raise ValueError("Tenant registry is empty.")
    return tuple(tenants)


def get_tenant(key: int | str | None) -> Tenant | None:
    """Resolve a tenant by numeric id or slug. Returns None when not found."""
    if key is None or key == "":
        return None
    tenants = load_tenants()
    # Numeric id (accepts "1" as well as 1)
    try:
        wanted_id = int(key)
    except (TypeError, ValueError):
        wanted_id = None
    if wanted_id is not None:
        for tenant in tenants:
            if tenant.tenant_id == wanted_id:
                return tenant
        return None
    wanted_slug = str(key).strip().lower()
    for tenant in tenants:
        if tenant.slug == wanted_slug:
            return tenant
    return None


def general_tenant() -> Tenant:
    """The tenant used for neutral/journalistic news shown to everyone."""
    for tenant in load_tenants():
        if tenant.is_general:
            return tenant
    return load_tenants()[0]


def opposition_tenant() -> Tenant | None:
    """The opposition's own tenant (BJP), or None until one is registered."""
    for tenant in load_tenants():
        if tenant.is_opposition:
            return tenant
    return None


def party_tenants() -> tuple[Tenant, ...]:
    """All selectable political parties: not general, not the opposition."""
    return tuple(t for t in load_tenants() if not t.is_general and not t.is_opposition)

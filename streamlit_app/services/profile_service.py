from __future__ import annotations

from pathlib import Path
from typing import List, Dict

import pandas as pd

from config import get_settings
from pipeline.profiles import PROFILE_FIELDS, _ensure_user_profiles_parquet


def profiles_path() -> Path:
    return get_settings().user_profiles_parquet_path


def load_profiles() -> List[Dict[str, str]]:
    path = profiles_path()
    _ensure_user_profiles_parquet(path)
    df = pd.read_parquet(path)
    return df.to_dict(orient="records")


def save_profiles(rows: List[Dict[str, str]]) -> None:
    cleaned = []
    for row in rows:
        out = {}
        for key in PROFILE_FIELDS:
            out[key] = str(row.get(key, "") or "")
        cleaned.append(out)
    df = pd.DataFrame(cleaned, columns=PROFILE_FIELDS)
    path = profiles_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from streamlit_app.components.auth import require_login


require_login("RAG Pipeline Testing Console")

st.title("RAG Pipeline Testing Console")
st.markdown(
    """
Use the left sidebar to open:

- `Test Retrieval`
- `Generate Posts From News`
- `Main Pipeline`
- `Profile Lab`
"""
)

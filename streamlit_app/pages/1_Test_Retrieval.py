from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from streamlit_app.components.auth import require_login
from streamlit_app.services.retrieval_service import run_retrieval


require_login("Test Retrieval")

st.title("Test Retrieval")
query = st.text_area("Query", height=140, placeholder="Enter a query/news summary")
top_k = st.slider("Top K", min_value=1, max_value=25, value=5, step=1)

if st.button("Run Retrieval", width="stretch"):
    if not query.strip():
        st.warning("Please provide a query.")
    else:
        with st.spinner("Running retrieval..."):
            payload = run_retrieval(query=query.strip(), top_k=int(top_k))
        st.success(f"Retrieved {len(payload.get('results', []))} chunk(s).")
        st.json(payload)

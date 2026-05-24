"""
Gunicorn config for AmbedkarGPT API.

Deploy: copy to ``/etc/ambedkar/gunicorn.conf.py`` and run::

  gunicorn -c /etc/ambedkar/gunicorn.conf.py backend.main:app
"""

import multiprocessing
import os

bind = os.getenv("GUNICORN_BIND", "127.0.0.1:8000")
workers = int(os.getenv("WEB_CONCURRENCY", str(multiprocessing.cpu_count() * 2 + 1)))
worker_class = "uvicorn.workers.UvicornWorker"
# Post generation (DeepSeek reasoner + retrieval) often exceeds 120s; allow headroom.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "600"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "120"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))
accesslog = "-"
errorlog = "-"
capture_output = True

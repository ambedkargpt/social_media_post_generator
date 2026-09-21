"""
Makes tests a package, which is what puts the repo root on sys.path.

Without this file pytest treats each test module as a top-level script and
inserts only backend/tests into sys.path, so a module-level `from backend...`
fails during collection — while the same import inside a test function still
works, because the root is on the path by the time the test runs. That is why
the suite passed for months: every existing test imported inside its functions,
and the first test to import at module level broke CI rather than anything
about the code it was testing.

With an __init__.py here, pytest walks up through backend/__init__.py to the
repo root and inserts that instead, so both forms work under `pytest` and
`python -m pytest` alike.
"""

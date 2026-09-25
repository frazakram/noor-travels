import os

# Tests must never reach a real database or provider by accident.
os.environ["FORCE_SQLITE"] = "1"
os.environ.setdefault("AUTH_SECRET", "test-secret")

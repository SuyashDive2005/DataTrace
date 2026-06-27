import os
TRUST_THRESHOLD = 95.0
EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cleaned_exports")
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)
redis_url = "redis://localhost:6379/0"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)
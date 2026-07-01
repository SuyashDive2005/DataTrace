import os
TRUST_THRESHOLD = 95.0
EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cleaned_exports")
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
VECTOR_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_db")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)
redis_url = "redis://localhost:6379/0"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(VECTOR_DB_DIR, exist_ok=True)
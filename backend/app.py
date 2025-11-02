"""FastAPI wrapper exposing /summarize and /summarize-marathi endpoints.

Run with:
    uvicorn backend.app:app --reload --port 8000
"""

# --- Fix Unicode Output (important for Marathi text) ---
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import logging

# === Import both models ===
from model_infer import summarize, is_loaded, _load_model
from Model2 import summarize_marathi_text

logger = logging.getLogger("backend.app")

# === FastAPI App Setup ===
app = FastAPI(title="NotebookModelAPI")

# Allow frontend CORS access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Schemas ===
class SummarizeRequest(BaseModel):
    text: str
    min_length: int | None = None
    max_length: int | None = None

class SummarizeResponse(BaseModel):
    summary: str

# === 1️⃣ English Summarizer Endpoint ===
@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_endpoint(req: SummarizeRequest):
    try:
        summary = summarize(req.text, min_length=req.min_length or 30, max_length=req.max_length or 100)
        return SummarizeResponse(summary=summary)
    except Exception as e:
        logger.exception("Error during English summarization")
        raise HTTPException(status_code=500, detail=str(e))

# === 2️⃣ Marathi Summarizer Endpoint ===
@app.post("/summarize-marathi", response_model=SummarizeResponse)
async def summarize_marathi_endpoint(req: SummarizeRequest):
    try:
        summary = summarize_marathi_text(req.text)
        return SummarizeResponse(summary=summary)
    except Exception as e:
        logger.exception("Error during Marathi summarization")
        raise HTTPException(status_code=500, detail=str(e))

# === Health + Utility Endpoints ===
@app.get("/ready")
async def ready():
    try:
        return {"loaded": bool(is_loaded())}
    except Exception:
        return {"loaded": False}

@app.post("/load")
async def load_model_endpoint(blocking: bool = False):
    try:
        if not is_loaded():
            if blocking:
                _load_model()
                return {"status": "loaded"}
            import threading
            t = threading.Thread(target=_load_model, daemon=True)
            t.start()
            return {"status": "loading"}
        return {"status": "already_loaded"}
    except Exception as e:
        logger.exception("Failed to start model load")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/diagnose")
async def diagnose():
    """Return lightweight diagnostics."""
    import platform
    info = {"python_version": platform.python_version(), "model_loaded": False}
    try:
        info["model_loaded"] = bool(is_loaded())
    except Exception as e:
        info["model_infer_error"] = str(e)

    try:
        import torch
        info["torch"] = True
        info["torch_version"] = getattr(torch, "__version__", "unknown")
        info["cuda_available"] = torch.cuda.is_available()
    except Exception as e:
        info["torch"] = False
        info["torch_error"] = str(e)

    try:
        import transformers
        info["transformers"] = True
        info["transformers_version"] = getattr(transformers, "__version__", "unknown")
    except Exception as e:
        info["transformers"] = False
        info["transformers_error"] = str(e)

    try:
        import sentencepiece
        info["sentencepiece"] = True
        info["sentencepiece_version"] = getattr(sentencepiece, "__version__", "unknown")
    except Exception as e:
        info["sentencepiece"] = False
        info["sentencepiece_error"] = str(e)

    try:
        import pkgutil
        proto = pkgutil.find_loader('google.protobuf')
        info["protobuf_found"] = proto is not None
    except Exception:
        info["protobuf_found"] = False

    return info

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

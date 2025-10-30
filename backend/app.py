"""FastAPI wrapper exposing /summarize endpoint which calls model_infer.summarize

Run with: uvicorn backend.app:app --reload --port 8000
"""
# at top of backend/app.py (very small change)
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import logging

from model_infer import summarize, is_loaded, _load_model

logger = logging.getLogger("backend.app")

app = FastAPI(title="NotebookModelAPI")

# Allow local frontend during development. Adjust origin for production.
# This is the fix
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:3000"  # <-- ADD THIS LINE
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummarizeRequest(BaseModel):
    text: str
    min_length: int | None = None
    max_length: int | None = None


class SummarizeResponse(BaseModel):
    summary: str


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_endpoint(req: SummarizeRequest):
    try:
        summary = summarize(req.text, min_length=req.min_length or 30, max_length=req.max_length or 100)
        return SummarizeResponse(summary=summary)
    except Exception as e:
        logger.exception("Error during summarization")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ready")
async def ready():
    """Returns readiness state. If model not loaded, returns loaded=false."""
    try:
        return {"loaded": bool(is_loaded())}
    except Exception:
        return {"loaded": False}


@app.post("/load")
async def load_model_endpoint(blocking: bool = False):
    """Trigger model load (useful to warm up).

    If `blocking=true` is provided as a query parameter the endpoint will
    synchronously load the model and return only after the load completes.
    This is useful for debugging to see errors/warnings in the server logs.
    """
    try:
        if not is_loaded():
            if blocking:
                # load synchronously (useful for debugging)
                _load_model()
                return {"status": "loaded"}
            # trigger load in background to avoid blocking caller too long
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
    """Return lightweight diagnostics about python packages and model state.

    This endpoint avoids heavy model loading; it's intended to help debug
    missing package/import errors (e.g., protobuf, transformers) without
    triggering the full model download.
    """
    import platform
    info = {
        "python_version": platform.python_version(),
        "model_loaded": False,
    }
    # check model_infer availability
    try:
        info["model_loaded"] = bool(is_loaded())
    except Exception as e:
        info["model_infer_error"] = str(e)

    # check optional heavy deps gracefully
    try:
        import torch
        info["torch"] = True
        info["torch_version"] = getattr(torch, "__version__", "unknown")
        try:
            info["cuda_available"] = torch.cuda.is_available()
        except Exception:
            info["cuda_available"] = False
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
        # check protobuf availability
        proto = pkgutil.find_loader('google.protobuf')
        info["protobuf_found"] = proto is not None
    except Exception:
        info["protobuf_found"] = False

    return info

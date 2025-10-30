"""model_infer.py

Converted from Text_summarizer.ipynb: provides a summarize(text) function that uses
ai4bharat/IndicBART-XLSum to produce an abstractive Marathi summary.

NOTE: this loads the model at import time which can be slow and memory-heavy. For
production, consider lazy-loading or running on a dedicated inference server with GPU.
"""
from typing import Optional
import logging
import threading

logger = logging.getLogger(__name__)

MODEL_NAME = "ai4bharat/IndicBART-XLSum"

# Lazy-loaded globals
_device = None
_tokenizer = None
_model = None
_load_lock = threading.Lock()


def _load_model():
    """Load tokenizer and model into module-level variables. Thread-safe."""
    global _device, _tokenizer, _model
    if _model is not None and _tokenizer is not None:
        return
    with _load_lock:
        if _model is not None and _tokenizer is not None:
            return
        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        except Exception as e:
            logger.exception("Failed importing model libraries")
            raise

        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {_device}")

        logger.info("Loading tokenizer and model (this may take a while)...")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME).to(_device)
        logger.info("Model loaded.")


def is_loaded() -> bool:
    return _model is not None and _tokenizer is not None


def summarize(text: str, min_length: int = 30, max_length: int = 100) -> str:
    """Return an abstractive Marathi summary for the provided text.

    Args:
        text: input text (Marathi or other Indic lang supported by model)
        min_length: minimum number of tokens in generated summary
        max_length: maximum number of tokens in generated summary

    Returns:
        summary string
    """
    if not text or not text.strip():
        return ""

    # ensure model loaded
    if not is_loaded():
        _load_model()

    # model expects a target-language tag; for Marathi use <2mr> as in the notebook
    input_text = f"{text} </s> <2mr>"
    logger.debug("Input text for summarization: %s", input_text)

    # tokenize and move tensors to device
    inputs = _tokenizer(
        input_text,
        return_tensors="pt",
        max_length=1024,
        truncation=True,
    )

    input_ids = inputs.input_ids.to(_device)
    attention_mask = inputs.attention_mask.to(_device) if 'attention_mask' in inputs else None

    # generation
    summary_ids = _model.generate(
        input_ids,
        attention_mask=attention_mask,
        num_beams=4,
        min_length=min_length,
        max_length=max_length,
        length_penalty=2.0,
        early_stopping=True,
        decoder_start_token_id=_tokenizer.encode("<2mr>", add_special_tokens=False)[0],
    )

    summary = _tokenizer.batch_decode(
        summary_ids,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )[0]
    logger.info("Generated summary (len=%d)", len(summary))
    return summary

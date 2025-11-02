# marathi_summarizer.py
from transformers import MBartForConditionalGeneration, MBart50TokenizerFast, pipeline
import unicodedata
import torch
import re

# Load models only once (heavy models)
print("🔹 Loading MBart and BART models...")

mbart_model_name = "facebook/mbart-large-50-many-to-many-mmt"
bart_model_name = "facebook/bart-large-cnn"

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device set to use {device}")

tokenizer = MBart50TokenizerFast.from_pretrained(mbart_model_name, src_lang="mr_IN")
mbart_model = MBartForConditionalGeneration.from_pretrained(mbart_model_name).to(device)
summarizer = pipeline("summarization", model=bart_model_name, device=0 if device == "cuda" else -1)


def summarize_marathi_text(marathi_text: str) -> str:
    """Takes Marathi text → Translates → Summarizes → Back to Marathi"""
    try:
        # === Step 1: Marathi → English ===
        tokenizer.src_lang = "mr_IN"
        encoded_mr = tokenizer(marathi_text, return_tensors="pt", truncation=True, max_length=512).to(device)
        generated_tokens = mbart_model.generate(
            **encoded_mr,
            forced_bos_token_id=tokenizer.lang_code_to_id["en_XX"],
            max_length=768,
            num_beams=4,
            temperature=0.9
        )
        english_text = tokenizer.decode(generated_tokens[0], skip_special_tokens=True, clean_up_tokenization_spaces=True)

        # === Step 2: English Summarization ===
        summary_en = summarizer(
            english_text,
            max_length=60,
            min_length=25,
            do_sample=False
        )[0]['summary_text']
        # === Step 3: English → Marathi ===
        tokenizer.src_lang = "en_XX"
        encoded_en = tokenizer(summary_en, return_tensors="pt", truncation=True, max_length=512).to(device)
        generated_tokens_mr = mbart_model.generate(
            **encoded_en,
            forced_bos_token_id=tokenizer.lang_code_to_id["mr_IN"],
            max_length=256,
            num_beams=4,
            temperature=0.9
        )

        # === Step 4: Normalize & Clean Marathi Output ===
        raw_mr = tokenizer.decode(
            generated_tokens_mr[0],
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True
        )
        virama = "\u094D"
        # Proper Unicode normalization (fixes ् + र issues)
        cleaned_mr = re.sub(r" (" + virama + ")", r"\1", raw_mr)
        cleaned_mr = re.sub(r"(" + virama + ") ", r"\1", cleaned_mr)
        
        summary_mr = unicodedata.normalize("NFC", cleaned_mr)

        # Fix punctuation spacing
        summary_mr = (
            summary_mr.replace(" .", "।")
            .replace("..", "।")
            .replace(" . ", "।")
            .replace(" ?", "?")
            .replace(" !", "!")
            .replace(" ,", ",")
            .replace(" :", ":")
            .strip()
        )

        # Ensure it's fully composed Unicode when returned
        return str(summary_mr.encode("utf-8").decode("utf-8"))





    except Exception as e:
        print("❌ Error in summarization:", e)
        return "सारांश तयार करण्यात त्रुटी आली आहे."

"""
Groq LLM service integration for AETHERIUM bookstore (Phase 7).
Handles prompt construction, API communication, error abstraction, and configuration safety.
"""

import logging
from django.conf import settings
import groq

logger = logging.getLogger(__name__)


class GroqConfigurationError(Exception):
    """Raised when Groq API key or required environment configuration is missing."""
    pass


class GroqServiceError(Exception):
    """Raised when Groq API returns an unrecoverable or malformed response."""
    pass


def is_placeholder_key(key: str) -> bool:
    """
    Checks if the provided API key appears to be an unconfigured template placeholder.
    """
    if not key or not isinstance(key, str):
        return True
    key_lower = key.strip().lower()
    placeholders = [
        'your_groq_api_key',
        'your_actual_groq',
        'gsk_your',
        'placeholder',
        '<your',
        'enter_your',
        'xxx',
    ]
    return any(p in key_lower for p in placeholders)


def get_groq_client():
    """
    Initializes and returns a Groq SDK client using configured settings.
    Raises GroqConfigurationError if GROQ_API_KEY is not set or contains placeholder text.
    """
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if isinstance(api_key, str):
        api_key = api_key.strip().strip("'\"")

    if not api_key:
        raise GroqConfigurationError("GROQ_API_KEY is not configured on the server.")

    if is_placeholder_key(api_key):
        raise GroqConfigurationError(
            "GROQ_API_KEY contains placeholder text. Please set your genuine Groq API key in backend/.env."
        )

    timeout = getattr(settings, 'GROQ_TIMEOUT', 25.0)
    return groq.Groq(api_key=api_key, timeout=timeout)


def generate_book_summary(book):
    """
    Generates a concise, high-quality editorial summary for a Book model instance
    using Groq's chat completions API.
    
    Guarantees:
    - Never leaks the API key in logs or exceptions.
    - Grounded in provided catalogue metadata.
    - Returns (summary_text, model_name).
    """
    client = get_groq_client()
    model = getattr(settings, 'GROQ_MODEL', 'qwen/qwen3.8-27b').strip().strip("'\"") or 'qwen/qwen3.8-27b'

    system_prompt = (
        "You are the literary editorial intelligence for AETHERIUM, a curated bookstore. "
        "Your task is to generate an elegant, concise, and helpful book synopsis (around 2-3 short paragraphs) "
        "for readers deciding whether to acquire or read this title.\n\n"
        "Strict Guidelines:\n"
        "1. Ground your synopsis exclusively on the catalogue information provided (title, author, category, publisher, and catalogue description).\n"
        "2. Write clear, sophisticated, and readable prose matching an editorial bookstore tone.\n"
        "3. Do not invent plot points, characters, historical claims, or themes not supported by the supplied metadata.\n"
        "4. If the provided catalogue description is sparse or provides minimal detail, clearly acknowledge that catalogue details are limited while summarizing what is known.\n"
        "5. Do not reproduce lengthy copyrighted text passages or claim this summary is the author's original words.\n"
        "6. Do not imply or claim you have read the full book; present this as an editorial synopsis synthesized from catalogue records.\n"
        "7. Return clean plain text without markdown headings, asterisks, bullet points, or intro conversational filler like 'Here is a summary:'."
    )

    category_name = book.category.name if book.category else "General Literature"
    publisher_name = book.publisher.strip() if book.publisher else "Not specified"
    description_text = book.description.strip() if book.description else "No synopsis provided in catalogue."

    user_prompt = (
        f"Catalogue Book Record:\n"
        f"Title: {book.title}\n"
        f"Author: {book.author}\n"
        f"Category: {category_name}\n"
        f"Publisher: {publisher_name}\n"
        f"Catalogue Description: {description_text}\n\n"
        f"Please provide an elegant editorial synopsis based strictly on this catalogue information."
    )

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=600,
        )
    except groq.AuthenticationError as exc:
        req_id = getattr(exc, 'request_id', None)
        logger.error("Groq authentication failure (HTTP 401). Request ID: %s", req_id)
        raise
    except groq.PermissionDeniedError as exc:
        req_id = getattr(exc, 'request_id', None)
        logger.error("Groq permission denied (HTTP 403). Request ID: %s", req_id)
        raise
    except groq.NotFoundError as exc:
        req_id = getattr(exc, 'request_id', None)
        logger.error("Groq model not found or inaccessible (HTTP 404): '%s'. Request ID: %s", model, req_id)
        raise
    except groq.RateLimitError as exc:
        req_id = getattr(exc, 'request_id', None)
        logger.warning("Groq rate limit encountered (HTTP 429). Request ID: %s", req_id)
        raise
    except groq.APITimeoutError as exc:
        logger.warning("Groq request timed out during book summary generation.")
        raise
    except groq.APIConnectionError as exc:
        logger.error("Groq network connection error during book summary generation.")
        raise
    except groq.GroqError as exc:
        status_code = getattr(exc, 'status_code', None)
        req_id = getattr(exc, 'request_id', None)
        logger.error("Groq API error encountered: %s (Status: %s, Request ID: %s)", type(exc).__name__, status_code, req_id)
        raise

    if not completion.choices or not completion.choices[0].message:
        raise GroqServiceError("Provider returned an empty response choices payload.")

    summary_text = completion.choices[0].message.content
    if not summary_text or not summary_text.strip():
        raise GroqServiceError("Provider returned an empty summary text.")

    return summary_text.strip(), model

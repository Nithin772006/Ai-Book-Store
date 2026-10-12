"""
Management command to safely diagnose Groq API configuration and connectivity
for the AETHERIUM bookstore project (Phase 7 & 8).

Guarantees:
- Never prints, logs, or leaks the API key (only reports length and placeholder status).
- Tests model accessibility with a minimal 2-token request.
- Distinguishes 401 (Auth), 403 (Permission), 404 (Model), 429 (Rate limit), and network errors.
"""

import sys
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
import groq

from catalog.services.groq_service import get_groq_client, is_placeholder_key, GroqConfigurationError


class Command(BaseCommand):
    help = "Safely checks Groq API configuration, credentials, and model access without leaking secrets."

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-live',
            action='store_true',
            help='Only inspect local configuration and .env loading without making live network requests to Groq.',
        )
        parser.add_argument(
            '--list-models',
            action='store_true',
            help='Query the Groq API to list accessible models for this API key.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== AETHERIUM Groq AI Diagnostic Check ==="))

        # 1. Inspect .env file location
        base_dir = getattr(settings, 'BASE_DIR', Path('.'))
        env_path = base_dir / '.env'
        env_exists = env_path.exists()

        self.stdout.write(f"[*] Configuration Path: {env_path}")
        if env_exists:
            self.stdout.write(self.style.SUCCESS("    [OK] backend/.env file is present."))
        else:
            self.stdout.write(self.style.WARNING("    [WARN] backend/.env file not found at expected path."))

        # 2. Inspect Settings
        raw_key = getattr(settings, 'GROQ_API_KEY', '')
        configured_model = getattr(settings, 'GROQ_MODEL', 'qwen/qwen3.8-27b')
        configured_timeout = getattr(settings, 'GROQ_TIMEOUT', 25.0)

        has_key = bool(raw_key and raw_key.strip())
        key_len = len(raw_key.strip()) if has_key else 0
        is_placeholder = is_placeholder_key(raw_key) if has_key else False

        self.stdout.write(f"[*] Configured GROQ_MODEL: {configured_model}")
        self.stdout.write(f"[*] Configured GROQ_TIMEOUT: {configured_timeout}s")
        self.stdout.write(f"[*] GROQ_API_KEY present: {has_key}")
        self.stdout.write(f"[*] GROQ_API_KEY length: {key_len} characters")

        if not has_key:
            self.stdout.write(self.style.ERROR("    [FAIL] GROQ_API_KEY is empty or missing in backend/.env."))
            self.stdout.write("    Remedy: Add GROQ_API_KEY=gsk_... to backend/.env and restart the backend.")
            sys.exit(1)

        if is_placeholder:
            self.stdout.write(self.style.ERROR("    [FAIL] GROQ_API_KEY contains placeholder text (e.g., 'your_groq_api_key')."))
            self.stdout.write("    Remedy: Replace the placeholder in backend/.env with your genuine key from https://console.groq.com/keys.")
            sys.exit(1)

        self.stdout.write(self.style.SUCCESS("    [OK] Key passes safe syntax and placeholder heuristics."))

        if options.get('skip_live'):
            self.stdout.write(self.style.SUCCESS("\n[OK] Local configuration check passed (live request skipped)."))
            return

        # 3. Live Client Initialization
        self.stdout.write("\n[*] Initializing Groq client and testing provider connectivity...")
        try:
            client = get_groq_client()
        except GroqConfigurationError as exc:
            self.stdout.write(self.style.ERROR(f"    [FAIL] Client initialization error: {exc}"))
            sys.exit(1)

        # 4. Optional / Diagnostic Model List
        if options.get('list_models'):
            self.stdout.write("[*] Fetching accessible models from Groq API...")
            try:
                models_resp = client.models.list()
                accessible_models = [m.id for m in models_resp.data]
                self.stdout.write(self.style.SUCCESS(f"    Accessible models ({len(accessible_models)}):"))
                for mid in accessible_models:
                    marker = " <== CURRENTLY CONFIGURED" if mid == configured_model else ""
                    self.stdout.write(f"      - {mid}{marker}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"    Unable to list models: {type(e).__name__}: {e}"))

        # 5. Live Ping with configured model
        self.stdout.write(f"[*] Sending minimal test prompt to model '{configured_model}'...")
        t0 = time.time()
        try:
            completion = client.chat.completions.create(
                model=configured_model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=2,
            )
            elapsed = time.time() - t0
            reply_snippet = completion.choices[0].message.content if completion.choices else ""
            self.stdout.write(self.style.SUCCESS(
                f"\n[SUCCESS] Groq API authentication and model query succeeded in {elapsed:.2f}s!\n"
                f"          Model: {configured_model}\n"
                f"          Response snippet: {reply_snippet.strip()}"
            ))
        except groq.AuthenticationError as exc:
            req_id = getattr(exc, 'request_id', 'N/A')
            self.stdout.write(self.style.ERROR(
                f"\n[FAIL] HTTP 401 Authentication Failure (Request ID: {req_id})\n"
                f"       Groq rejected your API credentials. The key may be expired, malformed, or revoked.\n"
                f"       Remedy: Generate a fresh key at https://console.groq.com/keys and update backend/.env."
            ))
            sys.exit(1)
        except groq.PermissionDeniedError as exc:
            req_id = getattr(exc, 'request_id', 'N/A')
            self.stdout.write(self.style.ERROR(
                f"\n[FAIL] HTTP 403 Permission Denied (Request ID: {req_id})\n"
                f"       Your account or organization does not have permission to access this resource.\n"
                f"       Remedy: Verify your Groq account tier and permissions."
            ))
            sys.exit(1)
        except groq.NotFoundError as exc:
            req_id = getattr(exc, 'request_id', 'N/A')
            self.stdout.write(self.style.ERROR(
                f"\n[FAIL] HTTP 404 Model Not Found (Request ID: {req_id})\n"
                f"       The configured model '{configured_model}' does not exist or is not enabled for your account tier.\n"
                f"       Remedy: Set GROQ_MODEL=qwen/qwen3.8-27b in backend/.env, or run with --list-models to see available models."
            ))
            sys.exit(1)
        except groq.RateLimitError as exc:
            req_id = getattr(exc, 'request_id', 'N/A')
            self.stdout.write(self.style.WARNING(
                f"\n[FAIL] HTTP 429 Rate Limit Exceeded (Request ID: {req_id})\n"
                f"       Credentials are valid, but rate limits or quota thresholds were exceeded.\n"
                f"       Remedy: Wait a moment or check your quota on the Groq console."
            ))
            sys.exit(1)
        except groq.APITimeoutError:
            self.stdout.write(self.style.ERROR(
                "\n[FAIL] Request Timed Out\n"
                "       Communication with Groq timed out. Check your internet connection or increase GROQ_TIMEOUT."
            ))
            sys.exit(1)
        except groq.APIConnectionError as exc:
            self.stdout.write(self.style.ERROR(
                f"\n[FAIL] Network Connection Error: {exc}\n"
                "       Could not connect to api.groq.com. Verify network connectivity, DNS, or proxy settings."
            ))
            sys.exit(1)
        except groq.GroqError as exc:
            self.stdout.write(self.style.ERROR(
                f"\n[FAIL] Groq Provider Error: {type(exc).__name__}: {exc}"
            ))
            sys.exit(1)

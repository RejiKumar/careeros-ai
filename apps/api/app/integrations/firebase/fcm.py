"""Firebase Cloud Messaging integration (provider SDK code).

Provider types stay inside integrations; domain code consumes typed services.
Firebase Admin is initialized lazily from the configured service-account
credentials so that the app still boots when FCM is not provisioned.
"""

from __future__ import annotations

import json
import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)

_APP_NAME = "careeros-fcm"

_initialized = False


def _load_credentials(settings: Settings) -> dict | None:
    if settings.firebase_credentials_json:
        try:
            return json.loads(settings.firebase_credentials_json)
        except json.JSONDecodeError:
            logger.error("FIREBASE_CREDENTIALS_JSON is not valid JSON; FCM disabled.")
            return None
    if settings.firebase_credentials_path:
        try:
            with open(settings.firebase_credentials_path, encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, json.JSONDecodeError):
            logger.error(
                "Could not read FIREBASE_CREDENTIALS_PATH; FCM disabled.",
                exc_info=True,
            )
            return None
    return None


def _ensure_initialized(settings: Settings) -> bool:
    """Initialize the Firebase Admin app once. Returns True when ready."""
    global _initialized
    if _initialized:
        return True
    credentials = _load_credentials(settings)
    if credentials is None:
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps.get(_APP_NAME):
            cred = credentials.Certificate(credentials)
            firebase_admin.initialize_app(cred, name=_APP_NAME)
        _initialized = True
        return True
    except Exception:
        logger.exception("Failed to initialize Firebase Admin; FCM disabled.")
        return False


def is_fcm_available(settings: Settings) -> bool:
    return _ensure_initialized(settings)


def send_message(
    settings: Settings,
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    image_url: str | None = None,
) -> bool:
    """Send a single push message. Returns True on success.

    Returns False (and does not raise) when FCM is not configured or the send
    fails, so callers can degrade gracefully.
    """
    if not _ensure_initialized(settings):
        logger.warning("FCM is not configured; skipping push to token.")
        return False
    try:
        from firebase_admin import messaging

        messaging.send(
            messaging.Message(
                notification=messaging.Notification(title=title, body=body, image=image_url),
                token=token,
                data=data,
            ),
            app_name=_APP_NAME,
        )
        return True
    except Exception:
        logger.exception("Failed to send FCM message to device.")
        return False

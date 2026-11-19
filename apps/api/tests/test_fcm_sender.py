"""FCM sender and notification delivery tests (no network, strict SDK signature)."""

from __future__ import annotations

import pytest
from app.core.auth import CurrentActor
from app.core.config import Settings
from app.integrations.firebase import fcm
from app.modules.notifications import service as service_module
from app.modules.notifications.service import NotificationService
from firebase_admin import messaging

from .fakes import FakeClients

_SETTINGS = Settings(environment="prod", firebase_credentials_json='{"project_id": "test"}')
_APP = object()


@pytest.fixture
def sdk(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replace the SDK call with a function that has messaging.send's real signature."""
    calls: list[dict] = []

    def strict_send(message: messaging.Message, dry_run: bool = False, app: object = None) -> str:
        calls.append({"message": message, "app": app})
        return "projects/test/messages/1"

    monkeypatch.setattr(fcm, "_ensure_initialized", lambda settings: True)
    monkeypatch.setattr("firebase_admin.get_app", lambda name: _APP)
    monkeypatch.setattr(messaging, "send", strict_send)
    return calls


def _send() -> bool:
    return fcm.send_message(
        _SETTINGS, token="device-token", title="Hello", body="World", data={"type": "mission"}
    )


def test_send_calls_the_sdk_with_the_app_and_android_channel(sdk: list[dict]) -> None:
    assert _send() is True

    [call] = sdk
    assert call["app"] is _APP
    message = call["message"]
    assert message.token == "device-token"
    assert message.notification.title == "Hello"
    assert message.android.notification.channel_id == fcm.ANDROID_CHANNEL_ID
    assert message.data == {"type": "mission"}


def test_send_failure_returns_false(sdk: list[dict], monkeypatch: pytest.MonkeyPatch) -> None:
    def failing_send(message: object, dry_run: bool = False, app: object = None) -> str:
        raise RuntimeError("fcm down")

    monkeypatch.setattr(messaging, "send", failing_send)

    assert _send() is False


@pytest.mark.parametrize(
    "error", [messaging.UnregisteredError("gone"), messaging.SenderIdMismatchError("other")]
)
def test_dead_token_is_reported_so_it_can_be_removed(
    sdk: list[dict], monkeypatch: pytest.MonkeyPatch, error: Exception
) -> None:
    def dead_send(message: object, dry_run: bool = False, app: object = None) -> str:
        raise error

    monkeypatch.setattr(messaging, "send", dead_send)

    with pytest.raises(fcm.InvalidTokenError):
        _send()


def test_unconfigured_fcm_does_not_send(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fcm, "_ensure_initialized", lambda settings: False)

    assert _send() is False


# -- delivery bookkeeping in NotificationService ---------------------------


def _service(clients: FakeClients) -> tuple[NotificationService, CurrentActor]:
    actor = CurrentActor(kind="user", id="user-1")
    table = clients.service_client.table("fcm_tokens")
    table.insert({"user_id": "user-1", "token": "good", "platform": "android"}).execute()
    table.insert({"user_id": "user-1", "token": "dead", "platform": "android"}).execute()
    return NotificationService(clients, _SETTINGS), actor


def _logged(clients: FakeClients) -> list[dict]:
    return clients.service_client.table("notification_logs").rows


def test_notification_is_logged_only_when_a_device_received_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients = FakeClients()
    service, actor = _service(clients)
    monkeypatch.setattr(service_module.fcm, "send_message", lambda *a, **k: False)

    service.send_notification(actor=actor, title="t", body="b", notification_type="mission")

    # Not logged, so the scheduler retries instead of de-duplicating a failed push.
    assert _logged(clients) == []


def test_dead_tokens_are_deleted_and_live_ones_still_get_the_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients = FakeClients()
    service, actor = _service(clients)

    def send(settings: object, *, token: str, **kwargs: object) -> bool:
        if token == "dead":
            raise fcm.InvalidTokenError
        return True

    monkeypatch.setattr(service_module.fcm, "send_message", send)

    service.send_notification(actor=actor, title="t", body="b", notification_type="mission")

    remaining = [r["token"] for r in clients.service_client.table("fcm_tokens").rows]
    assert remaining == ["good"]
    assert len(_logged(clients)) == 1

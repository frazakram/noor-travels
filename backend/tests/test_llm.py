import unittest
from types import SimpleNamespace
from unittest import mock

import httpx
from openai import AuthenticationError, BadRequestError, NotFoundError

from app.services import llm


def _api_error(cls, status: int):
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    return cls(f"{status}", response=httpx.Response(status, request=request), body=None)


class FakeClient:
    """Stands in for OpenAI(); each model name maps to a result or an exception."""

    def __init__(self, outcomes: dict):
        self.outcomes = outcomes
        self.calls: list[tuple[str, dict]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, model, **kwargs):
        self.calls.append((model, kwargs))
        outcome = self.outcomes[model]
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(model=model, value=outcome)


class CompleteTest(unittest.TestCase):
    def test_uses_primary_model_when_it_works(self):
        client = FakeClient({"primary": "ok", "backup": "unused"})
        response = llm.complete(client, ["primary", "backup"], messages=[])
        self.assertEqual(response.model, "primary")
        self.assertEqual([m for m, _ in client.calls], ["primary"])

    def test_decommissioned_model_falls_through_and_is_logged(self):
        client = FakeClient({"primary": _api_error(NotFoundError, 404), "backup": "ok"})
        with self.assertLogs("app.services.llm", level="WARNING") as logs:
            response = llm.complete(client, ["primary", "backup"], messages=[])
        self.assertEqual(response.model, "backup")
        self.assertTrue(any("llm_model_failed" in str(r.__dict__) for r in logs.records))
        self.assertTrue(any("fallback" in r.getMessage().lower() for r in logs.records))

    def test_rejected_request_shape_falls_through(self):
        client = FakeClient({"primary": _api_error(BadRequestError, 400), "backup": "ok"})
        with self.assertLogs("app.services.llm", level="WARNING"):
            self.assertEqual(llm.complete(client, ["primary", "backup"], messages=[]).model, "backup")

    def test_raises_the_last_error_when_every_model_fails(self):
        client = FakeClient({"a": _api_error(NotFoundError, 404), "b": _api_error(NotFoundError, 404)})
        with self.assertLogs("app.services.llm", level="WARNING"), self.assertRaises(NotFoundError):
            llm.complete(client, ["a", "b"], messages=[])

    def test_auth_errors_do_not_burn_through_the_chain(self):
        client = FakeClient({"primary": _api_error(AuthenticationError, 401), "backup": "ok"})
        with self.assertRaises(AuthenticationError):
            llm.complete(client, ["primary", "backup"], messages=[])
        self.assertEqual([m for m, _ in client.calls], ["primary"])

    def test_reasoning_effort_only_sent_to_gpt_oss(self):
        client = FakeClient({"openai/gpt-oss-20b": "ok", "qwen/qwen3.8-27b": "ok"})
        llm.complete(client, ["openai/gpt-oss-20b"], messages=[])
        llm.complete(client, ["qwen/qwen3.8-27b"], messages=[])
        self.assertEqual(client.calls[0][1].get("reasoning_effort"), "low")
        self.assertNotIn("reasoning_effort", client.calls[1][1])


class GroqModelsTest(unittest.TestCase):
    def test_primary_first_then_fallbacks_without_duplicates_or_blanks(self):
        settings = SimpleNamespace(groq_chat_model="a", groq_fallback_models=" b, a ,, c ")
        with mock.patch.object(llm, "get_settings", return_value=settings):
            self.assertEqual(llm.groq_models(), ["a", "b", "c"])


if __name__ == "__main__":
    unittest.main()

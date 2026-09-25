import time
import unittest
from unittest import mock

from app.api import auth


class PasswordHashingTest(unittest.TestCase):
    def test_round_trip(self):
        stored = auth.hash_password("correct horse battery")
        self.assertTrue(auth.verify_password("correct horse battery", stored))
        self.assertFalse(auth.verify_password("correct horse batterY", stored))

    def test_same_password_gets_a_fresh_salt(self):
        self.assertNotEqual(auth.hash_password("same"), auth.hash_password("same"))

    def test_malformed_hash_is_rejected_not_raised(self):
        for stored in ("", "plaintext", "bcrypt$1$2$3$aa$bb", "scrypt$x$8$1$zz$zz"):
            self.assertFalse(auth.verify_password("anything", stored))


class TokenTest(unittest.TestCase):
    def test_round_trip(self):
        self.assertEqual(auth.verify_token(auth.issue_token(42)), 42)

    def test_tampered_payload_is_rejected(self):
        payload, sig = auth.issue_token(42).split(".")
        forged = auth._b64(auth._unb64(payload).replace(b"42", b"43"))
        self.assertIsNone(auth.verify_token(f"{forged}.{sig}"))

    def test_token_signed_with_another_secret_is_rejected(self):
        token = auth.issue_token(7)
        with mock.patch.object(auth, "_secret", return_value=b"different-secret"):
            self.assertIsNone(auth.verify_token(token))

    def test_expired_token_is_rejected(self):
        token = auth.issue_token(7)
        with mock.patch.object(auth.time, "time", return_value=time.time() + auth.TOKEN_TTL_SECONDS + 1):
            self.assertIsNone(auth.verify_token(token))

    def test_garbage_is_rejected(self):
        for token in ("", "abc", "a.b.c", "..."):
            self.assertIsNone(auth.verify_token(token))

    def test_missing_or_bad_bearer_header_is_401(self):
        from fastapi import HTTPException

        for header in (None, "", "Token abc", "Bearer not-a-token"):
            with self.assertRaises(HTTPException) as ctx:
                auth.current_user_id(header)
            self.assertEqual(ctx.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()

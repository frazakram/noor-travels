import unittest
from types import SimpleNamespace
from unittest import mock

from starlette.requests import Request

from app import db
from app.api import quran_audio
from app.core.limiter import client_ip


class UseSqliteTest(unittest.TestCase):
    def _settings(self, postgres_url="", force_sqlite=""):
        return SimpleNamespace(postgres_url=postgres_url, force_sqlite=force_sqlite)

    def test_configured_postgres_is_never_swapped_for_sqlite(self):
        with mock.patch.dict("os.environ", {"FORCE_SQLITE": ""}), mock.patch.object(
            db, "get_settings", return_value=self._settings(postgres_url="postgresql://u:p@unreachable:5432/db")
        ):
            self.assertFalse(db.use_sqlite())

    def test_sqlite_when_forced_or_no_postgres_configured(self):
        with mock.patch.dict("os.environ", {"FORCE_SQLITE": "1"}), mock.patch.object(
            db, "get_settings", return_value=self._settings(postgres_url="postgresql://x")
        ):
            self.assertTrue(db.use_sqlite())
        with mock.patch.dict("os.environ", {"FORCE_SQLITE": ""}), mock.patch.object(
            db, "get_settings", return_value=self._settings()
        ):
            self.assertTrue(db.use_sqlite())


def _request(headers: dict[str, str], client_host="10.0.0.1") -> Request:
    return Request({
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (client_host, 1234),
    })


class ClientIpTest(unittest.TestCase):
    def test_prefers_vercel_client_headers_over_the_proxy_hop(self):
        self.assertEqual(client_ip(_request({"x-real-ip": "203.0.113.5"})), "203.0.113.5")
        self.assertEqual(client_ip(_request({"x-forwarded-for": "198.51.100.7, 10.0.0.2"})), "198.51.100.7")

    def test_falls_back_to_socket_peer_locally(self):
        self.assertEqual(client_ip(_request({}, client_host="127.0.0.1")), "127.0.0.1")


class Way2QuranTest(unittest.TestCase):
    def setUp(self):
        quran_audio._way2quran_cache.clear()

    def test_surah_urls_are_zero_padded(self):
        self.assertTrue(quran_audio._way2quran_surah_url("slug", "hafs", 2).endswith("/slug/hafs/002.mp3"))
        self.assertTrue(quran_audio._way2quran_surah_url("slug", "hafs", 114).endswith("/114.mp3"))

    def test_reciter_page_uses_the_language_prefixed_url(self):
        self.assertIn("/en/reciters/", quran_audio.WAY2QURAN_RECITER_PAGE)

    def test_failed_discovery_is_not_cached(self):
        page = (
            'surahNumber\\":2,\\"url\\":\\"https://media.way2quran.com/slug/hafs/002.mp3\\"'
        ).encode()
        ok_response = mock.MagicMock()
        ok_response.__enter__.return_value.read.return_value = page

        with mock.patch.object(quran_audio.urllib.request, "urlopen", side_effect=OSError("down")), \
                self.assertLogs("app.api.quran_audio", level="WARNING"):
            self.assertEqual(quran_audio._way2quran_available_surahs("slug", "hafs"), frozenset())

        with mock.patch.object(quran_audio.urllib.request, "urlopen", return_value=ok_response):
            self.assertEqual(quran_audio._way2quran_available_surahs("slug", "hafs"), frozenset({2}))


if __name__ == "__main__":
    unittest.main()

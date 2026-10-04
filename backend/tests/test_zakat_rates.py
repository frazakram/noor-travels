import unittest
from unittest import mock

import httpx
from fastapi.testclient import TestClient

from app.api import zakat
from app.main import app


def _response(url: str, payload: dict | None, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=payload or {}, request=httpx.Request("GET", url))


class ZakatRatesTest(unittest.TestCase):
    def setUp(self):
        zakat._cached = None
        self.client = TestClient(app)

    def _routes(self, fx_primary_ok=True, usd_inr=96.0, gold_ok=True):
        def get(url, params=None):
            if "gold-api.com/price/XAU" in url:
                return _response(url, {"price": 3110.34768, "updatedAt": "2026-10-04T21:00:00Z"}, 200 if gold_ok else 503)
            if "gold-api.com/price/XAG" in url:
                return _response(url, {"price": 31.1034768})
            if "open.er-api.com" in url:
                return _response(url, {"rates": {"INR": usd_inr}}, 200 if fx_primary_ok else 500)
            if "frankfurter.dev" in url:
                return _response(url, {"rates": {"INR": 95.0}})
            raise AssertionError(url)

        return mock.patch.object(zakat._http, "get", side_effect=get)

    def test_converts_ounces_to_rupees_per_gram_and_adds_import_duty(self):
        with self._routes():
            body = self.client.get("/api/zakat/rates").json()
        # 3110.35 USD/oz = 100 USD/g; at 96 INR/USD that's 9600 INR/g before duty.
        self.assertAlmostEqual(body["internationalGold24kPerGram"], 9600.0, places=1)
        self.assertAlmostEqual(body["gold24kPerGram"], 9600.0 * (1 + zakat.INDIA_IMPORT_DUTY), places=1)
        self.assertEqual(zakat.INDIA_IMPORT_DUTY, 0.15)  # Customs Notifications 15-18/2026
        self.assertAlmostEqual(body["internationalSilverPerGram"], 96.0, places=2)
        self.assertEqual(body["sources"], ["gold-api.com", "open.er-api.com"])

    def test_falls_back_to_the_second_exchange_rate_source(self):
        with self._routes(fx_primary_ok=False):
            body = self.client.get("/api/zakat/rates").json()
        self.assertEqual(body["usdInr"], 95.0)
        self.assertEqual(body["sources"][1], "frankfurter.dev")

    def test_absurd_exchange_rate_or_dead_price_feed_is_a_clean_503(self):
        with self._routes(usd_inr=0.96):
            self.assertEqual(self.client.get("/api/zakat/rates").status_code, 503)
        with self._routes(gold_ok=False):
            self.assertEqual(self.client.get("/api/zakat/rates").status_code, 503)

    def test_serves_from_cache_without_calling_the_sources_again(self):
        with self._routes():
            self.client.get("/api/zakat/rates")
        with mock.patch.object(zakat._http, "get", side_effect=AssertionError("refetched")):
            self.assertEqual(self.client.get("/api/zakat/rates").status_code, 200)


    def test_refresh_rechecks_after_a_minute_but_not_sooner(self):
        with self._routes():
            first = self.client.get("/api/zakat/rates").json()
        # Within a minute: same answer, sources untouched, and never cached downstream.
        with mock.patch.object(zakat._http, "get", side_effect=AssertionError("refetched too soon")):
            r = self.client.get("/api/zakat/rates?refresh=true")
        self.assertEqual(r.json()["checkedAt"], first["checkedAt"])
        self.assertEqual(r.headers["cache-control"], "no-store")
        # Older than a minute: refresh goes back to the sources.
        zakat._cached = (zakat._cached[0] - 61, zakat._cached[1])
        with self._routes(usd_inr=100.0):
            self.assertEqual(self.client.get("/api/zakat/rates?refresh=true").json()["usdInr"], 100.0)


if __name__ == "__main__":
    unittest.main()

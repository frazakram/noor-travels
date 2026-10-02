import io
import json
import unittest
from types import SimpleNamespace
from unittest import mock

from app.services import embedding_service


def _settings(**overrides):
    base = dict(embed_url="http://embed.test/api/embed", embed_secret="", semantic_model="all-MiniLM-L6-v2")
    return SimpleNamespace(**{**base, **overrides})


class _Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class XenovaEmbeddingTest(unittest.TestCase):
    def _call(self, served_model, kind="query"):
        sent = {}

        def fake_urlopen(request, timeout):
            sent["body"] = json.loads(request.data)
            return _Response(json.dumps({"embeddings": [[0.1, 0.2]], "dims": 2, "model": served_model}).encode())

        with mock.patch.object(embedding_service, "get_settings", return_value=_settings()), mock.patch.object(
            embedding_service.urllib.request, "urlopen", side_effect=fake_urlopen
        ):
            return embedding_service._embed_via_xenova(["patience"], kind), sent

    def test_kind_is_sent_and_vectors_returned(self):
        vectors, sent = self._call("all-MiniLM-L6-v2", kind="passage")
        self.assertEqual(vectors, [[0.1, 0.2]])
        self.assertEqual(sent["body"], {"texts": ["patience"], "kind": "passage"})

    def test_a_different_model_is_refused(self):
        # Frontend and backend deploy separately; vectors from two models must never be compared.
        with self.assertRaises(embedding_service.EmbeddingModelMismatch):
            self._call("multilingual-e5-small")
        with self.assertRaises(embedding_service.EmbeddingModelMismatch):
            self._call(None)


if __name__ == "__main__":
    unittest.main()

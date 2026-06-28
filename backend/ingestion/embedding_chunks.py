"""Shared helpers for ingestion embedding scripts."""
import json


def insert_chunk(cur, source_type, source_ref, content, metadata, embedding, is_sqlite):
    if is_sqlite:
        cur.execute(
            """
            INSERT INTO document_chunks (source_type, source_ref, content, metadata, embedding)
            VALUES (?, ?, ?, ?, ?)
            """,
            (source_type, source_ref, content, json.dumps(metadata), json.dumps(embedding)),
        )
    else:
        emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
        cur.execute(
            """
            INSERT INTO document_chunks (source_type, source_ref, content, metadata, embedding)
            VALUES (%s, %s, %s, %s, %s::vector)
            """,
            (source_type, source_ref, content, json.dumps(metadata), emb_str),
        )

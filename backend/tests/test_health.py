"""Tests for the health and readiness endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from httpx import AsyncClient


async def test_health_ok(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_health_firestore_ok(client: AsyncClient) -> None:
    # Patch the Firestore client so the readiness check never touches GCP.
    with patch("google.cloud.firestore.Client") as mock_client_cls:
        doc_ref = MagicMock()
        doc_ref.get.return_value = MagicMock()
        mock_client_cls.return_value.collection.return_value.document.return_value = (
            doc_ref
        )

        response = await client.get("/api/v1/health/firestore")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

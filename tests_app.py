"""
Basic automated test suite for the News Aggregator application.
Validates Flask routes, API endpoints, preprocessing, and error handling.
"""

import json
from app import app


def test_index_route():
    client = app.test_client()
    res = client.get("/")
    assert res.status_code == 200
    assert b"NewsPulse" in res.data
    print("[PASS] Index route loads successfully")


def test_api_categories():
    client = app.test_client()
    res = client.get("/api/categories")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "success"
    assert "technology" in data["categories"]
    assert "business" in data["categories"]
    print("[PASS] Categories API returns correct categories")


def test_api_countries():
    client = app.test_client()
    res = client.get("/api/countries")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "success"
    assert "us" in data["countries"]
    assert "in" in data["countries"]
    print("[PASS] Countries API returns configured regions")


def test_api_status():
    client = app.test_client()
    res = client.get("/api/status")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "online"
    print("[PASS] Health status API online")


def test_api_news_headlines():
    client = app.test_client()
    res = client.get("/api/news?category=technology&limit=6")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "success"
    assert len(data["articles"]) > 0
    article = data["articles"][0]
    assert "title" in article
    assert "description" in article
    assert "source" in article
    assert "url" in article
    assert "sentiment" in article
    print(f"[PASS] News API returns {len(data['articles'])} articles with required attributes")


def test_api_news_search():
    client = app.test_client()
    res = client.get("/api/news?q=science&limit=5")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "success"
    assert len(data["articles"]) > 0
    print(f"[PASS] Search API successfully returned {len(data['articles'])} results")


def test_404_handling():
    client = app.test_client()
    res = client.get("/api/unknown-endpoint")
    assert res.status_code == 404
    data = json.loads(res.data)
def test_api_key_pool():
    client = app.test_client()
    # Test GET
    res = client.get("/api/keys")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert "pool" in data
    assert data["pool"]["total_keys"] >= 4
    
    # Test POST update
    sample_keys = [
        "key111111111111111111111111111111",
        "key222222222222222222222222222222",
        "key333333333333333333333333333333",
        "key444444444444444444444444444444"
    ]
    post_res = client.post("/api/keys", json={"keys": sample_keys})
    assert post_res.status_code == 200
    post_data = json.loads(post_res.data)
    assert post_data["pool"]["total_keys"] == 4
    print("[PASS] Multi-Key Pool API (GET/POST) tested successfully")


if __name__ == "__main__":
    print("\n--- Running News Aggregator Test Suite ---")
    test_index_route()
    test_api_categories()
    test_api_countries()
    test_api_status()
    test_api_key_pool()
    test_api_news_headlines()
    test_api_news_search()
    test_404_handling()
    print("\n*** ALL 8 TESTS PASSED SUCCESSFULLY! ***\n")

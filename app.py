"""
News Aggregator Application
---------------------------
Entry point for the Flask web application.
Exposes REST API endpoints and serves the modern frontend dashboard.
"""

import os
from flask import Flask, render_template, request, jsonify
from config import Config
from services.news_service import get_news

app = Flask(__name__)
app.config.from_object(Config)


@app.route("/")
def index():
    """Renders the main news dashboard."""
    return render_template(
        "index.html",
        categories=Config.CATEGORIES,
        countries=Config.COUNTRIES,
        default_category=Config.DEFAULT_CATEGORY,
        default_country=Config.DEFAULT_COUNTRY,
        has_api_key=bool(Config.NEWS_API_KEY)
    )


@app.route("/api/news", methods=["GET"])
def api_get_news():
    """
    API Endpoint to retrieve preprocessed and filtered news articles.
    Query Parameters:
      - category: News category (general, technology, business, sports, etc.)
      - q: Search keyword
      - country: Country code (us, in, gb, ca, au)
      - source: Filter by specific publisher
      - sort_by: Sorting criterion (newest, oldest, title)
      - limit: Maximum number of articles to return (default 24)
      - api_key: Optional NewsAPI.org key passed dynamically from frontend
    """
    category = request.args.get("category", Config.DEFAULT_CATEGORY).lower()
    query = request.args.get("q", "").strip()
    country = request.args.get("country", Config.DEFAULT_COUNTRY).lower()
    source = request.args.get("source", "").strip()
    sort_by = request.args.get("sort_by", "newest").lower()
    api_key = request.args.get("api_key", "").strip() or Config.NEWS_API_KEY

    try:
        limit = int(request.args.get("limit", Config.DEFAULT_PAGE_SIZE))
    except ValueError:
        limit = Config.DEFAULT_PAGE_SIZE

    # Fetch news through our service pipeline
    result = get_news(
        api_key=api_key,
        category=category,
        query=query,
        country=country,
        source=source,
        sort_by=sort_by,
        limit=limit
    )

    return jsonify(result)


@app.route("/api/categories", methods=["GET"])
def api_get_categories():
    """Returns available news categories."""
    return jsonify({
        "status": "success",
        "categories": Config.CATEGORIES
    })


@app.route("/api/countries", methods=["GET"])
def api_get_countries():
    """Returns supported countries."""
    return jsonify({
        "status": "success",
        "countries": Config.COUNTRIES
    })


@app.route("/api/keys", methods=["GET", "POST"])
def api_manage_keys():
    """
    GET: Returns list of configured keys (masked) and active pool status.
    POST: Updates the 4 API keys in the environment and .env file.
    """
    from services.news_service import key_pool
    if request.method == "POST":
        data = request.get_json() or {}
        keys = data.get("keys", [])
        clean_keys = [k.strip() for k in keys if k and k.strip()]
        
        for idx in range(4):
            val = clean_keys[idx] if idx < len(clean_keys) else ""
            os.environ[f"NEWS_API_KEY_{idx+1}"] = val
        
        # Persist to .env
        try:
            with open(".env", "w") as f:
                f.write("# Multi-Key Pool for NewsAPI.org (Round-Robin & Quota Failover)\n")
                for idx in range(4):
                    val = clean_keys[idx] if idx < len(clean_keys) else ""
                    f.write(f"NEWS_API_KEY_{idx+1}={val}\n")
                f.write("PORT=5000\nFLASK_ENV=development\n")
        except Exception:
            pass

        return jsonify({
            "status": "success",
            "message": f"Successfully updated {len(clean_keys)} keys in rotation pool",
            "pool": key_pool.get_pool_status()
        })

    return jsonify({
        "status": "success",
        "pool": key_pool.get_pool_status()
    })


@app.route("/api/status", methods=["GET"])
def api_get_status():
    """Returns application health and configuration status."""
    from services.news_service import key_pool
    keys = Config.get_api_keys()
    return jsonify({
        "status": "online",
        "total_keys_configured": len(keys),
        "key_pool": key_pool.get_pool_status(),
        "default_country": Config.DEFAULT_COUNTRY,
        "default_category": Config.DEFAULT_CATEGORY
    })


@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"status": "error", "message": "API endpoint not found"}), 404
    return render_template("index.html", categories=Config.CATEGORIES, countries=Config.COUNTRIES), 404


@app.errorhandler(500)
def internal_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"status": "error", "message": "Internal server error occurred"}), 500
    return "Internal Server Error", 500


def find_available_port(start_port=5000, max_attempts=15):
    """Finds the first open TCP port starting from start_port."""
    import socket
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return start_port


if __name__ == "__main__":
    preferred_port = int(os.getenv("PORT", 5000))
    port = find_available_port(preferred_port)
    print(f"\n========================================================")
    print(f"  News Aggregator Web App is running!")
    print(f"  Open in browser: http://127.0.0.1:{port}")
    print(f"========================================================\n")
    app.run(host="0.0.0.0", port=port, debug=False)

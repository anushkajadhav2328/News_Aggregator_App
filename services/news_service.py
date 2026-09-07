"""
News Service Module
-------------------
Handles data collection from external News APIs (NewsAPI.org & Free RSS Fallback),
data preprocessing, missing value handling, deduplication, and sentiment analysis.
"""

import re
import html
import logging
from datetime import datetime, timezone
import email.utils
import xml.etree.ElementTree as ET
import requests
from config import Config

logger = logging.getLogger(__name__)

# Simple sentiment analysis word lists (Beginner-friendly rule-based sentiment classifier)
POSITIVE_WORDS = {
    "surge", "surges", "gain", "gains", "growth", "grew", "boost", "boosts", "record",
    "profit", "profits", "breakthrough", "success", "successful", "win", "wins", "won",
    "positive", "hero", "cure", "recovers", "recovery", "soars", "advance", "advances",
    "thrive", "opportunity", "hope", "optimistic", "praise", "praises", "milestone",
    "celebrate", "triumph", "innovative", "leader", "safe", "peace", "award", "promising"
}

NEGATIVE_WORDS = {
    "crash", "crashes", "drop", "drops", "fall", "falls", "loss", "losses", "crisis",
    "fail", "fails", "failed", "failure", "death", "deaths", "dead", "kill", "killed",
    "murder", "war", "conflict", "attack", "attacks", "threat", "danger", "warning",
    "disaster", "scam", "fraud", "arrest", "arrested", "decline", "declines", "injury",
    "ban", "bans", "banned", "lawsuit", "sues", "sued", "strike", "plunge", "plunges",
    "controversy", "recession", "inflation", "protest", "fatal", "damage", "corrupt"
}


def analyze_sentiment(text: str) -> dict:
    """
    Lightweight rule-based Sentiment Analysis for news headlines/descriptions.
    Computes a polarity score and classifies into Positive, Neutral, or Negative.
    Fulfills the AI/ML Project requirement in the BCS-III syllabus.
    """
    if not text:
        return {"label": "Neutral", "score": 0.0, "badge_class": "badge-neutral"}

    clean_text = re.sub(r"[^\w\s]", " ", text.lower())
    words = clean_text.split()

    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    total_matches = pos_count + neg_count

    if total_matches == 0:
        return {"label": "Neutral", "score": 0.0, "badge_class": "badge-neutral"}

    score = round((pos_count - neg_count) / max(total_matches, 1), 2)

    if score > 0.15:
        return {"label": "Positive", "score": score, "badge_class": "badge-positive"}
    elif score < -0.15:
        return {"label": "Negative", "score": score, "badge_class": "badge-negative"}
    else:
        return {"label": "Neutral", "score": score, "badge_class": "badge-neutral"}


def format_relative_time(dt: datetime) -> str:
    """Formats a datetime object into human-friendly relative time (e.g. '2 hours ago')."""
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt

    seconds = max(0, int(diff.total_seconds()))
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "Yesterday"
    if days < 7:
        return f"{days}d ago"
    return dt.strftime("%b %d, %Y")


def parse_date(date_str: str):
    """Parses multiple date formats (ISO 8601 or RFC 2822) safely."""
    if not date_str:
        now = datetime.now(timezone.utc)
        return now.isoformat(), now.strftime("%b %d, %Y, %I:%M %p"), "Recent"

    dt = None
    # Try ISO 8601 (from NewsAPI)
    try:
        clean_iso = date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_iso)
    except Exception:
        pass

    # Try RFC 2822 (from RSS feeds)
    if not dt:
        try:
            dt = email.utils.parsedate_to_datetime(date_str)
        except Exception:
            pass

    if not dt:
        now = datetime.now(timezone.utc)
        return date_str, date_str, "Recent"

    iso_str = dt.isoformat()
    formatted_str = dt.strftime("%b %d, %Y, %I:%M %p")
    time_ago = format_relative_time(dt)
    return iso_str, formatted_str, time_ago


def clean_html(raw_html: str) -> str:
    """Removes HTML tags and unescapes HTML entities from text."""
    if not raw_html:
        return ""
    clean = re.sub(r"<[^>]+>", " ", raw_html)
    clean = html.unescape(clean)
    return re.sub(r"\s+", " ", clean).strip()


def preprocess_article(raw: dict, category: str = "general") -> dict:
    """
    Step 2 in Synopsis: Data Preprocessing
    Cleans raw JSON data, extracts attributes, handles missing values,
    and enriches with sentiment and display-ready formatting.
    """
    # 1. Title handling
    title = raw.get("title", "").strip() or "Untitled News Article"
    # Often RSS and NewsAPI append ' - SourceName' at the end of title
    source_name = "News"
    if isinstance(raw.get("source"), dict):
        source_name = raw.get("source", {}).get("name") or "News"
    elif isinstance(raw.get("source"), str) and raw.get("source"):
        source_name = raw.get("source")

    # If title has ' - SourceName', clean it for cleaner display and better deduplication
    if " - " in title:
        parts = title.rsplit(" - ", 1)
        if len(parts[1]) < 40:
            if not source_name or source_name == "News":
                source_name = parts[1].strip()
            title = parts[0].strip()

    # 2. Description handling
    description = clean_html(raw.get("description", "") or "")
    if not description or description == title:
        content = clean_html(raw.get("content", "") or "")
        if content:
            # Strip NewsAPI's '[+1234 chars]' truncation note
            content = re.sub(r"\[\+\d+\s*chars\]", "", content).strip()
            description = content
        else:
            description = f"Click to read the full breaking coverage on {source_name}."

    if len(description) > 220:
        description = description[:217].rsplit(" ", 1)[0] + "..."

    # 3. Image URL handling with fallback
    image_url = raw.get("urlToImage") or raw.get("image") or ""
    if not image_url or not image_url.startswith("http"):
        # Use high quality category banner as fallback
        image_url = Config.CATEGORY_IMAGES.get(category, Config.CATEGORY_IMAGES["general"])

    # 4. URL
    url = raw.get("url") or raw.get("link") or "#"

    # 5. Date parsing & relative timestamp
    raw_date = raw.get("publishedAt") or raw.get("pubDate") or ""
    iso_date, formatted_date, time_ago = parse_date(raw_date)

    # 6. Sentiment analysis (AI/ML project feature)
    sentiment = analyze_sentiment(f"{title} {description}")

    return {
        "title": title,
        "description": description,
        "source": source_name,
        "url": url,
        "image_url": image_url,
        "published_at_raw": iso_date,
        "published_at": formatted_date,
        "time_ago": time_ago,
        "category": category.capitalize(),
        "sentiment": sentiment
    }


def remove_duplicates(articles: list) -> list:
    """
    Step 4 in Synopsis: Removing duplicate articles.
    Compares normalized titles and URLs to ensure uniqueness.
    """
    unique_articles = []
    seen_titles = set()
    seen_urls = set()

    for item in articles:
        url = item.get("url", "").strip().lower()
        title = item.get("title", "").strip().lower()
        
        # Normalize title: remove symbols, extra spaces
        normalized_title = re.sub(r"[^\w\s]", "", title)
        title_slug = " ".join(normalized_title.split()[:8])  # First 8 words

        if url and url != "#" and url in seen_urls:
            continue
        if title_slug and title_slug in seen_titles:
            continue

        if url and url != "#":
            seen_urls.add(url)
        if title_slug:
            seen_titles.add(title_slug)

        unique_articles.append(item)

    return unique_articles


class KeyPool:
    """
    Manages a pool of 3 to 4 NewsAPI keys.
    Provides round-robin rotation and automatic failover when a key hits rate limits (HTTP 429/401).
    """
    def __init__(self):
        self.index = 0
        self.failed_keys = set()

    def get_keys(self, custom_keys=None):
        if custom_keys:
            if isinstance(custom_keys, list):
                return [k.strip() for k in custom_keys if k and k.strip()]
            return [k.strip() for k in custom_keys.split(",") if k.strip()]
        return Config.get_api_keys()

    def get_masked(self, key: str) -> str:
        if not key or len(key) < 8:
            return "********"
        return f"{key[:4]}...{key[-4:]}"

    def get_pool_status(self, custom_keys=None):
        keys = self.get_keys(custom_keys)
        return {
            "total_keys": len(keys),
            "current_slot": (self.index % len(keys) + 1) if keys else 0,
            "masked_keys": [self.get_masked(k) for k in keys]
        }

    def rotate(self, total: int):
        if total > 0:
            self.index = (self.index + 1) % total


# Global key pool instance
key_pool = KeyPool()


def fetch_from_newsapi(api_key: str, category: str = "general", query: str = "", country: str = "us", page_size: int = 24) -> tuple:
    """
    Fetches articles from NewsAPI.org using the given key.
    Returns (articles, status_code, error_message).
    """
    headers = {"X-Api-Key": api_key, "User-Agent": "NewsAggregatorApp/1.0"}
    params = {"pageSize": page_size}

    if query.strip():
        url = Config.NEWS_API_EVERYTHING_URL
        params["q"] = query.strip()
        params["sortBy"] = "publishedAt"
    else:
        url = Config.NEWS_API_TOP_HEADLINES_URL
        if category and category != "all":
            params["category"] = category
        if country:
            params["country"] = country

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=7)
        if resp.status_code == 200:
            data = resp.json()
            raw_articles = data.get("articles", [])
            processed = [preprocess_article(a, category=category) for a in raw_articles if a.get("title")]
            return processed, 200, ""
        return [], resp.status_code, resp.text
    except Exception as e:
        logger.warning("NewsAPI request exception: %s", e)
        return [], 500, str(e)


def fetch_from_rss_feed(category: str = "general", query: str = "", country: str = "us", page_size: int = 30) -> list:
    """
    Free fallback news aggregator using Google News RSS.
    Requires no API keys, has no rate limits, and provides real-time global news.
    """
    country_code = country.upper()
    hl = f"en-{country_code}"
    gl = country_code
    ceid = f"{country_code}:en"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    if query.strip():
        rss_url = f"https://news.google.com/rss/search?q={requests.utils.quote(query.strip())}&hl={hl}&gl={gl}&ceid={ceid}"
    elif category.lower() in ["business", "technology", "sports", "entertainment", "science", "health"]:
        topic = category.upper()
        rss_url = f"https://news.google.com/rss/headlines/section/topic/{topic}?hl={hl}&gl={gl}&ceid={ceid}"
    else:
        rss_url = f"https://news.google.com/rss?hl={hl}&gl={gl}&ceid={ceid}"

    resp = requests.get(rss_url, headers=headers, timeout=8)
    if resp.status_code != 200:
        logger.error("RSS fetch error status: %s", resp.status_code)
        return []

    root = ET.fromstring(resp.content)
    items = root.findall("./channel/item")

    articles = []
    for item in items[:page_size]:
        title_el = item.find("title")
        link_el = item.find("link")
        desc_el = item.find("description")
        pub_el = item.find("pubDate")
        source_el = item.find("source")

        title = title_el.text if title_el is not None else ""
        link = link_el.text if link_el is not None else "#"
        desc = desc_el.text if desc_el is not None else ""
        pub_date = pub_el.text if pub_el is not None else ""
        source_name = source_el.text if source_el is not None else "News"

        raw_item = {
            "title": title,
            "url": link,
            "description": desc,
            "pubDate": pub_date,
            "source": source_name
        }
        articles.append(preprocess_article(raw_item, category=category))

    return articles


def get_news(
    api_key: str = None,
    category: str = "general",
    query: str = "",
    country: str = "us",
    source: str = "",
    sort_by: str = "newest",
    limit: int = 24
) -> dict:
    """
    Main aggregator function implementing the complete pipeline:
    1. Fetch news from NewsAPI across multi-key pool with automatic failover.
    2. Fallback to Free Live RSS if all keys fail/exhausted or unconfigured.
    3. Preprocessing, Deduplication, Filtering, and Sorting.
    """
    keys_pool = key_pool.get_keys(api_key)
    provider = "Free Live Feed"
    articles = []
    active_slot = 0
    key_used_masked = ""

    # Attempt to fetch using the Key Pool (Round-Robin & Failover across 3-4 keys)
    if keys_pool:
        total_k = len(keys_pool)
        start_idx = key_pool.index % total_k

        for offset in range(total_k):
            idx = (start_idx + offset) % total_k
            current_key = keys_pool[idx]
            slot_num = idx + 1

            fetched, status_code, err = fetch_from_newsapi(
                api_key=current_key,
                category=category,
                query=query,
                country=country,
                page_size=limit
            )

            if status_code == 200 and fetched:
                articles = fetched
                active_slot = slot_num
                key_used_masked = key_pool.get_masked(current_key)
                provider = f"NewsAPI.org (Key Slot #{slot_num} of {total_k})"
                key_pool.rotate(total_k)
                break
            else:
                logger.warning(
                    "NewsAPI Key Slot %s (%s) failed with status %s. Failing over to next key...",
                    slot_num, key_pool.get_masked(current_key), status_code
                )

    # Fallback to free live feeds if NewsAPI returned nothing or all keys failed/quota-limited
    if not articles:
        try:
            articles = fetch_from_rss_feed(
                category=category,
                query=query,
                country=country,
                page_size=limit + 10
            )
            if keys_pool:
                provider = f"Live Feed (All {len(keys_pool)} NewsAPI Keys Exhausted/Fallback)"
            else:
                provider = "Free Live Feed (Google News RSS)"
        except Exception as e:
            logger.error("RSS feed error: %s", e)
            articles = []

    # Step 4 in Synopsis: Logic Implementation
    # Deduplication
    articles = remove_duplicates(articles)

    # Source filtering if specified
    if source and source.lower() != "all":
        articles = [a for a in articles if source.lower() in a["source"].lower()]

    # Sorting
    if sort_by == "oldest":
        articles.sort(key=lambda x: x.get("published_at_raw", ""), reverse=False)
    elif sort_by == "title":
        articles.sort(key=lambda x: x.get("title", "").lower())
    else:  # 'newest' by default
        articles.sort(key=lambda x: x.get("published_at_raw", ""), reverse=True)

    # Extract available sources for frontend filter dropdown
    available_sources = sorted(list({a["source"] for a in articles if a.get("source")}))

    return {
        "status": "success",
        "provider": provider,
        "count": len(articles),
        "category": category,
        "query": query,
        "country": country,
        "key_pool": {
            "total_keys": len(keys_pool),
            "active_slot": active_slot,
            "active_key_masked": key_used_masked,
            "all_masked": [key_pool.get_masked(k) for k in keys_pool]
        },
        "sources": available_sources,
        "articles": articles[:limit]
    }

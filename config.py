import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration settings."""
    SECRET_KEY = os.getenv("SECRET_KEY", "news-aggregator-secret-key-2026")
    
    @classmethod
    def get_api_keys(cls):
        """Loads and returns all configured NewsAPI keys from environment."""
        load_dotenv(override=True)
        raw_keys = [
            os.getenv("NEWS_API_KEY_1", ""),
            os.getenv("NEWS_API_KEY_2", ""),
            os.getenv("NEWS_API_KEY_3", ""),
            os.getenv("NEWS_API_KEY_4", ""),
            os.getenv("NEWS_API_KEY", "")
        ]
        combined = os.getenv("NEWS_API_KEYS", "")
        if combined:
            raw_keys.extend([k.strip() for k in combined.split(",") if k.strip()])
        return [k.strip() for k in raw_keys if k and k.strip()]

    NEWS_API_KEYS = []
    NEWS_API_KEY = ""
    
    # News API Endpoints
    NEWS_API_TOP_HEADLINES_URL = "https://newsapi.org/v2/top-headlines"
    NEWS_API_EVERYTHING_URL = "https://newsapi.org/v2/everything"
    
    # Supported categories matching the synopsis requirements
    CATEGORIES = [
        "general",
        "business",
        "technology",
        "sports",
        "entertainment",
        "health",
        "science"
    ]
    
    # Default parameters
    DEFAULT_CATEGORY = "general"
    DEFAULT_COUNTRY = "us"
    DEFAULT_PAGE_SIZE = 24
    
    # Supported countries with display names
    COUNTRIES = {
        "us": "United States",
        "in": "India",
        "gb": "United Kingdom",
        "ca": "Canada",
        "au": "Australia"
    }

    # Curated high-resolution fallback banners for each category
    CATEGORY_IMAGES = {
        "general": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80",
        "business": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
        "technology": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
        "sports": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80",
        "entertainment": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
        "health": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&auto=format&fit=crop&q=80",
        "science": "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80"
    }

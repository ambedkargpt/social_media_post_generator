from typing import List, Dict

from newsapi import NewsApiClient


def fetch_latest_news(api_key: str, country: str = "in", page_size: int = 5) -> List[Dict]:
    """
    Fetch top headlines for India using NewsAPI.

    Returns a list of simplified article dicts:
    [
      {
        "title": "...",
        "description": "...",
        "content": "...",
        "source": "..."
      }
    ]
    """
    client = NewsApiClient(api_key=api_key)
    response = client.get_top_headlines(country=country, page_size=page_size)

    articles = response.get("articles", []) or []
    normalized = []
    for article in articles:
        if not article:
            continue
        normalized.append(
            {
                "title": article.get("title") or "",
                "description": article.get("description") or "",
                "content": article.get("content") or "",
                "source": (article.get("source") or {}).get("name") or "",
            }
        )
    return normalized


from typing import Dict

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse


def scrape_article(url: str, timeout: int = 15) -> Dict:
    """
    Fetch and lightly clean a news web page into a unified article dict.

    This is intentionally simple and generic:
    - Downloads HTML with requests
    - Parses with BeautifulSoup
    - Uses <title> as the headline
    - Concatenates all <p> text as the article body

    Returns:
    {
      "title": "...",
      "description": "",
      "content": "...",
      "source": "domain.com",
      "url": "..."
    }
    """
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Title
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else url

    # Naive body extraction: all <p> tags
    paragraphs = [p.get_text(separator=" ", strip=True) for p in soup.find_all("p")]
    content = "\n".join([p for p in paragraphs if p])

    # Source domain
    parsed = urlparse(url)
    source = parsed.netloc

    return {
        "title": title,
        "description": "",
        "content": content,
        "source": source,
        "url": url,
    }


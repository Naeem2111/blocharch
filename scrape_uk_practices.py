"""
Scrape UK interior designers and development companies from public directories
other than architectdirectory.co.uk.

Sources
- Interior designers: British Institute of Interior Design collective
  https://biid.org.uk/find-interior-designer
- Development companies: HomeViews company directory
  https://www.homeviews.com/developer-directory

Writes data/uk-interior-designers.json and data/uk-development-companies.json
in the same shape as architects.json, with practice_type set.
"""
import argparse
import json
import re
import time
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
INTERIOR_PATH = DATA / "uk-interior-designers.json"
DEVELOPMENT_PATH = DATA / "uk-development-companies.json"

USER_AGENT = "BlocharchDirectoryBot/1.0 (public directory import for Blocharch leads)"
BIID_LIST = "https://biid.org.uk/find-interior-designer"
HOMEVIEWS_LIST = "https://www.homeviews.com/developer-directory"

SOCIAL_HOSTS = {
    "twitter.com",
    "x.com",
    "instagram.com",
    "facebook.com",
    "fb.com",
    "linkedin.com",
    "youtube.com",
    "pinterest.com",
    "tiktok.com",
}
SKIP_WEBSITE_HOSTS = SOCIAL_HOSTS | {
    "biid.org.uk",
    "homeviews.com",
    "rightmove.co.uk",
    "zoopla.co.uk",
}

EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.I)
DEV_RE = re.compile(
    r"\b(developer|developers|development|housebuilder|house builder|new homes|builds homes|building homes)\b",
    re.I,
)
AGENT_RE = re.compile(
    r"\b(estate agent|lettings agent|letting agent|property consultancy|chartered surveyor)\b",
    re.I,
)


def host_of(url: str) -> str:
    host = (urlparse(url).netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def is_skipped_website(url: str) -> bool:
    host = host_of(url)
    if not host:
        return True
    return any(host == blocked or host.endswith("." + blocked) for blocked in SKIP_WEBSITE_HOSTS)


class DirectoryScraper:
    def __init__(self, delay: float):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT

    def get(self, url: str, params: Optional[dict] = None) -> BeautifulSoup:
        response = self.session.get(url, params=params, timeout=45)
        response.raise_for_status()
        time.sleep(self.delay)
        return BeautifulSoup(response.text, "html.parser")

    def biid_listing_pages(self, limit: Optional[int]) -> List[dict]:
        found: Dict[str, dict] = {}
        page = 0
        empty_run = 0
        while empty_run < 2 and page < 200:
            soup = self.get(BIID_LIST, {"page": page} if page else None)
            cards = soup.select("article.tile--collective-items")
            print(f"BIID listing page {page}: {len(cards)} profiles")
            if not cards:
                empty_run += 1
                page += 1
                continue
            empty_run = 0
            for card in cards:
                link = card.select_one("h2 a[href]")
                if not link:
                    continue
                profile_url = urljoin("https://biid.org.uk", link["href"]).split("?")[0]
                practice = ""
                practice_node = card.select_one("p.collective--roles-a-z-bottom")
                if practice_node:
                    practice = " ".join(practice_node.get_text(" ", strip=True).split())
                person = " ".join(link.get_text(" ", strip=True).split())
                found[profile_url] = {
                    "url": profile_url,
                    "name": practice or person,
                    "contact": person if practice and person != practice else "",
                }
                if limit and len(found) >= limit:
                    return list(found.values())
            page += 1
        return list(found.values())

    def biid_profile(self, stub: dict) -> dict:
        soup = self.get(stub["url"])
        record = {
            "url": stub["url"],
            "name": stub["name"],
            "practice_type": "interior_design",
            "website": "",
            "socials": [],
            "email": "",
            "address": "",
            "contact": stub.get("contact") or "",
            "description": "",
            "years_active": "",
            "staff": "",
            "awards": [],
        }
        socials = []
        for link in soup.find_all("a", href=True):
            href = link["href"].strip()
            if href.startswith("mailto:"):
                email = href.split(":", 1)[1].split("?")[0].strip()
                if email and "biid.org.uk" not in email.lower() and not record["email"]:
                    record["email"] = email
                continue
            if not href.startswith("http"):
                continue
            host = host_of(href)
            if host in SOCIAL_HOSTS or any(host.endswith("." + item) for item in SOCIAL_HOSTS):
                lowered = href.lower()
                if any(
                    marker in lowered
                    for marker in (
                        "britishinstituteofinteriordesign",
                        "biidtalk",
                        "british-institute-of-interior-design",
                        "thebiid",
                    )
                ):
                    continue
                if href not in socials:
                    socials.append(href)
                continue
            if not record["website"] and not is_skipped_website(href):
                record["website"] = href

        if not record["email"]:
            for match in EMAIL_RE.findall(soup.get_text(" ", strip=True)):
                if "biid.org.uk" not in match.lower():
                    record["email"] = match
                    break

        paragraphs = []
        for node in soup.find_all("p"):
            text = " ".join(node.get_text(" ", strip=True).split())
            if len(text) < 80:
                continue
            lower = text.lower()
            if "liverpool street" in lower or "registered office" in lower or "vat reg" in lower:
                continue
            if any(text in previous or previous in text for previous in paragraphs):
                continue
            paragraphs.append(text)
        record["description"] = " ".join(paragraphs)[:1500]
        record["socials"] = socials
        return record

    def homeviews_companies(self, limit: Optional[int]) -> List[str]:
        soup = self.get(HOMEVIEWS_LIST)
        urls = []
        seen = set()
        for link in soup.find_all("a", href=True):
            href = link["href"].split("?")[0].rstrip("/")
            if not href.startswith("/company/"):
                continue
            if href.count("/") != 2:
                continue
            full = urljoin("https://www.homeviews.com", href)
            if full in seen:
                continue
            seen.add(full)
            urls.append(full)
            if limit and len(urls) >= limit:
                break
        print(f"HomeViews directory: {len(urls)} company pages")
        return urls

    def homeviews_company(self, url: str) -> Optional[dict]:
        soup = self.get(url)
        title = ""
        heading = soup.find("h1")
        if heading:
            title = " ".join(heading.get_text(" ", strip=True).split())
        if not title and soup.title:
            title = soup.title.get_text(" ", strip=True).replace("HomeViews |", "").replace("Reviews", "").strip()
        paragraphs = []
        for node in soup.find_all("p"):
            text = " ".join(node.get_text(" ", strip=True).split())
            if len(text) < 80:
                continue
            lower = text.lower()
            if "claim your profile" in lower or "write a review" in lower:
                continue
            if lower.startswith("this all-time rating"):
                continue
            paragraphs.append(text)
        description = re.sub(
            r"\s*This all-time rating combines.*$",
            "",
            " ".join(paragraphs[:2]),
            flags=re.I,
        ).strip()[:1500]
        about = f"{title} {description}"
        name_is_developer = bool(re.search(r"homes|develop|estates|living", title or "", re.I))
        about_is_developer = bool(DEV_RE.search(about) or re.search(r"\b(homes|housebuilder|build)\b", about, re.I))
        if AGENT_RE.search(about) and not about_is_developer:
            print(f"  skip agent: {title}")
            return None
        if not about_is_developer and not name_is_developer:
            print(f"  skip non-developer: {title}")
            return None

        website = ""
        for link in soup.find_all("a", href=True):
            href = link["href"].strip()
            label = link.get_text(" ", strip=True).lower()
            if "website" not in label or not href.startswith("http"):
                continue
            if is_skipped_website(href):
                continue
            website = href
            break
        return {
            "url": url,
            "name": title,
            "practice_type": "development",
            "website": website,
            "socials": [],
            "email": "",
            "address": "",
            "contact": "",
            "description": description,
            "years_active": "",
            "staff": "",
            "awards": [],
        }


def load_existing(path: Path) -> Dict[str, dict]:
    if not path.exists():
        return {}
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(rows, list):
        return {}
    return {row["url"]: row for row in rows if isinstance(row, dict) and row.get("url")}


def save_rows(path: Path, rows: Dict[str, dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = [rows[key] for key in sorted(rows)]
    path.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def scrape_interior(scraper: DirectoryScraper, limit: Optional[int]) -> None:
    existing = load_existing(INTERIOR_PATH)
    stubs = scraper.biid_listing_pages(limit)
    print(f"BIID profiles to read: {len(stubs)} ({len(existing)} already saved)")
    for index, stub in enumerate(stubs, start=1):
        if stub["url"] in existing and existing[stub["url"]].get("name"):
            continue
        try:
            record = scraper.biid_profile(stub)
        except Exception as error:
            print(f"  failed {stub['url']}: {error}")
            continue
        existing[record["url"]] = record
        if index % 25 == 0:
            save_rows(INTERIOR_PATH, existing)
            print(f"  saved {len(existing)} interior designers")
    save_rows(INTERIOR_PATH, existing)
    print(f"Interior designers saved: {len(existing)} -> {INTERIOR_PATH}")


def scrape_development(scraper: DirectoryScraper, limit: Optional[int]) -> None:
    existing = load_existing(DEVELOPMENT_PATH)
    urls = scraper.homeviews_companies(limit)
    print(f"Development pages to read: {len(urls)} ({len(existing)} already saved)")
    for index, url in enumerate(urls, start=1):
        if url in existing and existing[url].get("name"):
            continue
        try:
            record = scraper.homeviews_company(url)
        except Exception as error:
            print(f"  failed {url}: {error}")
            continue
        if not record:
            existing[url] = {"url": url, "name": "", "skipped": True}
        else:
            existing[record["url"]] = record
        if index % 25 == 0:
            kept = [row for row in existing.values() if row.get("name") and not row.get("skipped")]
            save_rows(DEVELOPMENT_PATH, {row["url"]: row for row in kept})
            print(f"  checked {index}, kept {len(kept)} development companies")
    kept = {row["url"]: row for row in existing.values() if row.get("name") and not row.get("skipped")}
    save_rows(DEVELOPMENT_PATH, kept)
    print(f"Development companies saved: {len(kept)} -> {DEVELOPMENT_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["interior", "development", "both"], default="both")
    parser.add_argument("--limit", type=int, default=0, help="Max listing rows per source. 0 means all.")
    parser.add_argument("--delay", type=float, default=0.35)
    args = parser.parse_args()
    limit = args.limit or None
    scraper = DirectoryScraper(args.delay)
    if args.source in ("interior", "both"):
        scrape_interior(scraper, limit)
    if args.source in ("development", "both"):
        scrape_development(scraper, limit)


if __name__ == "__main__":
    main()

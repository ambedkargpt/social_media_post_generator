from pathlib import Path

from backend.repositories.news_repo import NewsRepository
from backend.services.news_migration import migrate_news


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    current_file = root / "outputs" / "generated_news.json"
    legacy_file = root / "outputs" / "generated_news_legacy.json"
    repo = NewsRepository()
    stats = migrate_news(repo, current_file=current_file, legacy_file=legacy_file)
    print("current_input=", stats.current_count)
    print("legacy_input=", stats.legacy_count)
    print("merged_normalized=", stats.merged_count)
    print("deduped_by_source_url=", stats.deduped_count)
    print("inserted=", stats.inserted)
    print("updated=", stats.updated)
    print("news_total=", repo.collection.count_documents({}))


if __name__ == "__main__":
    main()

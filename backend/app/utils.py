from datetime import date, datetime, timedelta, timezone


JAKARTA_TZ = timezone(timedelta(hours=7))


def jakarta_today() -> date:
    return datetime.now(JAKARTA_TZ).date()


def jakarta_yesterday() -> date:
    return jakarta_today() - timedelta(days=1)


def parse_iso_date(value: str | None, fallback: date) -> date:
    if not value:
        return fallback
    return date.fromisoformat(value)


def score_percent(total_score: int | float | None, max_score: int | float | None) -> int:
    total = float(total_score or 0)
    maximum = float(max_score or 0)
    if maximum <= 0:
        return 0
    return round((total / maximum) * 100)

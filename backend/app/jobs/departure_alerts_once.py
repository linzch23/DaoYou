import logging
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.amap_driving_provider import AmapDrivingProvider
from app.services.departure_alert_job import (
    DepartureAlertScanResult,
    run_departure_alert_scan,
)
from app.services.vivo_push_provider import VivoPushProvider

logger = logging.getLogger(__name__)
ADVISORY_LOCK_ID = 6_281_500


def run_once() -> DepartureAlertScanResult | None:
    with SessionLocal() as db:
        acquired = bool(
            db.scalar(
                text("SELECT pg_try_advisory_lock(:lock_id)"),
                {"lock_id": ADVISORY_LOCK_ID},
            )
        )
        if not acquired:
            logger.info("departure alert scan skipped: lock already held")
            return None
        try:
            result = run_departure_alert_scan(
                db=db,
                now=datetime.now(timezone.utc),
                route_provider=AmapDrivingProvider(api_key=settings.amap_api_key),
                push_provider=VivoPushProvider(
                    app_id=settings.vivo_push_app_id or 0,
                    app_key=settings.vivo_push_app_key,
                    app_secret=settings.vivo_push_app_secret,
                    api_base=settings.vivo_push_api_base,
                    push_mode=settings.vivo_push_mode,
                    timeout_seconds=settings.vivo_push_timeout_seconds,
                ),
            )
            logger.info(
                "departure alert scan completed evaluated=%s skipped=%s arrived=%s "
                "created=%s sent=%s failed=%s",
                result.evaluated_count,
                result.skipped_count,
                result.arrived_count,
                result.alert_created_count,
                result.sent_count,
                result.failed_count,
            )
            return result
        finally:
            db.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": ADVISORY_LOCK_ID},
            )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    run_once()


if __name__ == "__main__":
    main()

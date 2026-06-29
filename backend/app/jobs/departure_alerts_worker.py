import logging
import signal
import threading
from datetime import datetime, timedelta, timezone

from app.jobs.departure_alerts_once import run_once

logger = logging.getLogger(__name__)
stop_event = threading.Event()


def seconds_until_next_quarter(now: datetime) -> float:
    current = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
    next_minute = ((current.minute // 15) + 1) * 15
    next_run = current.replace(second=0, microsecond=0)
    if next_minute == 60:
        next_run = next_run.replace(minute=0) + timedelta(hours=1)
    else:
        next_run = next_run.replace(minute=next_minute)
    return (next_run - current).total_seconds()


def _request_stop(signum: int, frame: object) -> None:
    del signum, frame
    stop_event.set()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    signal.signal(signal.SIGTERM, _request_stop)
    signal.signal(signal.SIGINT, _request_stop)
    logger.info("departure alert worker started")
    while not stop_event.is_set():
        wait_seconds = seconds_until_next_quarter(datetime.now(timezone.utc))
        if stop_event.wait(wait_seconds):
            break
        try:
            run_once()
        except Exception:
            logger.exception("departure alert scan failed")
    logger.info("departure alert worker stopped")


if __name__ == "__main__":
    main()

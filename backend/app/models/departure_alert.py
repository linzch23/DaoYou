from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DepartureAlert(Base):
    __tablename__ = "departure_alerts"
    __table_args__ = (
        UniqueConstraint("trip_item_id", "level", name="uq_departure_alerts_item_level"),
        UniqueConstraint("request_id", name="uq_departure_alerts_request_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    trip_item_id: Mapped[int] = mapped_column(
        ForeignKey("trip_items.id", ondelete="CASCADE"),
        index=True,
    )
    level: Mapped[str] = mapped_column(String(16))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    distance_meters: Mapped[int] = mapped_column(Integer)
    eta_seconds: Mapped[int] = mapped_column(Integer)
    remaining_seconds: Mapped[int] = mapped_column(Integer)
    push_status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    request_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)
    provider_task_id: Mapped[str | None] = mapped_column(String(128), default=None)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error_code: Mapped[str | None] = mapped_column(String(64), default=None)
    last_error_message: Mapped[str | None] = mapped_column(String(256), default=None)
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

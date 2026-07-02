from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PendingAction(Base):
    __tablename__ = "pending_actions"
    __table_args__ = (
        UniqueConstraint("action_id", name="uq_pending_actions_action_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    action_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    operation: Mapped[str] = mapped_column(String(50))
    target_item_id: Mapped[int | None] = mapped_column(default=None)
    target_trip_day_id: Mapped[int | None] = mapped_column(default=None)
    target_date: Mapped[date | None] = mapped_column(Date, default=None)
    target_day_index: Mapped[int | None] = mapped_column(default=None)
    payload: Mapped[dict] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    option_snapshot: Mapped[dict] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    trip_fingerprint: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    result: Mapped[dict | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        default=None,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

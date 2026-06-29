from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DevicePushToken(Base):
    __tablename__ = "device_push_tokens"
    __table_args__ = (
        UniqueConstraint("provider", "reg_id", name="uq_device_push_tokens_provider_reg_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32), default="vivo")
    reg_id: Mapped[str] = mapped_column(String(512))
    device_name: Mapped[str] = mapped_column(String(128), default="")
    app_version: Mapped[str] = mapped_column(String(32), default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

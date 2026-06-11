from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    nickname: Mapped[str] = mapped_column(String(100), default="导友用户")
    latitude: Mapped[Decimal] = mapped_column(
        Numeric(10, 7),
        default=Decimal("31.2304000"),
    )
    longitude: Mapped[Decimal] = mapped_column(
        Numeric(10, 7),
        default=Decimal("121.4737000"),
    )
    location_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

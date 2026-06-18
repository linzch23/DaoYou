from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    preference_key: Mapped[str] = mapped_column(String(100))
    preference_value: Mapped[dict] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserMemory(Base):
    __tablename__ = "user_memory"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    memory_type: Mapped[str] = mapped_column(String(50))
    memory_key: Mapped[str] = mapped_column(String(100))
    memory_value: Mapped[dict] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

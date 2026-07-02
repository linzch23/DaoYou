from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    creation_key: Mapped[str | None] = mapped_column(String(100), unique=True, default=None)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TripDay(Base):
    __tablename__ = "trip_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    day_index: Mapped[int]
    trip_date: Mapped[date] = mapped_column(Date)
    summary: Mapped[str | None] = mapped_column(String(300), default=None)


class TripItem(Base):
    __tablename__ = "trip_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_day_id: Mapped[int] = mapped_column(
        ForeignKey("trip_days.id", ondelete="CASCADE"),
        index=True,
    )
    city: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    item_type: Mapped[str] = mapped_column(String(50), default="attraction")
    start_time: Mapped[time | None] = mapped_column(Time, default=None)
    end_time: Mapped[time | None] = mapped_column(Time, default=None)
    address: Mapped[str | None] = mapped_column(String(300), default=None)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), default=None)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), default=None)
    status: Mapped[str] = mapped_column(String(30), default="planned")
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    arrived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
    )
    arrival_distance_meters: Mapped[int | None] = mapped_column(Integer, default=None)

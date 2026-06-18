from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models.chat import ChatMessage
from app.models.photo import PhotoRecord
from app.models.preference import UserMemory, UserPreference
from app.models.reminder import Reminder
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User


@pytest.fixture
def db() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, connection_record) -> None:
        del connection_record
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    for table in [
        User.__table__,
        Trip.__table__,
        TripDay.__table__,
        TripItem.__table__,
        ChatMessage.__table__,
        PhotoRecord.__table__,
        Reminder.__table__,
        UserPreference.__table__,
        UserMemory.__table__,
    ]:
        table.create(engine)

    with Session(engine) as session:
        yield session

    engine.dispose()

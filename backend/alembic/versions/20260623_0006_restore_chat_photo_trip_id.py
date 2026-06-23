"""restore chat and photo trip scope

Revision ID: 20260623_0006
Revises: 20260618_0005
Create Date: 2026-06-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260623_0006"
down_revision: str | None = "20260618_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("trip_id", sa.Integer(), nullable=True))
    op.add_column("photo_records", sa.Column("trip_id", sa.Integer(), nullable=True))

    _backfill_trip_id("chat_messages")
    _backfill_trip_id("photo_records")

    op.alter_column("chat_messages", "trip_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("photo_records", "trip_id", existing_type=sa.Integer(), nullable=False)

    op.create_foreign_key(
        "chat_messages_trip_id_fkey",
        "chat_messages",
        "trips",
        ["trip_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_chat_messages_trip_id"),
        "chat_messages",
        ["trip_id"],
        unique=False,
    )

    op.create_foreign_key(
        "photo_records_trip_id_fkey",
        "photo_records",
        "trips",
        ["trip_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_photo_records_trip_id"),
        "photo_records",
        ["trip_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_photo_records_trip_id"), table_name="photo_records")
    op.drop_constraint("photo_records_trip_id_fkey", "photo_records", type_="foreignkey")
    op.drop_column("photo_records", "trip_id")

    op.drop_index(op.f("ix_chat_messages_trip_id"), table_name="chat_messages")
    op.drop_constraint("chat_messages_trip_id_fkey", "chat_messages", type_="foreignkey")
    op.drop_column("chat_messages", "trip_id")


def _backfill_trip_id(table_name: str) -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {table_name} AS record
            SET trip_id = (
                SELECT trips.id
                FROM trips
                WHERE trips.user_id = record.user_id
                ORDER BY
                    CASE WHEN trips.deleted_at IS NULL THEN 0 ELSE 1 END,
                    trips.start_date,
                    trips.id
                LIMIT 1
            )
            WHERE record.trip_id IS NULL
            """
        )
    )
    op.execute(sa.text(f"DELETE FROM {table_name} WHERE trip_id IS NULL"))

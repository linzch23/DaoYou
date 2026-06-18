"""Make chat and photo records user scoped.

Revision ID: 20260618_0003
Revises: 20260611_0002
Create Date: 2026-06-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260618_0003"
down_revision: str | Sequence[str] | None = "20260611_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_chat_messages_trip_id"), table_name="chat_messages")
    op.drop_constraint(
        "chat_messages_trip_id_fkey",
        "chat_messages",
        type_="foreignkey",
    )
    op.drop_column("chat_messages", "trip_id")

    op.drop_index(op.f("ix_photo_records_trip_id"), table_name="photo_records")
    op.drop_constraint(
        "photo_records_trip_id_fkey",
        "photo_records",
        type_="foreignkey",
    )
    op.drop_column("photo_records", "trip_id")


def downgrade() -> None:
    op.add_column("photo_records", sa.Column("trip_id", sa.Integer(), nullable=True))
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

    op.add_column("chat_messages", sa.Column("trip_id", sa.Integer(), nullable=True))
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

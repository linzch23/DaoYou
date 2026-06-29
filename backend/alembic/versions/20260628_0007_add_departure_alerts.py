"""replace in-app reminders with departure alert delivery state

Revision ID: 20260628_0007
Revises: 20260623_0006
Create Date: 2026-06-28 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260628_0007"
down_revision: str | None = "20260623_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "trip_items",
        sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "trip_items",
        sa.Column("arrival_distance_meters", sa.Integer(), nullable=True),
    )

    op.create_table(
        "device_push_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("reg_id", sa.String(length=512), nullable=False),
        sa.Column("device_name", sa.String(length=128), nullable=False),
        sa.Column("app_version", sa.String(length=32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "reg_id",
            name="uq_device_push_tokens_provider_reg_id",
        ),
    )
    op.create_index(
        op.f("ix_device_push_tokens_user_id"),
        "device_push_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_device_push_tokens_enabled"),
        "device_push_tokens",
        ["enabled"],
        unique=False,
    )

    op.create_table(
        "departure_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("trip_item_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=16), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("distance_meters", sa.Integer(), nullable=False),
        sa.Column("eta_seconds", sa.Integer(), nullable=False),
        sa.Column("remaining_seconds", sa.Integer(), nullable=False),
        sa.Column("push_status", sa.String(length=16), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_task_id", sa.String(length=128), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
        sa.Column("last_error_message", sa.String(length=256), nullable=True),
        sa.Column("pushed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trip_item_id"], ["trip_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "trip_item_id",
            "level",
            name="uq_departure_alerts_item_level",
        ),
        sa.UniqueConstraint("request_id", name="uq_departure_alerts_request_id"),
    )
    op.create_index(
        op.f("ix_departure_alerts_user_id"),
        "departure_alerts",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_departure_alerts_trip_id"),
        "departure_alerts",
        ["trip_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_departure_alerts_trip_item_id"),
        "departure_alerts",
        ["trip_item_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_departure_alerts_push_status"),
        "departure_alerts",
        ["push_status"],
        unique=False,
    )

    op.drop_index(op.f("ix_reminders_user_id"), table_name="reminders")
    op.drop_index(op.f("ix_reminders_trip_id"), table_name="reminders")
    op.drop_table("reminders")


def downgrade() -> None:
    op.create_table(
        "reminders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            name="reminders_trip_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="reminders_user_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id", name="reminders_pkey"),
    )
    op.create_index(
        op.f("ix_reminders_trip_id"),
        "reminders",
        ["trip_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reminders_user_id"),
        "reminders",
        ["user_id"],
        unique=False,
    )

    op.drop_index(op.f("ix_departure_alerts_push_status"), table_name="departure_alerts")
    op.drop_index(op.f("ix_departure_alerts_trip_item_id"), table_name="departure_alerts")
    op.drop_index(op.f("ix_departure_alerts_trip_id"), table_name="departure_alerts")
    op.drop_index(op.f("ix_departure_alerts_user_id"), table_name="departure_alerts")
    op.drop_table("departure_alerts")

    op.drop_index(op.f("ix_device_push_tokens_enabled"), table_name="device_push_tokens")
    op.drop_index(op.f("ix_device_push_tokens_user_id"), table_name="device_push_tokens")
    op.drop_table("device_push_tokens")

    op.drop_column("trip_items", "arrival_distance_meters")
    op.drop_column("trip_items", "arrived_at")

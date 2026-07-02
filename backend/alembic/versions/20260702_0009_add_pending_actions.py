"""add server-side pending agent actions

Revision ID: 20260702_0009
Revises: 20260702_0008
Create Date: 2026-07-02 01:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260702_0009"
down_revision: str | None = "20260702_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pending_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("action_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("operation", sa.String(length=50), nullable=False),
        sa.Column("target_item_id", sa.Integer(), nullable=True),
        sa.Column("target_trip_day_id", sa.Integer(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("target_day_index", sa.Integer(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("option_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("trip_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("action_id", name="uq_pending_actions_action_id"),
    )
    op.create_index(op.f("ix_pending_actions_action_id"), "pending_actions", ["action_id"])
    op.create_index(op.f("ix_pending_actions_user_id"), "pending_actions", ["user_id"])
    op.create_index(op.f("ix_pending_actions_trip_id"), "pending_actions", ["trip_id"])
    op.create_index(op.f("ix_pending_actions_status"), "pending_actions", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_pending_actions_status"), table_name="pending_actions")
    op.drop_index(op.f("ix_pending_actions_trip_id"), table_name="pending_actions")
    op.drop_index(op.f("ix_pending_actions_user_id"), table_name="pending_actions")
    op.drop_index(op.f("ix_pending_actions_action_id"), table_name="pending_actions")
    op.drop_table("pending_actions")

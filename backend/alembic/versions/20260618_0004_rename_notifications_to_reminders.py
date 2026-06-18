"""Rename notifications table to reminders.

Revision ID: 20260618_0004
Revises: 20260618_0003
Create Date: 2026-06-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260618_0004"
down_revision: str | Sequence[str] | None = "20260618_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.rename_table("notifications", "reminders")
    op.execute("ALTER INDEX ix_notifications_trip_id RENAME TO ix_reminders_trip_id")
    op.execute("ALTER INDEX ix_notifications_user_id RENAME TO ix_reminders_user_id")
    op.execute(
        "ALTER TABLE reminders RENAME CONSTRAINT notifications_trip_id_fkey "
        "TO reminders_trip_id_fkey"
    )
    op.execute(
        "ALTER TABLE reminders RENAME CONSTRAINT notifications_user_id_fkey "
        "TO reminders_user_id_fkey"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE reminders RENAME CONSTRAINT reminders_user_id_fkey "
        "TO notifications_user_id_fkey"
    )
    op.execute(
        "ALTER TABLE reminders RENAME CONSTRAINT reminders_trip_id_fkey "
        "TO notifications_trip_id_fkey"
    )
    op.execute("ALTER INDEX ix_reminders_user_id RENAME TO ix_notifications_user_id")
    op.execute("ALTER INDEX ix_reminders_trip_id RENAME TO ix_notifications_trip_id")
    op.rename_table("reminders", "notifications")

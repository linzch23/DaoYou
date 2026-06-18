"""Rename reminder primary key and sequence.

Revision ID: 20260618_0005
Revises: 20260618_0004
Create Date: 2026-06-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260618_0005"
down_revision: str | Sequence[str] | None = "20260618_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE reminders RENAME CONSTRAINT notifications_pkey TO reminders_pkey")
    op.execute("ALTER SEQUENCE notifications_id_seq RENAME TO reminders_id_seq")
    op.execute(
        "ALTER TABLE reminders ALTER COLUMN id SET DEFAULT nextval('reminders_id_seq'::regclass)"
    )
    op.execute("ALTER SEQUENCE reminders_id_seq OWNED BY reminders.id")


def downgrade() -> None:
    op.execute("ALTER SEQUENCE reminders_id_seq RENAME TO notifications_id_seq")
    op.execute(
        "ALTER TABLE reminders ALTER COLUMN id SET DEFAULT "
        "nextval('notifications_id_seq'::regclass)"
    )
    op.execute("ALTER SEQUENCE notifications_id_seq OWNED BY reminders.id")
    op.execute("ALTER TABLE reminders RENAME CONSTRAINT reminders_pkey TO notifications_pkey")

"""add user memory lifecycle fields and uniqueness

Revision ID: 20260702_0008
Revises: 20260628_0007
Create Date: 2026-07-02 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260702_0008"
down_revision: str | None = "20260628_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_memory", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.execute(sa.text("UPDATE user_memory SET updated_at = created_at WHERE updated_at IS NULL"))
    op.alter_column("user_memory", "updated_at", nullable=False)

    # Keep the newest row before enforcing the product invariant.
    op.execute(
        sa.text(
            "DELETE FROM user_memory WHERE id NOT IN ("
            "SELECT MAX(id) FROM user_memory GROUP BY user_id, memory_type, memory_key"
            ")"
        )
    )
    op.create_unique_constraint(
        "uq_user_memory_user_type_key",
        "user_memory",
        ["user_id", "memory_type", "memory_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_user_memory_user_type_key",
        "user_memory",
        type_="unique",
    )
    op.drop_column("user_memory", "updated_at")

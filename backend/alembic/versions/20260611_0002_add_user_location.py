"""Add the latest user location snapshot.

Revision ID: 20260611_0002
Revises: 20260608_0001
Create Date: 2026-06-11
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260611_0002"
down_revision: str | Sequence[str] | None = "20260608_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "latitude",
            sa.Numeric(precision=10, scale=7),
            server_default="31.2304000",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "longitude",
            sa.Numeric(precision=10, scale=7),
            server_default="121.4737000",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("location_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "location_updated_at")
    op.drop_column("users", "longitude")
    op.drop_column("users", "latitude")

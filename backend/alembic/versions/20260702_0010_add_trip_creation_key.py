"""add idempotency key for atomic trip creation

Revision ID: 20260702_0010
Revises: 20260702_0009
"""

import sqlalchemy as sa

from alembic import op

revision = "20260702_0010"
down_revision = "20260702_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("creation_key", sa.String(length=100), nullable=True))
    op.create_unique_constraint("uq_trips_creation_key", "trips", ["creation_key"])


def downgrade() -> None:
    op.drop_constraint("uq_trips_creation_key", "trips", type_="unique")
    op.drop_column("trips", "creation_key")

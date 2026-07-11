"""add is_read to contact_messages

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-07-10 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b3c4d5e6f7a8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('contact_messages',
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column('contact_messages', 'is_read')

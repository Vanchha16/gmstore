"""add phone to contact_messages

Revision ID: d4e5f6a7b8c9
Revises: 9c2e7f4a1b3d
Create Date: 2026-07-12 09:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = '9c2e7f4a1b3d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('contact_messages',
        sa.Column('phone', sa.String(length=30), nullable=True)
    )


def downgrade():
    op.drop_column('contact_messages', 'phone')

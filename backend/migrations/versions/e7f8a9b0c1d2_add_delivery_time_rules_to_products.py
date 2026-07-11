"""add delivery_time and rules to products

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-07-10 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e7f8a9b0c1d2'
down_revision = 'd6e7f8a9b0c1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('delivery_time', sa.String(100), nullable=True))
    op.add_column('products', sa.Column('rules', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('products', 'rules')
    op.drop_column('products', 'delivery_time')

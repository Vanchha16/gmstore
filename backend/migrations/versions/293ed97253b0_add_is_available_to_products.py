"""add is_available manual flag to products

Revision ID: 293ed97253b0
Revises: c7ed383edebf
Create Date: 2026-07-11 18:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '293ed97253b0'
down_revision = 'c7ed383edebf'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_available', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('is_available')

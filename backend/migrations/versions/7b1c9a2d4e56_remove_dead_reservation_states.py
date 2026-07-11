"""remove dead awaiting_stock/reserved states from the old auto-reveal flow

Revision ID: 7b1c9a2d4e56
Revises: 293ed97253b0
Create Date: 2026-07-11 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '7b1c9a2d4e56'
down_revision = '293ed97253b0'
branch_labels = None
depends_on = None


def upgrade():
    # No order is ever set to awaiting_stock anymore — delivery is always a
    # manual admin action (see order_service.deliver_order), so fold any
    # leftover rows back to 'paid' (pending delivery) before narrowing the enum.
    op.execute("UPDATE orders SET status = 'paid' WHERE status = 'awaiting_stock'")
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.alter_column('status',
               existing_type=sa.Enum('pending_payment', 'awaiting_stock', 'paid', 'fulfilled', 'cancelled', 'refunded', 'failed'),
               type_=mysql.ENUM('pending_payment', 'paid', 'fulfilled', 'cancelled', 'refunded', 'failed'),
               existing_nullable=False)

    # Stock is never reserved pre-delivery in the new flow — items go straight
    # from 'available' to 'sold' inside deliver_order.
    op.execute("UPDATE stock_items SET status = 'available', reserved_until = NULL WHERE status = 'reserved'")
    with op.batch_alter_table('stock_items', schema=None) as batch_op:
        batch_op.alter_column('status',
               existing_type=mysql.ENUM('available', 'reserved', 'sold'),
               type_=sa.Enum('available', 'sold'),
               existing_nullable=False)
        batch_op.drop_column('reserved_until')


def downgrade():
    with op.batch_alter_table('stock_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reserved_until', sa.DateTime(), nullable=True))
        batch_op.alter_column('status',
               existing_type=sa.Enum('available', 'sold'),
               type_=mysql.ENUM('available', 'reserved', 'sold'),
               existing_nullable=False)

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.alter_column('status',
               existing_type=mysql.ENUM('pending_payment', 'paid', 'fulfilled', 'cancelled', 'refunded', 'failed'),
               type_=sa.Enum('pending_payment', 'awaiting_stock', 'paid', 'fulfilled', 'cancelled', 'refunded', 'failed'),
               existing_nullable=False)

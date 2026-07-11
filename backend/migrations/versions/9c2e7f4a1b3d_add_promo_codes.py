"""add promo codes and redemptions

Revision ID: 9c2e7f4a1b3d
Revises: 7b1c9a2d4e56
Create Date: 2026-07-12 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9c2e7f4a1b3d'
down_revision = '7b1c9a2d4e56'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('promo_codes',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('discount_type', sa.Enum('percent', 'fixed'), nullable=False),
    sa.Column('discount_value', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('min_order_amount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('max_uses', sa.Integer(), nullable=True),
    sa.Column('used_count', sa.Integer(), nullable=False),
    sa.Column('max_uses_per_user', sa.Integer(), nullable=True),
    sa.Column('starts_at', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_engine='InnoDB',
    mysql_row_format='DYNAMIC'
    )
    op.create_table('promo_code_redemptions',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('promo_code_id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('order_id', sa.BigInteger(), nullable=False),
    sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['promo_code_id'], ['promo_codes.id']),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id'),
    mysql_charset='utf8mb4',
    mysql_engine='InnoDB',
    mysql_row_format='DYNAMIC'
    )
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('promo_code_id', sa.BigInteger(), nullable=True))
        batch_op.create_foreign_key('fk_orders_promo_code_id', 'promo_codes', ['promo_code_id'], ['id'], ondelete='SET NULL')

    with op.batch_alter_table('carts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('promo_code_id', sa.BigInteger(), nullable=True))
        batch_op.create_foreign_key('fk_carts_promo_code_id', 'promo_codes', ['promo_code_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('carts', schema=None) as batch_op:
        batch_op.drop_constraint('fk_carts_promo_code_id', type_='foreignkey')
        batch_op.drop_column('promo_code_id')

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_constraint('fk_orders_promo_code_id', type_='foreignkey')
        batch_op.drop_column('promo_code_id')

    op.drop_table('promo_code_redemptions')
    op.drop_table('promo_codes')

"""add chat tables

Revision ID: d6e7f8a9b0c1
Revises: b3c4d5e6f7a8
Create Date: 2026-07-10 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd6e7f8a9b0c1'
down_revision = 'b3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('guest_token', sa.String(64), nullable=True),
        sa.Column('guest_name', sa.String(100), nullable=True),
        sa.Column('status', sa.Enum('open', 'closed'), nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        mysql_engine='InnoDB', mysql_charset='utf8mb4', mysql_row_format='DYNAMIC'
    )
    op.create_index('ix_chat_sessions_guest_token', 'chat_sessions', ['guest_token'])

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.BigInteger(), nullable=False),
        sa.Column('sender', sa.Enum('user', 'admin'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        mysql_engine='InnoDB', mysql_charset='utf8mb4', mysql_row_format='DYNAMIC'
    )


def downgrade():
    op.drop_table('chat_messages')
    op.drop_index('ix_chat_sessions_guest_token', 'chat_sessions')
    op.drop_table('chat_sessions')

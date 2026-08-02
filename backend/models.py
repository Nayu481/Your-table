from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

board_users = Table(
    'board_users',
    Base.metadata,
    Column('board_id', Integer, ForeignKey('boards.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class DBUser(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owned_boards = relationship("DBBoard", back_populates="owner", foreign_keys="DBBoard.owner_id")
    shared_boards = relationship("DBBoard", secondary=board_users, back_populates="shared_users")
    invitations = relationship("DBInvitation", back_populates="user")

class DBBoard(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("DBUser", back_populates="owned_boards", foreign_keys=[owner_id])
    shared_users = relationship("DBUser", secondary=board_users, back_populates="shared_boards")
    invitations = relationship("DBInvitation", back_populates="board")

class DBInvitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    board = relationship("DBBoard", back_populates="invitations")
    user = relationship("DBUser", back_populates="invitations")

class DBTask(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    priority = Column(String, default="medium")
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

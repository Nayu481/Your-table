from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

class BoardCreate(BaseModel):
    title: str
    description: Optional[str] = None

class BoardResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    owner_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InvitationResponse(BaseModel):
    id: int
    board_id: int
    board_title: str
    owner_username: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    board_id: int

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    priority: str
    board_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

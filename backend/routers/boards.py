from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Board
from schemas import BoardCreate, BoardOut, BoardWithTasks, ShareBoardCreate
from dependencies import get_current_user, get_board_with_permissions
from services import board_service

router = APIRouter(prefix="/api/boards", tags=["Tableros"])

@router.get("", response_model=List[BoardOut])
def list_boards(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista los tableros del usuario y los compartidos con él."""
    return board_service.get_user_boards(db, current_user.id)

@router.post("", response_model=BoardOut, status_code=201)
def create_board(board_data: BoardCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Crea un nuevo tablero asignando al usuario como dueño."""
    return board_service.create_board(db, board_data, current_user.id)

@router.get("/{board_id}", response_model=BoardWithTasks)
def get_board(board: Board = Depends(get_board_with_permissions)):
    """Obtiene un tablero específico y sus tareas. Incluye validación automática de permisos."""
    return board

@router.post("/{board_id}/share")
def share_board(
    share_data: ShareBoardCreate, 
    board: Board = Depends(get_board_with_permissions), 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Comparte el tablero con otro usuario (solo si eres el dueño)."""
    board_service.share_board(db, board, share_data.username, current_user.id)
    return {"message": "Tablero compartido exitosamente"}
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Board
from schemas import TaskCreate, TaskUpdate, TaskOut
from dependencies import get_board_with_permissions
from services import task_service

# Las rutas de tareas se montan dependiendo del board para mantener la seguridad jerárquica
router = APIRouter(prefix="/api/boards/{board_id}/tasks", tags=["Tareas"])

@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    task_data: TaskCreate,
    board: Board = Depends(get_board_with_permissions), # Bloquea si no tienes permisos sobre el tablero
    db: Session = Depends(get_db)
):
    """Crea una tarea en un tablero validando previamente los permisos sobre él."""
    return task_service.create_task(db, task_data, board.id)

@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    board: Board = Depends(get_board_with_permissions),
    db: Session = Depends(get_db)
):
    """Actualiza una tarea. Revisa que el usuario tenga acceso al tablero que la contiene."""
    return task_service.update_task(db, task_id, task_data, board.id)

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    board: Board = Depends(get_board_with_permissions),
    db: Session = Depends(get_db)
):
    """Elimina una tarea."""
    task_service.delete_task(db, task_id, board.id)
    return {"message": "Tarea eliminada exitosamente"}
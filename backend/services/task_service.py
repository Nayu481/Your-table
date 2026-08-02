from sqlalchemy.orm import Session
from models import Task
from schemas import TaskCreate, TaskUpdate
from utils.exceptions import NotFoundError
from utils.logger import logger

def create_task(db: Session, task_data: TaskCreate, board_id: int) -> Task:
    new_task = Task(**task_data.model_dump(), board_id=board_id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    logger.info(f"Tarea creada ID: {new_task.id} en Tablero: {board_id}")
    return new_task

def update_task(db: Session, task_id: int, task_data: TaskUpdate, board_id: int) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.board_id == board_id).first()
    if not task:
        raise NotFoundError("Tarea no encontrada en este tablero")
        
    update_data = task_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
        
    db.commit()
    db.refresh(task)
    return task

def delete_task(db: Session, task_id: int, board_id: int):
    task = db.query(Task).filter(Task.id == task_id, Task.board_id == board_id).first()
    if not task:
        raise NotFoundError("Tarea no encontrada en este tablero")
        
    db.delete(task)
    db.commit()
    logger.info(f"Tarea eliminada ID: {task_id}")
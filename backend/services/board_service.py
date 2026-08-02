from sqlalchemy.orm import Session
from typing import List
from models import Board, SharedBoard, User
from schemas import BoardCreate
from utils.exceptions import NotFoundError, AppError
from utils.logger import logger

def get_user_boards(db: Session, user_id: int) -> List[Board]:
    owned_boards = db.query(Board).filter(Board.owner_id == user_id).all()
    
    shared_entries = db.query(SharedBoard).filter(SharedBoard.user_id == user_id).all()
    shared_board_ids = [entry.board_id for entry in shared_entries]
    shared_boards = db.query(Board).filter(Board.id.in_(shared_board_ids)).all()
    
    return owned_boards + shared_boards

def create_board(db: Session, board_data: BoardCreate, user_id: int) -> Board:
    new_board = Board(title=board_data.title, owner_id=user_id)
    db.add(new_board)
    db.commit()
    db.refresh(new_board)
    
    logger.info(f"Tablero creado ID: {new_board.id} por Usuario ID: {user_id}")
    return new_board

def share_board(db: Session, board: Board, target_username: str, owner_id: int):
    if board.owner_id != owner_id:
        raise AppError("Solo el propietario puede compartir el tablero", status_code=403)
        
    target_user = db.query(User).filter(User.username == target_username).first()
    if not target_user:
        raise NotFoundError("El usuario destino no existe")
        
    if target_user.id == owner_id:
        raise AppError("No puedes compartir el tablero contigo mismo", status_code=400)
        
    existing_share = db.query(SharedBoard).filter(
        SharedBoard.board_id == board.id,
        SharedBoard.user_id == target_user.id
    ).first()
    
    if existing_share:
        raise AppError("El tablero ya está compartido con este usuario", status_code=400)
        
    share_entry = SharedBoard(board_id=board.id, user_id=target_user.id)
    db.add(share_entry)
    db.commit()
    
    logger.info(f"Tablero {board.id} compartido con {target_username}")
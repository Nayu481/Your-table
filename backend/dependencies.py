from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from database import SessionLocal
from models import User, Board, SharedBoard
from config import settings
from utils.exceptions import UnauthorizedError, NotFoundError, ForbiddenError
from utils.logger import logger

# El cliente enviará el JWT usando el esquema Bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_db():
    """Generador de sesiones de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Valida el JWT y devuelve el usuario autenticado."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise UnauthorizedError("Token inválido: falta el usuario")
    except JWTError as e:
        logger.warning(f"Intento de acceso con token inválido: {str(e)}")
        raise UnauthorizedError("Token expirado o inválido")
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise UnauthorizedError("El usuario ya no existe")
        
    return user

def get_board_with_permissions(board_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Board:
    """Verifica que el tablero exista y el usuario tenga permisos (dueño o compartido)."""
    board = db.query(Board).filter(Board.id == board_id).first()
    
    if not board:
        raise NotFoundError("Tablero no encontrado")
        
    is_owner = board.owner_id == current_user.id
    is_shared = db.query(SharedBoard).filter(
        SharedBoard.board_id == board_id, 
        SharedBoard.user_id == current_user.id
    ).first() is not None
    
    if not is_owner and not is_shared:
        logger.warning(f"Usuario {current_user.id} intentó acceder sin permisos al tablero {board_id}")
        raise ForbiddenError("No tienes permisos para acceder a este tablero")
        
    return board
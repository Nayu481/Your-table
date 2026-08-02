from sqlalchemy.orm import Session
from models import User
from schemas import UserCreate
from utils.security import get_password_hash, verify_password, create_access_token
from utils.exceptions import AppError, UnauthorizedError
from utils.logger import logger

def register_user(db: Session, user_data: UserCreate) -> User:
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise AppError("El nombre de usuario ya está registrado", status_code=400)
        
    hashed_pwd = get_password_hash(user_data.password)
    new_user = User(username=user_data.username, hashed_password=hashed_pwd)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info(f"Nuevo usuario registrado: {new_user.username}")
    return new_user

def authenticate_user(db: Session, username: str, password: str) -> str:
    user = db.query(User).filter(User.username == username).first()
    
    if not user or not verify_password(password, user.hashed_password):
        logger.warning(f"Intento de login fallido para: {username}")
        raise UnauthorizedError("Credenciales incorrectas")
        
    access_token = create_access_token(data={"sub": user.username})
    logger.info(f"Login exitoso: {username}")
    
    return access_token
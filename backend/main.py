from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import bcrypt
from datetime import datetime

from models import DBUser, DBBoard, DBTask, DBInvitation, Base
from schemas import UserCreate, UserResponse, BoardCreate, BoardResponse, TaskCreate, TaskResponse, InvitationResponse
from database import engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Your Table API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def hash_password(password: str) -> str:
    """Hashea una contraseña usando bcrypt"""
    if len(password) > 72:
        raise ValueError("La contraseña no puede exceder 72 caracteres")
    
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña contra su hash"""
    try:
        if len(plain_password) > 72:
            return False
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        print(f"Error verificando contraseña: {e}")
        return False

@app.post("/api/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Registra un nuevo usuario"""
    try:
        existing_user = db.query(DBUser).filter(DBUser.username == user.username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="El usuario ya existe")
        
        if len(user.password) < 4:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")
        
        if len(user.password) > 72:
            raise HTTPException(status_code=400, detail="La contraseña no puede exceder 72 caracteres")
        
        hashed_password = hash_password(user.password)
        
        new_user = DBUser(
            username=user.username,
            hashed_password=hashed_password
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return UserResponse(id=new_user.id, username=new_user.username)
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error en registro: {e}")
        raise HTTPException(status_code=500, detail="Error al registrar usuario")

@app.post("/api/login", response_model=UserResponse)
def login(user: UserCreate, db: Session = Depends(get_db)):
    """Inicia sesión con username y contraseña"""
    try:
        db_user = db.query(DBUser).filter(DBUser.username == user.username).first()
        
        if not db_user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        if not verify_password(user.password, db_user.hashed_password):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        return UserResponse(id=db_user.id, username=db_user.username)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en login: {e}")
        raise HTTPException(status_code=500, detail="Error al iniciar sesión")

@app.get("/api/health")
def health_check():
    """Endpoint de salud"""
    return {"status": "ok", "message": "Your Table API funcionando"}

@app.post("/api/boards", response_model=BoardResponse)
def create_board(board: BoardCreate, x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Crea un nuevo tablero"""
    try:
        x_user_id = int(x_user_id)
        
        db_user = db.query(DBUser).filter(DBUser.id == x_user_id).first()
        if not db_user:
            raise HTTPException(status_code=401, detail="Usuario no autenticado")
        
        new_board = DBBoard(
            title=board.title,
            description=board.description,
            owner_id=x_user_id
        )
        db.add(new_board)
        db.commit()
        db.refresh(new_board)
        
        print(f"✓ Tablero creado: id={new_board.id}, owner={x_user_id}, title={new_board.title}")
        return BoardResponse.from_orm(new_board)
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creando tablero: {e}")
        raise HTTPException(status_code=500, detail="Error al crear tablero")

@app.get("/api/boards")
def get_boards(x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Obtiene tableros del usuario (propios y compartidos)"""
    try:
        x_user_id = int(x_user_id)
        
        db_user = db.query(DBUser).filter(DBUser.id == x_user_id).first()
        if not db_user:
            raise HTTPException(status_code=401, detail="Usuario no autenticado")
        
        owned = db.query(DBBoard).filter(DBBoard.owner_id == x_user_id).all()
        shared = db.query(DBBoard).filter(DBBoard.shared_users.any(DBUser.id == x_user_id)).all()
        
        return {
            "owned": [BoardResponse.from_orm(b).dict() for b in owned],
            "shared": [BoardResponse.from_orm(b).dict() for b in shared]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error obteniendo tableros: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener tableros")

@app.post("/api/boards/{board_id}/share")
def share_board(board_id: int, username: str, x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Comparte un tablero con otro usuario (envía invitación)"""
    try:
        print(f"\n{'='*70}")
        print(f"SHARE_BOARD INICIO")
        print(f"board_id: {board_id}, username: {username}, x_user_id: {x_user_id}")
        
        board_id = int(board_id)
        x_user_id = int(x_user_id)
        print(f"Tipos convertidos correctamente")
        
        print(f"\n[1] Buscando tablero {board_id} del propietario {x_user_id}...")
        db_board = db.query(DBBoard).filter(
            DBBoard.id == board_id,
            DBBoard.owner_id == x_user_id
        ).first()
        
        if not db_board:
            print(f"✗ Tablero no encontrado")
            # Debug
            all_boards = db.query(DBBoard).all()
            owner_boards = db.query(DBBoard).filter(DBBoard.owner_id == x_user_id).all()
            print(f"  Tableros totales en BD: {len(all_boards)}")
            print(f"  Tableros del propietario {x_user_id}: {len(owner_boards)}")
            if owner_boards:
                print(f"  IDs de tableros del propietario: {[b.id for b in owner_boards]}")
            raise HTTPException(status_code=404, detail=f"Tablero {board_id} no encontrado")
        
        print(f"✓ Tablero encontrado: {db_board.title}")
        
        print(f"\n[2] Buscando usuario destino: {username}...")
        target_user = db.query(DBUser).filter(DBUser.username == username).first()
        
        if not target_user:
            print(f"✗ Usuario {username} no encontrado")
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        print(f"✓ Usuario encontrado: {target_user.username} (id={target_user.id})")
        
        if target_user.id == x_user_id:
            print(f"✗ Error: Mismo usuario")
            raise HTTPException(status_code=400, detail="No puedes compartir contigo mismo")
        
        print(f"\n[3] Verificando invitaciones previas...")
        existing_invite = db.query(DBInvitation).filter(
            DBInvitation.board_id == board_id,
            DBInvitation.user_id == target_user.id,
            DBInvitation.status == "pending"
        ).first()
        
        if existing_invite:
            print(f"✗ Ya hay invitación pendiente")
            raise HTTPException(status_code=400, detail="Ya hay una invitación pendiente")
        
        if target_user in db_board.shared_users:
            print(f"✗ Usuario ya tiene acceso")
            raise HTTPException(status_code=400, detail="Ya tiene acceso a este tablero")
        
        print(f"\n[4] Creando invitación...")
        invitation = DBInvitation(
            board_id=board_id,
            user_id=target_user.id,
            status="pending"
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        
        print(f"✓ Invitación creada con ID: {invitation.id}")
        print(f"{'='*70}\n")
        
        return {"ok": True, "message": f"Invitación enviada a {username}"}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"\n✗ ERROR NO MANEJADO:")
        print(f"  {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*70}\n")
        raise HTTPException(status_code=500, detail=f"Error al compartir: {str(e)}")

@app.get("/api/invitations")
def get_invitations(x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Obtiene invitaciones pendientes del usuario"""
    try:
        x_user_id = int(x_user_id)
        
        db_user = db.query(DBUser).filter(DBUser.id == x_user_id).first()
        if not db_user:
            raise HTTPException(status_code=401, detail="Usuario no autenticado")
        
        invitations = db.query(DBInvitation).filter(
            DBInvitation.user_id == x_user_id,
            DBInvitation.status == "pending"
        ).all()
        
        result = []
        for inv in invitations:
            result.append({
                "id": inv.id,
                "board_id": inv.board.id,
                "board_title": inv.board.title,
                "owner_username": inv.board.owner.username,
                "status": inv.status,
                "created_at": inv.created_at
            })
        
        return {"invitations": result}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error obteniendo invitaciones: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener invitaciones")

@app.post("/api/invitations/{invitation_id}/accept")
def accept_invitation(invitation_id: int, x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Acepta una invitación de compartir tablero"""
    try:
        invitation_id = int(invitation_id)
        x_user_id = int(x_user_id)
        
        invitation = db.query(DBInvitation).filter(
            DBInvitation.id == invitation_id,
            DBInvitation.user_id == x_user_id
        ).first()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        
        if invitation.status != "pending":
            raise HTTPException(status_code=400, detail="La invitación ya fue procesada")
        
        invitation.board.shared_users.append(invitation.user)
        invitation.status = "accepted"
        db.commit()
        
        return {"ok": True, "message": "Tablero aceptado"}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error aceptando invitación: {e}")
        raise HTTPException(status_code=500, detail="Error al aceptar invitación")

@app.post("/api/invitations/{invitation_id}/reject")
def reject_invitation(invitation_id: int, x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Rechaza una invitación de compartir tablero"""
    try:
        invitation_id = int(invitation_id)
        x_user_id = int(x_user_id)
        
        invitation = db.query(DBInvitation).filter(
            DBInvitation.id == invitation_id,
            DBInvitation.user_id == x_user_id
        ).first()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        
        if invitation.status != "pending":
            raise HTTPException(status_code=400, detail="La invitación ya fue procesada")
        
        invitation.status = "rejected"
        db.commit()
        
        return {"ok": True, "message": "Invitación rechazada"}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error rechazando invitación: {e}")
        raise HTTPException(status_code=500, detail="Error al rechazar invitación")

@app.delete("/api/boards/{board_id}")
def delete_board(board_id: int, x_user_id: int = Header(...), db: Session = Depends(get_db)):
    """Elimina un tablero"""
    try:
        board_id = int(board_id)
        x_user_id = int(x_user_id)
        
        board = db.query(DBBoard).filter(
            DBBoard.id == board_id,
            DBBoard.owner_id == x_user_id
        ).first()
        
        if not board:
            raise HTTPException(status_code=404, detail="Tablero no encontrado")
        
        db.delete(board)
        db.commit()
        return {"ok": True}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error eliminando tablero: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar")

@app.get("/api/user/{username}/exists")
def user_exists(username: str, db: Session = Depends(get_db)):
    """Verifica si un usuario existe"""
    try:
        user = db.query(DBUser).filter(DBUser.username == username).first()
        return {"exists": user is not None, "username": username}
    except Exception as e:
        print(f"Error verificando usuario: {e}")
        raise HTTPException(status_code=500, detail="Error")

@app.get("/api/debug/boards")
def debug_boards(x_user_id: int = Header(None), db: Session = Depends(get_db)):
    """DEBUG: Ver tableros en BD"""
    try:
        if x_user_id:
            x_user_id = int(x_user_id)
        
        all_boards = db.query(DBBoard).all()
        user_boards = db.query(DBBoard).filter(DBBoard.owner_id == x_user_id).all() if x_user_id else []
        
        return {
            "x_user_id": x_user_id,
            "all_boards_count": len(all_boards),
            "user_boards_count": len(user_boards),
            "all_boards": [{"id": b.id, "title": b.title, "owner_id": b.owner_id} for b in all_boards],
            "user_boards": [{"id": b.id, "title": b.title, "owner_id": b.owner_id} for b in user_boards]
        }
    except Exception as e:
        return {"error": str(e)}

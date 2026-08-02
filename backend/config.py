from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Configuración central de la aplicación.
    En producción, estos valores deberían cargarse desde variables de entorno.
    """
    SECRET_KEY: str = "super-secret-key-cambiar-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 semana
    DATABASE_URL: str = "sqlite:///./kanban_app.db"

settings = Settings()
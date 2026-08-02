class AppError(Exception):
    """Clase base para errores de la aplicación."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code

class NotFoundError(AppError):
    def __init__(self, message: str = "Recurso no encontrado"):
        super().__init__(message, status_code=404)

class ForbiddenError(AppError):
    def __init__(self, message: str = "No tienes permisos para realizar esta acción"):
        super().__init__(message, status_code=403)

class UnauthorizedError(AppError):
    def __init__(self, message: str = "No autorizado"):
        super().__init__(message, status_code=401)
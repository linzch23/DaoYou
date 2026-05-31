from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.response import success


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.app_debug)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/health", tags=["health"])
    def health() -> dict[str, object]:
        return success({"status": "ok"})

    return app


app = create_app()


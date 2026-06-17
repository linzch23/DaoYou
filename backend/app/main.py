from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.core.response import success


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.app_debug)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.exception_handler(AppError)
    def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        del request
        status_code = 404 if exc.code == ErrorCode.NOT_FOUND else 400
        if exc.code >= ErrorCode.SERVER_ERROR:
            status_code = 500
        return JSONResponse(
            status_code=status_code,
            content={"code": int(exc.code), "message": exc.message, "data": {}},
        )

    @app.exception_handler(RequestValidationError)
    def handle_validation_error(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        del request, exc
        return JSONResponse(
            status_code=422,
            content={"code": 4000, "message": "请求参数错误", "data": {}},
        )

    @app.exception_handler(SQLAlchemyError)
    def handle_database_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        del request, exc
        return JSONResponse(
            status_code=500,
            content={"code": 5000, "message": "数据库操作失败", "data": {}},
        )

    @app.get("/health", tags=["health"])
    def health() -> dict[str, object]:
        return success({"status": "ok"})

    return app


app = create_app()

from fastapi.middleware.cors import CORSMiddleware

from app.main import app


def test_h5_dev_origin_is_allowed_by_cors_middleware() -> None:
    cors_middleware = next(
        (middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware),
        None,
    )

    assert cors_middleware is not None
    assert "http://localhost:5173" in cors_middleware.kwargs["allow_origins"]

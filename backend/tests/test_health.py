from app.main import app


def test_health_returns_success_response() -> None:
    route = next(route for route in app.routes if getattr(route, "path", None) == "/health")

    assert route.endpoint() == {
        "code": 0,
        "message": "success",
        "data": {"status": "ok"},
    }

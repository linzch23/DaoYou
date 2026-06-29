import httpx
import pytest

from app.services.amap_driving_provider import (
    AmapDrivingError,
    AmapDrivingProvider,
)


def test_driving_provider_parses_first_route_path() -> None:
    captured_request: httpx.Request | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={
                "status": "1",
                "info": "OK",
                "route": {
                    "paths": [
                        {"duration": "1234", "distance": "5678"},
                    ]
                },
            },
        )

    provider = AmapDrivingProvider(
        api_key="amap-key",
        transport=httpx.MockTransport(handler),
    )

    route = provider.get_route(
        origin_latitude=31.2304,
        origin_longitude=121.4737,
        destination_latitude=31.2404,
        destination_longitude=121.4837,
    )

    assert route.eta_seconds == 1234
    assert route.distance_meters == 5678
    assert captured_request is not None
    assert captured_request.url.path == "/v3/direction/driving"
    assert captured_request.url.params["origin"] == "121.473700,31.230400"
    assert captured_request.url.params["destination"] == "121.483700,31.240400"
    assert captured_request.url.params["extensions"] == "base"


def test_driving_provider_rejects_amap_business_error() -> None:
    provider = AmapDrivingProvider(
        api_key="amap-key",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"status": "0", "info": "INVALID_USER_KEY", "infocode": "10001"},
                request=request,
            )
        ),
    )

    with pytest.raises(AmapDrivingError, match="10001"):
        provider.get_route(
            origin_latitude=31.2304,
            origin_longitude=121.4737,
            destination_latitude=31.2404,
            destination_longitude=121.4837,
        )


@pytest.mark.parametrize(
    "path",
    [
        {},
        {"duration": "0", "distance": "10"},
        {"duration": "invalid", "distance": "10"},
    ],
)
def test_driving_provider_rejects_unusable_route(path: dict[str, str]) -> None:
    provider = AmapDrivingProvider(
        api_key="amap-key",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"status": "1", "info": "OK", "route": {"paths": [path]}},
                request=request,
            )
        ),
    )

    with pytest.raises(AmapDrivingError, match="unusable route"):
        provider.get_route(
            origin_latitude=31.2304,
            origin_longitude=121.4737,
            destination_latitude=31.2404,
            destination_longitude=121.4837,
        )

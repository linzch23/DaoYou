import httpx
import pytest

from app.services.amap_geocoding_provider import (
    AmapGeocodingError,
    AmapGeocodingProvider,
)


def test_geocoding_provider_parses_first_result() -> None:
    captured_request: httpx.Request | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={
                "status": "1",
                "count": "1",
                "info": "OK",
                "geocodes": [
                    {
                        "formatted_address": "北京市东城区景山前街4号",
                        "location": "116.397499,39.908722",
                        "level": "兴趣点",
                    }
                ],
            },
            request=request,
        )

    provider = AmapGeocodingProvider(
        api_key="amap-key",
        transport=httpx.MockTransport(handler),
    )

    location = provider.geocode(city="北京", address="故宫博物院")

    assert location.longitude == 116.397499
    assert location.latitude == 39.908722
    assert captured_request is not None
    assert captured_request.url.path == "/v3/geocode/geo"
    assert captured_request.url.params["city"] == "北京"
    assert captured_request.url.params["address"] == "故宫博物院"
    assert captured_request.url.params["output"] == "JSON"


def test_geocoding_provider_rejects_amap_business_error() -> None:
    provider = AmapGeocodingProvider(
        api_key="amap-key",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "status": "0",
                    "count": "0",
                    "info": "INVALID_USER_KEY",
                    "infocode": "10001",
                },
                request=request,
            )
        ),
    )

    with pytest.raises(AmapGeocodingError, match="10001"):
        provider.geocode(city="北京", address="故宫博物院")


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "1", "count": "0", "geocodes": []},
        {"status": "1", "count": "1", "geocodes": [{}]},
        {
            "status": "1",
            "count": "1",
            "geocodes": [{"location": "invalid"}],
        },
        {
            "status": "1",
            "count": "1",
            "geocodes": [{"location": "181.000000,39.000000"}],
        },
    ],
)
def test_geocoding_provider_rejects_unusable_result(
    payload: dict[str, object],
) -> None:
    provider = AmapGeocodingProvider(
        api_key="amap-key",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json=payload, request=request)
        ),
    )

    with pytest.raises(AmapGeocodingError, match="unusable result"):
        provider.geocode(city="北京", address="故宫博物院")

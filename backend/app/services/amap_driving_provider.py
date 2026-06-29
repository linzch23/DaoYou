from dataclasses import dataclass

import httpx

from app.core.config import settings


class AmapDrivingError(RuntimeError):
    pass


@dataclass(frozen=True)
class DrivingRoute:
    eta_seconds: int
    distance_meters: int


class AmapDrivingProvider:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = (base_url or settings.amap_base_url).rstrip("/")
        self.timeout_seconds = timeout_seconds or settings.amap_timeout_seconds
        self.transport = transport

    def get_route(
        self,
        *,
        origin_latitude: float,
        origin_longitude: float,
        destination_latitude: float,
        destination_longitude: float,
    ) -> DrivingRoute:
        try:
            with httpx.Client(
                transport=self.transport,
                timeout=self.timeout_seconds,
            ) as client:
                response = client.get(
                    f"{self.base_url}/v3/direction/driving",
                    params={
                        "key": self.api_key,
                        "origin": _coordinate(origin_longitude, origin_latitude),
                        "destination": _coordinate(
                            destination_longitude,
                            destination_latitude,
                        ),
                        "extensions": "base",
                        "output": "JSON",
                    },
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AmapDrivingError("amap driving request failed") from exc

        if data.get("status") != "1":
            error_code = str(data.get("infocode") or "unknown")
            raise AmapDrivingError(f"amap driving error {error_code}")

        try:
            path = data["route"]["paths"][0]
            eta_seconds = int(path["duration"])
            distance_meters = int(path["distance"])
            if eta_seconds <= 0 or distance_meters < 0:
                raise ValueError
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise AmapDrivingError("amap returned unusable route") from exc

        return DrivingRoute(
            eta_seconds=eta_seconds,
            distance_meters=distance_meters,
        )


def _coordinate(longitude: float, latitude: float) -> str:
    return f"{longitude:.6f},{latitude:.6f}"

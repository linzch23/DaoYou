from dataclasses import dataclass

import httpx

from app.core.config import settings


class AmapGeocodingError(RuntimeError):
    pass


@dataclass(frozen=True)
class GeocodedLocation:
    latitude: float
    longitude: float


class AmapGeocodingProvider:
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

    def geocode(self, *, city: str, address: str) -> GeocodedLocation:
        try:
            with httpx.Client(
                transport=self.transport,
                timeout=self.timeout_seconds,
            ) as client:
                response = client.get(
                    f"{self.base_url}/v3/geocode/geo",
                    params={
                        "key": self.api_key,
                        "city": city,
                        "address": address,
                        "output": "JSON",
                    },
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AmapGeocodingError("amap geocoding request failed") from exc

        if data.get("status") != "1":
            error_code = str(data.get("infocode") or "unknown")
            raise AmapGeocodingError(f"amap geocoding error {error_code}")

        try:
            if int(data["count"]) <= 0:
                raise ValueError
            raw_location = data["geocodes"][0]["location"]
            longitude_text, latitude_text = raw_location.split(",")
            longitude = float(longitude_text)
            latitude = float(latitude_text)
            if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                raise ValueError
        except (KeyError, IndexError, AttributeError, TypeError, ValueError) as exc:
            raise AmapGeocodingError("amap returned unusable result") from exc

        return GeocodedLocation(latitude=latitude, longitude=longitude)

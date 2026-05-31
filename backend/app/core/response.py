def success(data: object | None = None, message: str = "success") -> dict[str, object]:
    return {"code": 0, "message": message, "data": data if data is not None else {}}


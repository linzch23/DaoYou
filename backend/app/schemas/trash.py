from pydantic import BaseModel


class RestoreTrashTripRequest(BaseModel):
    user_id: int

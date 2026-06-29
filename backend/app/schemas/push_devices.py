from pydantic import BaseModel, ConfigDict, Field


class RegisterPushDeviceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int
    reg_id: str = Field(min_length=6, max_length=512)
    device_name: str = Field(default="", max_length=128)
    app_version: str = Field(default="", max_length=32)

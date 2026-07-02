from pydantic import BaseModel, Field


class ActionDecisionRequest(BaseModel):
    user_id: int = Field(gt=0)


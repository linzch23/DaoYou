from pydantic import BaseModel, Field


class ActionDecisionRequest(BaseModel):
    user_id: int = Field(gt=0)
    selected_operation_ids: list[str] | None = Field(
        default=None,
        min_length=1,
        max_length=20,
    )


from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.actions import ActionDecisionRequest
from app.services.action_service import confirm_action, reject_action

router = APIRouter()


@router.post("/{action_id}/confirm")
def confirm_action_endpoint(
    action_id: str,
    payload: ActionDecisionRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(confirm_action(
        action_id=action_id,
        user_id=payload.user_id,
        selected_operation_ids=payload.selected_operation_ids,
        db=db,
    ))


@router.post("/{action_id}/reject")
def reject_action_endpoint(
    action_id: str,
    payload: ActionDecisionRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(reject_action(action_id=action_id, user_id=payload.user_id, db=db))


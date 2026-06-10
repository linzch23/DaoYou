from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.response import success
from app.db.session import DbSession
from app.services.home_service import get_today_home

router = APIRouter()


@router.get("/today")
def read_today_home(
    user_id: int,
    db: DbSession,
    date_: Annotated[date | None, Query(alias="date")] = None,
) -> dict[str, object]:
    return success(get_today_home(user_id=user_id, target_date=date_, db=db))

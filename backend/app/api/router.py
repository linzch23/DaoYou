from fastapi import APIRouter

from app.api import chat, home, photos, preferences, reminders, trash, trips

api_router = APIRouter()
api_router.include_router(home.router, prefix="/home", tags=["home"])
api_router.include_router(trips.router, tags=["trips"])
api_router.include_router(trash.router, prefix="/trash", tags=["trash"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(photos.router, prefix="/photos", tags=["photos"])
api_router.include_router(reminders.router, prefix="/reminders", tags=["reminders"])
api_router.include_router(preferences.router, tags=["preferences"])

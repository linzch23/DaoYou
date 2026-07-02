from fastapi import APIRouter

from app.api import actions, chat, home, locations, photos, preferences, push_devices, trash, trips

api_router = APIRouter()
api_router.include_router(home.router, prefix="/home", tags=["home"])
api_router.include_router(locations.router, prefix="/location", tags=["location"])
api_router.include_router(trips.router, tags=["trips"])
api_router.include_router(trash.router, prefix="/trash", tags=["trash"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(photos.router, prefix="/photos", tags=["photos"])
api_router.include_router(push_devices.router, prefix="/push", tags=["push"])
api_router.include_router(preferences.router, tags=["preferences"])
api_router.include_router(actions.router, prefix="/actions", tags=["actions"])

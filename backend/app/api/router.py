from fastapi import APIRouter

from app.api.routes import accounts, cards, tasks


api_router = APIRouter()
api_router.include_router(cards.router, prefix="/cards", tags=["cards"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])

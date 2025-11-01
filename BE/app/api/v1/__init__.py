from fastapi import APIRouter

from app.api.v1 import checklists, llm, ocr, rooms, stt

api_router = APIRouter(prefix="/v1")

api_router.include_router(checklists.router, tags=["checklists"])
api_router.include_router(rooms.router, tags=["rooms"])
api_router.include_router(llm.router, tags=["llm"])
api_router.include_router(stt.router, tags=["stt"])
api_router.include_router(ocr.router, tags=["ocr"])

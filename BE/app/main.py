from fastapi import FastAPI
from app.core.config import settings
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="BMR API",
    description="우리들의 부동산 메이트",
    version="0.1.0",
    debug=settings.DEBUG,
    redirect_slashes=False,
)

# CORS (프론트-백엔드 분리 배포시 필요)
origins = [
    "http://127.0.0.1:3000",
    settings.FRONTEND_URL,
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 기본 헬스체크 엔드포인트
@app.get("/", tags=["health"])
def health_check():
    return {"msg": "BMR API running!"}

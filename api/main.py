import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.routes import router as auth_router
from routes.account import router as account_router
from routes.positions import router as positions_router
from routes.trades import router as trades_router
from routes.signals import router as signals_router
from routes.performance import router as performance_router
from routes.bot import router as bot_router
from routes.snapshots import router as snapshots_router
from routes.ml import router as ml_router
from websocket.manager import router as ws_router

app = FastAPI(title="Futures Trading Bot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [auth_router, account_router, positions_router, trades_router,
               signals_router, performance_router, bot_router, snapshots_router,
               ml_router, ws_router]:
    app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}

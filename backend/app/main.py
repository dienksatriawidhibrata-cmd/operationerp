from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import auth, branches, health, manager_visits, sop_docs, store_compliance, warehouse_receipts

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(branches.router, prefix="/api")
app.include_router(manager_visits.router, prefix="/api")
app.include_router(sop_docs.router, prefix="/api")
app.include_router(store_compliance.router, prefix="/api")
app.include_router(warehouse_receipts.router, prefix="/api")

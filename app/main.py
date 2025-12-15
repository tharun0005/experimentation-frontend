import uvicorn
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .routes import router
from .middlewares import add_cors_middleware
load_dotenv()
app = FastAPI(title=f"Experimentation UI")

add_cors_middleware(app)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(router)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api.routes import router, UPLOAD_DIR
from app.core.config import settings
from app.models.entities import Base, Master, Service, WorkingHour
from app.db import engine, SessionLocal


async def seed_database():
    async with SessionLocal() as db:
        # Создаём мастеров, если таблица пустая
        masters = list(
            (await db.scalars(select(Master).order_by(Master.id))).all()
        )

        if not masters:
            masters = [
                Master(
                    name="Александр Волков",
                    bio="Мастер с опытом в графике и геометрии.",
                    styles="Геометрия, графика, blackwork",
                    photo_url="",
                    is_active=True,
                ),
                Master(
                    name="Мария Соколова",
                    bio="Специализируется на тонких линиях и цветочных эскизах.",
                    styles="Fine line, флора, минимализм",
                    photo_url="",
                    is_active=True,
                ),
                Master(
                    name="Дмитрий Орлов",
                    bio="Создаёт выразительные композиции в тёмной палитре.",
                    styles="Реализм, blackwork, lettering",
                    photo_url="",
                    is_active=True,
                ),
            ]
            db.add_all(masters)
            await db.flush()

        # Создаём услуги, если таблица пустая
        services = list(
            (await db.scalars(select(Service).order_by(Service.id))).all()
        )

        if not services:
            services = [
                Service(
                    title="Мини-тату",
                    description="Небольшой рисунок с простым контуром.",
                    duration_minutes=60,
                    price_from=3000,
                    is_active=True,
                ),
                Service(
                    title="Тату до 10 см",
                    description="Компактная татуировка с проработанными деталями.",
                    duration_minutes=120,
                    price_from=5000,
                    is_active=True,
                ),
                Service(
                    title="Тату среднего размера",
                    description="Работа с более сложной композицией.",
                    duration_minutes=180,
                    price_from=8000,
                    is_active=True,
                ),
                Service(
                    title="Большая татуировка",
                    description="Крупная работа, требующая длительного сеанса.",
                    duration_minutes=240,
                    price_from=12000,
                    is_active=True,
                ),
                Service(
                    title="Разработка эскиза",
                    description="Подготовка индивидуального эскиза татуировки.",
                    duration_minutes=60,
                    price_from=1500,
                    is_active=True,
                ),
                Service(
                    title="Коррекция тату",
                    description="Коррекция ранее выполненной татуировки.",
                    duration_minutes=90,
                    price_from=2500,
                    is_active=True,
                ),
            ]
            db.add_all(services)

        # Добавляем рабочее расписание для каждого мастера,
        # если его ещё нет
        existing_hours = list(
            (await db.scalars(select(WorkingHour))).all()
        )
        existing_keys = {
            (hour.master_id, hour.weekday)
            for hour in existing_hours
        }

        for master in masters:
            for weekday in range(7):
                key = (master.id, weekday)

                if key not in existing_keys:
                    db.add(
                        WorkingHour(
                            master_id=master.id,
                            weekday=weekday,
                            opens_at="10:00",
                            closes_at="20:00",
                            is_closed=(weekday == 6),
                        )
                    )

        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await seed_database()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
async def root():
    return {"app": settings.app_name, "docs": "/docs"}


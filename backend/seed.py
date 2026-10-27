"""Add or update INK HOUSE demo masters, services and working hours. Safe to rerun."""
import asyncio
from sqlalchemy import select
from app.db import SessionLocal
from app.models.entities import Master, Service, WorkingHour

MASTERS = [
    {"name": "Анна Морозова", "bio": "Создаёт деликатные татуировки с тонкими линиями, ботаническими мотивами и аккуратными деталями.", "styles": "Fine line, флора, минимализм", "aliases": ["Мира"]},
    {"name": "Максим Волков", "bio": "Графика, контрастные композиции и выразительные чёрные работы.", "styles": "Blackwork, графика, геометрия", "aliases": ["Алекс"]},
    {"name": "Елизавета Соколова", "bio": "Орнаменты, декоративные композиции и авторские эскизы с плавными формами.", "styles": "Орнаментал, дотворк, авторские эскизы", "aliases": []},
]
SERVICES = [
    {"title": "Мини-тату до 3 см", "description": "Небольшой символ или лаконичный рисунок. Итоговая цена зависит от деталей эскиза.", "duration_minutes": 60, "price_from": 3000, "aliases": []},
    {"title": "Небольшая татуировка до 5 см", "description": "Компактная татуировка с умеренной детализацией.", "duration_minutes": 90, "price_from": 4500, "aliases": ["Небольшая татуировка"]},
    {"title": "Надпись или леттеринг", "description": "Текст, дата или короткая фраза; шрифт и расположение согласуются с мастером.", "duration_minutes": 60, "price_from": 3500, "aliases": []},
    {"title": "Графика и blackwork", "description": "Контрастный графический рисунок или композиция в чёрном цвете.", "duration_minutes": 120, "price_from": 7000, "aliases": []},
    {"title": "Флора и орнамент", "description": "Растительные мотивы и декоративные узоры среднего размера.", "duration_minutes": 150, "price_from": 8500, "aliases": []},
    {"title": "Большой сеанс 4 часа", "description": "Продолжительный сеанс для крупной или детализированной работы.", "duration_minutes": 240, "price_from": 14000, "aliases": ["Большой сеанс"]},
]


async def seed() -> None:
    async with SessionLocal() as db:
        for item in MASTERS:
            obj = await db.scalar(select(Master).where(Master.name == item["name"]))
            if obj is None:
                for alias in item["aliases"]:
                    obj = await db.scalar(select(Master).where(Master.name == alias))
                    if obj is not None:
                        break
            if obj is None:
                obj = Master(name=item["name"], bio=item["bio"], styles=item["styles"], is_active=True)
                db.add(obj)
            else:
                obj.name, obj.bio, obj.styles, obj.is_active = item["name"], item["bio"], item["styles"], True

        for item in SERVICES:
            obj = await db.scalar(select(Service).where(Service.title == item["title"]))
            if obj is None:
                for alias in item["aliases"]:
                    obj = await db.scalar(select(Service).where(Service.title == alias))
                    if obj is not None:
                        break
            if obj is None:
                obj = Service(title=item["title"], description=item["description"], duration_minutes=item["duration_minutes"], price_from=item["price_from"], is_active=True)
                db.add(obj)
            else:
                obj.title, obj.description = item["title"], item["description"]
                obj.duration_minutes, obj.price_from, obj.is_active = item["duration_minutes"], item["price_from"], True

        await db.flush()
        masters = (await db.scalars(select(Master).where(Master.name.in_([x["name"] for x in MASTERS])))).all()
        for master in masters:
            for weekday in range(7):
                hour = await db.scalar(select(WorkingHour).where(WorkingHour.master_id == master.id, WorkingHour.weekday == weekday))
                if hour is None:
                    db.add(WorkingHour(master_id=master.id, weekday=weekday, opens_at="10:00", closes_at="20:00", is_closed=weekday == 6))
        await db.commit()
        master_count = len((await db.scalars(select(Master).where(Master.is_active.is_(True)))).all())
        service_count = len((await db.scalars(select(Service).where(Service.is_active.is_(True)))).all())
        print(f"Demo data ready. Active masters: {master_count}; active services: {service_count}.")
        print("Demo entries: Анна Морозова, Максим Волков, Елизавета Соколова; 6 services.")
        print("Safe to rerun: existing demo entries are updated instead of duplicated.")

if __name__ == "__main__":
    asyncio.run(seed())

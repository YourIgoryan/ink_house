from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db import get_db
from app.models.entities import Appointment, Master, Service, WorkingHour
from app.schemas.booking import BookingCreate, MasterCreate, MasterOut, ServiceCreate, ServiceOut, WorkingHourIn, WorkingHourOut
from app.security import current_user, admin_user
from app.notifications import send_message

router = APIRouter(prefix="/api")
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ACTIVE = ("pending", "confirmed")
def as_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None: raise HTTPException(422, "Datetime must include timezone")
    return dt.astimezone(timezone.utc).replace(tzinfo=None)
def as_iso(dt: datetime) -> str:
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def get_now_utc() -> datetime:
    demo_now = settings.demo_now

    if demo_now is None:
        return datetime.now(timezone.utc)

    if demo_now.tzinfo is None:
        demo_now = demo_now.replace(
            tzinfo=ZoneInfo(settings.studio_timezone)
        )

    return demo_now.astimezone(timezone.utc)

async def booking_json(db, b):
    m = await db.get(Master, b.master_id)
    s = await db.get(Service, b.service_id)

    return {
        "id": b.id,
        "master_id": b.master_id,
        "service_id": b.service_id,
        "telegram_user_id": b.telegram_user_id,
        "client_name": b.client_name,
        "client_contact": b.client_contact,
        "reference_url": b.reference_url,
        "starts_at": as_iso(b.starts_at),
        "ends_at": as_iso(b.ends_at),
        "created_at": as_iso(b.created_at),
        "status": b.status,
        "notes": b.notes,
        "master_name": m.name if m else "Мастер",
        "service_title": s.title if s else "Услуга",
    }

async def get_hours(db, master_id, weekday):
    return await db.scalar(select(WorkingHour).where(WorkingHour.master_id==master_id, WorkingHour.weekday==weekday))
@router.get("/health")
async def health(): return {"status":"ok","app":settings.app_name}
@router.get("/me")
async def me(user: dict = Depends(current_user)): return {"telegram_user_id":user["id"],"is_admin":user["id"] in settings.admin_ids}
@router.get("/masters", response_model=list[MasterOut])
async def masters(db: AsyncSession=Depends(get_db)):
    return list(await db.scalars(select(Master).where(Master.is_active.is_(True)).order_by(Master.id)))
@router.get("/services", response_model=list[ServiceOut])
async def services(db: AsyncSession=Depends(get_db)):
    return list(await db.scalars(select(Service).where(Service.is_active.is_(True)).order_by(Service.id)))
@router.get("/appointments/availability")
async def availability(master_id: int, service_id: int, day: date, db: AsyncSession=Depends(get_db)):
    master, service = await db.get(Master,master_id), await db.get(Service,service_id)
    if not master or not master.is_active: raise HTTPException(404,"Master not found")
    if not service or not service.is_active: raise HTTPException(404,"Service not found")
    tz=ZoneInfo(settings.studio_timezone); hours=await get_hours(db,master_id,day.weekday())
    if hours and hours.is_closed: return {"day":day.isoformat(),"slots":[]}
    opening_s=hours.opens_at if hours else f"{settings.studio_open_hour:02d}:00"
    closing_s=hours.closes_at if hours else f"{settings.studio_close_hour:02d}:00"
    opening=datetime.combine(day,time.fromisoformat(opening_s),tzinfo=tz); closing=datetime.combine(day,time.fromisoformat(closing_s),tzinfo=tz)
    busy_rows=await db.scalars(select(Appointment).where(Appointment.master_id==master_id,Appointment.status.in_(ACTIVE),Appointment.starts_at<as_utc_naive(closing),Appointment.ends_at>as_utc_naive(opening)))
    busy=[]
    for b in busy_rows:
        a=b.starts_at.replace(tzinfo=timezone.utc) if b.starts_at.tzinfo is None else b.starts_at.astimezone(timezone.utc)
        z=b.ends_at.replace(tzinfo=timezone.utc) if b.ends_at.tzinfo is None else b.ends_at.astimezone(timezone.utc)
        busy.append((a,z))
    slots=[]; candidate=opening; step=timedelta(minutes=settings.slot_step_minutes); duration=timedelta(minutes=service.duration_minutes); now = get_now_utc()
    while candidate+duration<=closing:
        start=candidate.astimezone(timezone.utc); end=start+duration
        if start>now and not any(start<z and end>a for a,z in busy): slots.append({"starts_at":as_iso(start),"label":candidate.strftime("%H:%M")})
        candidate+=step
    return {"day":day.isoformat(),"slots":slots}
@router.post("/uploads/reference")
async def upload_reference(file: UploadFile=File(...), user: dict=Depends(current_user)):
    types={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}
    if file.content_type not in types: raise HTTPException(415,"Upload JPG, PNG or WebP image")
    data=await file.read(settings.max_upload_mb*1024*1024+1)
    if len(data)>settings.max_upload_mb*1024*1024: raise HTTPException(413,f"Maximum image size is {settings.max_upload_mb} MB")
    name=f"{user['id']}_{uuid.uuid4().hex}{types[file.content_type]}";(UPLOAD_DIR/name).write_bytes(data)
    return {"url":f"/uploads/{name}"}
@router.post("/appointments",status_code=201)
async def create_booking(payload: BookingCreate,user: dict=Depends(current_user),db: AsyncSession=Depends(get_db)):
    master,service=await db.get(Master,payload.master_id),await db.get(Service,payload.service_id)
    if not master or not master.is_active: raise HTTPException(404,"Master not found")
    if not service or not service.is_active: raise HTTPException(404,"Service not found")
    start=as_utc_naive(payload.starts_at); end=start+timedelta(minutes=service.duration_minutes)
    if start <= get_now_utc().replace(tzinfo=None):
        raise HTTPException(422, "Choose a future time")
    local_day=payload.starts_at.astimezone(ZoneInfo(settings.studio_timezone)).date(); hours=await get_hours(db,master.id,local_day.weekday())
    if hours and hours.is_closed: raise HTTPException(409,"Master is not working on this day")
    op=hours.opens_at if hours else f"{settings.studio_open_hour:02d}:00"; cl=hours.closes_at if hours else f"{settings.studio_close_hour:02d}:00"
    tz=ZoneInfo(settings.studio_timezone)
    opening=datetime.combine(local_day,time.fromisoformat(op),tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    closing=datetime.combine(local_day,time.fromisoformat(cl),tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    local_start=payload.starts_at.astimezone(tz)
    if start<opening or end>closing or local_start.minute%settings.slot_step_minutes!=0: raise HTTPException(422,"Selected time is outside the available schedule")
    conflict=await db.scalar(select(Appointment.id).where(Appointment.master_id==master.id,Appointment.status.in_(ACTIVE),Appointment.starts_at<end,Appointment.ends_at>start).limit(1))
    if conflict: raise HTTPException(409,"This time was just booked. Please choose another slot.")
    b=Appointment(master_id=master.id,service_id=service.id,telegram_user_id=user["id"],client_name=payload.client_name,client_contact=payload.client_contact,reference_url=payload.reference_url,starts_at=start,ends_at=end,notes=payload.notes,status="pending")
    db.add(b); await db.commit(); await db.refresh(b)
    when=payload.starts_at.astimezone(tz).strftime("%d.%m.%Y %H:%M")
    created = b.created_at.replace(tzinfo=timezone.utc) if b.created_at.tzinfo is None else b.created_at
    submitted = created.astimezone(tz).strftime("%d.%m.%Y %H:%M")
    await send_message(user["id"],f"INK HOUSE: Ваша заявка №{b.id} ожидает подтверждения.\nМастер: {master.name}\nУслуга: {service.title}\nВремя: {when}")
    for admin_id in settings.admin_ids: await send_message(admin_id,f"Новая заявка №{b.id}\nКлиент: {b.client_name}\nМастер: {master.name}\nУслуга: {service.title}\nВремя записи: {when}\nЗаявка подана: {submitted}")
    return await booking_json(db,b)

@router.get("/appointments/mine")
async def my_bookings(user: dict=Depends(current_user), db: AsyncSession=Depends(get_db)):
    # Нумеруем записи клиента по времени их СОЗДАНИЯ.
    # Отмены и переносы не меняют номера уже созданных записей.
    rows = list(await db.scalars(
        select(Appointment)
        .where(Appointment.telegram_user_id == user["id"])
        .order_by(Appointment.created_at.asc(), Appointment.id.asc())
    ))
    client_numbers = {booking.id: number for number, booking in enumerate(rows, start=1)}

    # В интерфейсе оставляем привычный порядок: ближайшие по дате записи сверху.
    rows.sort(key=lambda booking: (booking.starts_at, booking.id), reverse=True)
    result = []
    for booking in rows:
        item = await booking_json(db, booking)
        item["client_number"] = client_numbers[booking.id]
        result.append(item)
    return result
@router.post("/appointments/{booking_id}/cancel")
async def cancel_booking(booking_id:int,user:dict=Depends(current_user),db:AsyncSession=Depends(get_db)):
    b=await db.get(Appointment,booking_id)
    if not b or (b.telegram_user_id!=user["id"] and user["id"] not in settings.admin_ids): raise HTTPException(404,"Appointment not found")
    if b.status=="cancelled": return {"status":"cancelled"}
    booking_start = (
        b.starts_at.replace(tzinfo=timezone.utc)
        if b.starts_at.tzinfo is None
        else b.starts_at.astimezone(timezone.utc)
    )

    if booking_start <= get_now_utc():
        raise HTTPException(409, "Past appointments cannot be cancelled");await db.commit()
    for admin_id in settings.admin_ids: await send_message(admin_id,f"Запись №{b.id} отменена.")
    return {"status":"cancelled"}
@router.post("/appointments/{booking_id}/reschedule")
async def reschedule(booking_id:int,starts_at:datetime,user:dict=Depends(current_user),db:AsyncSession=Depends(get_db)):
    b=await db.get(Appointment,booking_id)
    if not b or (b.telegram_user_id!=user["id"] and user["id"] not in settings.admin_ids): raise HTTPException(404,"Appointment not found")
    if b.status=="cancelled": raise HTTPException(409,"Cancelled appointment cannot be rescheduled")
    service=await db.get(Service,b.service_id)
    if starts_at.tzinfo is None: raise HTTPException(422,"Datetime must include timezone")
    start=as_utc_naive(starts_at); end=start+timedelta(minutes=service.duration_minutes)
    local=starts_at.astimezone(ZoneInfo(settings.studio_timezone)); hours=await get_hours(db,b.master_id,local.weekday())
    if hours and hours.is_closed: raise HTTPException(409,"Master is not working on this day")
    op=hours.opens_at if hours else f"{settings.studio_open_hour:02d}:00"; cl=hours.closes_at if hours else f"{settings.studio_close_hour:02d}:00"
    opening=datetime.combine(local.date(),time.fromisoformat(op),tzinfo=ZoneInfo(settings.studio_timezone)).astimezone(timezone.utc).replace(tzinfo=None)
    closing=datetime.combine(local.date(),time.fromisoformat(cl),tzinfo=ZoneInfo(settings.studio_timezone)).astimezone(timezone.utc).replace(tzinfo=None)
    if start <= get_now_utc().replace(tzinfo=None) or start<opening or end>closing or local.minute%settings.slot_step_minutes!=0:
        raise HTTPException(422,"Selected time is outside the available schedule")
    conflict=await db.scalar(select(Appointment.id).where(Appointment.master_id==b.master_id,Appointment.id!=b.id,Appointment.status.in_(ACTIVE),Appointment.starts_at<end,Appointment.ends_at>start).limit(1))
    if conflict: raise HTTPException(409,"This time overlaps another appointment")
    b.starts_at,b.ends_at,b.status=start,end,"pending";await db.commit();await db.refresh(b)
    return await booking_json(db,b)
@router.get("/admin/appointments")
async def admin_bookings(user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    rows=await db.scalars(select(Appointment).order_by(Appointment.starts_at.desc()).limit(300));return [await booking_json(db,b) for b in rows]
@router.patch("/admin/appointments/{booking_id}/status")
async def set_status(booking_id:int,status:str,user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    if status not in {"pending","confirmed","cancelled"}: raise HTTPException(422,"Invalid status")
    b=await db.get(Appointment,booking_id)
    if not b: raise HTTPException(404,"Appointment not found")
    b.status=status;await db.commit();await db.refresh(b)
    msg={"confirmed":"Запись подтверждена!","cancelled":"Запись отменена салоном.","pending":"Запись ожидает подтверждения."}[status]
    await send_message(b.telegram_user_id,f"INK HOUSE · Запись №{b.id}\n{msg}")
    return await booking_json(db,b)
@router.get("/admin/masters",response_model=list[MasterOut])
async def admin_masters(user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    return list(await db.scalars(select(Master).order_by(Master.id)))
@router.post("/admin/masters",response_model=MasterOut,status_code=201)
async def add_master(data:MasterCreate,user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    m=Master(**data.model_dump());db.add(m);await db.commit();await db.refresh(m)
    for wd in range(7): db.add(WorkingHour(master_id=m.id,weekday=wd,opens_at="10:00",closes_at="20:00",is_closed=wd==6))
    await db.commit();return m
@router.patch("/admin/masters/{master_id}/active")
async def master_active(master_id:int,is_active:bool,user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    m=await db.get(Master,master_id)
    if not m: raise HTTPException(404,"Master not found")
    m.is_active=is_active;await db.commit();return {"id":m.id,"is_active":m.is_active}
@router.get("/admin/services",response_model=list[ServiceOut])
async def admin_services(user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    return list(await db.scalars(select(Service).order_by(Service.id)))
@router.post("/admin/services",response_model=ServiceOut,status_code=201)
async def add_service(data:ServiceCreate,user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    s=Service(**data.model_dump());db.add(s);await db.commit();await db.refresh(s);return s
@router.patch("/admin/services/{service_id}/active")
async def service_active(service_id:int,is_active:bool,user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    s=await db.get(Service,service_id)
    if not s: raise HTTPException(404,"Service not found")
    s.is_active=is_active;await db.commit();return {"id":s.id,"is_active":s.is_active}
@router.get("/admin/masters/{master_id}/working-hours",response_model=list[WorkingHourOut])
async def get_working_hours(master_id:int,user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    if not await db.get(Master,master_id): raise HTTPException(404,"Master not found")
    rows=await db.scalars(select(WorkingHour).where(WorkingHour.master_id==master_id).order_by(WorkingHour.weekday));return list(rows)
@router.put("/admin/masters/{master_id}/working-hours")
async def save_working_hours(master_id:int,hours:list[WorkingHourIn],user:dict=Depends(admin_user),db:AsyncSession=Depends(get_db)):
    if not await db.get(Master,master_id): raise HTTPException(404,"Master not found")
    if len({h.weekday for h in hours})!=len(hours): raise HTTPException(422,"Duplicate weekdays")
    for h in hours:
        if not h.is_closed and h.opens_at>=h.closes_at: raise HTTPException(422,"Closing time must be later than opening time")
        row=await db.scalar(select(WorkingHour).where(WorkingHour.master_id==master_id,WorkingHour.weekday==h.weekday))
        if row: row.opens_at,row.closes_at,row.is_closed=h.opens_at,h.closes_at,h.is_closed
        else: db.add(WorkingHour(master_id=master_id,weekday=h.weekday,opens_at=h.opens_at,closes_at=h.closes_at,is_closed=h.is_closed))
    await db.commit();rows=await db.scalars(select(WorkingHour).where(WorkingHour.master_id==master_id).order_by(WorkingHour.weekday));return list(rows)

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
class MasterCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    bio: str = Field(default="", max_length=2000)
    styles: str = Field(default="", max_length=250)
    photo_url: str = Field(default="", max_length=500)
class MasterOut(MasterCreate):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)
class ServiceCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    duration_minutes: int = Field(ge=30, le=720)
    price_from: int = Field(ge=0, le=10000000)
class ServiceOut(ServiceCreate):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)
class BookingCreate(BaseModel):
    master_id: int
    service_id: int
    client_name: str = Field(min_length=2, max_length=120)
    client_contact: str = Field(default="", max_length=120)
    reference_url: str = Field(default="", max_length=500)
    starts_at: datetime
    notes: str = Field(default="", max_length=2000)
    @field_validator("starts_at")
    @classmethod
    def tz_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None: raise ValueError("starts_at must include timezone")
        return value
class WorkingHourIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    opens_at: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    closes_at: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    is_closed: bool = False
class WorkingHourOut(WorkingHourIn):
    id: int
    master_id: int
    model_config = ConfigDict(from_attributes=True)

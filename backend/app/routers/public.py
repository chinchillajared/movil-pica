from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..email_sender import send_new_appointment_email
from ..event_manager import event_manager
from ..ratelimit import rate_limit

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/site/settings")
def get_site_settings(db: Session = Depends(get_db)):
    obj = crud.get_site_settings(db)
    return {"logo_data_url": obj.logo_data_url}


@router.post(
    "/appointments",
    response_model=schemas.AppointmentCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(max_requests=15, window_seconds=60))],
)
def create_appointment(
    payload: schemas.AppointmentCreate, db: Session = Depends(get_db)
):
    try:
        obj = crud.create_appointment(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    send_new_appointment_email(
        db=db,
        appointment_number=obj.appointment_number,
        first_name=obj.first_name,
        last_name=obj.last_name,
        phone=obj.phone,
        plate=obj.plate,
        appointment_date=obj.appointment_date,
        appointment_time=obj.appointment_time,
        address=obj.address,
        client_email=obj.email,
    )
    from ..whatsapp_sender import send_appointment_created_message

    send_appointment_created_message(
        db=db,
        appointment_number=obj.appointment_number,
        first_name=obj.first_name,
        last_name=obj.last_name,
        phone=obj.phone,
        country_code=obj.country_code,
        plate=obj.plate,
        appointment_date=obj.appointment_date,
        appointment_time=obj.appointment_time,
        address=obj.address,
    )
    event_manager.publish("appointment", {"type": "created", "number": obj.appointment_number})
    return schemas.AppointmentCreateResponse(
        appointment_number=obj.appointment_number, plate=obj.plate, status=obj.status
    )


@router.get("/appointments/taken-dates")
def get_taken_dates(
    year: int = Query(...),
    month: int = Query(...),
    exclude: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from_date = date(year, month, 1)
    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1
    to_date = date(next_year, next_month, 1) - timedelta(days=1)
    exclude_dates = None
    if exclude:
        appt = crud.get_by_number(db, exclude)
        if appt:
            settings = crud.get_appointment_time_settings(db)
            span = settings.value if settings.unit == "days" else 1
            exclude_dates = [appt.appointment_date + timedelta(days=i) for i in range(span)]
    taken = crud.get_taken_dates(db, from_date, to_date, exclude_dates=exclude_dates)
    return [d.isoformat() for d in taken]


@router.get("/schedule")
def get_schedule(db: Session = Depends(get_db)):
    s = crud.get_work_schedule(db)
    return {"days": s.days}


@router.get("/appointments/times")
def get_taken_times(for_date: date = Query(...), db: Session = Depends(get_db)):
    return crud.get_taken_times(db, for_date)


@router.get("/appointments/lookup", response_model=schemas.AppointmentStatusView)
def lookup_appointment(phone: str, plate: str, db: Session = Depends(get_db)):
    phone = phone.strip()
    plate = plate.strip().upper()
    obj = crud.get_by_phone_and_plate(db, phone, plate)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No appointment found with those details",
        )
    return schemas.AppointmentStatusView(
        appointment_number=obj.appointment_number,
        first_name=obj.first_name,
        last_name=obj.last_name,
        phone=obj.phone,
        country_code=obj.country_code,
        plate=obj.plate,
        appointment_date=obj.appointment_date,
        appointment_time=obj.appointment_time,
        address=obj.address,
        status=obj.status,
    )


@router.patch("/appointments/{number}/cancel")
def cancel_appointment(
    number: str,
    payload: schemas.AppointmentVerify,
    db: Session = Depends(get_db),
):
    obj = crud.get_by_number(db, number)
    if not obj:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if obj.status == "cancelled":
        raise HTTPException(status_code=400, detail="Appointment is already cancelled")
    if obj.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed appointment")
    if obj.phone != payload.phone.strip() or obj.plate != payload.plate.strip().upper():
        raise HTTPException(status_code=403, detail="Phone and plate do not match this appointment")
    crud.update_status(db, obj, "cancelled")
    event_manager.publish("appointment", {"type": "updated", "number": number, "status": "cancelled"})
    return {"appointment_number": obj.appointment_number, "status": obj.status}


@router.put("/appointments/{number}", response_model=schemas.AppointmentStatusView)
def update_appointment(
    number: str,
    payload: schemas.AppointmentUpdate,
    db: Session = Depends(get_db),
):
    obj = crud.get_by_number(db, number)
    if not obj:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if obj.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot edit a cancelled appointment")
    if obj.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot edit a completed appointment")
    if obj.phone != payload.phone.strip() or obj.plate != payload.plate.strip().upper():
        raise HTTPException(status_code=403, detail="Phone and plate do not match this appointment")
    obj.appointment_date = payload.appointment_date
    obj.appointment_time = payload.appointment_time
    if payload.first_name is not None:
        obj.first_name = payload.first_name
    if payload.last_name is not None:
        obj.last_name = payload.last_name
    if payload.new_phone is not None:
        obj.phone = payload.new_phone
    if payload.new_country_code is not None:
        obj.country_code = payload.new_country_code
    if payload.address is not None:
        obj.address = payload.address
    db.commit()
    db.refresh(obj)
    event_manager.publish("appointment", {"type": "updated", "number": number})
    return schemas.AppointmentStatusView(
        appointment_number=obj.appointment_number,
        first_name=obj.first_name,
        last_name=obj.last_name,
        phone=obj.phone,
        country_code=obj.country_code,
        plate=obj.plate,
        appointment_date=obj.appointment_date,
        appointment_time=obj.appointment_time,
        address=obj.address,
        status=obj.status,
    )


@router.get("/announcements/active")
def get_active_announcements(db: Session = Depends(get_db)):
    from datetime import datetime
    now = datetime.utcnow()
    result = []
    for ann in crud.get_active_announcements(db):
        if ann.is_permanent:
            result.append(ann)
            continue
        created = ann.created_at.replace(tzinfo=None) if ann.created_at else now
        if (now - created).total_seconds() > ann.duration_hours * 3600:
            ann.is_active = False
            db.commit()
            continue
        result.append(ann)
    return result

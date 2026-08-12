"""WhatsApp notifications via Kapso (Meta-compatible WhatsApp Cloud API).

Messages are only sent when the mechanic has activated the integration
(WhatsAppSettings singleton). Appointment notifications never raise: a
failure is swallowed and reported as None so booking still succeeds.
"""

import re
from datetime import date, time
from typing import Optional

import requests
from sqlalchemy.orm import Session

from . import crud

KAPSO_BASE_URL = "https://api.kapso.ai/meta/whatsapp/v24.0"


class WhatsAppSendError(Exception):
    pass


def normalize_phone(country_code: str, phone: str) -> str:
    """Join country code + local number and strip to digits (E.164 without +)."""
    return re.sub(r"\D", "", (country_code or "") + (phone or ""))


def send_whatsapp_message(
    db: Session, to: str, body: str, timeout: int = 20
) -> Optional[str]:
    """Send a plain-text WhatsApp message via Kapso. Returns "whatsapp" or None."""
    s = crud.get_whatsapp_settings(db)
    if not s.activated or not s.api_key or not s.phone_number_id:
        return None
    to = re.sub(r"\D", "", to or "")
    if not to:
        return None
    url = f"{KAPSO_BASE_URL}/{s.phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }
    resp = requests.post(
        url,
        json=payload,
        headers={"X-API-Key": s.api_key},
        timeout=timeout,
    )
    if resp.status_code not in (200, 201):
        raise WhatsAppSendError(
            f"Kapso send failed ({resp.status_code}): {resp.text[:300]}"
        )
    return "whatsapp"


def _to_12h(t: time) -> str:
    h = t.hour
    ampm = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    return f"{h12}:{t.strftime('%M')}{ampm}"


def send_appointment_created_message(
    db: Session,
    appointment_number: str,
    first_name: str,
    last_name: str,
    phone: str,
    country_code: str,
    plate: str,
    appointment_date: date,
    appointment_time: time,
    address: str,
) -> Optional[str]:
    to = normalize_phone(country_code, phone)
    if not to:
        return None
    body = (
        f"Hola {first_name} {last_name}, tu cita fue creada correctamente.\n\n"
        f"Numero: {appointment_number}\n"
        f"Placa: {plate}\n"
        f"Fecha: {appointment_date}\n"
        f"Hora: {_to_12h(appointment_time)}\n"
        f"Direccion: {address if address else 'Por confirmar'}\n\n"
        "Nuestro mecanico te confirmara la visita pronto."
    )
    try:
        return send_whatsapp_message(db, to, body)
    except Exception:
        return None


def send_appointment_confirmed_message(
    db: Session,
    appointment_number: str,
    first_name: str,
    last_name: str,
    phone: str,
    country_code: str,
    plate: str,
    appointment_date: date,
    appointment_time: time,
    address: str,
) -> Optional[str]:
    to = normalize_phone(country_code, phone)
    if not to:
        return None
    body = (
        f"Hola {first_name} {last_name}, tu cita fue confirmada por nuestro mecanico.\n\n"
        f"Numero: {appointment_number}\n"
        f"Placa: {plate}\n"
        f"Fecha: {appointment_date}\n"
        f"Hora: {_to_12h(appointment_time)}\n"
        f"Direccion: {address if address else 'Por confirmar'}\n\n"
        "Te esperamos."
    )
    try:
        return send_whatsapp_message(db, to, body)
    except Exception:
        return None

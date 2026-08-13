"""Email sending via Gmail API (OAuth2.0) with SMTP fallback.

If the Gmail integration is activated (refresh_token stored) the sender uses
the Gmail API with the OAuth credentials saved in the DB. Otherwise it falls
back to the legacy SMTP env credentials, and finally fails silently.
"""

import base64
import json
from datetime import date, time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import requests
from sqlalchemy.orm import Session

from . import crud
from .config import settings

GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send"


class GmailSendError(Exception):
    pass


def _gmail_authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GMAIL_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
        f"{k}={requests.utils.quote(str(v), safe='')}" for k, v in params.items()
    )


def gmail_redirect_uri() -> str:
    return settings.SITE_URL.rstrip("/") + settings.GMAIL_REDIRECT_PATH


def exchange_code_for_tokens(
    client_id: str, client_secret: str, code: str
) -> dict:
    resp = requests.post(
        GMAIL_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": gmail_redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise GmailSendError(
            f"Token exchange failed ({resp.status_code}): {resp.text[:300]}"
        )
    payload = resp.json()
    if "refresh_token" not in payload:
        raise GmailSendError("No refresh_token returned by Google")
    return payload


def _refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    resp = requests.post(
        GMAIL_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise GmailSendError(
            f"Token refresh failed ({resp.status_code}): {resp.text[:300]}"
        )
    return resp.json()["access_token"]


def send_html_email(
    db: Session, to: str, subject: str, html: str
) -> Optional[str]:
    """Send an HTML email. Returns a provider marker or None if skipped."""
    gmail = crud.get_gmail_settings(db)
    if gmail.activated and gmail.refresh_token and gmail.client_id:
        return _send_via_gmail(
            client_id=gmail.client_id,
            client_secret=gmail.client_secret,
            refresh_token=gmail.refresh_token,
            from_email=gmail.from_email,
            to=to,
            subject=subject,
            html=html,
        )

    # Legacy SMTP fallback (env based), kept for environments without Gmail.
    addr = settings.EMAIL_ADDRESS
    password = settings.EMAILAPP_PASSWORD
    if addr and password:
        return _send_via_smtp(addr, password, to, subject, html)
    return None


def _send_via_gmail(client_id, client_secret, refresh_token, from_email, to, subject, html) -> str:
    access_token = _refresh_access_token(client_id, client_secret, refresh_token)
    msg = MIMEMultipart("alternative")
    msg["From"] = from_email
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html", "utf-8"))
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    resp = requests.post(
        GMAIL_SEND_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json={"raw": raw},
        timeout=20,
    )
    if resp.status_code != 200:
        raise GmailSendError(f"Gmail send failed ({resp.status_code}): {resp.text[:300]}")
    return "gmail"


def _send_via_smtp(addr, password, to, subject, html) -> str:
    import smtplib

    msg = MIMEMultipart("alternative")
    msg["From"] = addr
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(addr, password)
        server.sendmail(addr, [to], msg.as_string())
    return "smtp"


def _to_12h(t: time) -> str:
    h = t.hour
    ampm = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    return f"{h12}:{t.strftime('%M')}{ampm}"


def _build_appointment_html(appointment_number, first_name, last_name, phone, plate, appointment_date, appointment_time, address):
    time_12h = _to_12h(appointment_time)
    addr = address if address else "—"
    site_url = settings.SITE_URL.rstrip("/")

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="background:#1d4ed8;padding:20px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Nueva cita agendada</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">New appointment scheduled</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Número / Number</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:16px;font-weight:700;font-family:monospace;">{appointment_number}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Nombre / Name</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:15px;">{first_name} {last_name}</p>
                  </td>
                  <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Teléfono / Phone</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:15px;">{phone}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Número de placa / Plate number</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:15px;font-weight:600;">{plate}</p>
                  </td>
                  <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Fecha / Date</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:15px;">{appointment_date}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Hora / Time</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:15px;font-weight:600;">{time_12h}</p>
                  </td>
                  <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                    <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Dirección / Address</span>
                    <p style="margin:2px 0 0;color:#1e293b;font-size:15px;word-break:break-all;">{addr}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;">
              <a href="{site_url}/mechanic/dashboard.html" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;">Ver en el panel del mecánico &rarr; View in mechanic panel</a>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 16px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Mecánico Móvil &middot; {appointment_date}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_new_appointment_email(
    db: Session,
    appointment_number: str,
    first_name: str,
    last_name: str,
    phone: str,
    plate: str,
    appointment_date: date,
    appointment_time: time,
    address: str,
    client_email: Optional[str] = None,
) -> Optional[str]:
    subject = f"Nueva cita / New appointment — {appointment_number}"
    html = _build_appointment_html(
        appointment_number, first_name, last_name, phone, plate,
        appointment_date, appointment_time, address,
    )
    result = None
    gmail = crud.get_gmail_settings(db)
    self_target = (gmail.from_email if gmail.activated else settings.EMAIL_ADDRESS) or None
    if self_target:
        try:
            result = send_html_email(db, self_target, subject, html)
        except Exception:
            pass
    if client_email:
        try:
            result = send_html_email(db, client_email, subject, html) or result
        except Exception:
            pass
    return result


def send_account_email(
    db: Session, to: str, subject: str, html: str
) -> Optional[str]:
    try:
        return send_html_email(db, to, subject, html)
    except Exception:
        return None

"""Username + password accounts behind an invite code. No email needed for a friends group."""
import hashlib
import hmac
import os
import secrets

from fastapi import Cookie, HTTPException

from . import db

COOKIE = "ad_session"


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, salt_hex, dk_hex = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(dk.hex(), dk_hex)


def invite_ok(code: str) -> bool:
    expected = os.environ.get("AD_INVITE_CODE", "")
    if not expected:
        # No code configured: only allow the very first account (the admin) to register.
        with db.tx() as c:
            return c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    return hmac.compare_digest(code.strip(), expected)


def new_session(c, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    c.execute("INSERT INTO sessions(token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def current_user(ad_session: str | None = Cookie(default=None)) -> dict:
    if not ad_session:
        raise HTTPException(401, "Not logged in")
    with db.tx() as c:
        u = c.execute(
            "SELECT u.id, u.username, u.display_name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
            (ad_session,),
        ).fetchone()
    if not u:
        raise HTTPException(401, "Session expired")
    return dict(u)


def admin_user(ad_session: str | None = Cookie(default=None)) -> dict:
    u = current_user(ad_session)
    if not u["is_admin"]:
        raise HTTPException(403, "Admins only")
    return u

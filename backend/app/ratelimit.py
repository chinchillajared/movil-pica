"""Lightweight in-memory per-IP rate limiter to blunt DDoS / brute force.

Suitable for a single-instance deployment. Keyed by client IP with a sliding
window. Each endpoint that opts in gets its own limiter instance.
"""

import threading
import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status

from .config import settings


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            window = [t for t in self._hits[key] if now - t < self.window_seconds]
            self._hits[key] = window
            if len(window) >= self.max_requests:
                return False
            window.append(now)
            return True


def rate_limit(
    max_requests: int | None = None, window_seconds: int | None = None
) -> Callable[[Request], None]:
    max_requests = max_requests or settings.RATE_LIMIT_MAX
    window_seconds = window_seconds or settings.RATE_LIMIT_WINDOW
    limiter = RateLimiter(max_requests, window_seconds)

    def dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        if not limiter.allow(ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, please slow down",
            )

    return dependency

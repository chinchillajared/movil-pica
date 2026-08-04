import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..event_manager import event_manager

router = APIRouter(prefix="/api/events", tags=["events"])


async def event_generator(request: Request):
    sid, q = event_manager.subscribe()
    try:
        yield ":\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                msg = await asyncio.to_thread(q.get, timeout=30)
                yield msg
            except asyncio.TimeoutError:
                yield ":\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        event_manager.unsubscribe(sid)


@router.get("/stream")
async def stream_events(request: Request):
    return StreamingResponse(
        event_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

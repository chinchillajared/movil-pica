import json
import queue
import threading
from typing import Any


class EventManager:
    def __init__(self):
        self._subscribers: dict[int, queue.Queue] = {}
        self._lock = threading.Lock()
        self._next_id = 0

    def subscribe(self) -> tuple[int, queue.Queue]:
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            sid = self._next_id
            self._next_id += 1
            self._subscribers[sid] = q
        return sid, q

    def unsubscribe(self, sid: int) -> None:
        with self._lock:
            self._subscribers.pop(sid, None)

    def publish(self, event: str, data: dict[str, Any]) -> None:
        payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        with self._lock:
            for sid, q in list(self._subscribers.items()):
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass


event_manager = EventManager()

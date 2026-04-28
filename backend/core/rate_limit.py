"""Simple in-memory rate limiting for audit endpoints."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import DefaultDict, Tuple

_buckets: DefaultDict[str, list[float]] = defaultdict(list)


def check_rate_limit(client_id: str, max_events: int, window_seconds: int = 3600) -> Tuple[bool, int]:
    """
    Return whether a client is within a sliding-window rate limit.

    Args:
        client_id: Identifier (IP, user id, or API key).
        max_events: Maximum allowed events in the window.
        window_seconds: Window length in seconds.

    Returns:
        Tuple ``(allowed, retry_after_seconds)`` where ``retry_after_seconds`` is 0 if allowed.
    """
    now = time.time()
    window_start = now - window_seconds
    events = _buckets[client_id]
    while events and events[0] < window_start:
        events.pop(0)
    if len(events) >= max_events:
        retry = int(max(0, window_seconds - (now - events[0])))
        return False, retry
    events.append(now)
    return True, 0


__all__ = ["check_rate_limit"]

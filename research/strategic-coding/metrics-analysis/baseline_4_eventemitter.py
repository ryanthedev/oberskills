from typing import Callable, Dict, List, Any


class EventEmitter:
    def __init__(self):
        self._listeners: Dict[str, List[Callable]] = {}

    def on(self, event: str, callback: Callable) -> None:
        """Subscribe to an event."""
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)

    def emit(self, event: str, *args, **kwargs) -> None:
        """Emit an event with data."""
        if event in self._listeners:
            for callback in self._listeners[event]:
                callback(*args, **kwargs)

    def off(self, event: str, callback: Callable) -> None:
        """Unsubscribe from an event."""
        if event in self._listeners:
            self._listeners[event].remove(callback)
            if not self._listeners[event]:
                del self._listeners[event]

    def once(self, event: str, callback: Callable) -> None:
        """Subscribe to an event that only fires once."""
        def wrapper(*args, **kwargs):
            callback(*args, **kwargs)
            self.off(event, wrapper)
        self.on(event, wrapper)

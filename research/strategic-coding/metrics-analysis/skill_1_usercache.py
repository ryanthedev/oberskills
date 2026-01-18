import threading
import time
from typing import Optional, TypeVar, Generic, Dict, Tuple

T = TypeVar('T')


class UserCache(Generic[T]):
    """
    Thread-safe cache for user objects with automatic expiration after 5 minutes.

    Interface:
    - get(user_id): Retrieve cached user or None if expired
    - set(user_id, user): Store a user object
    - delete(user_id): Remove a specific user
    - clear(): Clear all cached users
    """

    EXPIRATION_TIME = 5 * 60  # 5 minutes in seconds
    CLEANUP_INTERVAL = 60    # Cleanup every minute

    def __init__(self):
        self._cache: Dict[str, Tuple[T, float]] = {}
        self._lock = threading.RLock()
        self._cleanup_thread = threading.Thread(
            target=self._cleanup_loop, daemon=True
        )
        self._cleanup_thread.start()

    def get(self, user_id: str) -> Optional[T]:
        """Retrieve a user by ID. Returns None if not cached or expired."""
        with self._lock:
            if user_id not in self._cache:
                return None

            user, timestamp = self._cache[user_id]

            # Check if expired
            if time.time() - timestamp > self.EXPIRATION_TIME:
                del self._cache[user_id]
                return None

            return user

    def set(self, user_id: str, user: T) -> None:
        """Store a user object in cache with current timestamp."""
        with self._lock:
            self._cache[user_id] = (user, time.time())

    def delete(self, user_id: str) -> None:
        """Remove a specific user from cache."""
        with self._lock:
            self._cache.pop(user_id, None)

    def clear(self) -> None:
        """Clear all cached users."""
        with self._lock:
            self._cache.clear()

    def _cleanup_loop(self) -> None:
        """Background thread that periodically removes expired entries."""
        while True:
            time.sleep(self.CLEANUP_INTERVAL)
            self._cleanup_expired()

    def _cleanup_expired(self) -> None:
        """Remove all expired entries from cache."""
        with self._lock:
            current_time = time.time()
            expired_ids = [
                user_id for user_id, (_, timestamp) in self._cache.items()
                if current_time - timestamp > self.EXPIRATION_TIME
            ]
            for user_id in expired_ids:
                del self._cache[user_id]

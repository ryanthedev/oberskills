import threading
import time
from typing import Optional, Any, Dict


class UserCache:
    def __init__(self, expiration_time: int = 300):
        """
        Initialize UserCache with optional custom expiration time.

        Args:
            expiration_time: Time in seconds before cache entries expire (default: 300 seconds = 5 minutes)
        """
        self._cache: Dict[Any, tuple] = {}
        self._lock = threading.RLock()
        self._expiration_time = expiration_time

    def get(self, user_id: Any) -> Optional[Any]:
        """
        Retrieve a user object from cache by ID.
        Returns None if not found or expired.

        Args:
            user_id: The user ID to retrieve

        Returns:
            The cached user object or None
        """
        with self._lock:
            if user_id not in self._cache:
                return None

            user_obj, timestamp = self._cache[user_id]

            if time.time() - timestamp > self._expiration_time:
                del self._cache[user_id]
                return None

            return user_obj

    def set(self, user_id: Any, user_obj: Any) -> None:
        """
        Store a user object in cache by ID.

        Args:
            user_id: The user ID as cache key
            user_obj: The user object to cache
        """
        with self._lock:
            self._cache[user_id] = (user_obj, time.time())

    def delete(self, user_id: Any) -> bool:
        """
        Remove a user object from cache by ID.

        Args:
            user_id: The user ID to delete

        Returns:
            True if user was deleted, False if not found
        """
        with self._lock:
            if user_id in self._cache:
                del self._cache[user_id]
                return True
            return False

    def clear(self) -> None:
        """Clear all cached users."""
        with self._lock:
            self._cache.clear()

    def size(self) -> int:
        """Return the number of cached items."""
        with self._lock:
            return len(self._cache)

    def cleanup_expired(self) -> int:
        """
        Remove all expired entries from cache.

        Returns:
            Number of entries removed
        """
        with self._lock:
            current_time = time.time()
            expired_keys = [
                key for key, (_, timestamp) in self._cache.items()
                if current_time - timestamp > self._expiration_time
            ]

            for key in expired_keys:
                del self._cache[key]

            return len(expired_keys)

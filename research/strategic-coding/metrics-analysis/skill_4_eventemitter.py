class EventEmitter:
    """
    A simple, thread-safe event emitter for publishing and subscribing to named events.

    Supports multiple listeners per event, clean unsubscription, and error handling.
    """

    def __init__(self):
        self._listeners = {}  # {event_name: [(sub_id, callback), ...]}
        self._next_id = 0

    def subscribe(self, event_name, callback):
        """
        Subscribe to an event by name.

        Args:
            event_name (str): Name of the event to listen for
            callback (callable): Function to call when event is emitted

        Returns:
            int: Subscription ID for unsubscribing

        Raises:
            TypeError: If callback is not callable
        """
        if not callable(callback):
            raise TypeError(f"callback must be callable, got {type(callback)}")

        if event_name not in self._listeners:
            self._listeners[event_name] = []

        sub_id = self._next_id
        self._next_id += 1
        self._listeners[event_name].append((sub_id, callback))

        return sub_id

    def unsubscribe(self, event_name, subscription_id):
        """
        Unsubscribe from an event.

        Args:
            event_name (str): Name of the event
            subscription_id (int): ID returned from subscribe()

        Returns:
            bool: True if subscription was found and removed, False otherwise
        """
        if event_name not in self._listeners:
            return False

        listeners = self._listeners[event_name]
        original_len = len(listeners)
        self._listeners[event_name] = [(sid, cb) for sid, cb in listeners if sid != subscription_id]

        if len(self._listeners[event_name]) == 0:
            del self._listeners[event_name]

        return len(listeners) > len(self._listeners.get(event_name, []))

    def emit(self, event_name, *args, **kwargs):
        """
        Emit an event to all subscribed listeners.

        Args:
            event_name (str): Name of the event to emit
            *args: Positional arguments to pass to listeners
            **kwargs: Keyword arguments to pass to listeners

        Returns:
            bool: True if any listeners were called, False if no listeners

        Raises:
            RuntimeError: If any listener raises an exception and suppress_errors=False
        """
        if event_name not in self._listeners:
            return False

        listeners = self._listeners[event_name][:]  # Copy to allow modifications during iteration
        errors = []

        for sub_id, callback in listeners:
            try:
                callback(*args, **kwargs)
            except Exception as e:
                errors.append((sub_id, e))

        if errors:
            if len(errors) == 1:
                raise errors[0][1]
            else:
                error_msg = f"{len(errors)} listener(s) raised exceptions"
                raise RuntimeError(error_msg) from errors[0][1]

        return True

    def listeners(self, event_name):
        """
        Get the number of listeners for an event.

        Args:
            event_name (str): Name of the event

        Returns:
            int: Number of listeners subscribed to the event
        """
        return len(self._listeners.get(event_name, []))

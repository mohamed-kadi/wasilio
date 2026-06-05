package com.nexora.backend.domain.event;

public class EventConcurrencyException extends RuntimeException {
    public EventConcurrencyException(String message) {
        super(message);
    }

    public EventConcurrencyException(String message, Throwable cause) {
        super(message, cause);
    }
}

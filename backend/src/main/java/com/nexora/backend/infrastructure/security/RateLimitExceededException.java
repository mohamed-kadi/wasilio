package com.nexora.backend.infrastructure.security;

import java.time.Duration;

public class RateLimitExceededException extends RuntimeException {

    private final Duration retryAfter;

    public RateLimitExceededException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }

    public long getRetryAfterSeconds() {
        return Math.max(1, retryAfter.toSeconds());
    }
}

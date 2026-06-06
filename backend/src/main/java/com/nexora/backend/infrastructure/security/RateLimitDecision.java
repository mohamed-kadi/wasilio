package com.nexora.backend.infrastructure.security;

import java.time.Duration;

public record RateLimitDecision(
        boolean allowed,
        Duration retryAfter,
        String scope
) {
    public static RateLimitDecision allow() {
        return new RateLimitDecision(true, Duration.ZERO, "");
    }

    public static RateLimitDecision denied(Duration retryAfter, String scope) {
        return new RateLimitDecision(false, retryAfter, scope);
    }
}

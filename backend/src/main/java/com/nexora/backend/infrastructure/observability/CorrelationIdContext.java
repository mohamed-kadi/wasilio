package com.nexora.backend.infrastructure.observability;

import java.util.Optional;
import java.util.UUID;

public final class CorrelationIdContext {

    public static final String HEADER_NAME = "X-Correlation-ID";
    public static final String MDC_KEY = "correlationId";
    public static final String TENANT_MDC_KEY = "tenantId";

    private static final ThreadLocal<UUID> CURRENT_ID = new ThreadLocal<>();

    private CorrelationIdContext() {
    }

    public static void set(UUID correlationId) {
        CURRENT_ID.set(correlationId);
    }

    public static Optional<UUID> get() {
        return Optional.ofNullable(CURRENT_ID.get());
    }

    public static String getRequiredString() {
        return get().map(UUID::toString).orElse("");
    }

    public static void clear() {
        CURRENT_ID.remove();
    }
}

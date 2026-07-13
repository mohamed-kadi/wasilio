package com.nexora.backend.application;

public record PublicProductReadinessItemResponse(
        String key,
        String label,
        boolean complete,
        boolean required,
        String detail
) {}

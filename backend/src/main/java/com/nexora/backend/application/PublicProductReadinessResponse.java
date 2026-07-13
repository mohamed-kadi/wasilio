package com.nexora.backend.application;

import java.util.List;

public record PublicProductReadinessResponse(
        boolean orderable,
        int requiredComplete,
        int requiredTotal,
        List<PublicProductReadinessItemResponse> items
) {
    public PublicProductReadinessResponse {
        items = items == null ? List.of() : List.copyOf(items);
    }
}

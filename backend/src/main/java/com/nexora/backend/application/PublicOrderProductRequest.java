package com.nexora.backend.application;

import java.util.UUID;

public record PublicOrderProductRequest(
        UUID productId,
        String productSlug,
        String variantId
) {}

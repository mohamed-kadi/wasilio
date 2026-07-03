package com.nexora.backend.application;

import java.util.UUID;

public record PublicProductResponse(
        UUID productId,
        String productSlug,
        String productName,
        String description,
        String imageUrl
) {}

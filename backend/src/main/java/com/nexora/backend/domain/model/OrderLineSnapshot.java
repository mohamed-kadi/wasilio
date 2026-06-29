package com.nexora.backend.domain.model;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderLineSnapshot(
        UUID productId,
        String productName,
        String sku,
        BigDecimal unitPrice,
        String currency,
        int quantity,
        BigDecimal lineTotal
) {}

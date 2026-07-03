package com.nexora.backend.application;

import java.math.BigDecimal;

public record PublicOfferResponse(
        BigDecimal price,
        String currency,
        String availability,
        boolean orderable
) {}

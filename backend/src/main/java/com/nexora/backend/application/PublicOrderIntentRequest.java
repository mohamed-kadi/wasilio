package com.nexora.backend.application;

public record PublicOrderIntentRequest(
        PublicOrderSelectionRequest selection,
        PublicOrderCustomerRequest customer,
        PublicOrderDeliveryRequest delivery,
        String idempotencyKey,
        String correlationId,
        PublicOrderAttributionRequest attribution
) {}

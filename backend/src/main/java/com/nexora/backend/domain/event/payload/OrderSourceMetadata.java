package com.nexora.backend.domain.event.payload;

import com.nexora.backend.domain.model.OrderSource;

import java.util.UUID;

public record OrderSourceMetadata(
        OrderSource source,
        UUID inboundOrderId,
        String externalOrderId
) {}

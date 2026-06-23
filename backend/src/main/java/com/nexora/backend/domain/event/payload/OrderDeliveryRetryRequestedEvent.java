package com.nexora.backend.domain.event.payload;

import java.util.UUID;

public record OrderDeliveryRetryRequestedEvent(UUID recoveryId) {}

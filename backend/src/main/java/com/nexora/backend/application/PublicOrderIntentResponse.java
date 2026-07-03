package com.nexora.backend.application;

import java.util.UUID;

public record PublicOrderIntentResponse(
        UUID receiptId,
        String status,
        String message
) {}

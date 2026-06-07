package com.nexora.backend.domain.model;

public enum DeliveryFailureReason {
    CUSTOMER_UNREACHABLE,
    CUSTOMER_REFUSED,
    INVALID_ADDRESS,
    CUSTOMER_RESCHEDULED,
    LOST_PACKAGE,
    OTHER
}

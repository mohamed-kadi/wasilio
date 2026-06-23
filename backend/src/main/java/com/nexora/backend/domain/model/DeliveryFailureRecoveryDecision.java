package com.nexora.backend.domain.model;

public enum DeliveryFailureRecoveryDecision {
    RETRY_DELIVERY,
    REFUND_OR_CUSTOMER_FOLLOW_UP,
    CLOSE_UNRECOVERABLE
}

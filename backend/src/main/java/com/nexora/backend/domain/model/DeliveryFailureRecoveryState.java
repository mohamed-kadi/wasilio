package com.nexora.backend.domain.model;

public enum DeliveryFailureRecoveryState {
    ALL,
    NEEDS_DECISION,
    OPEN_FOLLOW_UP,
    RETRY_READY,
    REFUND_REVIEW,
    CLOSED_UNRECOVERABLE
}

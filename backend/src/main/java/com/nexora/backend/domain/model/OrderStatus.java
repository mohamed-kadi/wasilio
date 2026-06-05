package com.nexora.backend.domain.model;

public enum OrderStatus {
    CREATED,
    CONFIRMATION_REQUESTED,
    CONFIRMED,
    REJECTED,
    ASSIGNED_TO_COURIER,
    PICKED_UP,
    DELIVERED,
    FAILED
}

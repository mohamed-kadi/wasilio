package com.nexora.backend.application;

public record PublicOrderDeliveryRequest(
        String city,
        String address,
        String notes
) {}

package com.nexora.backend.application;

public record PublicOrderSelectionRequest(
        PublicOrderProductRequest product,
        Integer quantity
) {}

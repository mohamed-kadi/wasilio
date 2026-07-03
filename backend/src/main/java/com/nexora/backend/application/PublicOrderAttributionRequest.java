package com.nexora.backend.application;

public record PublicOrderAttributionRequest(
        String source,
        String medium,
        String campaign,
        String content,
        String term,
        String referrerUrl,
        String landingPageUrl
) {}

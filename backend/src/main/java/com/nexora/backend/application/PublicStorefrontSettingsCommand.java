package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefrontStatus;

public record PublicStorefrontSettingsCommand(
        String storeSlug,
        String publicName,
        PublicStorefrontStatus status,
        String supportChannelType,
        String supportChannelValue,
        String defaultCountryCode,
        String defaultCurrency,
        String phonePattern
) {}

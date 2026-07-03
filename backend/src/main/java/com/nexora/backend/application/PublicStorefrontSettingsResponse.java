package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;

public record PublicStorefrontSettingsResponse(
        String storeSlug,
        String publicName,
        PublicStorefrontStatus status,
        String supportChannelType,
        String supportChannelValue,
        String defaultCountryCode,
        String defaultCurrency,
        String phonePattern
) {
    public static PublicStorefrontSettingsResponse from(PublicStorefront storefront) {
        return new PublicStorefrontSettingsResponse(
                storefront.getStoreSlug(),
                storefront.getPublicName(),
                storefront.getStatus(),
                storefront.getSupportChannelType(),
                storefront.getSupportChannelValue(),
                storefront.getDefaultCountryCode(),
                storefront.getDefaultCurrency(),
                storefront.getPhonePattern()
        );
    }
}

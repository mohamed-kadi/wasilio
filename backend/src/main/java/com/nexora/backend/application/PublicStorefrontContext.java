package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefront;

public record PublicStorefrontContext(
        String storeSlug,
        String publicName,
        String supportChannelType,
        String supportChannelValue,
        String defaultCountryCode,
        String defaultCurrency,
        String phonePattern
) {
    static PublicStorefrontContext from(PublicStorefront storefront) {
        return new PublicStorefrontContext(
                storefront.getStoreSlug(),
                storefront.getPublicName(),
                storefront.getSupportChannelType(),
                storefront.getSupportChannelValue(),
                storefront.getDefaultCountryCode(),
                storefront.getDefaultCurrency(),
                storefront.getPhonePattern()
        );
    }
}

package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefront;

import java.util.UUID;

record ResolvedPublicStorefrontContext(
        UUID tenantId,
        String storeSlug,
        String publicName,
        String supportChannelType,
        String supportChannelValue,
        String defaultCountryCode,
        String defaultCurrency,
        String phonePattern
) {
    static ResolvedPublicStorefrontContext from(PublicStorefront storefront) {
        return new ResolvedPublicStorefrontContext(
                storefront.getTenantId(),
                storefront.getStoreSlug(),
                storefront.getPublicName(),
                storefront.getSupportChannelType(),
                storefront.getSupportChannelValue(),
                storefront.getDefaultCountryCode(),
                storefront.getDefaultCurrency(),
                storefront.getPhonePattern()
        );
    }

    PublicStorefrontContext toPublicContext() {
        return new PublicStorefrontContext(
                storeSlug,
                publicName,
                supportChannelType,
                supportChannelValue,
                defaultCountryCode,
                defaultCurrency,
                phonePattern
        );
    }
}

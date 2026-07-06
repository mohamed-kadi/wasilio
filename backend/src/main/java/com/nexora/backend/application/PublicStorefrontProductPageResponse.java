package com.nexora.backend.application;

import com.fasterxml.jackson.annotation.JsonInclude;

public record PublicStorefrontProductPageResponse(
        String storeSlug,
        String storePublicName,
        String defaultCountryCode,
        String defaultCurrency,
        PublicSupportChannelResponse supportChannel,
        PublicProductResponse product,
        PublicOfferResponse offer,
        PublicSeoResponse seo,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        PublicLandingProfileResponse landingProfile
) {}

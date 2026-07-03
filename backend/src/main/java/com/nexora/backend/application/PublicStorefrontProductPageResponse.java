package com.nexora.backend.application;

public record PublicStorefrontProductPageResponse(
        String storeSlug,
        String storePublicName,
        PublicSupportChannelResponse supportChannel,
        PublicProductResponse product,
        PublicOfferResponse offer,
        PublicSeoResponse seo
) {}

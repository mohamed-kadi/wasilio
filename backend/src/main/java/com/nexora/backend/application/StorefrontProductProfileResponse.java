package com.nexora.backend.application;

import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.model.StorefrontProductProfileStatus;
import com.nexora.backend.domain.model.StorefrontProfileFaqItem;
import com.nexora.backend.domain.model.StorefrontProfileFeature;
import com.nexora.backend.domain.model.StorefrontProfileTrustBadge;

import java.util.List;
import java.util.UUID;

public record StorefrontProductProfileResponse(
        UUID productId,
        String headline,
        String subheadline,
        List<String> benefits,
        List<StorefrontProfileFeature> features,
        List<StorefrontProfileFaqItem> faq,
        List<StorefrontProfileTrustBadge> trustBadges,
        List<String> galleryImageUrls,
        String seoTitle,
        String seoDescription,
        String seoImageUrl,
        StorefrontProductProfileStatus status
) {
    public static StorefrontProductProfileResponse from(StorefrontProductProfile profile) {
        return new StorefrontProductProfileResponse(
                profile.getProductId(),
                profile.getHeadline(),
                profile.getSubheadline(),
                profile.getBenefits(),
                profile.getFeatures(),
                profile.getFaq(),
                profile.getTrustBadges(),
                profile.getGalleryImageUrls(),
                profile.getSeoTitle(),
                profile.getSeoDescription(),
                profile.getSeoImageUrl(),
                profile.getStatus()
        );
    }
}

package com.nexora.backend.application;

import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.model.StorefrontProductProfileStatus;
import com.nexora.backend.domain.model.StorefrontProfileFaqItem;
import com.nexora.backend.domain.model.StorefrontProfileFeature;
import com.nexora.backend.domain.model.StorefrontProfileTrustBadge;
import com.nexora.backend.domain.repository.ProductRepository;
import com.nexora.backend.domain.repository.StorefrontProductProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class StorefrontProductProfileService {

    private final StorefrontProductProfileRepository profileRepository;
    private final ProductRepository productRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public StorefrontProductProfileResponse getProfile(UUID tenantId, UUID productId) {
        requireOwnedProduct(tenantId, productId);
        return profileRepository.findByTenantIdAndProductId(tenantId, productId)
                .map(StorefrontProductProfileResponse::from)
                .orElse(null);
    }

    @Transactional
    public StorefrontProductProfileResponse upsertProfile(UUID tenantId, UUID productId, StorefrontProductProfileCommand command) {
        requireOwnedProduct(tenantId, productId);
        if (command == null) {
            throw new IllegalArgumentException("Storefront product profile is required");
        }

        Instant now = Instant.now(clock);
        StorefrontProductProfile profile = profileRepository.findByTenantIdAndProductId(tenantId, productId)
                .orElseGet(() -> StorefrontProductProfile.builder()
                        .id(UUID.randomUUID())
                        .tenantId(tenantId)
                        .productId(productId)
                        .createdAt(now)
                        .build());

        profile.setHeadline(normalizeOptional(command.headline(), 255, "headline"));
        profile.setSubheadline(normalizeOptional(command.subheadline(), 500, "subheadline"));
        profile.setBenefits(normalizeStringList(command.benefits(), 160, "benefits"));
        profile.setFeatures(normalizeObjectList(command.features(), this::normalizeFeature));
        profile.setFaq(normalizeObjectList(command.faq(), this::normalizeFaqItem));
        profile.setTrustBadges(normalizeObjectList(command.trustBadges(), this::normalizeTrustBadge));
        profile.setGalleryImageUrls(normalizeStringList(command.galleryImageUrls(), 1000, "galleryImageUrls"));
        profile.setSeoTitle(normalizeOptional(command.seoTitle(), 255, "seoTitle"));
        profile.setSeoDescription(normalizeOptional(command.seoDescription(), 500, "seoDescription"));
        profile.setSeoImageUrl(normalizeOptional(command.seoImageUrl(), 1000, "seoImageUrl"));
        profile.setStatus(command.status() == null ? StorefrontProductProfileStatus.DRAFT : command.status());
        profile.setUpdatedAt(now);

        return StorefrontProductProfileResponse.from(profileRepository.save(profile));
    }

    @Transactional(readOnly = true)
    public StorefrontProductProfile getPublishedProfile(UUID tenantId, UUID productId) {
        return profileRepository.findByTenantIdAndProductIdAndStatus(
                        tenantId,
                        productId,
                        StorefrontProductProfileStatus.PUBLISHED
                )
                .orElse(null);
    }

    private Product requireOwnedProduct(UUID tenantId, UUID productId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }
        if (productId == null) {
            throw new IllegalArgumentException("productId is required");
        }
        return productRepository.findByIdAndTenantId(productId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
    }

    private List<String> normalizeStringList(List<String> values, int maxLength, String field) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .map(value -> normalizeOptional(value, maxLength, field))
                .filter(this::hasText)
                .toList();
    }

    private <T> List<T> normalizeObjectList(List<T> values, Function<T, T> normalizer) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .map(normalizer)
                .filter(value -> value != null)
                .toList();
    }

    private StorefrontProfileFeature normalizeFeature(StorefrontProfileFeature feature) {
        if (feature == null) {
            return null;
        }
        String title = normalizeOptional(feature.title(), 120, "features.title");
        String description = normalizeOptional(feature.description(), 500, "features.description");
        return hasText(title) || hasText(description) ? new StorefrontProfileFeature(title, description) : null;
    }

    private StorefrontProfileFaqItem normalizeFaqItem(StorefrontProfileFaqItem item) {
        if (item == null) {
            return null;
        }
        String question = normalizeOptional(item.question(), 255, "faq.question");
        String answer = normalizeOptional(item.answer(), 1000, "faq.answer");
        return hasText(question) || hasText(answer) ? new StorefrontProfileFaqItem(question, answer) : null;
    }

    private StorefrontProfileTrustBadge normalizeTrustBadge(StorefrontProfileTrustBadge badge) {
        if (badge == null) {
            return null;
        }
        String label = normalizeOptional(badge.label(), 120, "trustBadges.label");
        String description = normalizeOptional(badge.description(), 500, "trustBadges.description");
        return hasText(label) || hasText(description) ? new StorefrontProfileTrustBadge(label, description) : null;
    }

    private String normalizeOptional(String value, int maxLength, String field) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be at most " + maxLength + " characters");
        }
        return normalized;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    public record StorefrontProductProfileCommand(
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
    ) {}
}

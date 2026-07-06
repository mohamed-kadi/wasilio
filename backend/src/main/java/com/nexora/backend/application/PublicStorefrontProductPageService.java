package com.nexora.backend.application;

import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PublicStorefrontProductPageService {

    private static final String PUBLIC_AVAILABILITY_AVAILABLE = "available";

    private final PublicStorefrontQueryService publicStorefrontQueryService;
    private final ProductRepository productRepository;
    private final StorefrontProductProfileService profileService;

    @Transactional(readOnly = true)
    public PublicStorefrontProductPageResponse getProductPage(String storeSlug, String productSlug) {
        ResolvedPublicStorefrontContext storefront = publicStorefrontQueryService.resolveStorefrontForApplication(storeSlug);
        String normalizedProductSlug = normalizeProductSlug(productSlug);
        Product product = productRepository.findByTenantIdAndSlug(storefront.tenantId(), normalizedProductSlug)
                .filter(candidate -> candidate.getStatus() == ProductStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("Public product not found"));

        StorefrontProductProfile profile = profileService.getPublishedProfile(storefront.tenantId(), product.getId());
        return toResponse(storefront, product, profile);
    }

    private PublicStorefrontProductPageResponse toResponse(
            ResolvedPublicStorefrontContext storefront,
            Product product,
            StorefrontProductProfile profile
    ) {
        PublicLandingProfileResponse landingProfile = profile == null ? null : PublicLandingProfileResponse.from(profile);
        return new PublicStorefrontProductPageResponse(
                storefront.storeSlug(),
                storefront.publicName(),
                storefront.defaultCountryCode(),
                storefront.defaultCurrency(),
                new PublicSupportChannelResponse(
                        storefront.supportChannelType(),
                        storefront.supportChannelValue()
                ),
                new PublicProductResponse(
                        product.getId(),
                        product.getSlug(),
                        product.getName(),
                        product.getDescription(),
                        product.getImageUrl()
                ),
                new PublicOfferResponse(
                        product.getPriceAmount(),
                        product.getCurrency(),
                        PUBLIC_AVAILABILITY_AVAILABLE,
                        true
                ),
                new PublicSeoResponse(
                        seoTitle(storefront, product, profile),
                        seoDescription(storefront, product, profile),
                        seoImage(product, profile)
                ),
                landingProfile
        );
    }

    private String normalizeProductSlug(String productSlug) {
        if (productSlug == null || productSlug.trim().isEmpty()) {
            throw new IllegalArgumentException("Public product not found");
        }
        return productSlug.trim().toLowerCase(Locale.ROOT);
    }

    private String seoTitle(ResolvedPublicStorefrontContext storefront, Product product, StorefrontProductProfile profile) {
        if (profile != null && hasText(profile.getSeoTitle())) {
            return profile.getSeoTitle();
        }
        return product.getName() + " | " + storefront.publicName();
    }

    private String seoDescription(ResolvedPublicStorefrontContext storefront, Product product, StorefrontProductProfile profile) {
        if (profile != null && hasText(profile.getSeoDescription())) {
            return profile.getSeoDescription();
        }
        if (hasText(product.getDescription())) {
            return product.getDescription();
        }
        return "Order " + product.getName() + " from " + storefront.publicName() + ".";
    }

    private String seoImage(Product product, StorefrontProductProfile profile) {
        if (profile != null && hasText(profile.getSeoImageUrl())) {
            return profile.getSeoImageUrl();
        }
        return product.getImageUrl();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}

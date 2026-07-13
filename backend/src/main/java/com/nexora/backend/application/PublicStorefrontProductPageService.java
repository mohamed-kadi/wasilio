package com.nexora.backend.application;

import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
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
                readiness(product, profile),
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

    private PublicProductReadinessResponse readiness(Product product, StorefrontProductProfile profile) {
        List<PublicProductReadinessItemResponse> items = new ArrayList<>();
        addReadinessItem(items, "catalog_active", "Catalog product active", true, true,
                "Product can be returned by the public storefront API.");
        addReadinessItem(items, "product_description", "Product description", hasText(product.getDescription()), true,
                "Description gives landing-engine fallback copy and SEO text.");
        addReadinessItem(items, "primary_image", "Primary product image", hasText(product.getImageUrl()), true,
                "Primary image is available for the product hero and order review.");
        addReadinessItem(items, "landing_profile_published", "Landing profile published", profile != null, true,
                "Published landing content is available for the public product page.");
        addReadinessItem(items, "landing_headline", "Landing headline", profile != null && hasText(profile.getHeadline()), true,
                "Headline gives the landing page a clear product promise.");
        addReadinessItem(items, "landing_benefits", "Landing benefits", profile != null && !profile.getBenefits().isEmpty(), true,
                "Benefits explain why the customer should answer and confirm.");
        addReadinessItem(items, "landing_features", "Landing features", profile != null && !profile.getFeatures().isEmpty(), true,
                "Features support customer recall during confirmation.");
        addReadinessItem(items, "gallery_media", "Gallery media", profile != null && !profile.getGalleryImageUrls().isEmpty(), false,
                "Additional images help customers recognize the product.");
        addReadinessItem(items, "seo_image", "SEO image", hasText(seoImage(product, profile)), false,
                "SEO/social image is available for public previews.");

        int requiredTotal = (int) items.stream().filter(PublicProductReadinessItemResponse::required).count();
        int requiredComplete = (int) items.stream()
                .filter(PublicProductReadinessItemResponse::required)
                .filter(PublicProductReadinessItemResponse::complete)
                .count();
        return new PublicProductReadinessResponse(true, requiredComplete, requiredTotal, items);
    }

    private void addReadinessItem(
            List<PublicProductReadinessItemResponse> items,
            String key,
            String label,
            boolean complete,
            boolean required,
            String detail
    ) {
        items.add(new PublicProductReadinessItemResponse(key, label, complete, required, detail));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}

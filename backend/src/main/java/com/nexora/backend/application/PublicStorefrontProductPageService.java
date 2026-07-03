package com.nexora.backend.application;

import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
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

    @Transactional(readOnly = true)
    public PublicStorefrontProductPageResponse getProductPage(String storeSlug, String productSlug) {
        ResolvedPublicStorefrontContext storefront = publicStorefrontQueryService.resolveStorefrontForApplication(storeSlug);
        String normalizedProductSlug = normalizeProductSlug(productSlug);
        Product product = productRepository.findByTenantIdAndSlug(storefront.tenantId(), normalizedProductSlug)
                .filter(candidate -> candidate.getStatus() == ProductStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("Public product not found"));

        return toResponse(storefront, product);
    }

    private PublicStorefrontProductPageResponse toResponse(ResolvedPublicStorefrontContext storefront, Product product) {
        return new PublicStorefrontProductPageResponse(
                storefront.storeSlug(),
                storefront.publicName(),
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
                        seoTitle(storefront, product),
                        seoDescription(storefront, product)
                )
        );
    }

    private String normalizeProductSlug(String productSlug) {
        if (productSlug == null || productSlug.trim().isEmpty()) {
            throw new IllegalArgumentException("Public product not found");
        }
        return productSlug.trim().toLowerCase(Locale.ROOT);
    }

    private String seoTitle(ResolvedPublicStorefrontContext storefront, Product product) {
        return product.getName() + " | " + storefront.publicName();
    }

    private String seoDescription(ResolvedPublicStorefrontContext storefront, Product product) {
        if (hasText(product.getDescription())) {
            return product.getDescription();
        }
        return "Order " + product.getName() + " from " + storefront.publicName() + ".";
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}

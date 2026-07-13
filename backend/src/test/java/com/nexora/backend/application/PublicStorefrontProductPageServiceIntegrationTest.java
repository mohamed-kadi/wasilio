package com.nexora.backend.application;

import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.model.StorefrontProductProfileStatus;
import com.nexora.backend.domain.model.StorefrontProfileFaqItem;
import com.nexora.backend.domain.model.StorefrontProfileFeature;
import com.nexora.backend.domain.model.StorefrontProfileTrustBadge;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.repository.ProductRepository;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import com.nexora.backend.domain.repository.StorefrontProductProfileRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class PublicStorefrontProductPageServiceIntegrationTest {

    @Autowired
    private PublicStorefrontProductPageService productPageService;

    @Autowired
    private PublicStorefrontRepository publicStorefrontRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private StorefrontProductProfileRepository storefrontProductProfileRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID tenantId;
    private UUID otherTenantId;

    @BeforeEach
    void setup() {
        tenantId = UUID.randomUUID();
        otherTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            entityManager.createNativeQuery("DELETE FROM storefront_product_profiles").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
            entityManager.persist(new Tenant(tenantId, "Public Product Tenant"));
            entityManager.persist(new Tenant(otherTenantId, "Other Public Product Tenant"));
            entityManager.flush();
        });
    }

    @Test
    void activeProductReturnsPublicDto() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        Product product = productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                "Portable cooling fan for COD customers.",
                ProductStatus.ACTIVE
        ));

        PublicStorefrontProductPageResponse response = productPageService.getProductPage(
                "coolair-morocco",
                "coolair-mini"
        );

        assertEquals("coolair-morocco", response.storeSlug());
        assertEquals("CoolAir Morocco", response.storePublicName());
        assertEquals("MA", response.defaultCountryCode());
        assertEquals("MAD", response.defaultCurrency());
        assertEquals("whatsapp", response.supportChannel().type());
        assertEquals("+212600000000", response.supportChannel().value());
        assertEquals(product.getId(), response.product().productId());
        assertEquals("coolair-mini", response.product().productSlug());
        assertNotEquals(response.storeSlug(), response.product().productSlug());
        assertEquals("CoolAir Mini", response.product().productName());
        assertEquals("Portable cooling fan for COD customers.", response.product().description());
        assertEquals("https://cdn.example.test/coolair-mini.jpg", response.product().imageUrl());
        assertEquals(new BigDecimal("199.00"), response.offer().price());
        assertEquals("MAD", response.offer().currency());
        assertEquals("available", response.offer().availability());
        assertTrue(response.offer().orderable());
        assertEquals("CoolAir Mini | CoolAir Morocco", response.seo().title());
        assertEquals("Portable cooling fan for COD customers.", response.seo().description());
        assertEquals("https://cdn.example.test/coolair-mini.jpg", response.seo().image());
        assertTrue(response.readiness().orderable());
        assertEquals(3, response.readiness().requiredComplete());
        assertEquals(7, response.readiness().requiredTotal());
        assertReadinessItem(response, "primary_image", true);
        assertReadinessItem(response, "landing_profile_published", false);
        assertNull(response.landingProfile());
    }

    @Test
    void publishedProfileAddsLandingContentAndSeoOverrides() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        Product product = productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                "Portable cooling fan for COD customers.",
                ProductStatus.ACTIVE
        ));
        storefrontProductProfileRepository.saveAndFlush(profile(product.getId(), StorefrontProductProfileStatus.PUBLISHED));

        PublicStorefrontProductPageResponse response = productPageService.getProductPage(
                "coolair-morocco",
                "coolair-mini"
        );

        assertEquals("Cool air without installation", response.landingProfile().headline());
        assertEquals("Fast COD delivery", response.landingProfile().benefits().get(0));
        assertEquals("Rechargeable", response.landingProfile().features().get(0).title());
        assertEquals("Can I pay on delivery?", response.landingProfile().faq().get(0).question());
        assertEquals("COD", response.landingProfile().trustBadges().get(0).label());
        assertEquals("https://cdn.example.test/gallery-1.jpg", response.landingProfile().galleryImageUrls().get(0));
        assertEquals("Portable CoolAir Morocco", response.seo().title());
        assertEquals("Order a portable CoolAir fan in Morocco.", response.seo().description());
        assertEquals("https://cdn.example.test/seo-coolair.jpg", response.seo().image());
        assertEquals(7, response.readiness().requiredComplete());
        assertEquals(7, response.readiness().requiredTotal());
        assertReadinessItem(response, "landing_profile_published", true);
        assertReadinessItem(response, "gallery_media", true);
    }

    @Test
    void draftProfileDoesNotChangePublicResponse() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        Product product = productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                "Portable cooling fan for COD customers.",
                ProductStatus.ACTIVE
        ));
        storefrontProductProfileRepository.saveAndFlush(profile(product.getId(), StorefrontProductProfileStatus.DRAFT));

        PublicStorefrontProductPageResponse response = productPageService.getProductPage(
                "coolair-morocco",
                "coolair-mini"
        );

        assertNull(response.landingProfile());
        assertEquals("CoolAir Mini | CoolAir Morocco", response.seo().title());
        assertEquals("Portable cooling fan for COD customers.", response.seo().description());
        assertEquals(3, response.readiness().requiredComplete());
        assertReadinessItem(response, "landing_profile_published", false);
    }

    @Test
    void responseDoesNotExposeTenantIdInternalStatusOrTimestamps() {
        Set<String> forbiddenFields = Set.of(
                "tenantId",
                "merchantId",
                "status",
                "productStatus",
                "createdAt",
                "updatedAt",
                "stockCount"
        );

        List<Class<?>> publicDtoTypes = List.of(
                PublicStorefrontProductPageResponse.class,
                PublicProductResponse.class,
                PublicLandingProfileResponse.class,
                PublicProductReadinessResponse.class,
                PublicProductReadinessItemResponse.class,
                PublicOfferResponse.class,
                PublicSupportChannelResponse.class,
                PublicSeoResponse.class
        );

        publicDtoTypes.forEach(type -> {
            for (RecordComponent component : type.getRecordComponents()) {
                assertFalse(
                        forbiddenFields.contains(component.getName()),
                        type.getSimpleName() + " exposes " + component.getName()
                );
            }
        });
    }

    @Test
    void missingProductReturnsNotFound() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> productPageService.getProductPage("coolair-morocco", "missing-product")
        );

        assertTrue(ex.getMessage().contains("not found"));
    }

    @Test
    void draftAndArchivedProductsReturnNotFound() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        productRepository.saveAndFlush(product(
                tenantId,
                "draft-product",
                "Draft Product",
                null,
                ProductStatus.DRAFT
        ));
        productRepository.saveAndFlush(product(
                tenantId,
                "archived-product",
                "Archived Product",
                null,
                ProductStatus.ARCHIVED
        ));

        IllegalArgumentException draft = assertThrows(
                IllegalArgumentException.class,
                () -> productPageService.getProductPage("coolair-morocco", "draft-product")
        );
        IllegalArgumentException archived = assertThrows(
                IllegalArgumentException.class,
                () -> productPageService.getProductPage("coolair-morocco", "archived-product")
        );

        assertTrue(draft.getMessage().contains("not found"));
        assertTrue(archived.getMessage().contains("not found"));
    }

    @Test
    void productFromAnotherTenantIsNotReturned() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        productRepository.saveAndFlush(product(
                otherTenantId,
                "coolair-mini",
                "Other Tenant Product",
                null,
                ProductStatus.ACTIVE
        ));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> productPageService.getProductPage("coolair-morocco", "coolair-mini")
        );

        assertTrue(ex.getMessage().contains("not found"));
    }

    @Test
    void seoFallbackIsGeneratedFromProductAndStoreFields() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        productRepository.saveAndFlush(product(
                tenantId,
                "mini-fan",
                "Mini Fan",
                null,
                ProductStatus.ACTIVE
        ));

        PublicStorefrontProductPageResponse response = productPageService.getProductPage(
                "  COOLAIR-MOROCCO  ",
                "  MINI-FAN  "
        );

        assertEquals("Mini Fan | CoolAir Morocco", response.seo().title());
        assertEquals("Order Mini Fan from CoolAir Morocco.", response.seo().description());
        assertEquals("https://cdn.example.test/mini-fan.jpg", response.seo().image());
    }

    @Test
    void publicProductMediaContractReturnsGalleryAndSeoImageFallback() {
        publicStorefrontRepository.saveAndFlush(storefront(tenantId, "coolair-morocco", "CoolAir Morocco"));
        Product product = productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                "Portable cooling fan for COD customers.",
                ProductStatus.ACTIVE
        ));
        StorefrontProductProfile profile = profile(product.getId(), StorefrontProductProfileStatus.PUBLISHED);
        profile.setSeoImageUrl(null);
        storefrontProductProfileRepository.saveAndFlush(profile);

        PublicStorefrontProductPageResponse response = productPageService.getProductPage(
                "coolair-morocco",
                "coolair-mini"
        );

        assertEquals("https://cdn.example.test/coolair-mini.jpg", response.product().imageUrl());
        assertEquals("https://cdn.example.test/coolair-mini.jpg", response.seo().image());
        assertNull(response.landingProfile().seoImageUrl());
        assertEquals("https://cdn.example.test/gallery-1.jpg", response.landingProfile().galleryImageUrls().get(0));
        assertReadinessItem(response, "primary_image", true);
        assertReadinessItem(response, "gallery_media", true);
        assertReadinessItem(response, "seo_image", true);
    }

    private PublicStorefront storefront(UUID ownerTenantId, String storeSlug, String publicName) {
        Instant now = Instant.now();
        return PublicStorefront.builder()
                .id(UUID.randomUUID())
                .tenantId(ownerTenantId)
                .storeSlug(storeSlug)
                .publicName(publicName)
                .status(PublicStorefrontStatus.ACTIVE)
                .supportChannelType("whatsapp")
                .supportChannelValue("+212600000000")
                .defaultCountryCode("MA")
                .defaultCurrency("MAD")
                .phonePattern("^(06|07)\\d{8}$")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private StorefrontProductProfile profile(UUID productId, StorefrontProductProfileStatus status) {
        Instant now = Instant.now();
        return StorefrontProductProfile.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .productId(productId)
                .headline("Cool air without installation")
                .subheadline("A portable fan for COD customers.")
                .benefits(List.of("Fast COD delivery", "Easy returns"))
                .features(List.of(new StorefrontProfileFeature(
                        "Rechargeable",
                        "Runs for hours after charging."
                )))
                .faq(List.of(new StorefrontProfileFaqItem(
                        "Can I pay on delivery?",
                        "Yes, cash on delivery is supported."
                )))
                .trustBadges(List.of(new StorefrontProfileTrustBadge(
                        "COD",
                        "Pay when the package arrives."
                )))
                .galleryImageUrls(List.of("https://cdn.example.test/gallery-1.jpg"))
                .seoTitle("Portable CoolAir Morocco")
                .seoDescription("Order a portable CoolAir fan in Morocco.")
                .seoImageUrl("https://cdn.example.test/seo-coolair.jpg")
                .status(status)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Product product(
            UUID ownerTenantId,
            String slug,
            String name,
            String description,
            ProductStatus status
    ) {
        Instant now = Instant.now();
        return Product.builder()
                .id(UUID.randomUUID())
                .tenantId(ownerTenantId)
                .name(name)
                .slug(slug)
                .description(description)
                .priceAmount(new BigDecimal("199.00"))
                .currency("MAD")
                .sku("SKU-" + slug)
                .imageUrl("https://cdn.example.test/" + slug + ".jpg")
                .status(status)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void assertReadinessItem(PublicStorefrontProductPageResponse response, String key, boolean complete) {
        PublicProductReadinessItemResponse item = response.readiness().items().stream()
                .filter(candidate -> candidate.key().equals(key))
                .findFirst()
                .orElseThrow();
        assertEquals(complete, item.complete());
    }
}

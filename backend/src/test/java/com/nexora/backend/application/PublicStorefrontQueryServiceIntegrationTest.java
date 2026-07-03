package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.util.Arrays;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class PublicStorefrontQueryServiceIntegrationTest {

    @Autowired
    private PublicStorefrontQueryService publicStorefrontQueryService;

    @Autowired
    private PublicStorefrontRepository publicStorefrontRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID tenantId;

    @BeforeEach
    void setup() {
        tenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
            entityManager.persist(new Tenant(tenantId, "Public Storefront Query Tenant"));
            entityManager.flush();
        });
    }

    @Test
    void resolvesEnabledStorefront() {
        publicStorefrontRepository.saveAndFlush(storefront(
                "coolair-morocco",
                "CoolAir Morocco",
                PublicStorefrontStatus.ACTIVE
        ));

        PublicStorefrontContext context = publicStorefrontQueryService.resolveStorefront("coolair-morocco");

        assertEquals("coolair-morocco", context.storeSlug());
        assertEquals("CoolAir Morocco", context.publicName());
        assertEquals("whatsapp", context.supportChannelType());
        assertEquals("+212600000000", context.supportChannelValue());
        assertEquals("MA", context.defaultCountryCode());
        assertEquals("MAD", context.defaultCurrency());
        assertEquals("^(06|07)\\d{8}$", context.phonePattern());
    }

    @Test
    void normalizesSlug() {
        publicStorefrontRepository.saveAndFlush(storefront(
                "argan-house",
                "Argan House",
                PublicStorefrontStatus.ACTIVE
        ));

        PublicStorefrontContext context = publicStorefrontQueryService.resolveStorefront("  ARGAN-HOUSE  ");

        assertEquals("argan-house", context.storeSlug());
        assertEquals("Argan House", context.publicName());
    }

    @Test
    void missingSlugReturnsNotFound() {
        IllegalArgumentException missing = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontQueryService.resolveStorefront("missing-store")
        );
        IllegalArgumentException blank = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontQueryService.resolveStorefront(" ")
        );

        assertTrue(missing.getMessage().contains("not found"));
        assertTrue(blank.getMessage().contains("not found"));
    }

    @Test
    void disabledStorefrontIsTreatedAsNotFound() {
        publicStorefrontRepository.saveAndFlush(storefront(
                "paused-store",
                "Paused Store",
                PublicStorefrontStatus.DISABLED
        ));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontQueryService.resolveStorefront("paused-store")
        );

        assertTrue(ex.getMessage().contains("not found"));
    }

    @Test
    void publicContextDoesNotExposeTenantId() {
        boolean hasTenantIdComponent = Arrays.stream(PublicStorefrontContext.class.getRecordComponents())
                .map(RecordComponent::getName)
                .anyMatch("tenantId"::equals);

        assertFalse(hasTenantIdComponent);
    }

    private PublicStorefront storefront(
            String storeSlug,
            String publicName,
            PublicStorefrontStatus status
    ) {
        Instant now = Instant.now();
        return PublicStorefront.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .storeSlug(storeSlug)
                .publicName(publicName)
                .status(status)
                .supportChannelType("whatsapp")
                .supportChannelValue("+212600000000")
                .defaultCountryCode("MA")
                .defaultCurrency("MAD")
                .phonePattern("^(06|07)\\d{8}$")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}

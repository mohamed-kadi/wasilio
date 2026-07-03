package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.model.Tenant;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class PublicStorefrontRepositoryIntegrationTest {

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
            entityManager.persist(new Tenant(tenantId, "Public Storefront Tenant"));
            entityManager.flush();
        });
    }

    @Test
    void createsStorefront() {
        PublicStorefront storefront = publicStorefrontRepository.saveAndFlush(storefront(
                "coolair-morocco",
                "CoolAir Morocco",
                PublicStorefrontStatus.ACTIVE
        ));

        assertEquals(tenantId, storefront.getTenantId());
        assertEquals("coolair-morocco", storefront.getStoreSlug());
        assertEquals("CoolAir Morocco", storefront.getPublicName());
        assertEquals(PublicStorefrontStatus.ACTIVE, storefront.getStatus());
        assertEquals("whatsapp", storefront.getSupportChannelType());
        assertEquals("+212600000000", storefront.getSupportChannelValue());
        assertEquals("MA", storefront.getDefaultCountryCode());
        assertEquals("MAD", storefront.getDefaultCurrency());
        assertEquals("^(06|07)\\d{8}$", storefront.getPhonePattern());
    }

    @Test
    void findsByStoreSlug() {
        PublicStorefront saved = publicStorefrontRepository.saveAndFlush(storefront(
                "argan-house",
                "Argan House",
                PublicStorefrontStatus.ACTIVE
        ));

        Optional<PublicStorefront> found = publicStorefrontRepository.findByStoreSlug("argan-house");

        assertTrue(found.isPresent());
        assertEquals(saved.getId(), found.get().getId());
        assertEquals("Argan House", found.get().getPublicName());
    }

    @Test
    void storeSlugMustBeUnique() {
        publicStorefrontRepository.saveAndFlush(storefront(
                "shared-store",
                "First Store",
                PublicStorefrontStatus.ACTIVE
        ));

        assertThrows(DataIntegrityViolationException.class, () ->
                publicStorefrontRepository.saveAndFlush(storefront(
                        "shared-store",
                        "Duplicate Store",
                        PublicStorefrontStatus.ACTIVE
                ))
        );
    }

    @Test
    void disabledStorefrontCanBeRepresented() {
        PublicStorefront storefront = publicStorefrontRepository.saveAndFlush(storefront(
                "paused-store",
                "Paused Store",
                PublicStorefrontStatus.DISABLED
        ));

        Optional<PublicStorefront> found = publicStorefrontRepository.findByStoreSlug("paused-store");

        assertTrue(found.isPresent());
        assertEquals(storefront.getId(), found.get().getId());
        assertEquals(PublicStorefrontStatus.DISABLED, found.get().getStatus());
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

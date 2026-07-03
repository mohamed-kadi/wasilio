package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicStorefrontSettingsControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private PublicStorefrontRepository publicStorefrontRepository;

    private UUID tenantId;
    private UUID otherTenantId;
    private String jwtToken;
    private String otherTenantJwtToken;

    @BeforeEach
    void setup() throws Exception {
        tenantId = UUID.randomUUID();
        otherTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Storefront Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "storefront@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    tenantId
            ));
            entityManager.persist(new Tenant(otherTenantId, "Other Storefront Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "other-storefront@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    otherTenantId
            ));
            entityManager.flush();
        });

        jwtToken = login("storefront@example.com", "password");
        otherTenantJwtToken = login("other-storefront@example.com", "password");
    }

    @Test
    void settingsApiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/storefront-settings"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void merchantCanCreateStorefrontSettingsForCurrentTenant() throws Exception {
        mockMvc.perform(put("/api/storefront-settings")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsRequest(
                        " CoolAir Morocco! ",
                        "CoolAir Morocco",
                        PublicStorefrontStatus.DISABLED,
                        "whatsapp",
                        "+212600000000",
                        "ma",
                        "mad",
                        "^(06|07)\\d{8}$"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeSlug").value("coolair-morocco"))
                .andExpect(jsonPath("$.publicName").value("CoolAir Morocco"))
                .andExpect(jsonPath("$.status").value("DISABLED"))
                .andExpect(jsonPath("$.supportChannelType").value("whatsapp"))
                .andExpect(jsonPath("$.supportChannelValue").value("+212600000000"))
                .andExpect(jsonPath("$.defaultCountryCode").value("MA"))
                .andExpect(jsonPath("$.defaultCurrency").value("MAD"))
                .andExpect(jsonPath("$.phonePattern").value("^(06|07)\\d{8}$"))
                .andExpect(jsonPath("$.tenantId").doesNotExist())
                .andExpect(jsonPath("$.createdAt").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());

        PublicStorefront storefront = publicStorefrontRepository.findByStoreSlug("coolair-morocco").orElseThrow();
        assertEquals(tenantId, storefront.getTenantId());

        mockMvc.perform(get("/api/storefront-settings")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeSlug").value("coolair-morocco"))
                .andExpect(jsonPath("$.tenantId").doesNotExist());
    }

    @Test
    void merchantCanUpdateAndEnableOrDisableOwnStorefront() throws Exception {
        upsert(jwtToken, settingsRequest(
                "coolair-morocco",
                "CoolAir Morocco",
                PublicStorefrontStatus.ACTIVE,
                "whatsapp",
                "+212600000000",
                "MA",
                "MAD",
                "^(06|07)\\d{8}$"
        ));

        mockMvc.perform(put("/api/storefront-settings")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsRequest(
                        "coolair-ma",
                        "CoolAir MA",
                        PublicStorefrontStatus.DISABLED,
                        "phone",
                        "+212611111111",
                        "MA",
                        "MAD",
                        "^\\+212\\d{9}$"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeSlug").value("coolair-ma"))
                .andExpect(jsonPath("$.publicName").value("CoolAir MA"))
                .andExpect(jsonPath("$.status").value("DISABLED"))
                .andExpect(jsonPath("$.supportChannelType").value("phone"))
                .andExpect(jsonPath("$.supportChannelValue").value("+212611111111"));

        assertEquals(1, publicStorefrontRepository.count());
        assertTrue(publicStorefrontRepository.findByStoreSlug("coolair-morocco").isEmpty());
    }

    @Test
    void merchantDoesNotSeeAnotherTenantsStorefrontSettings() throws Exception {
        upsert(jwtToken, settingsRequest(
                "coolair-morocco",
                "CoolAir Morocco",
                PublicStorefrontStatus.ACTIVE,
                "whatsapp",
                "+212600000000",
                "MA",
                "MAD",
                "^(06|07)\\d{8}$"
        ));

        mockMvc.perform(get("/api/storefront-settings")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNoContent());
    }

    @Test
    void storeSlugMustBeGloballyUnique() throws Exception {
        upsert(jwtToken, settingsRequest(
                "shared-store",
                "Shared Store",
                PublicStorefrontStatus.ACTIVE,
                "whatsapp",
                "+212600000000",
                "MA",
                "MAD",
                "^(06|07)\\d{8}$"
        ));

        mockMvc.perform(put("/api/storefront-settings")
                .header("Authorization", bearer(otherTenantJwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsRequest(
                        "Shared Store",
                        "Other Shared Store",
                        PublicStorefrontStatus.ACTIVE,
                        "whatsapp",
                        "+212600000001",
                        "MA",
                        "MAD",
                        "^(06|07)\\d{8}$"
                ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Resource already exists"));
    }

    @Test
    void invalidPhonePatternReturnsBadRequest() throws Exception {
        mockMvc.perform(put("/api/storefront-settings")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsRequest(
                        "coolair-morocco",
                        "CoolAir Morocco",
                        PublicStorefrontStatus.ACTIVE,
                        "whatsapp",
                        "+212600000000",
                        "MA",
                        "MAD",
                        "["
                ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.detail").value("phonePattern must be a valid regular expression"));
    }

    private void upsert(
            String token,
            PublicStorefrontSettingsController.StorefrontSettingsRequest request
    ) throws Exception {
        mockMvc.perform(put("/api/storefront-settings")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    private PublicStorefrontSettingsController.StorefrontSettingsRequest settingsRequest(
            String storeSlug,
            String publicName,
            PublicStorefrontStatus status,
            String supportChannelType,
            String supportChannelValue,
            String defaultCountryCode,
            String defaultCurrency,
            String phonePattern
    ) {
        return new PublicStorefrontSettingsController.StorefrontSettingsRequest(
                storeSlug,
                publicName,
                status,
                supportChannelType,
                supportChannelValue,
                defaultCountryCode,
                defaultCurrency,
                phonePattern
        );
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM marketing_leads").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenant_payments").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenant_subscriptions").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM subscription_plans").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_search_saved_views").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM couriers").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM password_reset_tokens").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

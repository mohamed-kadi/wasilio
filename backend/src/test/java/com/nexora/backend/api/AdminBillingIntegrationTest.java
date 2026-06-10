package com.nexora.backend.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.TenantStatus;
import com.nexora.backend.domain.model.User;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminBillingIntegrationTest {

    private static final String PASSWORD = "correct-password";

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

    private UUID internalTenantId;
    private UUID merchantTenantId;

    @BeforeEach
    void setup() {
        internalTenantId = UUID.randomUUID();
        merchantTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(internalTenantId, "Nexora Internal"));
            entityManager.persist(new Tenant(merchantTenantId, "Atlas Shop"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "superadmin@example.com",
                    passwordEncoder.encode(PASSWORD),
                    Role.SUPER_ADMIN,
                    internalTenantId
            ));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "merchant@example.com",
                    passwordEncoder.encode(PASSWORD),
                    Role.MERCHANT,
                    merchantTenantId
            ));
            entityManager.flush();
        });
    }

    @Test
    void merchantCannotAccessAdminTenants() throws Exception {
        mockMvc.perform(get("/api/admin/tenants")
                .header("Authorization", "Bearer " + login("merchant@example.com")))
                .andExpect(status().isForbidden());
    }

    @Test
    void activeMerchantCanAccessMerchantApis() throws Exception {
        mockMvc.perform(get("/api/orders")
                .header("Authorization", "Bearer " + login("merchant@example.com")))
                .andExpect(status().isOk());
    }

    @Test
    void suspendedMerchantIsBlockedFromMerchantApis() throws Exception {
        transactionTemplate.executeWithoutResult(status -> {
            Tenant tenant = entityManager.find(Tenant.class, merchantTenantId);
            tenant.setStatus(TenantStatus.SUSPENDED);
            entityManager.flush();
        });

        mockMvc.perform(get("/api/orders")
                .header("Authorization", "Bearer " + login("merchant@example.com")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Tenant account blocked"))
                .andExpect(jsonPath("$.tenantStatus").value("SUSPENDED"));
    }

    @Test
    void superAdminCanManageSubscriptionAndRecordCashPaymentReceipt() throws Exception {
        String token = login("superadmin@example.com");

        mockMvc.perform(get("/api/admin/tenants")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.tenantId=='" + merchantTenantId + "')].name").value("Atlas Shop"));

        String planId = createPlan(token);

        mockMvc.perform(patch("/api/admin/tenants/" + merchantTenantId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "status": "TRIALING"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TRIALING"));

        mockMvc.perform(post("/api/admin/tenants/" + merchantTenantId + "/subscription")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "planId": "%s",
                          "status": "TRIALING",
                          "currentPeriodStart": "2026-06-01T00:00:00Z",
                          "currentPeriodEnd": "2026-07-01T00:00:00Z",
                          "trialEndsAt": "2026-06-15T00:00:00Z"
                        }
                        """.formatted(planId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.status").value("TRIALING"))
                .andExpect(jsonPath("$.plan.code").value("pilot"));

        MvcResult paymentResult = mockMvc.perform(post("/api/admin/tenants/" + merchantTenantId + "/payments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "method": "CASH",
                          "amount": 300.00,
                          "currency": "MAD",
                          "paidAt": "2026-06-09T12:00:00Z",
                          "periodStart": "2026-06-01T00:00:00Z",
                          "periodEnd": "2026-07-01T00:00:00Z",
                          "notes": "Cash collected during pilot onboarding"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.method").value("CASH"))
                .andExpect(jsonPath("$.currency").value("MAD"))
                .andExpect(jsonPath("$.collectedBy").value("superadmin@example.com"))
                .andExpect(jsonPath("$.receiptNumber").isString())
                .andReturn();

        JsonNode payment = objectMapper.readTree(paymentResult.getResponse().getContentAsString());
        String paymentId = payment.get("paymentId").asText();

        mockMvc.perform(get("/api/admin/tenants/" + merchantTenantId + "/payments/" + paymentId + "/receipt")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value(paymentId))
                .andExpect(jsonPath("$.receiptNumber").value(payment.get("receiptNumber").asText()))
                .andExpect(jsonPath("$.tenantName").value("Atlas Shop"))
                .andExpect(jsonPath("$.subscriptionStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.plan.name").value("Pilot"))
                .andExpect(jsonPath("$.periodStart").value("2026-06-01T00:00:00Z"))
                .andExpect(jsonPath("$.periodEnd").value("2026-07-01T00:00:00Z"));
    }

    private String createPlan(String token) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/plans")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "code": "pilot",
                          "name": "Pilot",
                          "monthlyPrice": 300.00,
                          "currency": "MAD",
                          "orderLimit": 300,
                          "userLimit": 3
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("pilot"))
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("planId").asText();
    }

    private String login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM tenant_payments").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenant_subscriptions").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM subscription_plans").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

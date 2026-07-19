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

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
            entityManager.persist(new Tenant(internalTenantId, "Wasilio Internal"));
            entityManager.persist(new Tenant(merchantTenantId, "Atlas Shop"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "superadmin@example.com",
                    "Wasilio Super Admin",
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
                .andExpect(jsonPath("$.collectedBy").value("Wasilio Super Admin"))
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

        mockMvc.perform(get("/api/admin/payments/summary")
                .param("paidFrom", "2026-06-01T00:00:00Z")
                .param("paidTo", "2026-07-01T00:00:00Z")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentCount").value(1))
                .andExpect(jsonPath("$.totals[0].currency").value("MAD"))
                .andExpect(jsonPath("$.totals[0].amount").value(300.0))
                .andExpect(jsonPath("$.monthlyTotals[0].month").value("2026-06"));

        mockMvc.perform(get("/api/admin/payments/export")
                .param("paidFrom", "2026-06-01T00:00:00Z")
                .param("paidTo", "2026-07-01T00:00:00Z")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("wasilio-payment-records.csv")))
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().string(containsString("Receipt Number,Merchant Workspace,Payment Method")))
                .andExpect(content().string(containsString(payment.get("receiptNumber").asText())))
                .andExpect(content().string(containsString("Atlas Shop")))
                .andExpect(content().string(containsString("Wasilio Super Admin")))
                .andExpect(content().string(not(containsString("superadmin@example.com"))));

        mockMvc.perform(patch("/api/admin/plans/" + planId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "active": false
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(delete("/api/admin/plans/" + planId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    void superAdminCanDeleteUnusedArchivedPlan() throws Exception {
        String token = login("superadmin@example.com");
        String planId = createPlan(token, "cleanup", "Cleanup");

        mockMvc.perform(delete("/api/admin/plans/" + planId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/admin/plans/" + planId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "active": false
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(delete("/api/admin/plans/" + planId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/admin/plans")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("cleanup"))));
    }

    private String createPlan(String token) throws Exception {
        return createPlan(token, "pilot", "Pilot");
    }

    private String createPlan(String token, String code, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/plans")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "code": "%s",
                          "name": "%s",
                          "monthlyPrice": 300.00,
                          "currency": "MAD",
                          "orderLimit": 300,
                          "userLimit": 3
                        }
                        """.formatted(code, name)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code))
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
        entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_intelligence_signals").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_intelligence_snapshots").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

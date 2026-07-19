package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.application.PasswordResetNotifier;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MarketingLeadIntegrationTest {

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

    @MockBean
    private PasswordResetNotifier passwordResetNotifier;

    private UUID internalTenantId;

    @BeforeEach
    void setup() {
        internalTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(internalTenantId, "Wasilio Internal"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "superadmin@example.com",
                    passwordEncoder.encode(PASSWORD),
                    Role.SUPER_ADMIN,
                    internalTenantId
            ));
            entityManager.flush();
        });
    }

    @Test
    void anonymousVisitorCanSubmitLeadAndSuperAdminCanListIt() throws Exception {
        MvcResult leadResult = mockMvc.perform(post("/api/marketing/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "contactName": "Sara Admin",
                          "storeName": "Casa Beauty",
                          "phone": "+212600000001",
                          "email": "sara@example.com",
                          "city": "Casablanca",
                          "monthlyOrderVolume": "100-500/month",
                          "message": "We need better callback tracking.",
                          "campaignSource": "utm_source=facebook"
                        }
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contactName").value("Sara Admin"))
                .andExpect(jsonPath("$.storeName").value("Casa Beauty"))
                .andExpect(jsonPath("$.campaignSource").value("utm_source=facebook"))
                .andExpect(jsonPath("$.status").value("NEW"))
                .andReturn();

        String leadId = objectMapper.readTree(leadResult.getResponse().getContentAsString()).get("leadId").asText();

        mockMvc.perform(get("/api/marketing/leads"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/marketing/leads")
                .header("Authorization", "Bearer " + login("superadmin@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].storeName").value("Casa Beauty"))
                .andExpect(jsonPath("$[0].phone").value("+212600000001"));

        mockMvc.perform(patch("/api/marketing/leads/{leadId}/follow-up", leadId)
                .header("Authorization", "Bearer " + login("superadmin@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "status": "CONTACTED",
                          "nextFollowUpAt": "2026-06-12T14:30:00Z",
                          "internalNotes": "Reached on WhatsApp. Interested in a guided pilot."
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONTACTED"))
                .andExpect(jsonPath("$.nextFollowUpAt").value("2026-06-12T14:30:00Z"))
                .andExpect(jsonPath("$.internalNotes").value("Reached on WhatsApp. Interested in a guided pilot."));

        mockMvc.perform(post("/api/marketing/leads/{leadId}/convert-to-tenant", leadId)
                .header("Authorization", "Bearer " + login("superadmin@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "tenantName": "Casa Beauty Pilot",
                          "adminName": "Sara Admin",
                          "adminEmail": "sara.admin@example.com",
                          "internalNotes": "Converted after qualification call. Free guided onboarding offered."
                        }
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lead.status").value("ONBOARDED"))
                .andExpect(jsonPath("$.lead.convertedTenantId").exists())
                .andExpect(jsonPath("$.lead.convertedAt").exists())
                .andExpect(jsonPath("$.tenant.tenantName").value("Casa Beauty Pilot"))
                .andExpect(jsonPath("$.tenant.adminEmail").value("sara.admin@example.com"));

        mockMvc.perform(get("/api/admin/tenants")
                .header("Authorization", "Bearer " + login("superadmin@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Casa Beauty Pilot')].status").value("TRIALING"));

        verify(passwordResetNotifier).sendAccountSetupLink(
                eq("sara.admin@example.com"),
                startsWith("http://localhost/reset-password?token="),
                any()
        );
        verify(passwordResetNotifier, never()).sendPasswordResetLink(any(), any(), any());
    }

    @Test
    void convertLeadFailsWhenAccountSetupNotificationFails() throws Exception {
        MvcResult leadResult = mockMvc.perform(post("/api/marketing/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "contactName": "Sara Admin",
                          "storeName": "Casa Beauty",
                          "phone": "+212600000001",
                          "email": "sara@example.com"
                        }
                        """))
                .andExpect(status().isCreated())
                .andReturn();

        String token = login("superadmin@example.com");
        String leadId = objectMapper.readTree(leadResult.getResponse().getContentAsString()).get("leadId").asText();

        doThrow(new RuntimeException("SMTP failed"))
                .when(passwordResetNotifier)
                .sendAccountSetupLink(eq("sara.admin@example.com"), any(), any());

        mockMvc.perform(post("/api/marketing/leads/{leadId}/convert-to-tenant", leadId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "tenantName": "Casa Beauty Pilot",
                          "adminName": "Sara Admin",
                          "adminEmail": "sara.admin@example.com",
                          "internalNotes": "Converted after qualification call."
                        }
                        """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Account setup notification failed"));

        mockMvc.perform(get("/api/marketing/leads")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("NEW"));

        mockMvc.perform(get("/api/admin/tenants")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("Casa Beauty Pilot"))));
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
        entityManager.createNativeQuery("DELETE FROM password_reset_tokens").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM marketing_leads").executeUpdate();
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

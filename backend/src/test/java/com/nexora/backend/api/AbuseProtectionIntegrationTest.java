package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.infrastructure.security.AbuseProtectionService;
import com.nexora.backend.infrastructure.security.SecurityAuditLogger;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "app.onboarding.enabled=true",
        "app.security.throttling.enabled=true",
        "app.security.throttling.login.max-attempts=2",
        "app.security.throttling.login.window=PT10M",
        "app.security.throttling.login.lockout=PT10M",
        "app.security.throttling.onboarding.max-attempts=2",
        "app.security.throttling.onboarding.window=PT10M",
        "app.security.throttling.onboarding.lockout=PT10M"
})
class AbuseProtectionIntegrationTest {

    private static final String PASSWORD = "correct-password";
    private static final String STRONG_PASSWORD = "Str0ng!Password";

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
    private AbuseProtectionService abuseProtectionService;

    @MockBean
    private SecurityAuditLogger securityAuditLogger;

    private UUID tenantId;

    @BeforeEach
    void setup() {
        tenantId = UUID.randomUUID();
        abuseProtectionService.clearAll();
        reset(securityAuditLogger);

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Tenant A"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "merchant-a@example.com",
                    passwordEncoder.encode(PASSWORD),
                    Role.MERCHANT,
                    tenantId
            ));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "merchant-b@example.com",
                    passwordEncoder.encode(PASSWORD),
                    Role.MERCHANT,
                    tenantId
            ));
            entityManager.flush();
        });
    }

    @Test
    void loginThrottlesAfterRepeatedFailures() throws Exception {
        String ip = "203.0.113.10";

        login("merchant-a@example.com", "wrong-password", ip)
                .andExpect(status().isUnauthorized());
        login("merchant-a@example.com", "wrong-password", ip)
                .andExpect(status().isUnauthorized());

        login("merchant-a@example.com", "wrong-password", ip)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.title").value("Too many requests"));

        verify(securityAuditLogger, atLeastOnce()).loginFailed("merchant-a@example.com", ip);
        verify(securityAuditLogger, atLeastOnce()).loginThrottled("merchant-a@example.com", ip);
    }

    @Test
    void successfulLoginResetsEmailFailureCounter() throws Exception {
        login("merchant-a@example.com", "wrong-password", "203.0.113.20")
                .andExpect(status().isUnauthorized());

        login("merchant-a@example.com", PASSWORD, "203.0.113.21")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        login("merchant-a@example.com", "wrong-password", "203.0.113.22")
                .andExpect(status().isUnauthorized());
        login("merchant-a@example.com", "wrong-password", "203.0.113.23")
                .andExpect(status().isUnauthorized());

        verify(securityAuditLogger).loginSucceeded("merchant-a@example.com", tenantId.toString(), "203.0.113.21");
    }

    @Test
    void loginThrottlesByIpAcrossEmails() throws Exception {
        String ip = "203.0.113.30";

        login("merchant-a@example.com", "wrong-password", ip)
                .andExpect(status().isUnauthorized());
        login("merchant-b@example.com", "wrong-password", ip)
                .andExpect(status().isUnauthorized());

        login("merchant-a@example.com", PASSWORD, ip)
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void onboardingThrottlesByIp() throws Exception {
        String ip = "203.0.113.40";

        onboard("Atlas Shop", "admin-a@example.com", ip)
                .andExpect(status().isCreated());
        onboard("Rabat Shop", "admin-b@example.com", ip)
                .andExpect(status().isCreated());

        onboard("Casa Shop", "admin-c@example.com", ip)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.title").value("Too many requests"));

        verify(securityAuditLogger).tenantOnboardingSucceeded(eq("admin-a@example.com"), any(UUID.class), eq(ip));
        verify(securityAuditLogger).tenantOnboardingSucceeded(eq("admin-b@example.com"), any(UUID.class), eq(ip));
        verify(securityAuditLogger).tenantOnboardingThrottled("admin-c@example.com", ip);
    }

    @Test
    void rejectedOnboardingIsAudited() throws Exception {
        String ip = "203.0.113.50";

        onboard("Atlas Shop", "admin-a@example.com", ip)
                .andExpect(status().isCreated());
        onboard("atlas shop", "admin-b@example.com", ip)
                .andExpect(status().isConflict());

        verify(securityAuditLogger).tenantOnboardingRejected("admin-b@example.com", ip, "ResourceConflictException");
    }

    private org.springframework.test.web.servlet.ResultActions login(
            String email,
            String password,
            String remoteIp
    ) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .with(remoteIp(remoteIp))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(email, password))));
    }

    private org.springframework.test.web.servlet.ResultActions onboard(
            String tenantName,
            String adminEmail,
            String remoteIp
    ) throws Exception {
        OnboardingController.TenantOnboardingRequest request = new OnboardingController.TenantOnboardingRequest(
                tenantName,
                "Admin User",
                adminEmail,
                STRONG_PASSWORD
        );

        return mockMvc.perform(post("/api/onboarding/tenants")
                .with(remoteIp(remoteIp))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
    }

    private RequestPostProcessor remoteIp(String remoteIp) {
        return request -> {
            request.setRemoteAddr(remoteIp);
            return request;
        };
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.TenantRepository;
import com.nexora.backend.domain.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.onboarding.enabled=true")
class OnboardingIntegrationTest {

    private static final String STRONG_PASSWORD = "Str0ng!Password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setup() {
        transactionTemplate.executeWithoutResult(status -> cleanDatabase());
    }

    @Test
    void successfulTenantOnboardingCreatesTenantAndAdmin() throws Exception {
        onboard("Atlas Shop", "Admin User", "Admin@Example.com", STRONG_PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tenantName").value("Atlas Shop"))
                .andExpect(jsonPath("$.workspaceName").value("Atlas Shop"))
                .andExpect(jsonPath("$.adminEmail").value("admin@example.com"))
                .andExpect(jsonPath("$.adminRole").value("ADMIN"));

        assertTrue(tenantRepository.existsByNameIgnoreCase("atlas shop"));
        User admin = userRepository.findByEmailIgnoreCase("admin@example.com").orElseThrow();
        assertNotEquals(STRONG_PASSWORD, admin.getPasswordHash());
        assertTrue(passwordEncoder.matches(STRONG_PASSWORD, admin.getPasswordHash()));
    }

    @Test
    void duplicateTenantIsRejected() throws Exception {
        onboard("Atlas Shop", "Admin User", "admin@example.com", STRONG_PASSWORD)
                .andExpect(status().isCreated());

        onboard("atlas shop", "Other Admin", "other@example.com", STRONG_PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Resource already exists"));
    }

    @Test
    void duplicateAdminEmailIsRejected() throws Exception {
        onboard("Atlas Shop", "Admin User", "admin@example.com", STRONG_PASSWORD)
                .andExpect(status().isCreated());

        onboard("Second Shop", "Other Admin", "ADMIN@example.com", STRONG_PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Resource already exists"));
    }

    @Test
    void weakPasswordIsRejected() throws Exception {
        onboard("Atlas Shop", "Admin User", "admin@example.com", "WeakPassword12")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"));
    }

    @Test
    void createdAdminCanLogIn() throws Exception {
        onboard("Atlas Shop", "Admin User", "admin@example.com", STRONG_PASSWORD)
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(
                        "admin@example.com",
                        STRONG_PASSWORD
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());
    }

    private org.springframework.test.web.servlet.ResultActions onboard(
            String tenantName,
            String adminName,
            String adminEmail,
            String password
    ) throws Exception {
        OnboardingController.TenantOnboardingRequest request = new OnboardingController.TenantOnboardingRequest(
                tenantName,
                adminName,
                adminEmail,
                password
        );

        return mockMvc.perform(post("/api/onboarding/tenants")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

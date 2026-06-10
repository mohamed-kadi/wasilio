package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.application.PasswordResetNotifier;
import com.nexora.backend.application.PasswordResetTokenHasher;
import com.nexora.backend.domain.model.PasswordResetToken;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetIntegrationTest {
    private static final String EMAIL = "merchant@example.com";
    private static final String OLD_PASSWORD = "old-password";
    private static final String NEW_PASSWORD = "New-password-123!";

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

    private UUID userId;

    @BeforeEach
    void setup() {
        UUID tenantId = UUID.randomUUID();
        userId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Tenant A"));
            entityManager.persist(new User(
                    userId,
                    EMAIL,
                    passwordEncoder.encode(OLD_PASSWORD),
                    Role.MERCHANT,
                    tenantId
            ));
            entityManager.flush();
        });
    }

    @Test
    void requestPasswordReset_returnsGenericMessageForExistingEmail() throws Exception {
        mockMvc.perform(post("/api/auth/password-reset/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.PasswordResetRequest(EMAIL))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If the email exists, a password reset link has been sent."));

        verify(passwordResetNotifier).sendPasswordResetLink(
                eq(EMAIL),
                org.mockito.ArgumentMatchers.startsWith("http://localhost/reset-password?token="),
                any(Instant.class)
        );
    }

    @Test
    void requestPasswordReset_returnsGenericMessageForUnknownEmail() throws Exception {
        mockMvc.perform(post("/api/auth/password-reset/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.PasswordResetRequest("unknown@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If the email exists, a password reset link has been sent."));

        verify(passwordResetNotifier, never()).sendPasswordResetLink(any(), any(), any());
    }

    @Test
    void confirmPasswordReset_updatesPasswordAndConsumesToken() throws Exception {
        String rawToken = "valid-reset-token";
        persistToken(rawToken, Instant.now().plusSeconds(900), null);

        mockMvc.perform(post("/api/auth/password-reset/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.PasswordResetConfirmRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password has been reset. You can sign in with the new password."));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(EMAIL, OLD_PASSWORD))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(EMAIL, NEW_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        mockMvc.perform(post("/api/auth/password-reset/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.PasswordResetConfirmRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void confirmPasswordReset_rejectsExpiredToken() throws Exception {
        String rawToken = "expired-reset-token";
        persistToken(rawToken, Instant.now().minusSeconds(60), null);

        mockMvc.perform(post("/api/auth/password-reset/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.PasswordResetConfirmRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Reset token is invalid or expired"));
    }

    private void persistToken(String rawToken, Instant expiresAt, Instant usedAt) {
        transactionTemplate.executeWithoutResult(status -> {
            entityManager.persist(new PasswordResetToken(
                    UUID.randomUUID(),
                    userId,
                    PasswordResetTokenHasher.hash(rawToken),
                    expiresAt,
                    usedAt,
                    Instant.now(),
                    "127.0.0.1"
            ));
            entityManager.flush();
        });
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM password_reset_tokens").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

package com.nexora.backend.application;

import com.nexora.backend.domain.model.PasswordResetToken;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.PasswordResetTokenRepository;
import com.nexora.backend.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {
    private static final Pattern STRONG_PASSWORD = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,}$"
    );
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetNotifier notifier;
    private final Clock clock;

    @Value("${app.password-reset.token-ttl:PT30M}")
    private Duration tokenTtl;

    @Value("${app.frontend.base-url:http://localhost}")
    private String frontendBaseUrl;

    @Transactional
    public void requestPasswordReset(String email, String remoteIp) {
        String normalizedEmail = normalizeEmail(email);
        userRepository.findByEmailIgnoreCase(normalizedEmail)
                .ifPresent(user -> createResetToken(user, remoteIp, ResetTokenPurpose.PASSWORD_RESET, true));
    }

    @Transactional
    public void sendAccountSetupLink(String email, String remoteIp) {
        String normalizedEmail = normalizeEmail(email);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Account setup user not found"));
        createResetToken(user, remoteIp, ResetTokenPurpose.ACCOUNT_SETUP, false);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        validatePassword(newPassword);

        String token = rawToken == null ? "" : rawToken.trim();
        if (token.isBlank()) {
            throw new IllegalArgumentException("Reset token is required");
        }

        PasswordResetToken resetToken = tokenRepository.findByTokenHash(PasswordResetTokenHasher.hash(token))
                .orElseThrow(() -> new IllegalArgumentException("Reset token is invalid or expired"));

        Instant current = now();
        if (resetToken.getUsedAt() != null || !resetToken.getExpiresAt().isAfter(current)) {
            throw new IllegalArgumentException("Reset token is invalid or expired");
        }

        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Reset token is invalid or expired"));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        resetToken.setUsedAt(current);
    }

    private void createResetToken(User user, String remoteIp, ResetTokenPurpose purpose, boolean suppressNotificationFailure) {
        Instant current = now();
        List<PasswordResetToken> existingTokens = tokenRepository.findByUserIdAndUsedAtIsNull(user.getId());
        existingTokens.forEach(token -> token.setUsedAt(current));

        String rawToken = generateToken();
        PasswordResetToken resetToken = new PasswordResetToken(
                UUID.randomUUID(),
                user.getId(),
                PasswordResetTokenHasher.hash(rawToken),
                current.plus(tokenTtl),
                null,
                current,
                truncate(remoteIp, 64)
        );

        tokenRepository.save(resetToken);
        try {
            String resetUrl = buildResetUrl(rawToken);
            if (purpose == ResetTokenPurpose.ACCOUNT_SETUP) {
                notifier.sendAccountSetupLink(user.getEmail(), resetUrl, resetToken.getExpiresAt());
            } else {
                notifier.sendPasswordResetLink(user.getEmail(), resetUrl, resetToken.getExpiresAt());
            }
        } catch (RuntimeException ex) {
            if (suppressNotificationFailure) {
                log.warn(
                        "{} notification failed for user {}: {}",
                        purpose.logLabel(),
                        user.getId(),
                        ex.getMessage()
                );
            } else {
                log.error("{} notification failed for user {}", purpose.logLabel(), user.getId(), ex);
                throw new IllegalStateException(purpose.logLabel() + " notification failed", ex);
            }
        }
    }

    private String buildResetUrl(String rawToken) {
        String baseUrl = frontendBaseUrl == null || frontendBaseUrl.isBlank()
                ? "http://localhost"
                : frontendBaseUrl.replaceAll("/+$", "");
        return baseUrl + "/reset-password?token=" + rawToken;
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void validatePassword(String password) {
        if (password == null || !STRONG_PASSWORD.matcher(password).matches()) {
            throw new IllegalArgumentException(
                    "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol"
            );
        }
    }

    private String normalizeEmail(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private Instant now() {
        return Instant.now(clock);
    }

    private enum ResetTokenPurpose {
        PASSWORD_RESET("Password reset"),
        ACCOUNT_SETUP("Account setup");

        private final String logLabel;

        ResetTokenPurpose(String logLabel) {
            this.logLabel = logLabel;
        }

        private String logLabel() {
            return logLabel;
        }
    }
}

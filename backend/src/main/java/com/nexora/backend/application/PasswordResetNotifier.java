package com.nexora.backend.application;

import java.time.Instant;

public interface PasswordResetNotifier {
    void sendPasswordResetLink(String email, String resetUrl, Instant expiresAt);
}

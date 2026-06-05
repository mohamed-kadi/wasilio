package com.nexora.backend.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtServiceTest {

    @Test
    void missingSecret_failsStartupValidation() {
        JwtService service = jwtService("", 86_400_000L);

        assertThrows(IllegalStateException.class, service::validateConfiguration);
    }

    @Test
    void shortSecret_failsStartupValidation() {
        String shortSecret = Base64.getEncoder().encodeToString("too-short".getBytes(StandardCharsets.UTF_8));
        JwtService service = jwtService(shortSecret, 86_400_000L);

        assertThrows(IllegalStateException.class, service::validateConfiguration);
    }

    @Test
    void hexLookingSecret_failsStartupValidation() {
        JwtService service = jwtService("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", 86_400_000L);

        assertThrows(IllegalStateException.class, service::validateConfiguration);
    }

    @Test
    void strongBase64Secret_passesStartupValidation() {
        String strongSecret = Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".getBytes(StandardCharsets.UTF_8));
        JwtService service = jwtService(strongSecret, 86_400_000L);

        assertDoesNotThrow(service::validateConfiguration);
    }

    private JwtService jwtService(String secret, long expiration) {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secretKey", secret);
        ReflectionTestUtils.setField(service, "jwtExpiration", expiration);
        return service;
    }
}

package com.nexora.backend.infrastructure.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.security.throttling")
public class SecurityThrottleProperties {

    private boolean enabled = true;
    private Limit login = new Limit();
    private Limit onboarding = new Limit();

    @Getter
    @Setter
    public static class Limit {
        private int maxAttempts = 5;
        private Duration window = Duration.ofMinutes(10);
        private Duration lockout = Duration.ofMinutes(15);
    }
}

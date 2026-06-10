package com.nexora.backend.infrastructure.security;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
public class AbuseProtectionService {

    private final SecurityThrottleProperties properties;
    private final Clock clock;
    private final ConcurrentMap<String, AttemptBucket> buckets = new ConcurrentHashMap<>();

    public RateLimitDecision checkLoginAllowed(String email, String remoteIp) {
        if (!properties.isEnabled()) {
            return RateLimitDecision.allow();
        }

        return firstDenied(List.of(
                checkOnly(loginEmailKey(email), properties.getLogin(), "login-email"),
                checkOnly(loginIpKey(remoteIp), properties.getLogin(), "login-ip")
        ));
    }

    public RateLimitDecision recordLoginFailure(String email, String remoteIp) {
        if (!properties.isEnabled()) {
            return RateLimitDecision.allow();
        }

        return firstDenied(List.of(
                recordFailure(loginEmailKey(email), properties.getLogin(), "login-email"),
                recordFailure(loginIpKey(remoteIp), properties.getLogin(), "login-ip")
        ));
    }

    public void recordLoginSuccess(String email) {
        if (!properties.isEnabled()) {
            return;
        }

        buckets.remove(loginEmailKey(email));
    }

    public RateLimitDecision recordOnboardingAttempt(String email, String remoteIp) {
        if (!properties.isEnabled()) {
            return RateLimitDecision.allow();
        }

        RateLimitDecision emailDecision = consume(onboardingEmailKey(email), properties.getOnboarding(), "onboarding-email");
        if (!emailDecision.allowed()) {
            return emailDecision;
        }

        return consume(onboardingIpKey(remoteIp), properties.getOnboarding(), "onboarding-ip");
    }

    public RateLimitDecision recordPasswordResetAttempt(String email, String remoteIp) {
        if (!properties.isEnabled()) {
            return RateLimitDecision.allow();
        }

        RateLimitDecision emailDecision = consume(passwordResetEmailKey(email), properties.getPasswordReset(), "password-reset-email");
        if (!emailDecision.allowed()) {
            return emailDecision;
        }

        return consume(passwordResetIpKey(remoteIp), properties.getPasswordReset(), "password-reset-ip");
    }

    public void clearAll() {
        buckets.clear();
    }

    private RateLimitDecision firstDenied(List<RateLimitDecision> decisions) {
        return decisions.stream()
                .filter(decision -> !decision.allowed())
                .findFirst()
                .orElseGet(RateLimitDecision::allow);
    }

    private RateLimitDecision checkOnly(String key, SecurityThrottleProperties.Limit limit, String scope) {
        AttemptBucket bucket = buckets.computeIfAbsent(key, ignored -> new AttemptBucket(now()));
        synchronized (bucket) {
            refreshWindow(bucket, limit);
            if (bucket.lockedUntil != null && bucket.lockedUntil.isAfter(now())) {
                return RateLimitDecision.denied(Duration.between(now(), bucket.lockedUntil), scope);
            }
            return RateLimitDecision.allow();
        }
    }

    private RateLimitDecision recordFailure(String key, SecurityThrottleProperties.Limit limit, String scope) {
        AttemptBucket bucket = buckets.computeIfAbsent(key, ignored -> new AttemptBucket(now()));
        synchronized (bucket) {
            refreshWindow(bucket, limit);
            if (bucket.lockedUntil != null && bucket.lockedUntil.isAfter(now())) {
                return RateLimitDecision.denied(Duration.between(now(), bucket.lockedUntil), scope);
            }

            bucket.attempts++;
            if (bucket.attempts >= limit.getMaxAttempts()) {
                bucket.lockedUntil = now().plus(limit.getLockout());
                return RateLimitDecision.denied(limit.getLockout(), scope);
            }

            return RateLimitDecision.allow();
        }
    }

    private RateLimitDecision consume(String key, SecurityThrottleProperties.Limit limit, String scope) {
        AttemptBucket bucket = buckets.computeIfAbsent(key, ignored -> new AttemptBucket(now()));
        synchronized (bucket) {
            refreshWindow(bucket, limit);
            if (bucket.lockedUntil != null && bucket.lockedUntil.isAfter(now())) {
                return RateLimitDecision.denied(Duration.between(now(), bucket.lockedUntil), scope);
            }
            if (bucket.attempts >= limit.getMaxAttempts()) {
                bucket.lockedUntil = now().plus(limit.getLockout());
                return RateLimitDecision.denied(limit.getLockout(), scope);
            }

            bucket.attempts++;
            return RateLimitDecision.allow();
        }
    }

    private void refreshWindow(AttemptBucket bucket, SecurityThrottleProperties.Limit limit) {
        Instant current = now();
        if (!bucket.windowStartedAt.plus(limit.getWindow()).isAfter(current)) {
            bucket.windowStartedAt = current;
            bucket.attempts = 0;
            bucket.lockedUntil = null;
        }
    }

    private Instant now() {
        return Instant.now(clock);
    }

    private String loginEmailKey(String email) {
        return "login:email:" + normalize(email);
    }

    private String loginIpKey(String remoteIp) {
        return "login:ip:" + normalize(remoteIp);
    }

    private String onboardingEmailKey(String email) {
        return "onboarding:email:" + normalize(email);
    }

    private String onboardingIpKey(String remoteIp) {
        return "onboarding:ip:" + normalize(remoteIp);
    }

    private String passwordResetEmailKey(String email) {
        return "password-reset:email:" + normalize(email);
    }

    private String passwordResetIpKey(String remoteIp) {
        return "password-reset:ip:" + normalize(remoteIp);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static final class AttemptBucket {
        private Instant windowStartedAt;
        private int attempts;
        private Instant lockedUntil;

        private AttemptBucket(Instant windowStartedAt) {
            this.windowStartedAt = windowStartedAt;
        }
    }
}

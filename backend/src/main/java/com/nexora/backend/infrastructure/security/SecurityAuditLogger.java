package com.nexora.backend.infrastructure.security;

import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SecurityAuditLogger {

    private static final Logger SECURITY_AUDIT = LoggerFactory.getLogger("security.audit");

    public void loginSucceeded(String email, String tenantId, String remoteIp) {
        log("login_success", email, tenantId, remoteIp, "");
    }

    public void loginFailed(String email, String remoteIp) {
        log("login_failed", email, "", remoteIp, "");
    }

    public void loginThrottled(String email, String remoteIp) {
        log("login_throttled", email, "", remoteIp, "");
    }

    public void tenantOnboardingSucceeded(String email, UUID tenantId, String remoteIp) {
        log("tenant_onboarding_success", email, tenantId == null ? "" : tenantId.toString(), remoteIp, "");
    }

    public void tenantOnboardingRejected(String email, String remoteIp, String reason) {
        log("tenant_onboarding_rejected", email, "", remoteIp, reason);
    }

    public void tenantOnboardingThrottled(String email, String remoteIp) {
        log("tenant_onboarding_throttled", email, "", remoteIp, "");
    }

    private void log(String event, String email, String tenantId, String remoteIp, String reason) {
        SECURITY_AUDIT.info(
                "event={} correlationId={} email={} tenantId={} remoteIp={} reason={}",
                event,
                CorrelationIdContext.getRequiredString(),
                safe(email),
                safe(tenantId),
                safe(remoteIp),
                safe(reason)
        );
    }

    private String safe(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n\\t]", "_");
    }
}

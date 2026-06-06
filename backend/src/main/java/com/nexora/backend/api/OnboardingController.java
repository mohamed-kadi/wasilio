package com.nexora.backend.api;

import com.nexora.backend.application.TenantOnboardingService;
import com.nexora.backend.infrastructure.security.AbuseProtectionService;
import com.nexora.backend.infrastructure.security.ClientIpResolver;
import com.nexora.backend.infrastructure.security.RateLimitDecision;
import com.nexora.backend.infrastructure.security.RateLimitExceededException;
import com.nexora.backend.infrastructure.security.SecurityAuditLogger;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final TenantOnboardingService onboardingService;
    private final AbuseProtectionService abuseProtectionService;
    private final SecurityAuditLogger securityAuditLogger;

    public record TenantOnboardingRequest(
            @NotBlank @Size(min = 2, max = 120) String tenantName,
            @NotBlank @Size(min = 2, max = 120) String adminName,
            @NotBlank @Email @Size(max = 255) String adminEmail,
            @NotBlank @Size(min = 12, max = 128) String password
    ) {}

    public record TenantOnboardingResponse(
            UUID tenantId,
            String tenantName,
            UUID workspaceId,
            String workspaceName,
            UUID adminUserId,
            String adminEmail,
            String adminRole
    ) {
        static TenantOnboardingResponse from(TenantOnboardingService.TenantOnboardingResult result) {
            return new TenantOnboardingResponse(
                    result.tenantId(),
                    result.tenantName(),
                    result.workspaceId(),
                    result.workspaceName(),
                    result.adminUserId(),
                    result.adminEmail(),
                    result.adminRole().name()
            );
        }
    }

    @PostMapping("/tenants")
    public ResponseEntity<TenantOnboardingResponse> onboardTenant(
            @Valid @RequestBody TenantOnboardingRequest request,
            HttpServletRequest servletRequest
    ) {
        String adminEmail = normalizeEmail(request.adminEmail());
        String remoteIp = ClientIpResolver.resolve(servletRequest);

        RateLimitDecision decision = abuseProtectionService.recordOnboardingAttempt(adminEmail, remoteIp);
        if (!decision.allowed()) {
            securityAuditLogger.tenantOnboardingThrottled(adminEmail, remoteIp);
            throw new RateLimitExceededException("Tenant onboarding temporarily locked due to repeated attempts", decision.retryAfter());
        }

        TenantOnboardingService.TenantOnboardingResult result;
        try {
            result = onboardingService.onboardTenant(
                    new TenantOnboardingService.TenantOnboardingCommand(
                            request.tenantName(),
                            request.adminName(),
                            adminEmail,
                            request.password()
                    )
            );
        } catch (RuntimeException ex) {
            securityAuditLogger.tenantOnboardingRejected(adminEmail, remoteIp, ex.getClass().getSimpleName());
            throw ex;
        }

        securityAuditLogger.tenantOnboardingSucceeded(result.adminEmail(), result.tenantId(), remoteIp);

        return ResponseEntity.status(HttpStatus.CREATED).body(TenantOnboardingResponse.from(result));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}

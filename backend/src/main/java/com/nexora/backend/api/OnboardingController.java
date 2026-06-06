package com.nexora.backend.api;

import com.nexora.backend.application.TenantOnboardingService;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final TenantOnboardingService onboardingService;

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
            @Valid @RequestBody TenantOnboardingRequest request
    ) {
        TenantOnboardingService.TenantOnboardingResult result = onboardingService.onboardTenant(
                new TenantOnboardingService.TenantOnboardingCommand(
                        request.tenantName(),
                        request.adminName(),
                        request.adminEmail(),
                        request.password()
                )
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(TenantOnboardingResponse.from(result));
    }
}

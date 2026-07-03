package com.nexora.backend.api;

import com.nexora.backend.application.PublicStorefrontManagementService;
import com.nexora.backend.application.PublicStorefrontSettingsCommand;
import com.nexora.backend.application.PublicStorefrontSettingsResponse;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/storefront-settings")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class PublicStorefrontSettingsController {

    private final PublicStorefrontManagementService storefrontManagementService;

    @GetMapping
    public ResponseEntity<PublicStorefrontSettingsResponse> getSettings() {
        return storefrontManagementService.getSettings(getCurrentTenantId())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public ResponseEntity<PublicStorefrontSettingsResponse> upsertSettings(
            @Valid @RequestBody StorefrontSettingsRequest request
    ) {
        return ResponseEntity.ok(storefrontManagementService.upsertSettings(
                getCurrentTenantId(),
                request.toCommand()
        ));
    }

    private UUID getCurrentTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return UUID.fromString(userDetails.getTenantId());
    }

    public record StorefrontSettingsRequest(
            @NotBlank(message = "storeSlug is required")
            @Size(max = 160, message = "storeSlug must be at most 160 characters")
            String storeSlug,

            @NotBlank(message = "publicName is required")
            @Size(max = 255, message = "publicName must be at most 255 characters")
            String publicName,

            PublicStorefrontStatus status,

            @Size(max = 50, message = "supportChannelType must be at most 50 characters")
            String supportChannelType,

            @Size(max = 255, message = "supportChannelValue must be at most 255 characters")
            String supportChannelValue,

            @NotBlank(message = "defaultCountryCode is required")
            @Size(min = 2, max = 2, message = "defaultCountryCode must be 2 characters")
            String defaultCountryCode,

            @NotBlank(message = "defaultCurrency is required")
            @Size(min = 3, max = 3, message = "defaultCurrency must be 3 characters")
            String defaultCurrency,

            @NotBlank(message = "phonePattern is required")
            @Size(max = 255, message = "phonePattern must be at most 255 characters")
            String phonePattern
    ) {
        PublicStorefrontSettingsCommand toCommand() {
            return new PublicStorefrontSettingsCommand(
                    storeSlug,
                    publicName,
                    status,
                    supportChannelType,
                    supportChannelValue,
                    defaultCountryCode,
                    defaultCurrency,
                    phonePattern
            );
        }
    }
}

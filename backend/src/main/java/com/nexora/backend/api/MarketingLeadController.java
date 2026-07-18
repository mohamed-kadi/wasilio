package com.nexora.backend.api;

import com.nexora.backend.application.MarketingLeadService;
import com.nexora.backend.domain.model.MarketingLead;
import com.nexora.backend.domain.model.MarketingLeadStatus;
import com.nexora.backend.infrastructure.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/marketing/leads")
@RequiredArgsConstructor
public class MarketingLeadController {

    private final MarketingLeadService marketingLeadService;

    public record CaptureLeadRequest(
            @NotBlank @Size(min = 2, max = 120) String contactName,
            @NotBlank @Size(min = 2, max = 160) String storeName,
            @NotBlank @Size(min = 6, max = 40) String phone,
            @Email @Size(max = 255) String email,
            @Size(max = 80) String city,
            @Size(max = 80) String monthlyOrderVolume,
            @Size(max = 1000) String message,
            @Size(max = 255) String campaignSource
    ) {}

    public record LeadResponse(
            UUID leadId,
            String contactName,
            String storeName,
            String phone,
            String email,
            String city,
            String monthlyOrderVolume,
            String message,
            String campaignSource,
            MarketingLeadStatus status,
            Instant nextFollowUpAt,
            String internalNotes,
            UUID convertedTenantId,
            Instant convertedAt,
            Instant createdAt
    ) {
        static LeadResponse from(MarketingLead lead) {
            return new LeadResponse(
                    lead.getLeadId(),
                    lead.getContactName(),
                    lead.getStoreName(),
                    lead.getPhone(),
                    lead.getEmail(),
                    lead.getCity(),
                    lead.getMonthlyOrderVolume(),
                    lead.getMessage(),
                    lead.getCampaignSource(),
                    lead.getStatus(),
                    lead.getNextFollowUpAt(),
                    lead.getInternalNotes(),
                    lead.getConvertedTenantId(),
                    lead.getConvertedAt(),
                    lead.getCreatedAt()
            );
        }
    }

    public record TenantConversionResponse(
            LeadResponse lead,
            OnboardingController.TenantOnboardingResponse tenant
    ) {
        static TenantConversionResponse from(MarketingLeadService.LeadTenantConversionResult result) {
            return new TenantConversionResponse(
                    LeadResponse.from(result.lead()),
                    OnboardingController.TenantOnboardingResponse.from(result.tenant())
            );
        }
    }

    public record UpdateLeadFollowUpRequest(
            @jakarta.validation.constraints.NotNull MarketingLeadStatus status,
            Instant nextFollowUpAt,
            @Size(max = 2000) String internalNotes
    ) {}

    public record ConvertLeadToTenantRequest(
            @NotBlank @Size(min = 2, max = 120) String tenantName,
            @NotBlank @Size(min = 2, max = 120) String adminName,
            @NotBlank @Email @Size(max = 255) String adminEmail,
            @Size(max = 128) String password,
            @Size(max = 2000) String internalNotes
    ) {}

    @PostMapping
    public ResponseEntity<LeadResponse> captureLead(
            @Valid @RequestBody CaptureLeadRequest request,
            HttpServletRequest servletRequest
    ) {
        MarketingLead lead = marketingLeadService.capture(new MarketingLeadService.CaptureLeadCommand(
                request.contactName(),
                request.storeName(),
                request.phone(),
                request.email(),
                request.city(),
                request.monthlyOrderVolume(),
                request.message(),
                request.campaignSource(),
                ClientIpResolver.resolve(servletRequest)
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(LeadResponse.from(lead));
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<LeadResponse>> listLeads() {
        return ResponseEntity.ok(marketingLeadService.listLeads().stream()
                .map(LeadResponse::from)
                .toList());
    }

    @PatchMapping("/{leadId}/follow-up")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<LeadResponse> updateFollowUp(
            @PathVariable UUID leadId,
            @Valid @RequestBody UpdateLeadFollowUpRequest request
    ) {
        MarketingLead lead = marketingLeadService.updateFollowUp(leadId, new MarketingLeadService.UpdateLeadFollowUpCommand(
                request.status(),
                request.nextFollowUpAt(),
                request.internalNotes()
        ));
        return ResponseEntity.ok(LeadResponse.from(lead));
    }

    @PostMapping("/{leadId}/convert-to-tenant")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<TenantConversionResponse> convertToTenant(
            @PathVariable UUID leadId,
            @Valid @RequestBody ConvertLeadToTenantRequest request,
            HttpServletRequest servletRequest
    ) {
        MarketingLeadService.LeadTenantConversionResult result = marketingLeadService.convertToTenant(
                leadId,
                new MarketingLeadService.ConvertLeadToTenantCommand(
                        request.tenantName(),
                        request.adminName(),
                        request.adminEmail(),
                        request.password(),
                        request.internalNotes(),
                        ClientIpResolver.resolve(servletRequest)
                )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(TenantConversionResponse.from(result));
    }
}

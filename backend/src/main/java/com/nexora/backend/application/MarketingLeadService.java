package com.nexora.backend.application;

import com.nexora.backend.domain.model.MarketingLead;
import com.nexora.backend.domain.model.MarketingLeadStatus;
import com.nexora.backend.domain.repository.MarketingLeadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MarketingLeadService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final MarketingLeadRepository marketingLeadRepository;
    private final TenantOnboardingService tenantOnboardingService;
    private final PasswordResetService passwordResetService;

    public record CaptureLeadCommand(
            String contactName,
            String storeName,
            String phone,
            String email,
            String city,
            String monthlyOrderVolume,
            String message,
            String campaignSource,
            String remoteIp
    ) {}

    public record UpdateLeadFollowUpCommand(
            MarketingLeadStatus status,
            java.time.Instant nextFollowUpAt,
            String internalNotes
    ) {}

    public record ConvertLeadToTenantCommand(
            String tenantName,
            String adminName,
            String adminEmail,
            String password,
            String internalNotes,
            String remoteIp
    ) {}

    public record LeadTenantConversionResult(
            MarketingLead lead,
            TenantOnboardingService.TenantOnboardingResult tenant
    ) {}

    @Transactional
    public MarketingLead capture(CaptureLeadCommand command) {
        MarketingLead lead = MarketingLead.create(
                command.contactName().trim(),
                command.storeName().trim(),
                command.phone().trim(),
                command.email(),
                command.city(),
                command.monthlyOrderVolume(),
                command.message(),
                command.campaignSource(),
                command.remoteIp()
        );
        return marketingLeadRepository.save(lead);
    }

    @Transactional(readOnly = true)
    public List<MarketingLead> listLeads() {
        return marketingLeadRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public MarketingLead updateFollowUp(UUID leadId, UpdateLeadFollowUpCommand command) {
        MarketingLead lead = marketingLeadRepository.findById(leadId)
                .orElseThrow(() -> new IllegalArgumentException("Marketing lead not found"));

        lead.updateFollowUp(
                command.status(),
                command.nextFollowUpAt(),
                command.internalNotes()
        );
        return marketingLeadRepository.save(lead);
    }

    @Transactional
    public LeadTenantConversionResult convertToTenant(UUID leadId, ConvertLeadToTenantCommand command) {
        MarketingLead lead = marketingLeadRepository.findById(leadId)
                .orElseThrow(() -> new IllegalArgumentException("Marketing lead not found"));

        if (lead.getConvertedTenantId() != null) {
            throw new IllegalStateException("Marketing lead is already converted to a tenant");
        }

        String initialPassword = command.password();
        if (initialPassword == null || initialPassword.isBlank()) {
            initialPassword = generateTemporaryPassword();
        }

        TenantOnboardingService.TenantOnboardingResult tenant = tenantOnboardingService.onboardTenantFromStaff(
                new TenantOnboardingService.TenantOnboardingCommand(
                        command.tenantName(),
                        command.adminName(),
                        command.adminEmail(),
                        initialPassword
                )
        );

        String note = command.internalNotes();
        if (note == null || note.isBlank()) {
            note = "Converted to tenant " + tenant.tenantName() + ".";
        }
        lead.markConverted(tenant.tenantId(), note);
        passwordResetService.sendAccountSetupLink(tenant.adminEmail(), command.remoteIp());
        return new LeadTenantConversionResult(marketingLeadRepository.save(lead), tenant);
    }

    private String generateTemporaryPassword() {
        byte[] bytes = new byte[24];
        SECURE_RANDOM.nextBytes(bytes);
        return "Setup1!" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}

package com.nexora.backend.application;

import com.nexora.backend.domain.model.MarketingLead;
import com.nexora.backend.domain.model.MarketingLeadStatus;
import com.nexora.backend.domain.repository.MarketingLeadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MarketingLeadService {

    private final MarketingLeadRepository marketingLeadRepository;

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
}

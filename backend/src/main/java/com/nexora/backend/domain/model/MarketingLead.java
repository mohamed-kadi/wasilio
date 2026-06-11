package com.nexora.backend.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "marketing_leads")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class MarketingLead {
    @Id
    private UUID leadId;

    @Column(nullable = false, length = 120)
    private String contactName;

    @Column(nullable = false, length = 160)
    private String storeName;

    @Column(nullable = false, length = 40)
    private String phone;

    @Column(length = 255)
    private String email;

    @Column(length = 80)
    private String city;

    @Column(length = 80)
    private String monthlyOrderVolume;

    @Column(length = 1000)
    private String message;

    @Column(length = 255)
    private String campaignSource;

    @Column(length = 64)
    private String remoteIp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private MarketingLeadStatus status;

    @Column
    private Instant nextFollowUpAt;

    @Column(length = 2000)
    private String internalNotes;

    @Column(nullable = false)
    private Instant createdAt;

    public static MarketingLead create(
            String contactName,
            String storeName,
            String phone,
            String email,
            String city,
            String monthlyOrderVolume,
            String message,
            String campaignSource,
            String remoteIp
    ) {
        Instant now = Instant.now();
        return new MarketingLead(
                UUID.randomUUID(),
                contactName,
                storeName,
                phone,
                emptyToNull(email),
                emptyToNull(city),
                emptyToNull(monthlyOrderVolume),
                emptyToNull(message),
                emptyToNull(campaignSource),
                emptyToNull(remoteIp),
                MarketingLeadStatus.NEW,
                null,
                null,
                now
        );
    }

    public void updateFollowUp(MarketingLeadStatus status, Instant nextFollowUpAt, String internalNotes) {
        this.status = status;
        this.nextFollowUpAt = nextFollowUpAt;
        this.internalNotes = emptyToNull(internalNotes);
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

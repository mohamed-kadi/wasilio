package com.nexora.backend.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_intelligence_audit_events")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderIntelligenceAuditEvent {

    @Id
    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "sequence_number", nullable = false)
    private long sequenceNumber;

    @Column(name = "previous_confirmation_confidence_score")
    private Integer previousConfirmationConfidenceScore;

    @Column(name = "previous_fraud_risk_score")
    private Integer previousFraudRiskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_level", length = 50)
    private OrderIntelligenceLevel previousLevel;

    @Column(name = "confirmation_confidence_score", nullable = false)
    private int confirmationConfidenceScore;

    @Column(name = "fraud_risk_score", nullable = false)
    private int fraudRiskScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderIntelligenceLevel level;

    @Column(name = "confidence_delta", nullable = false)
    private int confidenceDelta;

    @Column(name = "risk_delta", nullable = false)
    private int riskDelta;

    @Column(name = "change_label", nullable = false, length = 255)
    private String changeLabel;

    @Column(nullable = false, length = 255)
    private String summary;

    @Column(name = "reason_key", length = 100)
    private String reasonKey;

    @Column(name = "reason_label", length = 255)
    private String reasonLabel;

    @Column(name = "reason_detail", length = 500)
    private String reasonDetail;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_severity", length = 50)
    private OrderIntelligenceSignalSeverity reasonSeverity;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_source", length = 50)
    private OrderIntelligenceSignalSource reasonSource;

    @Column(name = "calibration_version", nullable = false, length = 30)
    private String calibrationVersion;

    @Column(name = "calculated_at", nullable = false)
    private Instant calculatedAt;
}

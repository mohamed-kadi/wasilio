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
@Table(name = "order_intelligence_snapshots")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderIntelligenceSnapshot {

    @Id
    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "confirmation_confidence_score", nullable = false)
    private int confirmationConfidenceScore;

    @Column(name = "fraud_risk_score", nullable = false)
    private int fraudRiskScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderIntelligenceLevel level;

    @Column(nullable = false, length = 255)
    private String summary;

    @Column(name = "calculated_at", nullable = false)
    private Instant calculatedAt;

    public void updateScore(
            int confirmationConfidenceScore,
            int fraudRiskScore,
            OrderIntelligenceLevel level,
            String summary,
            Instant calculatedAt
    ) {
        this.confirmationConfidenceScore = confirmationConfidenceScore;
        this.fraudRiskScore = fraudRiskScore;
        this.level = level;
        this.summary = summary;
        this.calculatedAt = calculatedAt;
    }
}

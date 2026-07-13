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
@Table(name = "order_intelligence_signals")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderIntelligenceSignal {

    @Id
    @Column(name = "signal_id")
    private UUID signalId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "signal_key", nullable = false, length = 100)
    private String signalKey;

    @Column(nullable = false, length = 255)
    private String label;

    @Column(length = 500)
    private String detail;

    @Column(name = "confidence_delta", nullable = false)
    private int confidenceDelta;

    @Column(name = "risk_delta", nullable = false)
    private int riskDelta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderIntelligenceSignalSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderIntelligenceSignalSource source;

    @Column(name = "sort_rank", nullable = false)
    private int sortRank;

    @Column(name = "calculated_at", nullable = false)
    private Instant calculatedAt;
}

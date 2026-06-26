package com.nexora.backend.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "inbound_orders",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_inbound_orders_tenant_source_idempotency",
                        columnNames = {"tenant_id", "source", "idempotency_key"}
                ),
                @UniqueConstraint(
                        name = "ux_inbound_orders_tenant_source_external_order",
                        columnNames = {"tenant_id", "source", "external_order_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InboundOrder {
    @Id
    private UUID inboundOrderId;

    @Column(nullable = false)
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderSource source;

    @Column(length = 255)
    private String externalOrderId;

    @Column(nullable = false, length = 255)
    private String idempotencyKey;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String rawPayload;

    @Column(nullable = false)
    private Instant receivedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private InboundOrderStatus status;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    private UUID normalizedOrderId;

    private Instant normalizedAt;

    public void markNormalized(UUID orderId, Instant normalizedAt) {
        this.status = InboundOrderStatus.NORMALIZED;
        this.normalizedOrderId = orderId;
        this.normalizedAt = normalizedAt;
        this.rejectionReason = null;
    }

    public void markRejected(String reason) {
        this.status = InboundOrderStatus.REJECTED;
        this.rejectionReason = reason;
        this.normalizedOrderId = null;
        this.normalizedAt = null;
    }
}

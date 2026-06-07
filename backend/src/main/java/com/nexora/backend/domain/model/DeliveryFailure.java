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
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_failures")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryFailure {
    @Id
    private UUID failureId;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID orderId;

    @Column(nullable = false)
    private UUID courierId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeliveryFailureReason reason;

    @Column(length = 1000)
    private String note;

    @Column(nullable = false)
    private Instant createdAt;
}

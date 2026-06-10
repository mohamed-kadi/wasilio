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
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenant_payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TenantPayment {
    @Id
    private UUID paymentId;

    @Column(nullable = false)
    private UUID tenantId;

    private UUID subscriptionId;

    @Column(nullable = false, unique = true)
    private String receiptNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMethod method;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false)
    private Instant paidAt;

    private Instant periodStart;

    private Instant periodEnd;

    @Column(nullable = false)
    private String collectedBy;

    @Column(length = 1000)
    private String notes;

    @Column(nullable = false)
    private Instant createdAt;
}

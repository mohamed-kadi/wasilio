package com.nexora.backend.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Embedded
    private Customer customer;

    @Embedded
    private Address address;

    @Column(nullable = false)
    private BigDecimal amount;

    private String courierId;
    private String failureReason;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private OrderSource source;

    private UUID inboundOrderId;
    private String externalOrderId;

    @Column(nullable = false)
    private Instant createdAt;
    
    @Column(nullable = false)
    private Instant updatedAt;
    
    @Column(nullable = false)
    private int version;
}

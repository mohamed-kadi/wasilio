package com.nexora.backend.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.nexora.backend.infrastructure.persistence.OrderLineSnapshotListConverter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
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

    @Builder.Default
    @Convert(converter = OrderLineSnapshotListConverter.class)
    @Column(name = "order_lines", nullable = false, columnDefinition = "TEXT")
    private List<OrderLineSnapshot> orderLines = List.of();

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

package com.nexora.backend.api;

import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        UUID tenantId,
        OrderStatus status,
        Customer customer,
        Address address,
        BigDecimal amount,
        List<OrderLineSnapshotResponse> orderLines,
        String courierId,
        String failureReason,
        OrderSource source,
        UUID inboundOrderId,
        String externalOrderId,
        Instant createdAt,
        Instant updatedAt,
        int version,
        OrderIntelligenceResponse intelligence
) {
    static OrderResponse from(Order order) {
        return from(order, null);
    }

    static OrderResponse from(Order order, OrderIntelligenceResponse intelligence) {
        return new OrderResponse(
                order.getId(),
                order.getTenantId(),
                order.getStatus(),
                order.getCustomer(),
                order.getAddress(),
                order.getAmount(),
                toOrderLineResponses(order.getOrderLines()),
                order.getCourierId(),
                order.getFailureReason(),
                order.getSource(),
                order.getInboundOrderId(),
                order.getExternalOrderId(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getVersion(),
                intelligence
        );
    }

    private static List<OrderLineSnapshotResponse> toOrderLineResponses(List<OrderLineSnapshot> orderLines) {
        if (orderLines == null || orderLines.isEmpty()) {
            return List.of();
        }
        return orderLines.stream()
                .map(OrderLineSnapshotResponse::from)
                .toList();
    }

    public record OrderLineSnapshotResponse(
            String productName,
            String sku,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal,
            String currency
    ) {
        static OrderLineSnapshotResponse from(OrderLineSnapshot orderLine) {
            return new OrderLineSnapshotResponse(
                    orderLine.productName(),
                    orderLine.sku(),
                    orderLine.unitPrice(),
                    orderLine.quantity(),
                    orderLine.lineTotal(),
                    orderLine.currency()
            );
        }
    }
}

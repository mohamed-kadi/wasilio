package com.nexora.backend.application;

import com.nexora.backend.domain.model.DeliveryFailure;
import com.nexora.backend.domain.model.DeliveryFailureReason;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.DeliveryFailureRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliveryOperationsService {

    private final OrderLifecycleService orderLifecycleService;
    private final OrderRepository orderRepository;
    private final DeliveryFailureRepository deliveryFailureRepository;
    private final Clock clock;

    @Transactional
    public void markDelivered(UUID tenantId, UUID orderId) {
        requirePickedUpOrder(tenantId, orderId);
        orderLifecycleService.markDelivered(tenantId, orderId);
    }

    @Transactional
    public DeliveryFailure markFailed(UUID tenantId, UUID orderId, DeliveryFailureReason reason, String note) {
        Order order = requirePickedUpOrder(tenantId, orderId);
        UUID courierId = parseCourierId(order.getCourierId());

        orderLifecycleService.markFailed(tenantId, orderId, reason.name());

        return deliveryFailureRepository.save(DeliveryFailure.builder()
                .failureId(UUID.randomUUID())
                .tenantId(tenantId)
                .orderId(orderId)
                .courierId(courierId)
                .reason(reason)
                .note(normalize(note))
                .createdAt(Instant.now(clock))
                .build());
    }

    private Order requirePickedUpOrder(UUID tenantId, UUID orderId) {
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (order.getStatus() != OrderStatus.PICKED_UP) {
            throw new IllegalStateException("Invalid state transition from " + order.getStatus() + " expected " + OrderStatus.PICKED_UP);
        }
        if (order.getCourierId() == null || order.getCourierId().isBlank()) {
            throw new IllegalStateException("Picked up order must have an assigned courier");
        }
        return order;
    }

    private UUID parseCourierId(String courierId) {
        try {
            return UUID.fromString(courierId);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Picked up order has an invalid courier");
        }
    }

    private String normalize(String value) {
        String normalized = value == null ? null : value.trim();
        return normalized == null || normalized.isBlank() ? null : normalized;
    }
}

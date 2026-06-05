package com.nexora.backend.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.event.payload.*;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderLifecycleService {

    private final EventStore eventStore;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public UUID createOrder(UUID tenantId, Customer customer, Address address, BigDecimal amount) {
        UUID orderId = UUID.randomUUID();
        OrderCreatedEvent payload = new OrderCreatedEvent(customer, address, amount);
        appendEvent(tenantId, orderId, "OrderCreated", payload, 1);
        return orderId;
    }

    @Transactional
    public void requestConfirmation(UUID tenantId, UUID orderId) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.CREATED);
        appendEvent(tenantId, orderId, "OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), order.getVersion() + 1);
    }

    @Transactional
    public void confirmOrder(UUID tenantId, UUID orderId) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.CONFIRMATION_REQUESTED);
        appendEvent(tenantId, orderId, "OrderConfirmed", new OrderConfirmedEvent(), order.getVersion() + 1);
    }

    @Transactional
    public void rejectOrder(UUID tenantId, UUID orderId, String reason) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.CONFIRMATION_REQUESTED);
        appendEvent(tenantId, orderId, "OrderRejected", new OrderRejectedEvent(reason), order.getVersion() + 1);
    }

    @Transactional
    public void assignToCourier(UUID tenantId, UUID orderId, String courierId) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.CONFIRMED);
        appendEvent(tenantId, orderId, "OrderAssignedToCourier", new OrderAssignedToCourierEvent(courierId), order.getVersion() + 1);
    }

    @Transactional
    public void markPickedUp(UUID tenantId, UUID orderId, String courierId) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.ASSIGNED_TO_COURIER);
        if (order.getCourierId() != null && !order.getCourierId().equals(courierId)) {
            throw new IllegalStateException("Order assigned to a different courier");
        }
        appendEvent(tenantId, orderId, "OrderPickedUp", new OrderPickedUpEvent(courierId), order.getVersion() + 1);
    }

    @Transactional
    public void markDelivered(UUID tenantId, UUID orderId) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.PICKED_UP);
        appendEvent(tenantId, orderId, "OrderDelivered", new OrderDeliveredEvent(), order.getVersion() + 1);
    }

    @Transactional
    public void markFailed(UUID tenantId, UUID orderId, String reason) {
        Order order = getOrderAndValidate(tenantId, orderId, OrderStatus.PICKED_UP);
        appendEvent(tenantId, orderId, "OrderDeliveryFailed", new OrderDeliveryFailedEvent(reason), order.getVersion() + 1);
    }

    private Order getOrderAndValidate(UUID tenantId, UUID orderId, OrderStatus expectedStatus) {
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        
        if (order.getStatus() == OrderStatus.DELIVERED || order.getStatus() == OrderStatus.FAILED) {
            throw new IllegalStateException("Order is in a final state and cannot be modified.");
        }

        if (order.getStatus() != expectedStatus) {
            throw new IllegalStateException("Invalid state transition from " + order.getStatus() + " expected " + expectedStatus);
        }
        return order;
    }

    private void appendEvent(UUID tenantId, UUID aggregateId, String eventType, Object payload, int version) {
        try {
            DomainEvent event = DomainEvent.builder()
                    .eventId(UUID.randomUUID())
                    .eventType(eventType)
                    .version(version)
                    .tenantId(tenantId)
                    .aggregateId(aggregateId)
                    .timestamp(Instant.now())
                    .payload(objectMapper.writeValueAsString(payload))
                    .build();
            eventStore.append(event);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize event payload", e);
        }
    }
}

package com.nexora.backend.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.event.payload.*;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderLifecycleService {

    private static final int EVENT_SCHEMA_VERSION = 1;

    private final EventStore eventStore;
    private final ObjectMapper objectMapper;

    @Transactional
    public UUID createOrder(UUID tenantId, Customer customer, Address address, BigDecimal amount) {
        UUID orderId = UUID.randomUUID();
        OrderCreatedEvent payload = new OrderCreatedEvent(customer, address, amount);
        appendEvent(tenantId, orderId, "OrderCreated", payload, 0);
        return orderId;
    }

    @Transactional
    public void requestConfirmation(UUID tenantId, UUID orderId) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.CREATED);
        appendEvent(tenantId, orderId, "OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), order.sequence());
    }

    @Transactional
    public void confirmOrder(UUID tenantId, UUID orderId) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.CONFIRMATION_REQUESTED);
        appendEvent(tenantId, orderId, "OrderConfirmed", new OrderConfirmedEvent(), order.sequence());
    }

    @Transactional
    public void rejectOrder(UUID tenantId, UUID orderId, String reason) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.CONFIRMATION_REQUESTED);
        appendEvent(tenantId, orderId, "OrderRejected", new OrderRejectedEvent(reason), order.sequence());
    }

    @Transactional
    public void assignToCourier(UUID tenantId, UUID orderId, String courierId) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.CONFIRMED);
        appendEvent(tenantId, orderId, "OrderAssignedToCourier", new OrderAssignedToCourierEvent(courierId), order.sequence());
    }

    @Transactional
    public void markPickedUp(UUID tenantId, UUID orderId, String courierId) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.ASSIGNED_TO_COURIER);
        if (order.courierId() != null && !order.courierId().equals(courierId)) {
            throw new IllegalStateException("Order assigned to a different courier");
        }
        appendEvent(tenantId, orderId, "OrderPickedUp", new OrderPickedUpEvent(courierId), order.sequence());
    }

    @Transactional
    public void markDelivered(UUID tenantId, UUID orderId) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.PICKED_UP);
        appendEvent(tenantId, orderId, "OrderDelivered", new OrderDeliveredEvent(), order.sequence());
    }

    @Transactional
    public void markFailed(UUID tenantId, UUID orderId, String reason) {
        OrderState order = loadOrderAndValidate(tenantId, orderId, OrderStatus.PICKED_UP);
        appendEvent(tenantId, orderId, "OrderDeliveryFailed", new OrderDeliveryFailedEvent(reason), order.sequence());
    }

    private OrderState loadOrderAndValidate(UUID tenantId, UUID orderId, OrderStatus expectedStatus) {
        OrderState order = replayOrder(tenantId, orderId);

        if (!order.exists()) {
            throw new IllegalArgumentException("Order not found");
        }

        if (order.status() == OrderStatus.DELIVERED || order.status() == OrderStatus.FAILED) {
            throw new IllegalStateException("Order is in a final state and cannot be modified.");
        }

        if (order.status() != expectedStatus) {
            throw new IllegalStateException("Invalid state transition from " + order.status() + " expected " + expectedStatus);
        }
        return order;
    }

    private OrderState replayOrder(UUID tenantId, UUID orderId) {
        List<DomainEvent> events = eventStore.getEventsForAggregate(tenantId, orderId);
        OrderState state = OrderState.empty();
        for (DomainEvent event : events) {
            state = apply(state, event);
        }
        return state;
    }

    private OrderState apply(OrderState state, DomainEvent event) {
        try {
            return switch (event.getEventType()) {
                case "OrderCreated" -> new OrderState(true, OrderStatus.CREATED, null, event.getAggregateSequence());
                case "OrderConfirmationRequested" -> state.withStatus(OrderStatus.CONFIRMATION_REQUESTED, event.getAggregateSequence());
                case "OrderConfirmed" -> state.withStatus(OrderStatus.CONFIRMED, event.getAggregateSequence());
                case "OrderRejected" -> state.withStatus(OrderStatus.REJECTED, event.getAggregateSequence());
                case "OrderAssignedToCourier" -> {
                    OrderAssignedToCourierEvent payload = objectMapper.readValue(event.getPayload(), OrderAssignedToCourierEvent.class);
                    yield state.withCourier(OrderStatus.ASSIGNED_TO_COURIER, payload.courierId(), event.getAggregateSequence());
                }
                case "OrderPickedUp" -> state.withStatus(OrderStatus.PICKED_UP, event.getAggregateSequence());
                case "OrderDelivered" -> state.withStatus(OrderStatus.DELIVERED, event.getAggregateSequence());
                case "OrderDeliveryFailed" -> state.withStatus(OrderStatus.FAILED, event.getAggregateSequence());
                default -> throw new IllegalStateException("Unknown order event type: " + event.getEventType());
            };
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize event payload", e);
        }
    }

    private void appendEvent(UUID tenantId, UUID aggregateId, String eventType, Object payload, int expectedSequence) {
        try {
            DomainEvent event = DomainEvent.builder()
                    .eventId(UUID.randomUUID())
                    .eventType(eventType)
                    .aggregateSequence(expectedSequence + 1)
                    .eventSchemaVersion(EVENT_SCHEMA_VERSION)
                    .tenantId(tenantId)
                    .aggregateId(aggregateId)
                    .correlationId(CorrelationIdContext.get().orElse(null))
                    .timestamp(Instant.now())
                    .payload(objectMapper.writeValueAsString(payload))
                    .build();
            eventStore.append(event, expectedSequence);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize event payload", e);
        }
    }

    private record OrderState(boolean exists, OrderStatus status, String courierId, int sequence) {
        static OrderState empty() {
            return new OrderState(false, null, null, 0);
        }

        OrderState withStatus(OrderStatus nextStatus, int nextSequence) {
            return new OrderState(exists, nextStatus, courierId, nextSequence);
        }

        OrderState withCourier(OrderStatus nextStatus, String nextCourierId, int nextSequence) {
            return new OrderState(exists, nextStatus, nextCourierId, nextSequence);
        }
    }
}

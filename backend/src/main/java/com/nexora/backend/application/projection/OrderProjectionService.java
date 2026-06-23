package com.nexora.backend.application.projection;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
import com.nexora.backend.domain.event.payload.OrderAssignedToCourierEvent;
import com.nexora.backend.domain.event.payload.OrderCreatedEvent;
import com.nexora.backend.domain.event.payload.OrderDeliveryFailedEvent;
import com.nexora.backend.domain.event.payload.OrderRejectedEvent;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderProjectionService {

    public static final String PROJECTION_NAME = "orders";

    private final OrderRepository orderRepository;
    private final DomainEventRepository domainEventRepository;
    private final ProjectionProcessedEventRepository processedEventRepository;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void project(DomainEvent event) throws Exception {
        if (processedEventRepository.existsByProjectionNameAndEventId(PROJECTION_NAME, event.getEventId())) {
            return;
        }

        apply(event);
        markProcessed(event);
    }

    @Transactional
    public ProjectionRebuildResult rebuildAll() throws Exception {
        processedEventRepository.deleteByProjectionName(PROJECTION_NAME);
        orderRepository.deleteAllInBatch();
        entityManager.flush();
        entityManager.clear();

        List<DomainEvent> events = domainEventRepository.findAllByOrderByTenantIdAscAggregateIdAscAggregateSequenceAsc();
        for (DomainEvent event : events) {
            apply(event);
            markProcessed(event);
        }

        return new ProjectionRebuildResult(PROJECTION_NAME, events.size());
    }

    private void apply(DomainEvent event) throws Exception {
        switch (event.getEventType()) {
            case "OrderCreated" -> createOrder(event);
            case "OrderConfirmationRequested" -> updateOrderStatus(event, OrderStatus.CONFIRMATION_REQUESTED);
            case "OrderConfirmed" -> updateOrderStatus(event, OrderStatus.CONFIRMED);
            case "OrderRejected" -> rejectOrder(event);
            case "OrderAssignedToCourier" -> assignCourier(event);
            case "OrderPickedUp" -> updateOrderStatus(event, OrderStatus.PICKED_UP);
            case "OrderDelivered" -> updateOrderStatus(event, OrderStatus.DELIVERED);
            case "OrderDeliveryFailed" -> failDelivery(event);
            case "OrderDeliveryRetryRequested" -> retryDelivery(event);
            default -> throw new IllegalStateException("Unknown order event type: " + event.getEventType());
        }
    }

    private void createOrder(DomainEvent event) throws Exception {
        if (orderRepository.existsByIdAndTenantIdNot(event.getAggregateId(), event.getTenantId())) {
            throw new IllegalStateException("Order projection ID belongs to a different tenant");
        }

        OrderCreatedEvent payload = objectMapper.readValue(event.getPayload(), OrderCreatedEvent.class);
        Order order = Order.builder()
                .id(event.getAggregateId())
                .tenantId(event.getTenantId())
                .status(OrderStatus.CREATED)
                .customer(payload.customer())
                .address(payload.address())
                .amount(payload.amount())
                .createdAt(event.getTimestamp())
                .updatedAt(event.getTimestamp())
                .version(event.getAggregateSequence())
                .build();
        orderRepository.save(order);
    }

    private void rejectOrder(DomainEvent event) throws Exception {
        OrderRejectedEvent payload = objectMapper.readValue(event.getPayload(), OrderRejectedEvent.class);
        Order order = getOrder(event);
        order.setStatus(OrderStatus.REJECTED);
        order.setFailureReason(payload.reason());
        saveOrder(order, event);
    }

    private void assignCourier(DomainEvent event) throws Exception {
        OrderAssignedToCourierEvent payload = objectMapper.readValue(event.getPayload(), OrderAssignedToCourierEvent.class);
        Order order = getOrder(event);
        order.setStatus(OrderStatus.ASSIGNED_TO_COURIER);
        order.setCourierId(payload.courierId());
        saveOrder(order, event);
    }

    private void failDelivery(DomainEvent event) throws Exception {
        OrderDeliveryFailedEvent payload = objectMapper.readValue(event.getPayload(), OrderDeliveryFailedEvent.class);
        Order order = getOrder(event);
        order.setStatus(OrderStatus.FAILED);
        order.setFailureReason(payload.reason());
        saveOrder(order, event);
    }

    private void retryDelivery(DomainEvent event) {
        Order order = getOrder(event);
        order.setStatus(OrderStatus.CONFIRMED);
        order.setCourierId(null);
        order.setFailureReason(null);
        saveOrder(order, event);
    }

    private Order getOrder(DomainEvent event) {
        return orderRepository.findByIdAndTenantId(event.getAggregateId(), event.getTenantId())
                .orElseThrow(() -> new IllegalStateException("Order not found for projection"));
    }

    private void updateOrderStatus(DomainEvent event, OrderStatus status) {
        Order order = getOrder(event);
        order.setStatus(status);
        saveOrder(order, event);
    }

    private void saveOrder(Order order, DomainEvent event) {
        if (!order.getTenantId().equals(event.getTenantId())) {
            throw new IllegalStateException("Order projection tenant mismatch");
        }
        order.setUpdatedAt(event.getTimestamp());
        order.setVersion(event.getAggregateSequence());
        orderRepository.save(order);
    }

    private void markProcessed(DomainEvent event) {
        processedEventRepository.save(ProjectionProcessedEvent.builder()
                .projectionName(PROJECTION_NAME)
                .eventId(event.getEventId())
                .tenantId(event.getTenantId())
                .aggregateId(event.getAggregateId())
                .aggregateSequence(event.getAggregateSequence())
                .processedAt(Instant.now())
                .build());
    }

    public record ProjectionRebuildResult(String projectionName, int eventsProcessed) {}
}

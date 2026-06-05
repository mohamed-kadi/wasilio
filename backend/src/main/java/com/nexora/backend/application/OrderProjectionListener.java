package com.nexora.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.payload.*;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderProjectionListener {

    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    @EventListener
    public void on(DomainEvent event) throws Exception {
        switch (event.getEventType()) {
            case "OrderCreated": {
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
                break;
            }
            case "OrderConfirmationRequested": {
                updateOrderStatus(event, OrderStatus.CONFIRMATION_REQUESTED);
                break;
            }
            case "OrderConfirmed": {
                updateOrderStatus(event, OrderStatus.CONFIRMED);
                break;
            }
            case "OrderRejected": {
                OrderRejectedEvent payload = objectMapper.readValue(event.getPayload(), OrderRejectedEvent.class);
                Order order = getOrder(event);
                order.setStatus(OrderStatus.REJECTED);
                order.setFailureReason(payload.reason());
                saveOrder(order, event);
                break;
            }
            case "OrderAssignedToCourier": {
                OrderAssignedToCourierEvent payload = objectMapper.readValue(event.getPayload(), OrderAssignedToCourierEvent.class);
                Order order = getOrder(event);
                order.setStatus(OrderStatus.ASSIGNED_TO_COURIER);
                order.setCourierId(payload.courierId());
                saveOrder(order, event);
                break;
            }
            case "OrderPickedUp": {
                updateOrderStatus(event, OrderStatus.PICKED_UP);
                break;
            }
            case "OrderDelivered": {
                updateOrderStatus(event, OrderStatus.DELIVERED);
                break;
            }
            case "OrderDeliveryFailed": {
                OrderDeliveryFailedEvent payload = objectMapper.readValue(event.getPayload(), OrderDeliveryFailedEvent.class);
                Order order = getOrder(event);
                order.setStatus(OrderStatus.FAILED);
                order.setFailureReason(payload.reason());
                saveOrder(order, event);
                break;
            }
        }
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
}

package com.nexora.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.payload.OrderConfirmedEvent;
import com.nexora.backend.domain.event.payload.OrderCreatedEvent;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderProjectionListenerTest {

    private static final int EVENT_SCHEMA_VERSION = 1;

    @Mock
    private OrderRepository orderRepository;

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private OrderProjectionListener listener;
    private UUID tenantId;
    private UUID orderId;

    @BeforeEach
    void setUp() {
        listener = new OrderProjectionListener(orderRepository, objectMapper);
        tenantId = UUID.randomUUID();
        orderId = UUID.randomUUID();
    }

    @Test
    void projectionUpdateUsesTenantAwareLookup() throws Exception {
        Order order = Order.builder()
                .id(orderId)
                .tenantId(tenantId)
                .status(OrderStatus.CONFIRMATION_REQUESTED)
                .amount(BigDecimal.TEN)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .version(2)
                .build();
        when(orderRepository.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.of(order));

        listener.on(event("OrderConfirmed", new OrderConfirmedEvent(), 3));

        verify(orderRepository).findByIdAndTenantId(orderId, tenantId);
        verify(orderRepository, never()).findById(any(UUID.class));
        verify(orderRepository).save(orderCaptor.capture());
        Order savedOrder = orderCaptor.getValue();
        assertEquals(tenantId, savedOrder.getTenantId());
        assertEquals(OrderStatus.CONFIRMED, savedOrder.getStatus());
        assertEquals(3, savedOrder.getVersion());
    }

    @Test
    void projectionUpdateDoesNotSaveWhenTenantScopedLookupMisses() throws Exception {
        when(orderRepository.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () ->
                listener.on(event("OrderConfirmed", new OrderConfirmedEvent(), 3))
        );

        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void createdProjectionDoesNotOverwriteDifferentTenantOrderId() throws Exception {
        when(orderRepository.existsByIdAndTenantIdNot(orderId, tenantId)).thenReturn(true);

        assertThrows(IllegalStateException.class, () ->
                listener.on(event("OrderCreated", new OrderCreatedEvent(
                        new Customer("John", "Doe", "john@example.com", "123"),
                        new Address("Street", "City", "State", "10000", "Morocco"),
                        BigDecimal.TEN
                ), 1))
        );

        verify(orderRepository, never()).save(any(Order.class));
    }

    private DomainEvent event(String eventType, Object payload, int aggregateSequence) throws Exception {
        return DomainEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .aggregateSequence(aggregateSequence)
                .eventSchemaVersion(EVENT_SCHEMA_VERSION)
                .tenantId(tenantId)
                .aggregateId(orderId)
                .timestamp(Instant.now())
                .payload(objectMapper.writeValueAsString(payload))
                .build();
    }
}

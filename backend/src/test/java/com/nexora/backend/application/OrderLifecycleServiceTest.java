package com.nexora.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderLifecycleServiceTest {

    @Mock
    private EventStore eventStore;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private OrderLifecycleService service;

    @Captor
    private ArgumentCaptor<DomainEvent> eventCaptor;

    private UUID tenantId;
    private UUID orderId;
    private Customer customer;
    private Address address;
    private Order order;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        orderId = UUID.randomUUID();
        customer = new Customer("John", "Doe", "john@example.com", "123456789");
        address = new Address("Street", "City", "State", "10000", "Morocco");
        order = Order.builder()
                .id(orderId)
                .tenantId(tenantId)
                .status(OrderStatus.CREATED)
                .amount(BigDecimal.TEN)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .version(1)
                .build();
    }

    @Test
    void createOrder_success() throws Exception {
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        UUID createdId = service.createOrder(tenantId, customer, address, BigDecimal.TEN);
        
        assertNotNull(createdId);
        verify(eventStore).append(eventCaptor.capture());
        
        DomainEvent savedEvent = eventCaptor.getValue();
        assertEquals("OrderCreated", savedEvent.getEventType());
        assertEquals(tenantId, savedEvent.getTenantId());
        assertEquals(1, savedEvent.getVersion());
    }

    @Test
    void confirmOrder_success() throws Exception {
        order.setStatus(OrderStatus.CONFIRMATION_REQUESTED);
        when(orderRepository.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.of(order));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        service.confirmOrder(tenantId, orderId);

        verify(eventStore).append(eventCaptor.capture());
        assertEquals("OrderConfirmed", eventCaptor.getValue().getEventType());
    }

    @Test
    void confirmOrder_invalidState_throwsException() {
        order.setStatus(OrderStatus.CREATED); // Should be CONFIRMATION_REQUESTED
        when(orderRepository.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> 
            service.confirmOrder(tenantId, orderId)
        );
        assertTrue(ex.getMessage().contains("Invalid state transition"));
    }
    
    @Test
    void assignToCourier_success() throws Exception {
        order.setStatus(OrderStatus.CONFIRMED);
        when(orderRepository.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.of(order));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        service.assignToCourier(tenantId, orderId, "courier-123");

        verify(eventStore).append(eventCaptor.capture());
        assertEquals("OrderAssignedToCourier", eventCaptor.getValue().getEventType());
    }
    
    @Test
    void assignToCourier_invalidState_throwsException() {
        order.setStatus(OrderStatus.REJECTED); // Cannot assign if rejected
        when(orderRepository.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.of(order));

        assertThrows(IllegalStateException.class, () -> 
            service.assignToCourier(tenantId, orderId, "courier-123")
        );
    }
}

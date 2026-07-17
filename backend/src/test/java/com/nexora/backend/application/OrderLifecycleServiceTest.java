package com.nexora.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.event.payload.OrderAssignedToCourierEvent;
import com.nexora.backend.domain.event.payload.OrderConfirmationRequestClearedEvent;
import com.nexora.backend.domain.event.payload.OrderConfirmationRequestedEvent;
import com.nexora.backend.domain.event.payload.OrderConfirmedEvent;
import com.nexora.backend.domain.event.payload.OrderCreatedEvent;
import com.nexora.backend.domain.event.payload.OrderDeliveredEvent;
import com.nexora.backend.domain.event.payload.OrderDeliveryFailedEvent;
import com.nexora.backend.domain.event.payload.OrderDeliveryRetryRequestedEvent;
import com.nexora.backend.domain.event.payload.OrderPickedUpEvent;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderLifecycleServiceTest {

    private static final int EVENT_SCHEMA_VERSION = 1;

    @Mock
    private EventStore eventStore;

    @Captor
    private ArgumentCaptor<DomainEvent> eventCaptor;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private OrderLifecycleService service;
    private UUID tenantId;
    private UUID orderId;
    private Customer customer;
    private Address address;

    @BeforeEach
    void setUp() {
        service = new OrderLifecycleService(eventStore, objectMapper);
        tenantId = UUID.randomUUID();
        orderId = UUID.randomUUID();
        customer = new Customer("John", "Doe", "john@example.com", "123456789");
        address = new Address("Street", "City", "State", "10000", "Morocco");
    }

    @Test
    void createOrder_appendsFirstEventWithExpectedSequenceZero() {
        UUID createdId = service.createOrder(tenantId, customer, address, BigDecimal.TEN);

        assertNotNull(createdId);
        verify(eventStore).append(eventCaptor.capture(), eq(0));

        DomainEvent savedEvent = eventCaptor.getValue();
        assertEquals("OrderCreated", savedEvent.getEventType());
        assertEquals(tenantId, savedEvent.getTenantId());
        assertEquals(1, savedEvent.getAggregateSequence());
        assertEquals(EVENT_SCHEMA_VERSION, savedEvent.getEventSchemaVersion());
    }

    @Test
    void confirmOrder_rebuildsStateFromEventsAndAppendsNextSequence() throws Exception {
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1),
                event("OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2)
        ));

        service.confirmOrder(tenantId, orderId);

        verify(eventStore).append(eventCaptor.capture(), eq(2));
        DomainEvent savedEvent = eventCaptor.getValue();
        assertEquals("OrderConfirmed", savedEvent.getEventType());
        assertEquals(3, savedEvent.getAggregateSequence());
        assertEquals(EVENT_SCHEMA_VERSION, savedEvent.getEventSchemaVersion());
    }

    @Test
    void confirmOrder_invalidTransitionIsRejectedFromReplayedState() throws Exception {
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1)
        ));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.confirmOrder(tenantId, orderId)
        );

        assertTrue(ex.getMessage().contains("Invalid state transition"));
        verify(eventStore, never()).append(any(DomainEvent.class), anyInt());
    }

    @Test
    void clearConfirmationRequest_returnsRequestedOrderToCreated() throws Exception {
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1),
                event("OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2)
        ));

        service.clearConfirmationRequest(tenantId, orderId);

        verify(eventStore).append(eventCaptor.capture(), eq(2));
        DomainEvent savedEvent = eventCaptor.getValue();
        assertEquals("OrderConfirmationRequestCleared", savedEvent.getEventType());
        assertEquals(3, savedEvent.getAggregateSequence());
        assertEquals(EVENT_SCHEMA_VERSION, savedEvent.getEventSchemaVersion());
        assertNotNull(objectMapper.readValue(savedEvent.getPayload(), OrderConfirmationRequestClearedEvent.class));
    }

    @Test
    void clearConfirmationRequest_rejectsOrdersNotAwaitingConfirmation() throws Exception {
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1)
        ));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.clearConfirmationRequest(tenantId, orderId)
        );

        assertTrue(ex.getMessage().contains("Invalid state transition"));
        verify(eventStore, never()).append(any(DomainEvent.class), anyInt());
    }

    @Test
    void pickedUpOrder_replaysCourierAssignmentBeforeDeliveryFailure() throws Exception {
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1),
                event("OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2),
                event("OrderConfirmed", new OrderConfirmedEvent(), 3),
                event("OrderAssignedToCourier", new OrderAssignedToCourierEvent("courier-123"), 4),
                event("OrderPickedUp", new OrderPickedUpEvent("courier-123"), 5)
        ));

        service.markFailed(tenantId, orderId, "Customer unavailable");

        verify(eventStore).append(eventCaptor.capture(), eq(5));
        DomainEvent savedEvent = eventCaptor.getValue();
        assertEquals("OrderDeliveryFailed", savedEvent.getEventType());
        assertEquals(6, savedEvent.getAggregateSequence());
    }

    @Test
    void retryDelivery_appendsRetryEventFromFailedOrder() throws Exception {
        UUID recoveryId = UUID.randomUUID();
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1),
                event("OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2),
                event("OrderConfirmed", new OrderConfirmedEvent(), 3),
                event("OrderAssignedToCourier", new OrderAssignedToCourierEvent("courier-123"), 4),
                event("OrderPickedUp", new OrderPickedUpEvent("courier-123"), 5),
                event("OrderDeliveryFailed", new OrderDeliveryFailedEvent("Customer unavailable"), 6)
        ));

        service.retryDelivery(tenantId, orderId, recoveryId);

        verify(eventStore).append(eventCaptor.capture(), eq(6));
        DomainEvent savedEvent = eventCaptor.getValue();
        assertEquals("OrderDeliveryRetryRequested", savedEvent.getEventType());
        assertEquals(7, savedEvent.getAggregateSequence());
        assertEquals(recoveryId, objectMapper.readValue(savedEvent.getPayload(), OrderDeliveryRetryRequestedEvent.class).recoveryId());
    }

    @Test
    void deliveredAndFailedOrdersAreImmutableFromReplayedState() throws Exception {
        when(eventStore.getEventsForAggregate(tenantId, orderId)).thenReturn(List.of(
                event("OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1),
                event("OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2),
                event("OrderConfirmed", new OrderConfirmedEvent(), 3),
                event("OrderAssignedToCourier", new OrderAssignedToCourierEvent("courier-123"), 4),
                event("OrderPickedUp", new OrderPickedUpEvent("courier-123"), 5),
                event("OrderDelivered", new OrderDeliveredEvent(), 6)
        ));

        assertThrows(IllegalStateException.class, () -> service.markFailed(tenantId, orderId, "Too late"));

        UUID failedOrderId = UUID.randomUUID();
        when(eventStore.getEventsForAggregate(tenantId, failedOrderId)).thenReturn(List.of(
                event(failedOrderId, "OrderCreated", new OrderCreatedEvent(customer, address, BigDecimal.TEN), 1),
                event(failedOrderId, "OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2),
                event(failedOrderId, "OrderConfirmed", new OrderConfirmedEvent(), 3),
                event(failedOrderId, "OrderAssignedToCourier", new OrderAssignedToCourierEvent("courier-123"), 4),
                event(failedOrderId, "OrderPickedUp", new OrderPickedUpEvent("courier-123"), 5),
                event(failedOrderId, "OrderDeliveryFailed", new OrderDeliveryFailedEvent("Customer unavailable"), 6)
        ));

        assertThrows(IllegalStateException.class, () -> service.markDelivered(tenantId, failedOrderId));
    }

    private DomainEvent event(String eventType, Object payload, int aggregateSequence) throws Exception {
        return event(orderId, eventType, payload, aggregateSequence);
    }

    private DomainEvent event(UUID aggregateId, String eventType, Object payload, int aggregateSequence) throws Exception {
        return DomainEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .aggregateSequence(aggregateSequence)
                .eventSchemaVersion(EVENT_SCHEMA_VERSION)
                .tenantId(tenantId)
                .aggregateId(aggregateId)
                .timestamp(Instant.now())
                .payload(objectMapper.writeValueAsString(payload))
                .build();
    }
}

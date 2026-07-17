package com.nexora.backend.application.projection;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
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
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class OrderProjectionServiceIntegrationTest {

    private static final int EVENT_SCHEMA_VERSION = 1;

    @Autowired
    private OrderProjectionService projectionService;

    @Autowired
    private DomainEventRepository domainEventRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProjectionProcessedEventRepository processedEventRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setup() {
        transactionTemplate.executeWithoutResult(status -> {
            entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM order_intelligence_signals").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM order_intelligence_snapshots").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        });
    }

    @Test
    void duplicateEventProcessingIsIdempotent() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        DomainEvent created = save(event(
                tenantId,
                orderId,
                "OrderCreated",
                orderCreated("Idempotent"),
                1
        ));

        projectionService.project(created);
        projectionService.project(created);

        assertEquals(1, orderRepository.count());
        assertEquals(1, processedEventRepository.countByProjectionName(OrderProjectionService.PROJECTION_NAME));
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId).orElseThrow();
        assertEquals(OrderStatus.CREATED, order.getStatus());
        assertEquals(1, order.getVersion());
    }

    @Test
    void rebuildAllReplaysEventsAndPreservesFinalState() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        saveLifecycle(tenantId, orderId);

        OrderProjectionService.ProjectionRebuildResult result = projectionService.rebuildAll();

        assertEquals(OrderProjectionService.PROJECTION_NAME, result.projectionName());
        assertEquals(6, result.eventsProcessed());
        assertEquals(6, processedEventRepository.countByProjectionName(OrderProjectionService.PROJECTION_NAME));

        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId).orElseThrow();
        assertEquals(OrderStatus.DELIVERED, order.getStatus());
        assertEquals("courier-1", order.getCourierId());
        assertEquals(6, order.getVersion());
    }

    @Test
    void rebuildAllClearsStaleProjectionBeforeReplayingEvents() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        saveLifecycle(tenantId, orderId);
        projectionService.rebuildAll();

        transactionTemplate.executeWithoutResult(status -> {
            orderRepository.deleteAllInBatch();
            processedEventRepository.deleteAllInBatch();
        });

        OrderProjectionService.ProjectionRebuildResult result = projectionService.rebuildAll();

        assertEquals(6, result.eventsProcessed());
        assertTrue(orderRepository.findByIdAndTenantId(orderId, tenantId).isPresent());
        assertEquals(6, processedEventRepository.countByProjectionName(OrderProjectionService.PROJECTION_NAME));
    }

    @Test
    void retryEventReopensFailedOrderForAssignment() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        save(event(tenantId, orderId, "OrderCreated", orderCreated("Retry"), 1));
        save(event(tenantId, orderId, "OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2));
        save(event(tenantId, orderId, "OrderConfirmed", new OrderConfirmedEvent(), 3));
        save(event(tenantId, orderId, "OrderAssignedToCourier", new OrderAssignedToCourierEvent("courier-1"), 4));
        save(event(tenantId, orderId, "OrderPickedUp", new OrderPickedUpEvent("courier-1"), 5));
        save(event(tenantId, orderId, "OrderDeliveryFailed", new OrderDeliveryFailedEvent("CUSTOMER_UNREACHABLE"), 6));
        save(event(tenantId, orderId, "OrderDeliveryRetryRequested", new OrderDeliveryRetryRequestedEvent(UUID.randomUUID()), 7));

        OrderProjectionService.ProjectionRebuildResult result = projectionService.rebuildAll();

        assertEquals(7, result.eventsProcessed());
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId).orElseThrow();
        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        assertNull(order.getCourierId());
        assertNull(order.getFailureReason());
        assertEquals(7, order.getVersion());
    }

    @Test
    void confirmationRequestClearedEventReturnsProjectionToCreated() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        save(event(tenantId, orderId, "OrderCreated", orderCreated("Clear"), 1));
        save(event(tenantId, orderId, "OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2));
        save(event(tenantId, orderId, "OrderConfirmationRequestCleared", new OrderConfirmationRequestClearedEvent(), 3));

        OrderProjectionService.ProjectionRebuildResult result = projectionService.rebuildAll();

        assertEquals(3, result.eventsProcessed());
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId).orElseThrow();
        assertEquals(OrderStatus.CREATED, order.getStatus());
        assertEquals(3, order.getVersion());
    }

    @Test
    void projectionDoesNotCrossTenantBoundaries() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID otherTenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        DomainEvent created = save(event(
                tenantId,
                orderId,
                "OrderCreated",
                orderCreated("TenantScoped"),
                1
        ));
        DomainEvent crossTenantEvent = save(event(
                otherTenantId,
                orderId,
                "OrderConfirmed",
                new OrderConfirmedEvent(),
                2
        ));

        projectionService.project(created);

        assertThrows(IllegalStateException.class, () -> projectionService.project(crossTenantEvent));
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId).orElseThrow();
        assertEquals(OrderStatus.CREATED, order.getStatus());
        assertFalse(orderRepository.findByIdAndTenantId(orderId, otherTenantId).isPresent());
        assertFalse(processedEventRepository.existsByProjectionNameAndEventId(
                OrderProjectionService.PROJECTION_NAME,
                crossTenantEvent.getEventId()
        ));
    }

    @Test
    void projectionFailureLeavesEventHistoryUnmarkedForRebuildRecovery() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        DomainEvent orphanConfirmed = save(event(
                tenantId,
                orderId,
                "OrderConfirmed",
                new OrderConfirmedEvent(),
                1
        ));

        assertThrows(IllegalStateException.class, () -> projectionService.project(orphanConfirmed));

        assertTrue(domainEventRepository.findById(orphanConfirmed.getEventId()).isPresent());
        assertFalse(processedEventRepository.existsByProjectionNameAndEventId(
                OrderProjectionService.PROJECTION_NAME,
                orphanConfirmed.getEventId()
        ));
        assertEquals(0, orderRepository.count());
    }

    private void saveLifecycle(UUID tenantId, UUID orderId) throws Exception {
        save(event(tenantId, orderId, "OrderCreated", orderCreated("Lifecycle"), 1));
        save(event(tenantId, orderId, "OrderConfirmationRequested", new OrderConfirmationRequestedEvent(), 2));
        save(event(tenantId, orderId, "OrderConfirmed", new OrderConfirmedEvent(), 3));
        save(event(tenantId, orderId, "OrderAssignedToCourier", new OrderAssignedToCourierEvent("courier-1"), 4));
        save(event(tenantId, orderId, "OrderPickedUp", new OrderPickedUpEvent("courier-1"), 5));
        save(event(tenantId, orderId, "OrderDelivered", new OrderDeliveredEvent(), 6));
    }

    private DomainEvent save(DomainEvent event) {
        return transactionTemplate.execute(status -> domainEventRepository.saveAndFlush(event));
    }

    private OrderCreatedEvent orderCreated(String firstName) {
        return new OrderCreatedEvent(
                new Customer(firstName, "User", firstName.toLowerCase() + "@example.com", "0612345678"),
                new Address("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                BigDecimal.TEN
        );
    }

    private DomainEvent event(UUID tenantId, UUID aggregateId, String eventType, Object payload, int aggregateSequence)
            throws Exception {
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

package com.nexora.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
import com.nexora.backend.domain.event.payload.OrderCreatedEvent;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderIntelligenceAuditEvent;
import com.nexora.backend.domain.model.OrderIntelligenceSnapshot;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.InboundOrderRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceAuditEventRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSignalRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSnapshotRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class OrderIngestionServiceIntegrationTest {

    @Autowired
    private OrderIngestionService orderIngestionService;

    @Autowired
    private InboundOrderRepository inboundOrderRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderIntelligenceSnapshotRepository orderIntelligenceSnapshotRepository;

    @Autowired
    private OrderIntelligenceSignalRepository orderIntelligenceSignalRepository;

    @Autowired
    private OrderIntelligenceAuditEventRepository orderIntelligenceAuditEventRepository;

    @Autowired
    private DomainEventRepository domainEventRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID tenantId;

    @BeforeEach
    void setup() {
        tenantId = UUID.randomUUID();
        transactionTemplate.executeWithoutResult(status -> {
            entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM order_intelligence_audit_events").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM order_intelligence_signals").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM order_intelligence_snapshots").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        });
    }

    @Test
    void inboundOrderCanBeReceivedAndNormalizedIntoOrder() {
        OrderIngestionService.IngestedOrderResult result = orderIngestionService.ingestAndNormalize(command(
                OrderSource.MANUAL,
                null,
                "manual-1",
                BigDecimal.TEN
        ));

        assertEquals(InboundOrderStatus.NORMALIZED, result.status());
        assertNotNull(result.inboundOrderId());
        assertNotNull(result.orderId());

        InboundOrder inboundOrder = inboundOrderRepository.findById(result.inboundOrderId()).orElseThrow();
        assertEquals(tenantId, inboundOrder.getTenantId());
        assertEquals(OrderSource.MANUAL, inboundOrder.getSource());
        assertEquals("manual-1", inboundOrder.getIdempotencyKey());
        assertEquals(InboundOrderStatus.NORMALIZED, inboundOrder.getStatus());
        assertEquals(result.orderId(), inboundOrder.getNormalizedOrderId());
        assertNotNull(inboundOrder.getReceivedAt());
        assertNotNull(inboundOrder.getNormalizedAt());

        Order order = orderRepository.findByIdAndTenantId(result.orderId(), tenantId).orElseThrow();
        assertEquals(OrderStatus.CREATED, order.getStatus());
        assertEquals(OrderSource.MANUAL, order.getSource());
        assertEquals(result.inboundOrderId(), order.getInboundOrderId());
        assertNull(order.getExternalOrderId());

        OrderIntelligenceSnapshot snapshot = orderIntelligenceSnapshotRepository
                .findByTenantIdAndOrderId(tenantId, result.orderId())
                .orElseThrow();
        assertEquals(73, snapshot.getConfirmationConfidenceScore());
        assertEquals(34, snapshot.getFraudRiskScore());
        assertEquals("NEEDS_ATTENTION", snapshot.getLevel().name());
        assertFalse(orderIntelligenceSignalRepository
                .findByTenantIdAndOrderIdOrderBySortRankAsc(tenantId, result.orderId())
                .isEmpty());

        List<OrderIntelligenceAuditEvent> history = orderIntelligenceAuditEventRepository
                .findByTenantIdAndOrderIdOrderBySequenceNumberDescCalculatedAtDesc(
                        tenantId,
                        result.orderId(),
                        PageRequest.of(0, 5)
                );
        assertEquals(1, history.size());
        assertEquals(1, history.get(0).getSequenceNumber());
        assertEquals("Initial score", history.get(0).getChangeLabel());
    }

    @Test
    void duplicateIdempotencyDoesNotCreateDuplicateOrders() {
        OrderIngestionService.IngestedOrderResult first = orderIngestionService.ingestAndNormalize(command(
                OrderSource.WASILIO_STOREFRONT,
                "storefront-1",
                "idem-1",
                BigDecimal.TEN
        ));
        OrderIngestionService.IngestedOrderResult duplicate = orderIngestionService.ingestAndNormalize(command(
                OrderSource.WASILIO_STOREFRONT,
                "storefront-1",
                "idem-1",
                new BigDecimal("99.00")
        ));

        assertEquals(first.inboundOrderId(), duplicate.inboundOrderId());
        assertEquals(first.orderId(), duplicate.orderId());
        assertEquals(1, inboundOrderRepository.count());
        assertEquals(1, orderRepository.count());
        assertEquals(1, domainEventRepository.count());
    }

    @Test
    void sourceMetadataIsPreservedOnEventAndProjection() throws Exception {
        OrderIngestionService.IngestedOrderResult result = orderIngestionService.ingestAndNormalize(command(
                OrderSource.SHOPIFY,
                "shopify-1001",
                "shopify-idem-1001",
                BigDecimal.TEN
        ));

        Order order = orderRepository.findByIdAndTenantId(result.orderId(), tenantId).orElseThrow();
        assertEquals(OrderSource.SHOPIFY, order.getSource());
        assertEquals(result.inboundOrderId(), order.getInboundOrderId());
        assertEquals("shopify-1001", order.getExternalOrderId());

        List<DomainEvent> events = domainEventRepository.findByTenantIdAndAggregateIdOrderByAggregateSequenceAsc(
                tenantId,
                result.orderId()
        );
        assertEquals(1, events.size());
        OrderCreatedEvent payload = objectMapper.readValue(events.get(0).getPayload(), OrderCreatedEvent.class);
        assertEquals(OrderSource.SHOPIFY, payload.sourceMetadata().source());
        assertEquals(result.inboundOrderId(), payload.sourceMetadata().inboundOrderId());
        assertEquals("shopify-1001", payload.sourceMetadata().externalOrderId());
    }

    @Test
    void rejectedInboundOrdersNeverCreateOrders() {
        OrderIngestionService.IngestedOrderResult result = orderIngestionService.ingestAndNormalize(command(
                OrderSource.CUSTOM_API,
                "bad-order-1",
                "bad-idem-1",
                BigDecimal.ZERO
        ));

        assertEquals(InboundOrderStatus.REJECTED, result.status());
        assertNotNull(result.inboundOrderId());
        assertNull(result.orderId());
        assertTrue(result.rejectionReason().contains("amount"));
        assertEquals(1, inboundOrderRepository.count());
        assertEquals(0, orderRepository.count());
        assertEquals(0, domainEventRepository.count());
        assertEquals(0, orderIntelligenceSnapshotRepository.count());
        assertEquals(0, orderIntelligenceSignalRepository.count());
        assertEquals(0, orderIntelligenceAuditEventRepository.count());

        InboundOrder inboundOrder = inboundOrderRepository.findById(result.inboundOrderId()).orElseThrow();
        assertEquals(InboundOrderStatus.REJECTED, inboundOrder.getStatus());
        assertEquals("amount must be greater than zero", inboundOrder.getRejectionReason());
    }

    private OrderIngestionService.IngestOrderCommand command(
            OrderSource source,
            String externalOrderId,
            String idempotencyKey,
            BigDecimal amount
    ) {
        return new OrderIngestionService.IngestOrderCommand(
                tenantId,
                source,
                externalOrderId,
                idempotencyKey,
                """
                {"source":"test"}
                """,
                new Customer("Amina", "Merchant", "amina@example.com", "0612345678"),
                new Address("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                amount
        );
    }
}

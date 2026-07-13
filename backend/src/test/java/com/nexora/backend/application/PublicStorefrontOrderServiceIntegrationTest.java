package com.nexora.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderIntelligenceSnapshot;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.repository.InboundOrderRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceAuditEventRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSignalRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSnapshotRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.domain.repository.ProductRepository;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class PublicStorefrontOrderServiceIntegrationTest {

    @Autowired
    private PublicStorefrontOrderService publicStorefrontOrderService;

    @Autowired
    private PublicStorefrontRepository publicStorefrontRepository;

    @Autowired
    private ProductRepository productRepository;

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
            entityManager.createNativeQuery("DELETE FROM marketing_leads").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM tenant_payments").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM tenant_subscriptions").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM order_search_saved_views").executeUpdate();
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
            entityManager.createNativeQuery("DELETE FROM couriers").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM password_reset_tokens").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
            entityManager.persist(new Tenant(tenantId, "Public Order Tenant"));
            entityManager.flush();
        });
    }

    @Test
    void validOrderIntentCreatesInboundOrderAndForcesStorefrontSource() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                ProductStatus.ACTIVE,
                new BigDecimal("199.00")
        ));

        PublicOrderIntentResponse response = publicStorefrontOrderService.submitOrderIntent(
                "COOLAIR-MOROCCO",
                validRequest("CoolAir-Mini", "idem-public-1")
        );

        assertNotNull(response.receiptId());
        assertEquals("accepted", response.status());
        assertEquals("Order received", response.message());

        InboundOrder inboundOrder = inboundOrderRepository.findById(response.receiptId()).orElseThrow();
        assertEquals(tenantId, inboundOrder.getTenantId());
        assertEquals(OrderSource.WASILIO_STOREFRONT, inboundOrder.getSource());
        assertEquals("idem-public-1", inboundOrder.getIdempotencyKey());
        assertEquals(InboundOrderStatus.NORMALIZED, inboundOrder.getStatus());
        assertNotNull(inboundOrder.getNormalizedOrderId());

        JsonNode rawPayload = objectMapper.readTree(inboundOrder.getRawPayload());
        assertEquals("public-order-intent", rawPayload.path("type").asText());
        assertEquals(1, rawPayload.path("schemaVersion").asInt());
        assertFalse(rawPayload.path("payloadHash").asText().isBlank());
        assertEquals("coolair-morocco", rawPayload.path("payload").path("storeSlug").asText());
        assertEquals("coolair-mini", rawPayload.path("payload").path("productSlug").asText());
        assertEquals("CoolAir Mini", rawPayload.path("serverProductSnapshot").path("productName").asText());
        assertEquals("WAS-COOLAIR-MINI", rawPayload.path("serverProductSnapshot").path("sku").asText());

        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();
        assertEquals(OrderSource.WASILIO_STOREFRONT, order.getSource());
        assertEquals(inboundOrder.getInboundOrderId(), order.getInboundOrderId());
        assertEquals("Amina Buyer", order.getCustomer().getFirstName());
        assertEquals("", order.getCustomer().getLastName());
        assertEquals("0612345678", order.getCustomer().getPhone());
        assertEquals("Casablanca", order.getAddress().getCity());
        assertEquals("MA", order.getAddress().getCountry());

        OrderIntelligenceSnapshot snapshot = orderIntelligenceSnapshotRepository
                .findByTenantIdAndOrderId(tenantId, order.getId())
                .orElseThrow();
        assertEquals(74, snapshot.getConfirmationConfidenceScore());
        assertEquals(33, snapshot.getFraudRiskScore());
        assertEquals("NEEDS_ATTENTION", snapshot.getLevel().name());
        assertFalse(orderIntelligenceSignalRepository.findByTenantIdAndOrderIdOrderBySortRankAsc(tenantId, order.getId()).isEmpty());
        assertEquals(1, orderIntelligenceAuditEventRepository.countByTenantIdAndOrderId(tenantId, order.getId()));
    }

    @Test
    void priceCurrencyAndNameAreSnapshottedFromServerProduct() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product product = productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                ProductStatus.ACTIVE,
                new BigDecimal("199.00")
        ));

        PublicOrderIntentResponse response = publicStorefrontOrderService.submitOrderIntent(
                "coolair-morocco",
                validRequest("coolair-mini", "idem-snapshot-1", 2)
        );
        InboundOrder inboundOrder = inboundOrderRepository.findById(response.receiptId()).orElseThrow();

        product.setName("Edited CoolAir Mini");
        product.setPriceAmount(new BigDecimal("299.00"));
        product.setUpdatedAt(Instant.now());
        productRepository.saveAndFlush(product);

        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();
        assertBigDecimalEquals(new BigDecimal("398.00"), order.getAmount());
        assertEquals(1, order.getOrderLines().size());

        OrderLineSnapshot line = order.getOrderLines().get(0);
        assertEquals(product.getId(), line.productId());
        assertEquals("CoolAir Mini", line.productName());
        assertEquals("WAS-COOLAIR-MINI", line.sku());
        assertBigDecimalEquals(new BigDecimal("199.00"), line.unitPrice());
        assertEquals("MAD", line.currency());
        assertEquals(2, line.quantity());
        assertBigDecimalEquals(new BigDecimal("398.00"), line.lineTotal());
    }

    @Test
    void missingProductIsRejected() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontOrderService.submitOrderIntent(
                        "coolair-morocco",
                        validRequest("missing-product", "idem-missing-1")
                )
        );

        assertTrue(ex.getMessage().contains("not found"));
    }

    @Test
    void draftAndArchivedProductsAreRejected() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product(
                tenantId,
                "draft-product",
                "Draft Product",
                ProductStatus.DRAFT,
                new BigDecimal("199.00")
        ));
        productRepository.saveAndFlush(product(
                tenantId,
                "archived-product",
                "Archived Product",
                ProductStatus.ARCHIVED,
                new BigDecimal("199.00")
        ));

        IllegalArgumentException draft = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontOrderService.submitOrderIntent(
                        "coolair-morocco",
                        validRequest("draft-product", "idem-draft-1")
                )
        );
        IllegalArgumentException archived = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontOrderService.submitOrderIntent(
                        "coolair-morocco",
                        validRequest("archived-product", "idem-archived-1")
                )
        );

        assertTrue(draft.getMessage().contains("not found"));
        assertTrue(archived.getMessage().contains("not found"));
    }

    @Test
    void productSlugAndIdMismatchIsRejected() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product requestedProduct = productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                ProductStatus.ACTIVE,
                new BigDecimal("199.00")
        ));
        productRepository.saveAndFlush(product(
                tenantId,
                "other-product",
                "Other Product",
                ProductStatus.ACTIVE,
                new BigDecimal("299.00")
        ));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontOrderService.submitOrderIntent(
                        "coolair-morocco",
                        request(
                                new PublicOrderProductRequest(requestedProduct.getId(), "other-product", null),
                                1,
                                "Amina Buyer",
                                "0612345678",
                                "Casablanca",
                                "12 Rue Atlas",
                                "idem-mismatch-1"
                        )
                )
        );

        assertTrue(ex.getMessage().contains("do not match"));
    }

    @Test
    void variantIdIsRejectedInV1() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> publicStorefrontOrderService.submitOrderIntent(
                        "coolair-morocco",
                        request(
                                new PublicOrderProductRequest(null, "coolair-mini", "blue"),
                                1,
                                "Amina Buyer",
                                "0612345678",
                                "Casablanca",
                                "12 Rue Atlas",
                                "idem-variant-1"
                        )
                )
        );

        assertTrue(ex.getMessage().contains("variantId"));
    }

    @Test
    void invalidPhoneQuantityNameAndAddressAreRejected() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                ProductStatus.ACTIVE,
                new BigDecimal("199.00")
        ));

        List<PublicOrderIntentRequest> invalidRequests = List.of(
                request(productRequest("coolair-mini"), 0, "Amina Buyer", "0612345678", "Casablanca", "12 Rue Atlas", "bad-quantity"),
                request(productRequest("coolair-mini"), 1, "", "0612345678", "Casablanca", "12 Rue Atlas", "bad-name"),
                request(productRequest("coolair-mini"), 1, "Amina Buyer", "0812345678", "Casablanca", "12 Rue Atlas", "bad-phone"),
                request(productRequest("coolair-mini"), 1, "Amina Buyer", "0612345678", "", "12 Rue Atlas", "bad-city"),
                request(productRequest("coolair-mini"), 1, "Amina Buyer", "0612345678", "Casablanca", "", "bad-address"),
                request(productRequest("coolair-mini"), 1, "Amina Buyer", "0612345678", "Casablanca", "12 Rue Atlas", "")
        );

        invalidRequests.forEach(invalidRequest ->
                assertThrows(
                        IllegalArgumentException.class,
                        () -> publicStorefrontOrderService.submitOrderIntent("coolair-morocco", invalidRequest)
                )
        );
    }

    @Test
    void duplicateSameIdempotencyKeyAndPayloadReturnsOriginalReceipt() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                ProductStatus.ACTIVE,
                new BigDecimal("199.00")
        ));
        PublicOrderIntentRequest request = validRequest("coolair-mini", "idem-duplicate-1");

        PublicOrderIntentResponse first = publicStorefrontOrderService.submitOrderIntent("coolair-morocco", request);
        PublicOrderIntentResponse duplicate = publicStorefrontOrderService.submitOrderIntent("coolair-morocco", request);

        assertEquals(first.receiptId(), duplicate.receiptId());
        assertEquals("accepted", duplicate.status());
        assertEquals("Order already received", duplicate.message());
        assertEquals(1, inboundOrderRepository.count());
        assertEquals(1, orderRepository.count());
    }

    @Test
    void duplicateSameIdempotencyKeyWithDifferentPayloadConflicts() {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product(
                tenantId,
                "coolair-mini",
                "CoolAir Mini",
                ProductStatus.ACTIVE,
                new BigDecimal("199.00")
        ));

        publicStorefrontOrderService.submitOrderIntent(
                "coolair-morocco",
                validRequest("coolair-mini", "idem-conflict-1", 1)
        );

        ResourceConflictException ex = assertThrows(
                ResourceConflictException.class,
                () -> publicStorefrontOrderService.submitOrderIntent(
                        "coolair-morocco",
                        validRequest("coolair-mini", "idem-conflict-1", 2)
                )
        );

        assertTrue(ex.getMessage().contains("different public order payload"));
        assertEquals(1, inboundOrderRepository.count());
        assertEquals(1, orderRepository.count());
    }

    private PublicOrderIntentRequest validRequest(String productSlug, String idempotencyKey) {
        return validRequest(productSlug, idempotencyKey, 1);
    }

    private PublicOrderIntentRequest validRequest(String productSlug, String idempotencyKey, int quantity) {
        return request(
                productRequest(productSlug),
                quantity,
                "Amina Buyer",
                "0612345678",
                "Casablanca",
                "12 Rue Atlas",
                idempotencyKey
        );
    }

    private PublicOrderIntentRequest request(
            PublicOrderProductRequest product,
            Integer quantity,
            String customerName,
            String phone,
            String city,
            String address,
            String idempotencyKey
    ) {
        return new PublicOrderIntentRequest(
                new PublicOrderSelectionRequest(product, quantity),
                new PublicOrderCustomerRequest(customerName, phone),
                new PublicOrderDeliveryRequest(city, address, "Leave with concierge"),
                idempotencyKey,
                null,
                new PublicOrderAttributionRequest(
                        "facebook",
                        "paid",
                        "summer",
                        null,
                        null,
                        "https://ref.example.test",
                        "https://store.example.test/coolair-mini"
                )
        );
    }

    private PublicOrderProductRequest productRequest(String productSlug) {
        return new PublicOrderProductRequest(null, productSlug, null);
    }

    private PublicStorefront storefront(String storeSlug, PublicStorefrontStatus status) {
        Instant now = Instant.now();
        return PublicStorefront.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .storeSlug(storeSlug)
                .publicName("CoolAir Morocco")
                .status(status)
                .supportChannelType("whatsapp")
                .supportChannelValue("+212600000000")
                .defaultCountryCode("MA")
                .defaultCurrency("MAD")
                .phonePattern("^(06|07)\\d{8}$")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Product product(
            UUID ownerTenantId,
            String slug,
            String name,
            ProductStatus status,
            BigDecimal price
    ) {
        Instant now = Instant.now();
        return Product.builder()
                .id(UUID.randomUUID())
                .tenantId(ownerTenantId)
                .name(name)
                .slug(slug)
                .description("Public product description")
                .priceAmount(price)
                .currency("MAD")
                .sku("WAS-" + slug.toUpperCase())
                .imageUrl("https://cdn.example.test/" + slug + ".jpg")
                .status(status)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void assertBigDecimalEquals(BigDecimal expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, expected.compareTo(actual), () -> "Expected " + expected + " but got " + actual);
    }
}

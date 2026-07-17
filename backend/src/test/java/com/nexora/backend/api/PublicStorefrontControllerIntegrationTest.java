package com.nexora.backend.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nexora.backend.application.OrderIntelligenceScoringService;
import com.nexora.backend.application.PublicOrderAttributionRequest;
import com.nexora.backend.application.PublicOrderCustomerRequest;
import com.nexora.backend.application.PublicOrderDeliveryRequest;
import com.nexora.backend.application.PublicOrderIntentRequest;
import com.nexora.backend.application.PublicOrderProductRequest;
import com.nexora.backend.application.PublicOrderSelectionRequest;
import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.model.StorefrontProductProfileStatus;
import com.nexora.backend.domain.model.StorefrontProfileFaqItem;
import com.nexora.backend.domain.model.StorefrontProfileFeature;
import com.nexora.backend.domain.model.StorefrontProfileTrustBadge;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.repository.InboundOrderRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.domain.repository.ProductRepository;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import com.nexora.backend.domain.repository.StorefrontProductProfileRepository;
import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicStorefrontControllerIntegrationTest {

    private static final String PUBLIC_PRODUCT_PATH = "/api/public/storefront/coolair-morocco/products/coolair-mini";
    private static final String PUBLIC_ORDER_PATH = "/api/public/storefront/coolair-morocco/orders";
    private static final String FIRST_STORE_PRODUCT_PATH = "/api/public/storefront/first-store/products/coolair-mini";
    private static final String FIRST_STORE_ORDER_PATH = "/api/public/storefront/first-store/orders";
    private static final Set<String> FORBIDDEN_PUBLIC_FIELDS = Set.of(
            "tenantId",
            "merchantId",
            "status",
            "productStatus",
            "createdAt",
            "updatedAt",
            "stockCount"
    );
    private static final Set<String> FORBIDDEN_ORDER_RESPONSE_FIELDS = Set.of(
            "tenantId",
            "merchantId",
            "orderId",
            "lifecycleStatus",
            "orderStatus",
            "operationalStatus",
            "inboundOrderId",
            "source"
    );

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PublicStorefrontRepository publicStorefrontRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private StorefrontProductProfileRepository storefrontProductProfileRepository;

    @Autowired
    private InboundOrderRepository inboundOrderRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderIntelligenceScoringService orderIntelligenceScoringService;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID tenantId;

    @BeforeEach
    void setup() {
        tenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Public Storefront Controller Tenant"));
            entityManager.flush();
        });
    }

    @Test
    void activeProductCanBeFetchedWithoutAuthentication() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product product = productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Correlation-Id"))
                .andExpect(jsonPath("$.storeSlug").value("coolair-morocco"))
                .andExpect(jsonPath("$.storePublicName").value("CoolAir Morocco"))
                .andExpect(jsonPath("$.defaultCountryCode").value("MA"))
                .andExpect(jsonPath("$.defaultCurrency").value("MAD"))
                .andExpect(jsonPath("$.supportChannel.type").value("whatsapp"))
                .andExpect(jsonPath("$.supportChannel.value").value("+212600000000"))
                .andExpect(jsonPath("$.product.productId").value(product.getId().toString()))
                .andExpect(jsonPath("$.product.productSlug").value("coolair-mini"))
                .andExpect(jsonPath("$.product.productName").value("CoolAir Mini"))
                .andExpect(jsonPath("$.product.description").value("Portable cooling fan for COD customers."))
                .andExpect(jsonPath("$.product.imageUrl").value("https://cdn.example.test/coolair-mini.jpg"))
                .andExpect(jsonPath("$.offer.price").value(199.00))
                .andExpect(jsonPath("$.offer.currency").value("MAD"))
                .andExpect(jsonPath("$.offer.availability").value("available"))
                .andExpect(jsonPath("$.offer.orderable").value(true))
                .andExpect(jsonPath("$.seo.title").value("CoolAir Mini | CoolAir Morocco"))
                .andExpect(jsonPath("$.seo.description").value("Portable cooling fan for COD customers."))
                .andExpect(jsonPath("$.seo.image").value("https://cdn.example.test/coolair-mini.jpg"))
                .andExpect(jsonPath("$.readiness.orderable").value(true))
                .andExpect(jsonPath("$.readiness.requiredComplete").value(3))
                .andExpect(jsonPath("$.readiness.requiredTotal").value(7))
                .andExpect(jsonPath("$.readiness.items[?(@.key=='primary_image')].complete").value(true))
                .andExpect(jsonPath("$.readiness.items[?(@.key=='landing_profile_published')].complete").value(false))
                .andExpect(jsonPath("$.landingProfile").doesNotExist());
    }

    @Test
    void publishedStorefrontProductProfileIsIncludedInPublicResponse() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product product = productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));
        storefrontProductProfileRepository.saveAndFlush(profile(product.getId(), StorefrontProductProfileStatus.PUBLISHED));

        mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.landingProfile.headline").value("Cool air without installation"))
                .andExpect(jsonPath("$.landingProfile.subheadline").value("A portable fan for COD customers."))
                .andExpect(jsonPath("$.landingProfile.benefits[0]").value("Fast COD delivery"))
                .andExpect(jsonPath("$.landingProfile.features[0].title").value("Rechargeable"))
                .andExpect(jsonPath("$.landingProfile.features[0].description").value("Runs for hours after charging."))
                .andExpect(jsonPath("$.landingProfile.faq[0].question").value("Can I pay on delivery?"))
                .andExpect(jsonPath("$.landingProfile.faq[0].answer").value("Yes, cash on delivery is supported."))
                .andExpect(jsonPath("$.landingProfile.trustBadges[0].label").value("COD"))
                .andExpect(jsonPath("$.landingProfile.trustBadges[0].description").value("Pay when the package arrives."))
                .andExpect(jsonPath("$.landingProfile.galleryImageUrls[0]").value("https://cdn.example.test/gallery-1.jpg"))
                .andExpect(jsonPath("$.landingProfile.seoTitle").value("Portable CoolAir Morocco"))
                .andExpect(jsonPath("$.landingProfile.seoDescription").value("Order a portable CoolAir fan in Morocco."))
                .andExpect(jsonPath("$.landingProfile.seoImageUrl").value("https://cdn.example.test/seo-coolair.jpg"))
                .andExpect(jsonPath("$.seo.title").value("Portable CoolAir Morocco"))
                .andExpect(jsonPath("$.seo.description").value("Order a portable CoolAir fan in Morocco."))
                .andExpect(jsonPath("$.seo.image").value("https://cdn.example.test/seo-coolair.jpg"))
                .andExpect(jsonPath("$.readiness.requiredComplete").value(7))
                .andExpect(jsonPath("$.readiness.items[?(@.key=='gallery_media')].complete").value(true));
    }

    @Test
    void draftStorefrontProductProfileIsExcludedFromPublicResponse() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product product = productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));
        storefrontProductProfileRepository.saveAndFlush(profile(product.getId(), StorefrontProductProfileStatus.DRAFT));

        mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.landingProfile").doesNotExist())
                .andExpect(jsonPath("$.seo.title").value("CoolAir Mini | CoolAir Morocco"))
                .andExpect(jsonPath("$.seo.description").value("Portable cooling fan for COD customers."))
                .andExpect(jsonPath("$.seo.image").value("https://cdn.example.test/coolair-mini.jpg"));
    }

    @Test
    void missingStoreAndMissingProductReturnNotFound() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));

        mockMvc.perform(get("/api/public/storefront/missing-store/products/coolair-mini"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"))
                .andExpect(jsonPath("$.correlationId").isNotEmpty());

        mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"))
                .andExpect(jsonPath("$.correlationId").isNotEmpty());
    }

    @Test
    void disabledStorefrontReturnsNotFound() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.DISABLED));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void draftAndArchivedProductsReturnNotFound() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("draft-product", "Draft Product", ProductStatus.DRAFT));
        productRepository.saveAndFlush(product("archived-product", "Archived Product", ProductStatus.ARCHIVED));

        mockMvc.perform(get("/api/public/storefront/coolair-morocco/products/draft-product"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));

        mockMvc.perform(get("/api/public/storefront/coolair-morocco/products/archived-product"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void internalProductApiRemainsProtected() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Authentication failed"));
    }

    @Test
    void publicOrderCanBeSubmittedWithoutAuthentication() throws Exception {
        UUID correlationId = UUID.randomUUID();
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        MvcResult result = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .header(CorrelationIdContext.HEADER_NAME, correlationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("coolair-mini", "idem-post-1"))))
                .andExpect(status().isAccepted())
                .andExpect(header().string(CorrelationIdContext.HEADER_NAME, correlationId.toString()))
                .andExpect(jsonPath("$.receiptId").isNotEmpty())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.message").value("Order received"))
                .andReturn();

        UUID receiptId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .path("receiptId")
                .asText());
        InboundOrder inboundOrder = inboundOrderRepository.findById(receiptId).orElseThrow();
        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();

        assertEquals(inboundOrder.getInboundOrderId(), receiptId);
        assertEquals("WASILIO_STOREFRONT", inboundOrder.getSource().name());
        assertEquals("WASILIO_STOREFRONT", order.getSource().name());
        assertEquals(correlationId.toString(), objectMapper.readTree(inboundOrder.getRawPayload())
                .path("correlationId")
                .asText());
    }

    @Test
    void landingEngineCanFetchProductAndSubmitOrderIntent() throws Exception {
        UUID correlationId = UUID.randomUUID();
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product product = productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));
        storefrontProductProfileRepository.saveAndFlush(profile(product.getId(), StorefrontProductProfileStatus.PUBLISHED));

        MvcResult productResult = mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.product.productId").value(product.getId().toString()))
                .andExpect(jsonPath("$.product.productSlug").value("coolair-mini"))
                .andExpect(jsonPath("$.product.imageUrl").value("https://cdn.example.test/coolair-mini.jpg"))
                .andExpect(jsonPath("$.landingProfile.galleryImageUrls[0]").value("https://cdn.example.test/gallery-1.jpg"))
                .andExpect(jsonPath("$.seo.image").value("https://cdn.example.test/seo-coolair.jpg"))
                .andExpect(jsonPath("$.readiness.items[?(@.key=='primary_image')].complete").value(true))
                .andReturn();

        JsonNode publicProduct = objectMapper.readTree(productResult.getResponse().getContentAsString());
        ObjectNode orderPayload = objectMapper.createObjectNode();
        orderPayload.put("idempotencyKey", "order-coolair-mini-phase-21");
        ObjectNode selection = orderPayload.putObject("selection");
        selection.put("quantity", 1);
        ObjectNode selectedProduct = selection.putObject("product");
        selectedProduct.put("productId", publicProduct.path("product").path("productId").asText());
        selectedProduct.put("productSlug", publicProduct.path("product").path("productSlug").asText());
        selectedProduct.putNull("variantId");
        ObjectNode customer = orderPayload.putObject("customer");
        customer.put("name", "Amina Buyer");
        customer.put("phone", "0612345678");
        ObjectNode delivery = orderPayload.putObject("delivery");
        delivery.put("city", "Casablanca");
        delivery.put("address", "12 Rue Atlas");
        delivery.put("notes", "Call before delivery");
        ObjectNode attribution = orderPayload.putObject("attribution");
        attribution.put("source", "landing-engine");
        attribution.put("campaign", "phase-21");
        attribution.put("content", "control");
        attribution.put("landingPageUrl", "http://localhost:3000/products/coolair-mini");

        MvcResult orderResult = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .header(CorrelationIdContext.HEADER_NAME, correlationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderPayload)))
                .andExpect(status().isAccepted())
                .andExpect(header().string(CorrelationIdContext.HEADER_NAME, correlationId.toString()))
                .andExpect(jsonPath("$.receiptId").isNotEmpty())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.message").value("Order received"))
                .andExpect(jsonPath("$.orderId").doesNotExist())
                .andExpect(jsonPath("$.source").doesNotExist())
                .andExpect(jsonPath("$.intelligence").doesNotExist())
                .andReturn();

        JsonNode orderResponse = objectMapper.readTree(orderResult.getResponse().getContentAsString());
        assertNoForbiddenFields(orderResponse, FORBIDDEN_ORDER_RESPONSE_FIELDS);

        InboundOrder inboundOrder = inboundOrderRepository
                .findById(UUID.fromString(orderResponse.path("receiptId").asText()))
                .orElseThrow();
        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();
        JsonNode rawPayload = objectMapper.readTree(inboundOrder.getRawPayload());

        assertEquals("WASILIO_STOREFRONT", inboundOrder.getSource().name());
        assertEquals("WASILIO_STOREFRONT", order.getSource().name());
        assertEquals(correlationId.toString(), rawPayload.path("correlationId").asText());
        assertEquals("public-order-intent", rawPayload.path("type").asText());
        assertEquals("coolair-morocco", rawPayload.path("payload").path("storeSlug").asText());
        assertEquals(product.getId().toString(), rawPayload.path("payload").path("productId").asText());
        assertEquals("coolair-mini", rawPayload.path("payload").path("productSlug").asText());
        assertEquals("landing-engine", rawPayload.path("payload").path("attribution").path("source").asText());
        assertEquals("phase-21", rawPayload.path("payload").path("attribution").path("campaign").asText());
        assertEquals("control", rawPayload.path("payload").path("attribution").path("content").asText());
        assertEquals("http://localhost:3000/products/coolair-mini", rawPayload.path("payload").path("attribution").path("landingPageUrl").asText());
        assertEquals("CoolAir Mini", rawPayload.path("serverProductSnapshot").path("productName").asText());
        assertEquals("SKU-coolair-mini", rawPayload.path("serverProductSnapshot").path("sku").asText());

        OrderIntelligenceScoringService.OrderIntelligenceResult score =
                orderIntelligenceScoringService.getOrCalculate(tenantId, order.getId());
        assertEquals(76, score.snapshot().getConfirmationConfidenceScore());
        assertEquals(32, score.snapshot().getFraudRiskScore());
        assertEquals("HIGH_CONFIDENCE", score.snapshot().getLevel().name());
        assertTrue(score.signals().stream().anyMatch(signal -> signal.getSignalKey().equals("storefront_product_image_present")));
        assertTrue(score.signals().stream().anyMatch(signal -> signal.getSignalKey().equals("storefront_landing_content_ready")));
    }

    @Test
    void firstStoreRehearsalContractCanFetchProductAndSubmitLandingEngineOrderIntent() throws Exception {
        UUID correlationId = UUID.randomUUID();
        publicStorefrontRepository.saveAndFlush(firstStorefront());
        Product product = productRepository.saveAndFlush(firstStoreProduct());
        storefrontProductProfileRepository.saveAndFlush(firstStoreProfile(product.getId()));

        MvcResult productResult = mockMvc.perform(get(FIRST_STORE_PRODUCT_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeSlug").value("first-store"))
                .andExpect(jsonPath("$.storePublicName").value("First Store"))
                .andExpect(jsonPath("$.product.productId").value(product.getId().toString()))
                .andExpect(jsonPath("$.product.productSlug").value("coolair-mini"))
                .andExpect(jsonPath("$.product.productName").value("First Store CoolAir Mini"))
                .andExpect(jsonPath("$.product.imageUrl").value("http://localhost:8080/media/demo/first-store/coolair-mini-primary.svg"))
                .andExpect(jsonPath("$.landingProfile.galleryImageUrls[0]").value("http://localhost:8080/media/demo/first-store/coolair-mini-gallery.svg"))
                .andExpect(jsonPath("$.seo.image").value("http://localhost:8080/media/demo/first-store/coolair-mini-seo.svg"))
                .andExpect(jsonPath("$.readiness.requiredComplete").value(7))
                .andExpect(jsonPath("$.readiness.items[?(@.key=='landing_profile_published')].complete").value(true))
                .andReturn();

        JsonNode publicProduct = objectMapper.readTree(productResult.getResponse().getContentAsString());
        ObjectNode orderPayload = objectMapper.createObjectNode();
        orderPayload.put("idempotencyKey", "order-first-store-phase-22");
        ObjectNode selection = orderPayload.putObject("selection");
        selection.put("quantity", 1);
        ObjectNode selectedProduct = selection.putObject("product");
        selectedProduct.put("productId", publicProduct.path("product").path("productId").asText());
        selectedProduct.put("productSlug", publicProduct.path("product").path("productSlug").asText());
        ObjectNode customer = orderPayload.putObject("customer");
        customer.put("name", "Amina Buyer");
        customer.put("phone", "0612345678");
        ObjectNode delivery = orderPayload.putObject("delivery");
        delivery.put("city", "Casablanca");
        delivery.put("address", "12 Rue Atlas");
        delivery.put("notes", "Call before delivery");
        ObjectNode attribution = orderPayload.putObject("attribution");
        attribution.put("source", "landing-engine");
        attribution.put("campaign", "phase-22-local-rehearsal");
        attribution.put("content", "first-store");
        attribution.put("landingPageUrl", "http://localhost:3000/products/coolair-mini");

        MvcResult orderResult = mockMvc.perform(post(FIRST_STORE_ORDER_PATH)
                        .header(CorrelationIdContext.HEADER_NAME, correlationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderPayload)))
                .andExpect(status().isAccepted())
                .andExpect(header().string(CorrelationIdContext.HEADER_NAME, correlationId.toString()))
                .andExpect(jsonPath("$.receiptId").isNotEmpty())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.message").value("Order received"))
                .andExpect(jsonPath("$.orderId").doesNotExist())
                .andExpect(jsonPath("$.intelligence").doesNotExist())
                .andReturn();

        JsonNode orderResponse = objectMapper.readTree(orderResult.getResponse().getContentAsString());
        assertNoForbiddenFields(orderResponse, FORBIDDEN_ORDER_RESPONSE_FIELDS);

        InboundOrder inboundOrder = inboundOrderRepository
                .findById(UUID.fromString(orderResponse.path("receiptId").asText()))
                .orElseThrow();
        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();
        JsonNode rawPayload = objectMapper.readTree(inboundOrder.getRawPayload());

        assertEquals("WASILIO_STOREFRONT", inboundOrder.getSource().name());
        assertEquals("WASILIO_STOREFRONT", order.getSource().name());
        assertEquals(correlationId.toString(), rawPayload.path("correlationId").asText());
        assertEquals("first-store", rawPayload.path("payload").path("storeSlug").asText());
        assertEquals(product.getId().toString(), rawPayload.path("payload").path("productId").asText());
        assertEquals("coolair-mini", rawPayload.path("payload").path("productSlug").asText());
        assertEquals("landing-engine", rawPayload.path("payload").path("attribution").path("source").asText());
        assertEquals("phase-22-local-rehearsal", rawPayload.path("payload").path("attribution").path("campaign").asText());
        assertEquals("First Store CoolAir Mini", rawPayload.path("serverProductSnapshot").path("productName").asText());
        assertEquals("FIRST-COOLAIR-MINI", rawPayload.path("serverProductSnapshot").path("sku").asText());

        OrderIntelligenceScoringService.OrderIntelligenceResult score =
                orderIntelligenceScoringService.getOrCalculate(tenantId, order.getId());
        assertEquals(76, score.snapshot().getConfirmationConfidenceScore());
        assertEquals(32, score.snapshot().getFraudRiskScore());
        assertEquals("HIGH_CONFIDENCE", score.snapshot().getLevel().name());
        assertTrue(score.signals().stream().anyMatch(signal -> signal.getSignalKey().equals("storefront_product_image_present")));
        assertTrue(score.signals().stream().anyMatch(signal -> signal.getSignalKey().equals("storefront_landing_content_ready")));
    }

    @Test
    void publicOrderIgnoresExternalScoreHintsAndUsesInternalIntelligence() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));
        ObjectNode request = objectMapper.valueToTree(validOrderRequest("coolair-mini", "idem-score-hints"));
        request.put("confirmationConfidenceScore", 1);
        request.put("fraudRiskScore", 99);
        ObjectNode fakeIntelligence = objectMapper.createObjectNode();
        fakeIntelligence.put("level", "HIGH_RISK");
        fakeIntelligence.put("summary", "external score must not be trusted");
        request.set("intelligence", fakeIntelligence);

        MvcResult result = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.receiptId").isNotEmpty())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.intelligence").doesNotExist())
                .andExpect(jsonPath("$.confirmationConfidenceScore").doesNotExist())
                .andExpect(jsonPath("$.fraudRiskScore").doesNotExist())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        InboundOrder inboundOrder = inboundOrderRepository.findById(UUID.fromString(response.path("receiptId").asText()))
                .orElseThrow();
        JsonNode rawPayload = objectMapper.readTree(inboundOrder.getRawPayload());
        assertFalse(rawPayload.has("intelligence"));
        assertFalse(rawPayload.has("confirmationConfidenceScore"));
        assertFalse(rawPayload.has("fraudRiskScore"));
        assertFalse(rawPayload.path("payload").has("intelligence"));
        assertFalse(rawPayload.path("payload").has("confirmationConfidenceScore"));
        assertFalse(rawPayload.path("payload").has("fraudRiskScore"));

        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();
        OrderIntelligenceScoringService.OrderIntelligenceResult score =
                orderIntelligenceScoringService.getOrCalculate(tenantId, order.getId());
        assertEquals(74, score.snapshot().getConfirmationConfidenceScore());
        assertEquals(33, score.snapshot().getFraudRiskScore());
        assertEquals("NEEDS_ATTENTION", score.snapshot().getLevel().name());
        assertTrue(score.signals().stream().anyMatch(signal -> signal.getSignalKey().equals("storefront_product_image_present")));
    }

    @Test
    void publicOrderIntelligenceFlagsMissingStorefrontProductMedia() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product product = product("no-media-product", "No Media Product", ProductStatus.ACTIVE);
        product.setImageUrl(null);
        productRepository.saveAndFlush(product);

        MvcResult result = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validOrderRequest("no-media-product", "idem-no-media"))))
                .andExpect(status().isAccepted())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        InboundOrder inboundOrder = inboundOrderRepository.findById(UUID.fromString(response.path("receiptId").asText()))
                .orElseThrow();
        Order order = orderRepository.findByIdAndTenantId(inboundOrder.getNormalizedOrderId(), tenantId).orElseThrow();
        OrderIntelligenceScoringService.OrderIntelligenceResult score =
                orderIntelligenceScoringService.getOrCalculate(tenantId, order.getId());

        assertEquals(68, score.snapshot().getConfirmationConfidenceScore());
        assertEquals(39, score.snapshot().getFraudRiskScore());
        assertEquals("NEEDS_ATTENTION", score.snapshot().getLevel().name());
        assertTrue(score.signals().stream().anyMatch(signal -> signal.getSignalKey().equals("storefront_product_image_missing")));
    }

    @Test
    void publicStorefrontCorsPreflightAllowsLandingEngineOrigin() throws Exception {
        mockMvc.perform(options(PUBLIC_PRODUCT_PATH)
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("GET")));

        mockMvc.perform(options(PUBLIC_ORDER_PATH)
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type,X-Correlation-ID"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("POST")))
                .andExpect(header().string("Access-Control-Allow-Headers", containsString("Content-Type")))
                .andExpect(header().string("Access-Control-Allow-Headers", containsString("X-Correlation-ID")));
    }

    @Test
    void internalOrderApiRemainsProtected() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Authentication failed"));
    }

    @Test
    void invalidPublicOrderPayloadsReturnBadRequest() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        PublicOrderIntentRequest[] invalidRequests = {
                orderRequest(productRequest("coolair-mini"), 0, "Amina Buyer", "0612345678", "Casablanca", "12 Rue Atlas", "bad-quantity"),
                orderRequest(productRequest("coolair-mini"), 1, "", "0612345678", "Casablanca", "12 Rue Atlas", "bad-name"),
                orderRequest(productRequest("coolair-mini"), 1, "Amina Buyer", "0812345678", "Casablanca", "12 Rue Atlas", "bad-phone"),
                orderRequest(productRequest("coolair-mini"), 1, "Amina Buyer", "0612345678", "", "12 Rue Atlas", "bad-city"),
                orderRequest(productRequest("coolair-mini"), 1, "Amina Buyer", "0612345678", "Casablanca", "", "bad-address")
        };

        for (PublicOrderIntentRequest invalidRequest : invalidRequests) {
            mockMvc.perform(post(PUBLIC_ORDER_PATH)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(invalidRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Bad request"))
                    .andExpect(jsonPath("$.correlationId").isNotEmpty());
        }
    }

    @Test
    void missingStoreAndMissingProductReturnNotFoundForPublicOrder() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));

        mockMvc.perform(post("/api/public/storefront/missing-store/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("coolair-mini", "idem-missing-store"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("missing-product", "idem-missing-product"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void disabledStorefrontReturnsNotFoundForPublicOrder() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.DISABLED));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("coolair-mini", "idem-disabled-store"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void draftAndArchivedProductsReturnNotFoundForPublicOrder() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("draft-product", "Draft Product", ProductStatus.DRAFT));
        productRepository.saveAndFlush(product("archived-product", "Archived Product", ProductStatus.ARCHIVED));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("draft-product", "idem-draft-product"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("archived-product", "idem-archived-product"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void productSlugAndIdMismatchReturnsBadRequestForPublicOrder() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        Product requestedProduct = productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));
        productRepository.saveAndFlush(product("other-product", "Other Product", ProductStatus.ACTIVE));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(orderRequest(
                                new PublicOrderProductRequest(requestedProduct.getId(), "other-product", null),
                                1,
                                "Amina Buyer",
                                "0612345678",
                                "Casablanca",
                                "12 Rue Atlas",
                                "idem-mismatch"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"));
    }

    @Test
    void variantIdIsRejectedForPublicOrderV1() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(orderRequest(
                                new PublicOrderProductRequest(null, "coolair-mini", "blue"),
                                1,
                                "Amina Buyer",
                                "0612345678",
                                "Casablanca",
                                "12 Rue Atlas",
                                "idem-variant"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"));
    }

    @Test
    void duplicatePublicOrderWithSamePayloadReturnsSameReceipt() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));
        PublicOrderIntentRequest request = validOrderRequest("coolair-mini", "idem-duplicate-post");

        MvcResult first = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(request)))
                .andExpect(status().isAccepted())
                .andReturn();
        MvcResult duplicate = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("Order already received"))
                .andReturn();

        assertEquals(
                objectMapper.readTree(first.getResponse().getContentAsString()).path("receiptId").asText(),
                objectMapper.readTree(duplicate.getResponse().getContentAsString()).path("receiptId").asText()
        );
        assertEquals(1, inboundOrderRepository.count());
        assertEquals(1, orderRepository.count());
    }

    @Test
    void duplicatePublicOrderWithDifferentPayloadReturnsConflict() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("coolair-mini", "idem-conflict-post", 1))))
                .andExpect(status().isAccepted());

        mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("coolair-mini", "idem-conflict-post", 2))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Resource already exists"))
                .andExpect(jsonPath("$.correlationId").isNotEmpty());
    }

    @Test
    void publicOrderResponseDoesNotExposeLifecycleOrderIdOrOperationalStatus() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        MvcResult result = mockMvc.perform(post(PUBLIC_ORDER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validOrderRequest("coolair-mini", "idem-public-shape"))))
                .andExpect(status().isAccepted())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        assertNoForbiddenFields(response, FORBIDDEN_ORDER_RESPONSE_FIELDS);

        InboundOrder inboundOrder = inboundOrderRepository.findById(UUID.fromString(response.path("receiptId").asText()))
                .orElseThrow();
        assertNotEquals(inboundOrder.getNormalizedOrderId().toString(), response.path("receiptId").asText());
        assertEquals("accepted", response.path("status").asText());
    }

    @Test
    void responseDoesNotExposeInternalFields() throws Exception {
        publicStorefrontRepository.saveAndFlush(storefront("coolair-morocco", PublicStorefrontStatus.ACTIVE));
        productRepository.saveAndFlush(product("coolair-mini", "CoolAir Mini", ProductStatus.ACTIVE));

        MvcResult result = mockMvc.perform(get(PUBLIC_PRODUCT_PATH))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        assertNoForbiddenPublicFields(response);
    }

    private void assertNoForbiddenPublicFields(JsonNode node) {
        assertNoForbiddenFields(node, FORBIDDEN_PUBLIC_FIELDS);
    }

    private void assertNoForbiddenFields(JsonNode node, Set<String> forbiddenFields) {
        Iterator<String> fieldNames = node.fieldNames();
        while (fieldNames.hasNext()) {
            String fieldName = fieldNames.next();
            assertFalse(forbiddenFields.contains(fieldName), "Public response exposes " + fieldName);
            assertNoForbiddenFields(node.get(fieldName), forbiddenFields);
        }

        if (node.isArray()) {
            node.forEach(child -> assertNoForbiddenFields(child, forbiddenFields));
        }
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private PublicOrderIntentRequest validOrderRequest(String productSlug, String idempotencyKey) {
        return validOrderRequest(productSlug, idempotencyKey, 1);
    }

    private PublicOrderIntentRequest validOrderRequest(String productSlug, String idempotencyKey, int quantity) {
        return orderRequest(
                productRequest(productSlug),
                quantity,
                "Amina Buyer",
                "0612345678",
                "Casablanca",
                "12 Rue Atlas",
                idempotencyKey
        );
    }

    private PublicOrderIntentRequest orderRequest(
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

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM marketing_leads").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenant_payments").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenant_subscriptions").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM subscription_plans").executeUpdate();
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
        entityManager.createNativeQuery("DELETE FROM storefront_product_profiles").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM password_reset_tokens").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
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

    private PublicStorefront firstStorefront() {
        Instant now = Instant.now();
        return PublicStorefront.builder()
                .id(UUID.fromString("00000000-0000-0000-0000-000000000101"))
                .tenantId(tenantId)
                .storeSlug("first-store")
                .publicName("First Store")
                .status(PublicStorefrontStatus.ACTIVE)
                .supportChannelType("whatsapp")
                .supportChannelValue("+212600000000")
                .defaultCountryCode("MA")
                .defaultCurrency("MAD")
                .phonePattern("^(06|07)\\d{8}$")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private StorefrontProductProfile profile(UUID productId, StorefrontProductProfileStatus status) {
        Instant now = Instant.now();
        return StorefrontProductProfile.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .productId(productId)
                .headline("Cool air without installation")
                .subheadline("A portable fan for COD customers.")
                .benefits(List.of("Fast COD delivery", "Easy returns"))
                .features(List.of(new StorefrontProfileFeature(
                        "Rechargeable",
                        "Runs for hours after charging."
                )))
                .faq(List.of(new StorefrontProfileFaqItem(
                        "Can I pay on delivery?",
                        "Yes, cash on delivery is supported."
                )))
                .trustBadges(List.of(new StorefrontProfileTrustBadge(
                        "COD",
                        "Pay when the package arrives."
                )))
                .galleryImageUrls(List.of("https://cdn.example.test/gallery-1.jpg"))
                .seoTitle("Portable CoolAir Morocco")
                .seoDescription("Order a portable CoolAir fan in Morocco.")
                .seoImageUrl("https://cdn.example.test/seo-coolair.jpg")
                .status(status)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Product product(String slug, String name, ProductStatus status) {
        Instant now = Instant.now();
        return Product.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .name(name)
                .slug(slug)
                .description("Portable cooling fan for COD customers.")
                .priceAmount(new BigDecimal("199.00"))
                .currency("MAD")
                .sku("SKU-" + slug)
                .imageUrl("https://cdn.example.test/" + slug + ".jpg")
                .status(status)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Product firstStoreProduct() {
        Instant now = Instant.now();
        return Product.builder()
                .id(UUID.fromString("00000000-0000-0000-0000-000000000102"))
                .tenantId(tenantId)
                .name("First Store CoolAir Mini")
                .slug("coolair-mini")
                .description("Compact rechargeable cooling fan for cash-on-delivery customers.")
                .priceAmount(new BigDecimal("199.00"))
                .currency("MAD")
                .sku("FIRST-COOLAIR-MINI")
                .imageUrl("http://localhost:8080/media/demo/first-store/coolair-mini-primary.svg")
                .status(ProductStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private StorefrontProductProfile firstStoreProfile(UUID productId) {
        Instant now = Instant.now();
        return StorefrontProductProfile.builder()
                .id(UUID.fromString("00000000-0000-0000-0000-000000000103"))
                .tenantId(tenantId)
                .productId(productId)
                .headline("Cool air without installation")
                .subheadline("A compact fan prepared for the landing-engine local order rehearsal.")
                .benefits(List.of("Cash on delivery available", "Fast local delivery", "Call confirmation before dispatch"))
                .features(List.of(
                        new StorefrontProfileFeature("Rechargeable", "Runs for hours after charging."),
                        new StorefrontProfileFeature("Compact size", "Fits on desks, counters, and bedside tables.")
                ))
                .faq(List.of(
                        new StorefrontProfileFaqItem("Can I pay on delivery?", "Yes, cash on delivery is supported."),
                        new StorefrontProfileFaqItem("Will someone confirm my order?", "Yes, Wasilio confirmation happens after the order is received.")
                ))
                .trustBadges(List.of(
                        new StorefrontProfileTrustBadge("COD", "Pay when the package arrives."),
                        new StorefrontProfileTrustBadge("Local support", "WhatsApp support is available for order questions.")
                ))
                .galleryImageUrls(List.of("http://localhost:8080/media/demo/first-store/coolair-mini-gallery.svg"))
                .seoTitle("First Store CoolAir Mini")
                .seoDescription("Order the CoolAir Mini locally and submit a Wasilio-powered COD order.")
                .seoImageUrl("http://localhost:8080/media/demo/first-store/coolair-mini-seo.svg")
                .status(StorefrontProductProfileStatus.PUBLISHED)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}

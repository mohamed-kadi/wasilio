package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.application.OrderIngestionService;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InboundOrderControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private OrderIngestionService orderIngestionService;

    private UUID tenantId;
    private UUID otherTenantId;
    private String jwtToken;
    private String otherTenantJwtToken;

    @BeforeEach
    void setup() throws Exception {
        tenantId = UUID.randomUUID();
        otherTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Inbound Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "inbound@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    tenantId
            ));

            entityManager.persist(new Tenant(otherTenantId, "Other Inbound Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "other-inbound@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    otherTenantId
            ));

            entityManager.flush();
        });

        jwtToken = login("inbound@example.com", "password");
        otherTenantJwtToken = login("other-inbound@example.com", "password");
    }

    @Test
    void listInboundOrders_returnsTenantRecordsWithoutRawPayload() throws Exception {
        OrderIngestionService.IngestedOrderResult result = ingestNormalized(
                tenantId,
                OrderSource.WHATSAPP,
                "wa-1001",
                "idem-wa-1001",
                "Inbound"
        );
        ingestNormalized(otherTenantId, OrderSource.WHATSAPP, "wa-other", "idem-wa-other", "Other");

        mockMvc.perform(get("/api/inbound-orders")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].inboundOrderId").value(result.inboundOrderId().toString()))
                .andExpect(jsonPath("$.content[0].source").value("WHATSAPP"))
                .andExpect(jsonPath("$.content[0].externalOrderId").value("wa-1001"))
                .andExpect(jsonPath("$.content[0].idempotencyKey").value("idem-wa-1001"))
                .andExpect(jsonPath("$.content[0].status").value("NORMALIZED"))
                .andExpect(jsonPath("$.content[0].normalizedOrderId").value(result.orderId().toString()))
                .andExpect(jsonPath("$.content[0].receivedAt").isNotEmpty())
                .andExpect(jsonPath("$.content[0].rawPayload").doesNotExist());
    }

    @Test
    void listInboundOrders_filtersByStatusAndSource() throws Exception {
        ingestNormalized(tenantId, OrderSource.WHATSAPP, "wa-filter", "idem-wa-filter", "Whatsapp");
        ingestNormalized(tenantId, OrderSource.SHOPIFY, "shop-filter", "idem-shop-filter", "Shopify");
        OrderIngestionService.IngestedOrderResult rejected = ingestRejected(
                tenantId,
                OrderSource.CUSTOM_API,
                "api-rejected",
                "idem-api-rejected"
        );

        mockMvc.perform(get("/api/inbound-orders")
                .param("status", "REJECTED")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].inboundOrderId").value(rejected.inboundOrderId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("REJECTED"))
                .andExpect(jsonPath("$.content[0].rejectionReason").value("amount must be greater than zero"));

        mockMvc.perform(get("/api/inbound-orders")
                .param("source", "SHOPIFY")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].source").value("SHOPIFY"))
                .andExpect(jsonPath("$.content[0].externalOrderId").value("shop-filter"));
    }

    @Test
    void listInboundOrders_searchesExternalOrderIdAndIdempotencyKey() throws Exception {
        ingestNormalized(tenantId, OrderSource.YOUCAN, "youcan-4455", "idem-youcan-4455", "Youcan");
        ingestNormalized(tenantId, OrderSource.WOOCOMMERCE, "woo-7788", "idem-woo-7788", "Woo");

        mockMvc.perform(get("/api/inbound-orders")
                .param("search", "4455")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].externalOrderId").value("youcan-4455"));

        mockMvc.perform(get("/api/inbound-orders")
                .param("search", "idem-woo")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].idempotencyKey").value("idem-woo-7788"));
    }

    @Test
    void detailView_isTenantScopedAndIncludesRejectedReasonAndRawPayload() throws Exception {
        OrderIngestionService.IngestedOrderResult rejected = ingestRejected(
                tenantId,
                OrderSource.CUSTOM_API,
                "api-bad-1",
                "idem-api-bad-1"
        );
        OrderIngestionService.IngestedOrderResult otherTenantInbound = ingestNormalized(
                otherTenantId,
                OrderSource.CUSTOM_API,
                "api-other-1",
                "idem-api-other-1",
                "Other"
        );

        mockMvc.perform(get("/api/inbound-orders/" + rejected.inboundOrderId())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inboundOrderId").value(rejected.inboundOrderId().toString()))
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("amount must be greater than zero"))
                .andExpect(jsonPath("$.rawPayload").value("{\"source\":\"CUSTOM_API\",\"externalOrderId\":\"api-bad-1\"}"));

        mockMvc.perform(get("/api/inbound-orders/" + otherTenantInbound.inboundOrderId())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void detailView_linksNormalizedInboundOrderToCreatedOrder() throws Exception {
        OrderIngestionService.IngestedOrderResult result = ingestNormalized(
                tenantId,
                OrderSource.FACEBOOK_LEAD_FORM,
                "fb-2001",
                "idem-fb-2001",
                "Facebook"
        );

        mockMvc.perform(get("/api/inbound-orders/" + result.inboundOrderId())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NORMALIZED"))
                .andExpect(jsonPath("$.normalizedOrderId").value(result.orderId().toString()))
                .andExpect(jsonPath("$.rejectionReason").doesNotExist());

        mockMvc.perform(get("/api/orders/" + result.orderId())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(result.orderId().toString()))
                .andExpect(jsonPath("$.source").value("FACEBOOK_LEAD_FORM"))
                .andExpect(jsonPath("$.inboundOrderId").value(result.inboundOrderId().toString()));
    }

    @Test
    void unauthenticatedAccess_isUnauthorized() throws Exception {
        mockMvc.perform(get("/api/inbound-orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void summary_isTenantScopedAndReportsIngestionHealth() throws Exception {
        Instant now = Instant.now();
        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);

        OrderIngestionService.IngestedOrderResult oldRejected = ingestRejected(
                tenantId,
                OrderSource.CUSTOM_API,
                "api-old-rejected",
                "idem-api-old-rejected"
        );
        updateInboundOrder(
                oldRejected.inboundOrderId(),
                now.minusSeconds(26 * 60 * 60),
                null,
                "Old rejection outside the dashboard window"
        );

        OrderIngestionService.IngestedOrderResult countedRejected = ingestRejected(
                tenantId,
                OrderSource.SHOPIFY,
                "shop-counted-rejected",
                "idem-shop-counted-rejected"
        );
        updateInboundOrder(
                countedRejected.inboundOrderId(),
                now.minusSeconds(2 * 60 * 60),
                null,
                "Missing address line"
        );

        OrderIngestionService.IngestedOrderResult latestRejected = ingestRejected(
                tenantId,
                OrderSource.WHATSAPP,
                "wa-latest-rejected",
                "idem-wa-latest-rejected"
        );
        updateInboundOrder(
                latestRejected.inboundOrderId(),
                now.minusSeconds(60 * 60),
                null,
                "Customer phone number is missing"
        );

        OrderIngestionService.IngestedOrderResult normalizedToday = ingestNormalized(
                tenantId,
                OrderSource.YOUCAN,
                "youcan-normalized-today",
                "idem-youcan-normalized-today",
                "Today"
        );
        updateInboundOrder(normalizedToday.inboundOrderId(), now.minusSeconds(30), now.minusSeconds(30), null);

        OrderIngestionService.IngestedOrderResult normalizedBeforeToday = ingestNormalized(
                tenantId,
                OrderSource.WOOCOMMERCE,
                "woo-normalized-old",
                "idem-woo-normalized-old",
                "Old"
        );
        updateInboundOrder(
                normalizedBeforeToday.inboundOrderId(),
                todayStart.minusSeconds(120),
                todayStart.minusSeconds(60),
                null
        );

        OrderIngestionService.IngestedOrderResult otherTenantRejected = ingestRejected(
                otherTenantId,
                OrderSource.FACEBOOK_LEAD_FORM,
                "fb-other-rejected",
                "idem-fb-other-rejected"
        );
        updateInboundOrder(
                otherTenantRejected.inboundOrderId(),
                now.minusSeconds(10),
                null,
                "Other tenant rejection"
        );
        ingestNormalized(
                otherTenantId,
                OrderSource.SHOPIFY,
                "shop-other-normalized",
                "idem-shop-other-normalized",
                "OtherToday"
        );

        mockMvc.perform(get("/api/inbound-orders/summary")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejectedCount").value(2))
                .andExpect(jsonPath("$.normalizedTodayCount").value(1))
                .andExpect(jsonPath("$.latestRejectedSource").value("WHATSAPP"))
                .andExpect(jsonPath("$.latestRejectedAt").isNotEmpty())
                .andExpect(jsonPath("$.latestRejectedReason").value("Customer phone number is missing"))
                .andExpect(jsonPath("$.rawPayload").doesNotExist());
    }

    private OrderIngestionService.IngestedOrderResult ingestNormalized(
            UUID tenantId,
            OrderSource source,
            String externalOrderId,
            String idempotencyKey,
            String firstName
    ) {
        return orderIngestionService.ingestAndNormalize(new OrderIngestionService.IngestOrderCommand(
                tenantId,
                source,
                externalOrderId,
                idempotencyKey,
                "{\"source\":\"" + source + "\",\"externalOrderId\":\"" + externalOrderId + "\"}",
                new Customer(firstName, "Customer", firstName.toLowerCase() + "@example.com", "0612345678"),
                new Address("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                new BigDecimal("100.00")
        ));
    }

    private OrderIngestionService.IngestedOrderResult ingestRejected(
            UUID tenantId,
            OrderSource source,
            String externalOrderId,
            String idempotencyKey
    ) {
        return orderIngestionService.ingestAndNormalize(new OrderIngestionService.IngestOrderCommand(
                tenantId,
                source,
                externalOrderId,
                idempotencyKey,
                "{\"source\":\"" + source + "\",\"externalOrderId\":\"" + externalOrderId + "\"}",
                new Customer("Rejected", "Customer", "rejected-" + externalOrderId + "@example.com", "0612345678"),
                new Address("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                BigDecimal.ZERO
        ));
    }

    private void updateInboundOrder(
            UUID inboundOrderId,
            Instant receivedAt,
            Instant normalizedAt,
            String rejectionReason
    ) {
        transactionTemplate.executeWithoutResult(status -> {
            InboundOrder inboundOrder = entityManager.find(InboundOrder.class, inboundOrderId);
            inboundOrder.setReceivedAt(receivedAt);
            inboundOrder.setNormalizedAt(normalizedAt);
            if (rejectionReason != null) {
                inboundOrder.setRejectionReason(rejectionReason);
            }
            entityManager.flush();
        });
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readValue(
                result.getResponse().getContentAsString(),
                AuthController.LoginResponse.class
        ).token();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM order_search_saved_views").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM couriers").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }
}

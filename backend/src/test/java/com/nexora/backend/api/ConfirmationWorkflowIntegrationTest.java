package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.ConfirmationOutcome;
import com.nexora.backend.domain.model.ProductStatus;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ConfirmationWorkflowIntegrationTest {

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

    private String jwtToken;
    private String otherTenantJwtToken;

    @BeforeEach
    void setup() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID otherTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Test Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "test@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    tenantId
            ));

            entityManager.persist(new Tenant(otherTenantId, "Other Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "other@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    otherTenantId
            ));

            entityManager.flush();
        });

        jwtToken = login("test@example.com", "password");
        otherTenantJwtToken = login("other@example.com", "password");
    }

    @Test
    void queueListing_isTenantScopedAndSupportsFilters() throws Exception {
        String createdOrderId = createOrder(jwtToken, "Alice", "Queue", "0611111111");
        String requestedOrderId = createOrder(jwtToken, "Bob", "Requested", "0622222222");
        requestConfirmation(jwtToken, requestedOrderId);
        createOrder(otherTenantJwtToken, "Mallory", "Other", "0633333333");

        String today = LocalDate.now(ZoneOffset.UTC).toString();

        mockMvc.perform(get("/api/confirmations/queue")
                .param("createdFrom", today)
                .param("createdTo", today)
                .param("search", "061111")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(createdOrderId))
                .andExpect(jsonPath("$.content[0].customer.firstName").value("Alice"));

        mockMvc.perform(get("/api/confirmations/queue")
                .param("status", "CONFIRMATION_REQUESTED")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(requestedOrderId))
                .andExpect(jsonPath("$.content[0].status").value("CONFIRMATION_REQUESTED"));

        mockMvc.perform(get("/api/confirmations/queue")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].customer.firstName").value("Mallory"));

        assertNotEquals(createdOrderId, requestedOrderId);
    }

    @Test
    void queueListing_includesSafeOrderLineSnapshotsForProductOrders() throws Exception {
        String productId = createProduct(
                jwtToken,
                productRequest("Argan Oil", "argan-oil", "174.50", "MAD", "ARG-001", ProductStatus.ACTIVE)
        );
        String orderId = createProductLineOrder(jwtToken, List.of(
                new OrderController.ProductLineRequest(UUID.fromString(productId), 2)
        ));

        mockMvc.perform(get("/api/confirmations/queue")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(orderId))
                .andExpect(jsonPath("$.content[0].amount").value(349.00))
                .andExpect(jsonPath("$.content[0].orderLines.length()").value(1))
                .andExpect(jsonPath("$.content[0].orderLines[0].productId").doesNotExist())
                .andExpect(jsonPath("$.content[0].orderLines[0].productName").value("Argan Oil"))
                .andExpect(jsonPath("$.content[0].orderLines[0].sku").value("ARG-001"))
                .andExpect(jsonPath("$.content[0].orderLines[0].unitPrice").value(174.50))
                .andExpect(jsonPath("$.content[0].orderLines[0].quantity").value(2))
                .andExpect(jsonPath("$.content[0].orderLines[0].lineTotal").value(349.00))
                .andExpect(jsonPath("$.content[0].orderLines[0].currency").value("MAD"));
    }

    @Test
    void queueListing_includesInitialIntelligenceScoreWithoutChangingOrderPayloads() throws Exception {
        String orderId = createOrder(jwtToken, "Score", "Buyer", "0612345678");

        mockMvc.perform(get("/api/confirmations/queue")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(orderId))
                .andExpect(jsonPath("$.content[0].intelligence.confirmationConfidenceScore").value(73))
                .andExpect(jsonPath("$.content[0].intelligence.fraudRiskScore").value(34))
                .andExpect(jsonPath("$.content[0].intelligence.level").value("NEEDS_ATTENTION"))
                .andExpect(jsonPath("$.content[0].intelligence.signals.length()").value(3))
                .andExpect(jsonPath("$.content[0].intelligence.signals[0].label").value("Address has delivery basics"));
    }

    @Test
    void orderDetailTracksIntelligenceAuditHistory() throws Exception {
        String orderId = createOrder(jwtToken, "Audit", "Buyer", "0612345678");

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intelligence.history.length()").value(1))
                .andExpect(jsonPath("$.intelligence.history[0].sequenceNumber").value(1))
                .andExpect(jsonPath("$.intelligence.history[0].changeLabel").value("Initial score"))
                .andExpect(jsonPath("$.intelligence.history[0].confirmationConfidenceScore").value(73))
                .andExpect(jsonPath("$.intelligence.history[0].fraudRiskScore").value(34))
                .andExpect(jsonPath("$.intelligence.history[0].calibrationVersion").value("v2"));

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "No answer on first call"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intelligence.history.length()").value(2))
                .andExpect(jsonPath("$.intelligence.history[0].sequenceNumber").value(2))
                .andExpect(jsonPath("$.intelligence.history[0].changeLabel").value("Risk increased"))
                .andExpect(jsonPath("$.intelligence.history[0].previousConfirmationConfidenceScore").value(73))
                .andExpect(jsonPath("$.intelligence.history[0].previousFraudRiskScore").value(34))
                .andExpect(jsonPath("$.intelligence.history[0].confirmationConfidenceScore").value(63))
                .andExpect(jsonPath("$.intelligence.history[0].fraudRiskScore").value(44))
                .andExpect(jsonPath("$.intelligence.history[0].confidenceDelta").value(-10))
                .andExpect(jsonPath("$.intelligence.history[0].riskDelta").value(10))
                .andExpect(jsonPath("$.intelligence.history[0].reasonLabel").value("First no-answer attempt"))
                .andExpect(jsonPath("$.intelligence.history[1].sequenceNumber").value(1))
                .andExpect(jsonPath("$.intelligence.history[1].changeLabel").value("Initial score"));
    }

    @Test
    void repeatedNoAnswerAttemptsRaiseHighRiskIntelligenceScore() throws Exception {
        String orderId = createOrder(jwtToken, "Risk", "Buyer", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "No answer on first call"))
                .andExpect(status().isCreated());
        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "No answer again"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.intelligence.confirmationConfidenceScore").value(38))
                .andExpect(jsonPath("$.intelligence.fraudRiskScore").value(69))
                .andExpect(jsonPath("$.intelligence.level").value("HIGH_RISK"))
                .andExpect(jsonPath("$.intelligence.summary").value("High risk: Second no-answer attempt"))
                .andExpect(jsonPath("$.intelligence.signals[0].label").value("Second no-answer attempt"))
                .andExpect(jsonPath("$.intelligence.signals[?(@.key=='repeated_unresolved_outcome')].label")
                        .value("Repeated unresolved behavior"));
    }

    @Test
    void wrongNumberAttemptIsHighRiskAndExplainable() throws Exception {
        String orderId = createOrder(jwtToken, "Wrong", "Number", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.WRONG_NUMBER, "Phone belongs to someone else"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.intelligence.confirmationConfidenceScore").value(13))
                .andExpect(jsonPath("$.intelligence.fraudRiskScore").value(94))
                .andExpect(jsonPath("$.intelligence.level").value("HIGH_RISK"))
                .andExpect(jsonPath("$.intelligence.summary").value("High risk: Wrong number"))
                .andExpect(jsonPath("$.intelligence.signals[0].key").value("wrong_number"));
    }

    @Test
    void intelligenceReportSummarizesScoreHealthAndMovements() throws Exception {
        String orderId = createOrder(jwtToken, "Report", "Buyer", "0612345678");

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intelligence.confirmationConfidenceScore").value(73));

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "No answer on first call"))
                .andExpect(status().isCreated());
        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "No answer again"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/intelligence/report")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scoredOrders").value(1))
                .andExpect(jsonPath("$.averageConfirmationConfidence").value(38))
                .andExpect(jsonPath("$.averageFraudRisk").value(69))
                .andExpect(jsonPath("$.highRiskCount").value(1))
                .andExpect(jsonPath("$.needsAttentionCount").value(0))
                .andExpect(jsonPath("$.movementSummary.riskIncreasedCount").value(2))
                .andExpect(jsonPath("$.movementSummary.levelChangedCount").value(1))
                .andExpect(jsonPath("$.topSignals[0].key").value("second_no_answer"))
                .andExpect(jsonPath("$.recentMovements[?(@.changeLabel=='Moved to High risk')].orderId").value(orderId))
                .andExpect(jsonPath("$.highRiskOrders[0].orderId").value(orderId))
                .andExpect(jsonPath("$.highRiskOrders[0].customerName").value("Report Buyer"))
                .andExpect(jsonPath("$.calibration.version").value("v2"))
                .andExpect(jsonPath("$.calibration.highRiskMinimumRisk").value(65));
    }

    @Test
    void deliveredPhoneHistoryRaisesNewOrderToHighConfidence() throws Exception {
        String courierId = createCourier(jwtToken, "History Courier");
        String deliveredOrderId = createOrder(jwtToken, "Loyal", "Buyer", "0612345678");

        requestConfirmation(jwtToken, deliveredOrderId);
        confirmOrder(jwtToken, deliveredOrderId);
        assignCourier(jwtToken, deliveredOrderId, courierId);
        pickUp(jwtToken, deliveredOrderId, courierId);
        mockMvc.perform(post("/api/orders/" + deliveredOrderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        String newOrderId = createOrder(jwtToken, "Loyal", "Buyer", "0612345678");

        mockMvc.perform(get("/api/orders/" + newOrderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.intelligence.confirmationConfidenceScore").value(93))
                .andExpect(jsonPath("$.intelligence.fraudRiskScore").value(19))
                .andExpect(jsonPath("$.intelligence.level").value("HIGH_CONFIDENCE"))
                .andExpect(jsonPath("$.intelligence.summary").value("Strong confirmation signals"))
                .andExpect(jsonPath("$.intelligence.signals[0].key").value("phone_delivered_before"));
    }

    @Test
    void confirmedAttempt_emitsOrderConfirmedEventAndUpdatesOrder() throws Exception {
        String orderId = createOrder(jwtToken, "Confirmed", "User", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.CONFIRMED, "Customer confirmed by phone"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.attemptNumber").value(1))
                .andExpect(jsonPath("$.outcome").value("CONFIRMED"))
                .andExpect(jsonPath("$.note").value("Customer confirmed by phone"))
                .andExpect(jsonPath("$.createdBy").value("test@example.com"));

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.intelligence.level").value("HIGH_CONFIDENCE"))
                .andExpect(jsonPath("$.intelligence.confirmationConfidenceScore").value(100))
                .andExpect(jsonPath("$.intelligence.fraudRiskScore").value(0));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[1].eventType").value("OrderConfirmationRequested"))
                .andExpect(jsonPath("$[2].eventType").value("OrderConfirmed"));
    }

    @Test
    void rejectedAttempt_emitsOrderRejectedEventAndUpdatesOrder() throws Exception {
        String orderId = createOrder(jwtToken, "Rejected", "User", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.REJECTED, "Customer refused COD"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptNumber").value(1))
                .andExpect(jsonPath("$.outcome").value("REJECTED"));

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.failureReason").value("Customer refused COD"));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[2].eventType").value("OrderRejected"))
                .andExpect(jsonPath("$[2].payload", containsString("Customer refused COD")));
    }

    @Test
    void nonFinalAttempt_doesNotFinalizeOrderOrEmitLifecycleEvent() throws Exception {
        String orderId = createOrder(jwtToken, "Pending", "User", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "No answer on first call"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptNumber").value(1))
                .andExpect(jsonPath("$.outcome").value("NO_ANSWER"));

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].eventType").value("OrderCreated"));
    }

    @Test
    void cannotRecordAttemptOnFinalStateOrder() throws Exception {
        String orderId = createOrder(jwtToken, "Delivered", "User", "0612345678");
        String courierId = createCourier(jwtToken, "Final State Courier");

        requestConfirmation(jwtToken, orderId);
        confirmOrder(jwtToken, orderId);
        assignCourier(jwtToken, orderId, courierId);
        pickUp(jwtToken, orderId, courierId);
        mockMvc.perform(post("/api/orders/" + orderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "Too late"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));
    }

    @Test
    void attemptsList_isTenantScopedAndOrdered() throws Exception {
        String orderId = createOrder(jwtToken, "Scoped", "User", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.NO_ANSWER, "First call"))
                .andExpect(status().isCreated());
        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Call after 18:00",
                Instant.now().plusSeconds(3600)
        ))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/orders/" + orderId + "/confirmation-attempts")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].attemptNumber").value(1))
                .andExpect(jsonPath("$[0].outcome").value("NO_ANSWER"))
                .andExpect(jsonPath("$[1].attemptNumber").value(2))
                .andExpect(jsonPath("$[1].outcome").value("CALL_BACK_LATER"));

        mockMvc.perform(get("/api/orders/" + orderId + "/confirmation-attempts")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void queueRejectsNonQueueStatusFilter() throws Exception {
        mockMvc.perform(get("/api/confirmations/queue")
                .param("status", "CONFIRMED")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("status must be CREATED or CONFIRMATION_REQUESTED"));
    }

    @Test
    void callBackLaterRequiresCallbackAt() throws Exception {
        String orderId = createOrder(jwtToken, "CallbackMissing", "User", "0612345678");

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.CALL_BACK_LATER, "Call later"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("callbackAt is required for CALL_BACK_LATER"));
    }

    @Test
    void pastCallbackAtIsRejected() throws Exception {
        String orderId = createOrder(jwtToken, "CallbackPast", "User", "0612345678");

        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Call later",
                Instant.now().minusSeconds(60)
        ))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("callbackAt must be in the future"));
    }

    @Test
    void dueCallbackAppearsInCallbackQueue() throws Exception {
        String orderId = createOrder(jwtToken, "Due", "Callback", "0612345678");
        Instant scheduledAt = Instant.now().plusSeconds(3600);

        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Call this customer back",
                scheduledAt
        ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.callbackAt").value(scheduledAt.toString()));

        Instant dueAt = Instant.now().minusSeconds(60);
        moveCallbackAt(orderId, dueAt);

        mockMvc.perform(get("/api/confirmations/callbacks")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(orderId))
                .andExpect(jsonPath("$.content[0].callbackAt").value(dueAt.toString()))
                .andExpect(jsonPath("$.content[0].note").value("Call this customer back"))
                .andExpect(jsonPath("$.content[0].order.customer.firstName").value("Due"));
    }

    @Test
    void futureCallbackDoesNotAppearInDefaultDueQueue() throws Exception {
        String orderId = createOrder(jwtToken, "Future", "Callback", "0612345678");
        Instant callbackAt = Instant.now().plusSeconds(3600);

        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Call tomorrow",
                callbackAt
        ))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/confirmations/callbacks")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/api/confirmations/callbacks")
                .param("scope", "UPCOMING")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(orderId))
                .andExpect(jsonPath("$.content[0].status").value("UPCOMING"));
    }

    @Test
    void finalConfirmationResolvesPendingCallbacks() throws Exception {
        String orderId = createOrder(jwtToken, "Resolved", "Callback", "0612345678");

        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Call back later",
                Instant.now().plusSeconds(3600)
        ))
                .andExpect(status().isCreated());

        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.CONFIRMED, "Confirmed on follow-up"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.outcome").value("CONFIRMED"));

        mockMvc.perform(get("/api/confirmations/callbacks")
                .param("scope", "ALL")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/api/orders/" + orderId + "/confirmation-attempts")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].outcome").value("CALL_BACK_LATER"))
                .andExpect(jsonPath("$[0].callbackResolvedAt").isString())
                .andExpect(jsonPath("$[0].callbackResolvedBy").value("test@example.com"))
                .andExpect(jsonPath("$[1].outcome").value("CONFIRMED"));
    }

    @Test
    void orderTimelineIncludesConfirmationAttemptsAndCallbackResolution() throws Exception {
        String orderId = createOrder(jwtToken, "Timeline", "Callback", "0612345678");

        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Call customer after work",
                Instant.now().plusSeconds(3600)
        ))
                .andExpect(status().isCreated());
        mockMvc.perform(recordAttempt(jwtToken, orderId, ConfirmationOutcome.CONFIRMED, "Confirmed on second call"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/orders/" + orderId + "/timeline")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].type").value("OrderCreated"))
                .andExpect(jsonPath("$[?(@.type=='ConfirmationAttemptRecorded' && @.category=='CALLBACK')].title").value("Callback scheduled"))
                .andExpect(jsonPath("$[?(@.type=='ConfirmationAttemptRecorded' && @.category=='CONFIRMATION')].actor").value("test@example.com"))
                .andExpect(jsonPath("$[?(@.type=='CallbackResolved')].actor").value("test@example.com"))
                .andExpect(jsonPath("$[?(@.type=='OrderConfirmed')].source").value("DOMAIN_EVENT"));
    }

    @Test
    void callbackQueueIsTenantScoped() throws Exception {
        String orderId = createOrder(jwtToken, "Tenant", "Callback", "0612345678");
        String otherOrderId = createOrder(otherTenantJwtToken, "OtherTenant", "Callback", "0612345678");

        mockMvc.perform(recordAttempt(
                jwtToken,
                orderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Tenant callback",
                Instant.now().plusSeconds(3600)
        ))
                .andExpect(status().isCreated());
        mockMvc.perform(recordAttempt(
                otherTenantJwtToken,
                otherOrderId,
                ConfirmationOutcome.CALL_BACK_LATER,
                "Other callback",
                Instant.now().plusSeconds(3600)
        ))
                .andExpect(status().isCreated());

        Instant dueAt = Instant.now().minusSeconds(60);
        moveCallbackAt(orderId, dueAt);
        moveCallbackAt(otherOrderId, dueAt);

        mockMvc.perform(get("/api/confirmations/callbacks")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(orderId))
                .andExpect(jsonPath("$.content[0].order.customer.firstName").value("Tenant"));
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM order_intelligence_audit_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_intelligence_signals").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_intelligence_snapshots").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM couriers").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }

    private String createCourier(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/couriers")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierRequest(name, "0611111111"))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("courierId").asText();
    }

    private String createOrder(String token, String firstName, String lastName, String phone) throws Exception {
        OrderController.CreateOrderRequest createRequest = new OrderController.CreateOrderRequest(
                new OrderController.CustomerRequest(firstName, lastName, firstName.toLowerCase() + "@example.com", phone),
                new OrderController.AddressRequest("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                new BigDecimal("100.00")
        );

        MvcResult result = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isOk())
                .andReturn();

        return result.getResponse().getContentAsString().replace("\"", "");
    }

    private String createProductLineOrder(
            String token,
            List<OrderController.ProductLineRequest> productLines
    ) throws Exception {
        OrderController.CreateOrderRequest createRequest = new OrderController.CreateOrderRequest(
                new OrderController.CustomerRequest("Product", "Buyer", "product-buyer@example.com", "0612345678"),
                new OrderController.AddressRequest("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                null,
                productLines,
                null,
                null,
                null
        );

        MvcResult result = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isOk())
                .andReturn();

        return result.getResponse().getContentAsString().replace("\"", "");
    }

    private ProductController.ProductRequest productRequest(
            String name,
            String slug,
            String priceAmount,
            String currency,
            String sku,
            ProductStatus status
    ) {
        return new ProductController.ProductRequest(
                name,
                slug,
                null,
                new BigDecimal(priceAmount),
                currency,
                sku,
                null,
                status
        );
    }

    private String createProduct(String token, ProductController.ProductRequest request) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    private MockHttpServletRequestBuilder recordAttempt(
            String token,
            String orderId,
            ConfirmationOutcome outcome,
            String note
    ) throws Exception {
        return recordAttempt(token, orderId, outcome, note, null);
    }

    private MockHttpServletRequestBuilder recordAttempt(
            String token,
            String orderId,
            ConfirmationOutcome outcome,
            String note,
            Instant callbackAt
    ) throws Exception {
        ConfirmationController.RecordConfirmationAttemptRequest request =
                new ConfirmationController.RecordConfirmationAttemptRequest(outcome, note, callbackAt);
        return post("/api/orders/" + orderId + "/confirmation-attempts")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request));
    }

    private void moveCallbackAt(String orderId, Instant callbackAt) {
        transactionTemplate.executeWithoutResult(status -> entityManager.createQuery("""
                        update ConfirmationAttempt attempt
                           set attempt.callbackAt = :callbackAt
                         where attempt.orderId = :orderId
                        """)
                .setParameter("callbackAt", callbackAt)
                .setParameter("orderId", UUID.fromString(orderId))
                .executeUpdate());
    }

    private void requestConfirmation(String token, String orderId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation")
                .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    private void confirmOrder(String token, String orderId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/confirm")
                .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    private void assignCourier(String token, String orderId, String courierId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isOk());
    }

    private void pickUp(String token, String orderId, String courierId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/pick-up")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isOk());
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
}

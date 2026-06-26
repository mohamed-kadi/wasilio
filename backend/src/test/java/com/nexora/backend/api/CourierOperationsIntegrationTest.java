package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.DeliveryFailureRecoveryDecision;
import com.nexora.backend.domain.model.DeliveryFailureReason;
import com.nexora.backend.domain.model.DeliveryFollowUpStatus;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.DeliveryFailureRepository;
import com.nexora.backend.domain.repository.DeliveryFailureRecoveryRepository;
import com.nexora.backend.domain.repository.DeliveryFollowUpTaskRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CourierOperationsIntegrationTest {

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
    private DeliveryFailureRepository deliveryFailureRepository;

    @Autowired
    private DeliveryFailureRecoveryRepository deliveryFailureRecoveryRepository;

    @Autowired
    private DeliveryFollowUpTaskRepository deliveryFollowUpTaskRepository;

    private String jwtToken;
    private String otherTenantJwtToken;

    @BeforeEach
    void setup() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID otherTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Courier Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "courier@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    tenantId
            ));

            entityManager.persist(new Tenant(otherTenantId, "Other Courier Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "other-courier@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    otherTenantId
            ));

            entityManager.flush();
        });

        jwtToken = login("courier@example.com", "password");
        otherTenantJwtToken = login("other-courier@example.com", "password");
    }

    @Test
    void createListUpdateAndDeactivateCourier_areTenantScoped() throws Exception {
        String courierId = createCourier(jwtToken, "Atlas Courier", "0611111111");

        mockMvc.perform(get("/api/couriers")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].courierId").value(courierId))
                .andExpect(jsonPath("$.content[0].active").value(true));

        mockMvc.perform(put("/api/couriers/" + courierId)
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierRequest("Updated Courier", "0622222222"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Courier"))
                .andExpect(jsonPath("$.phone").value("0622222222"));

        mockMvc.perform(patch("/api/couriers/" + courierId + "/active")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierActiveRequest(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(get("/api/couriers/" + courierId)
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/couriers")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void courierValidation_rejectsBlankNameAndPhone() throws Exception {
        mockMvc.perform(post("/api/couriers")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierRequest("", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"));
    }

    @Test
    void assignConfirmedOrder_emitsEventAndUpdatesProjection() throws Exception {
        String courierId = createCourier(jwtToken, "Assignment Courier", "0611111111");
        String orderId = createConfirmedOrder(jwtToken, "Assignable");

        assignCourier(jwtToken, orderId, courierId)
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED_TO_COURIER"))
                .andExpect(jsonPath("$.courierId").value(courierId));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[3].eventType").value("OrderAssignedToCourier"));
    }

    @Test
    void assignmentRejectsInvalidStateInactiveCourierCrossTenantCourierAndReassignment() throws Exception {
        String courierId = createCourier(jwtToken, "Assignment Guard", "0611111111");
        String inactiveCourierId = createCourier(jwtToken, "Inactive Guard", "0633333333");
        deactivateCourier(jwtToken, inactiveCourierId);
        String otherTenantCourierId = createCourier(otherTenantJwtToken, "Other Tenant Courier", "0644444444");

        String createdOrderId = createOrder(jwtToken, "CreatedOnly");
        assignCourier(jwtToken, createdOrderId, courierId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        String confirmedOrderId = createConfirmedOrder(jwtToken, "Confirmed");
        assignCourier(jwtToken, confirmedOrderId, inactiveCourierId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        assignCourier(jwtToken, confirmedOrderId, otherTenantCourierId)
                .andExpect(status().isNotFound());

        assignCourier(jwtToken, confirmedOrderId, courierId)
                .andExpect(status().isOk());

        assignCourier(jwtToken, confirmedOrderId, courierId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));
    }

    @Test
    void pickupAssignedOrder_updatesProjectionAndRejectsInvalidState() throws Exception {
        String courierId = createCourier(jwtToken, "Pickup Courier", "0611111111");
        String assignedOrderId = createConfirmedOrder(jwtToken, "Pickup");
        assignCourier(jwtToken, assignedOrderId, courierId)
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/orders/" + assignedOrderId + "/pick-up")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + assignedOrderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PICKED_UP"));

        String confirmedOrderId = createConfirmedOrder(jwtToken, "NotAssigned");
        mockMvc.perform(post("/api/orders/" + confirmedOrderId + "/pick-up")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));
    }

    @Test
    void courierQueuesSupportTenantIsolationFilteringAndPagination() throws Exception {
        String firstCourierId = createCourier(jwtToken, "First Courier", "0611111111");
        String secondCourierId = createCourier(jwtToken, "Second Courier", "0622222222");
        String unassignedOrderId = createConfirmedOrder(jwtToken, "Unassigned");
        String firstAssignedOrderId = createConfirmedOrder(jwtToken, "FirstAssigned");
        String secondAssignedOrderId = createConfirmedOrder(jwtToken, "SecondAssigned");
        String otherTenantOrderId = createConfirmedOrder(otherTenantJwtToken, "OtherTenant");

        assignCourier(jwtToken, firstAssignedOrderId, firstCourierId)
                .andExpect(status().isOk());
        assignCourier(jwtToken, secondAssignedOrderId, secondCourierId)
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/courier-operations/assignment-queue")
                .param("page", "0")
                .param("size", "1")
                .param("createdFrom", Instant.now().minus(1, ChronoUnit.DAYS).toString())
                .param("createdTo", Instant.now().plus(1, ChronoUnit.DAYS).toString())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(unassignedOrderId));

        mockMvc.perform(get("/api/courier-operations/pickup-queue")
                .param("courierId", firstCourierId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(firstAssignedOrderId));

        mockMvc.perform(get("/api/courier-operations/pickup-queue")
                .param("status", "ASSIGNED_TO_COURIER")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/courier-operations/pickup-queue")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/api/orders/" + otherTenantOrderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deliveryQueueSupportsTenantIsolationFilteringAndPagination() throws Exception {
        String firstCourierId = createCourier(jwtToken, "Delivery First", "0611111111");
        String secondCourierId = createCourier(jwtToken, "Delivery Second", "0622222222");
        String firstPickedUpOrderId = createPickedUpOrder(jwtToken, "FirstDelivery", firstCourierId);
        String secondPickedUpOrderId = createPickedUpOrder(jwtToken, "SecondDelivery", secondCourierId);
        createPickedUpOrder(otherTenantJwtToken, "OtherDelivery", createCourier(otherTenantJwtToken, "Other Delivery", "0633333333"));

        mockMvc.perform(get("/api/courier-operations/delivery-queue")
                .param("page", "0")
                .param("size", "1")
                .param("courierId", firstCourierId)
                .param("createdFrom", Instant.now().minus(1, ChronoUnit.DAYS).toString())
                .param("createdTo", Instant.now().plus(1, ChronoUnit.DAYS).toString())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(firstPickedUpOrderId));

        mockMvc.perform(get("/api/courier-operations/delivery-queue")
                .param("status", "PICKED_UP")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/courier-operations/delivery-queue")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(get("/api/courier-operations/delivery-queue")
                .param("courierId", secondCourierId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(secondPickedUpOrderId));
    }

    @Test
    void markDelivered_updatesProjectionAndEmitsEvent() throws Exception {
        String courierId = createCourier(jwtToken, "Delivered Courier", "0611111111");
        String orderId = createPickedUpOrder(jwtToken, "Delivered", courierId);

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[5].eventType").value("OrderDelivered"));
    }

    @Test
    void markFailed_updatesProjectionEmitsEventAndPersistsFailureReason() throws Exception {
        String courierId = createCourier(jwtToken, "Failed Courier", "0611111111");
        String orderId = createPickedUpOrder(jwtToken, "Failed", courierId);

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        DeliveryFailureReason.CUSTOMER_UNREACHABLE,
                        "No answer after two calls"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.courierId").value(courierId))
                .andExpect(jsonPath("$.reason").value("CUSTOMER_UNREACHABLE"))
                .andExpect(jsonPath("$.note").value("No answer after two calls"));

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.failureReason").value("CUSTOMER_UNREACHABLE"));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[5].eventType").value("OrderDeliveryFailed"));

        mockMvc.perform(get("/api/orders/" + orderId + "/timeline")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecorded')].category").value("DELIVERY"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecorded')].details.reason").value("CUSTOMER_UNREACHABLE"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecorded')].details.note").value("No answer after two calls"));

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.RETRY_DELIVERY,
                        "Customer asked for retry tomorrow",
                        null
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.decision").value("RETRY_DELIVERY"))
                .andExpect(jsonPath("$.note").value("Customer asked for retry tomorrow"))
                .andExpect(jsonPath("$.createdBy").value("courier@example.com"));

        mockMvc.perform(get("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderId").value(orderId))
                .andExpect(jsonPath("$[0].decision").value("RETRY_DELIVERY"))
                .andExpect(jsonPath("$[0].note").value("Customer asked for retry tomorrow"));

        mockMvc.perform(get("/api/orders/" + orderId + "/timeline")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecoveryRecorded')].category").value("DELIVERY"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecoveryRecorded')].actor").value("courier@example.com"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecoveryRecorded')].details.decision").value("RETRY_DELIVERY"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFailureRecoveryRecorded')].details.note").value("Customer asked for retry tomorrow"));

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/retry-delivery")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        mockMvc.perform(get("/api/courier-operations/assignment-queue")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(orderId));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7))
                .andExpect(jsonPath("$[6].eventType").value("OrderDeliveryRetryRequested"));

        mockMvc.perform(get("/api/orders/" + orderId + "/timeline")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(9))
                .andExpect(jsonPath("$[?(@.type=='OrderDeliveryRetryRequested')].category").value("DELIVERY"));

        transactionTemplate.executeWithoutResult(status -> {
            var failure = deliveryFailureRepository.findByOrderIdAndTenantId(UUID.fromString(orderId), getTenantId("courier@example.com"))
                    .orElseThrow();
            org.assertj.core.api.Assertions.assertThat(failure.getReason()).isEqualTo(DeliveryFailureReason.CUSTOMER_UNREACHABLE);
            org.assertj.core.api.Assertions.assertThat(failure.getNote()).isEqualTo("No answer after two calls");

            var recoveries = deliveryFailureRecoveryRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(
                    getTenantId("courier@example.com"),
                    UUID.fromString(orderId)
            );
            org.assertj.core.api.Assertions.assertThat(recoveries).hasSize(1);
            org.assertj.core.api.Assertions.assertThat(recoveries.get(0).getDecision()).isEqualTo(DeliveryFailureRecoveryDecision.RETRY_DELIVERY);
            org.assertj.core.api.Assertions.assertThat(recoveries.get(0).getNote()).isEqualTo("Customer asked for retry tomorrow");
        });
    }

    @Test
    void deliveryOutcomesRejectInvalidStatesAndCrossTenantOrders() throws Exception {
        String courierId = createCourier(jwtToken, "Delivery Guard", "0611111111");
        String confirmedOrderId = createConfirmedOrder(jwtToken, "ConfirmedDeliveryGuard");
        String assignedOrderId = createConfirmedOrder(jwtToken, "AssignedDeliveryGuard");
        assignCourier(jwtToken, assignedOrderId, courierId)
                .andExpect(status().isOk());
        String pickedUpOrderId = createPickedUpOrder(jwtToken, "PickedDeliveryGuard", courierId);

        mockMvc.perform(post("/api/courier-operations/orders/" + confirmedOrderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        mockMvc.perform(post("/api/courier-operations/orders/" + assignedOrderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        DeliveryFailureReason.CUSTOMER_REFUSED,
                        null
                ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        mockMvc.perform(post("/api/courier-operations/orders/" + confirmedOrderId + "/retry-delivery")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        mockMvc.perform(post("/api/courier-operations/orders/" + confirmedOrderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.REFUND_OR_CUSTOMER_FOLLOW_UP,
                        "Customer follow-up needed",
                        null
                ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        mockMvc.perform(post("/api/courier-operations/orders/" + pickedUpOrderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        DeliveryFailureReason.CUSTOMER_REFUSED,
                        null
                ))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/courier-operations/orders/" + pickedUpOrderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.REFUND_OR_CUSTOMER_FOLLOW_UP,
                        "Customer follow-up needed",
                        null
                ))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/courier-operations/orders/" + pickedUpOrderId + "/retry-delivery")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));

        mockMvc.perform(post("/api/courier-operations/orders/" + pickedUpOrderId + "/deliver")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/courier-operations/orders/" + pickedUpOrderId + "/failure-recoveries")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void customerFollowUpRecoveryCreatesAndResolvesTask() throws Exception {
        String courierId = createCourier(jwtToken, "Follow Up Courier", "0611111111");
        String orderId = createPickedUpOrder(jwtToken, "FollowUp", courierId);
        Instant dueAt = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        DeliveryFailureReason.CUSTOMER_REFUSED,
                        "Customer refused at delivery"
                ))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.REFUND_OR_CUSTOMER_FOLLOW_UP,
                        "Merchant must call customer about refund",
                        dueAt
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("REFUND_OR_CUSTOMER_FOLLOW_UP"))
                .andExpect(jsonPath("$.followUpTask.status").value("OPEN"))
                .andExpect(jsonPath("$.followUpTask.note").value("Merchant must call customer about refund"))
                .andExpect(jsonPath("$.followUpTask.dueAt").value(dueAt.toString()))
                .andExpect(jsonPath("$.followUpTask.assignedTo").value("courier@example.com"));

        MvcResult followUpsResult = mockMvc.perform(get("/api/courier-operations/orders/" + orderId + "/follow-ups")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderId").value(orderId))
                .andExpect(jsonPath("$[0].status").value("OPEN"))
                .andExpect(jsonPath("$[0].note").value("Merchant must call customer about refund"))
                .andExpect(jsonPath("$[0].dueAt").value(dueAt.toString()))
                .andExpect(jsonPath("$[0].assignedTo").value("courier@example.com"))
                .andReturn();

        String taskId = objectMapper.readTree(followUpsResult.getResponse().getContentAsString()).get(0).get("taskId").asText();

        mockMvc.perform(get("/api/courier-operations/orders/recovery-summaries")
                .param("orderId", orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderId").value(orderId))
                .andExpect(jsonPath("$[0].latestRecovery.orderId").value(orderId))
                .andExpect(jsonPath("$[0].latestRecovery.decision").value("REFUND_OR_CUSTOMER_FOLLOW_UP"))
                .andExpect(jsonPath("$[0].openFollowUp.taskId").value(taskId))
                .andExpect(jsonPath("$[0].openFollowUp.status").value("OPEN"))
                .andExpect(jsonPath("$[0].latestFollowUp.taskId").value(taskId));

        mockMvc.perform(get("/api/courier-operations/orders/recovery-summaries")
                .param("orderId", orderId)
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("page", "0")
                .param("size", "1")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].task.taskId").value(taskId))
                .andExpect(jsonPath("$.content[0].task.status").value("OPEN"))
                .andExpect(jsonPath("$.content[0].order.orderId").value(orderId))
                .andExpect(jsonPath("$.content[0].order.customerFirstName").value("FollowUp"))
                .andExpect(jsonPath("$.content[0].order.customerPhone").value("0612345678"))
                .andExpect(jsonPath("$.content[0].order.amount").value(100.00));

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/follow-ups/" + taskId + "/resolve")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFollowUpResolutionRequest(
                        "Refund request sent to merchant"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.resolvedBy").value("courier@example.com"))
                .andExpect(jsonPath("$.resolutionNote").value("Refund request sent to merchant"));

        mockMvc.perform(get("/api/courier-operations/orders/recovery-summaries")
                .param("orderId", orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].latestRecovery.decision").value("REFUND_OR_CUSTOMER_FOLLOW_UP"))
                .andExpect(jsonPath("$[0].openFollowUp").doesNotExist())
                .andExpect(jsonPath("$[0].latestFollowUp.taskId").value(taskId))
                .andExpect(jsonPath("$[0].latestFollowUp.status").value("RESOLVED"));

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("page", "0")
                .param("size", "1")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/api/orders/" + orderId + "/timeline")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.type=='DeliveryFollowUpOpened')].details.status").value("OPEN"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFollowUpResolved')].details.status").value("RESOLVED"))
                .andExpect(jsonPath("$[?(@.type=='DeliveryFollowUpResolved')].actor").value("courier@example.com"));

        transactionTemplate.executeWithoutResult(status -> {
            var tasks = deliveryFollowUpTaskRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(
                    getTenantId("courier@example.com"),
                    UUID.fromString(orderId)
            );
            org.assertj.core.api.Assertions.assertThat(tasks).hasSize(1);
            org.assertj.core.api.Assertions.assertThat(tasks.get(0).getStatus()).isEqualTo(DeliveryFollowUpStatus.RESOLVED);
            org.assertj.core.api.Assertions.assertThat(tasks.get(0).getDueAt()).isEqualTo(dueAt);
            org.assertj.core.api.Assertions.assertThat(tasks.get(0).getResolutionNote()).isEqualTo("Refund request sent to merchant");
        });
    }

    @Test
    void closeUnrecoverableRecoveryRequiresNoteAndResolvesOpenFollowUps() throws Exception {
        String courierId = createCourier(jwtToken, "Closure Courier", "0617171717");
        String orderId = createPickedUpOrder(jwtToken, "ClosureFollowUp", courierId);
        Instant dueAt = Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

        createFailedCustomerFollowUp(jwtToken, orderId, dueAt, "Customer unreachable after failed delivery");

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.CLOSE_UNRECOVERABLE,
                        "",
                        null
                ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("closure note is required"));

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.CLOSE_UNRECOVERABLE,
                        "Customer unreachable after repeated attempts; close recovery",
                        null
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("CLOSE_UNRECOVERABLE"))
                .andExpect(jsonPath("$.note").value("Customer unreachable after repeated attempts; close recovery"))
                .andExpect(jsonPath("$.followUpTask").doesNotExist());

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("dueFilter", "DUE_NOW")
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/api/courier-operations/orders/" + orderId + "/follow-ups")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("RESOLVED"))
                .andExpect(jsonPath("$[0].resolvedBy").value("courier@example.com"))
                .andExpect(jsonPath("$[0].resolutionNote").value("Superseded by recovery decision CLOSE_UNRECOVERABLE"));
    }

    @Test
    void openFollowUpsAreListedByDueDate() throws Exception {
        String courierId = createCourier(jwtToken, "Queue Follow Up Courier", "0619191919");
        String overdueOrderId = createPickedUpOrder(jwtToken, "OverdueFollowUp", courierId);
        String laterOrderId = createPickedUpOrder(jwtToken, "LaterFollowUp", courierId);
        String earlierOrderId = createPickedUpOrder(jwtToken, "EarlierFollowUp", courierId);
        String noDateOrderId = createPickedUpOrder(jwtToken, "NoDateFollowUp", courierId);
        String otherTenantCourierId = createCourier(otherTenantJwtToken, "Other Follow Up Courier", "0629292929");
        String otherTenantOrderId = createPickedUpOrder(otherTenantJwtToken, "OtherTenantFollowUp", otherTenantCourierId);
        Instant overdueDueAt = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Instant laterDueAt = Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Instant earlierDueAt = Instant.now().plus(3, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

        createFailedCustomerFollowUp(jwtToken, overdueOrderId, overdueDueAt, "Overdue customer follow-up");
        createFailedCustomerFollowUp(jwtToken, laterOrderId, laterDueAt, "Later customer follow-up");
        createFailedCustomerFollowUp(jwtToken, earlierOrderId, earlierDueAt, "Earlier customer follow-up");
        createFailedCustomerFollowUp(jwtToken, noDateOrderId, null, "No due date customer follow-up");
        createFailedCustomerFollowUp(otherTenantJwtToken, otherTenantOrderId, earlierDueAt.minus(1, ChronoUnit.HOURS), "Other tenant follow-up");

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content[0].task.orderId").value(overdueOrderId))
                .andExpect(jsonPath("$.content[0].task.dueAt").value(overdueDueAt.toString()))
                .andExpect(jsonPath("$.content[0].order.customerFirstName").value("OverdueFollowUp"))
                .andExpect(jsonPath("$.content[0].order.status").value("FAILED"))
                .andExpect(jsonPath("$.content[0].order.amount").value(100.00))
                .andExpect(jsonPath("$.content[1].task.orderId").value(earlierOrderId))
                .andExpect(jsonPath("$.content[1].task.dueAt").value(earlierDueAt.toString()))
                .andExpect(jsonPath("$.content[1].order.customerFirstName").value("EarlierFollowUp"))
                .andExpect(jsonPath("$.content[2].task.orderId").value(laterOrderId))
                .andExpect(jsonPath("$.content[2].task.dueAt").value(laterDueAt.toString()))
                .andExpect(jsonPath("$.content[2].order.customerFirstName").value("LaterFollowUp"))
                .andExpect(jsonPath("$.content[3].task.orderId").value(noDateOrderId))
                .andExpect(jsonPath("$.content[3].task.dueAt").doesNotExist())
                .andExpect(jsonPath("$.content[3].order.customerFirstName").value("NoDateFollowUp"));

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("dueFilter", "DUE_NOW")
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].task.orderId").value(overdueOrderId));

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("dueFilter", "SCHEDULED")
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].task.orderId").value(earlierOrderId))
                .andExpect(jsonPath("$.content[1].task.orderId").value(laterOrderId));

        mockMvc.perform(get("/api/courier-operations/follow-ups")
                .param("status", "OPEN")
                .param("dueFilter", "NO_DUE_DATE")
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].task.orderId").value(noDateOrderId));
    }

    @Test
    void failedRecoveryQueuePaginatesFiltersAndCountsGlobally() throws Exception {
        String courierId = createCourier(jwtToken, "Recovery Queue Courier", "0615151515");
        String needsDecisionOrderId = createPickedUpOrder(jwtToken, "QueueNeeds", courierId);
        String openFollowUpOrderId = createPickedUpOrder(jwtToken, "QueueOpen", courierId);
        String retryReadyOrderId = createPickedUpOrder(jwtToken, "QueueRetry", courierId);
        String refundReviewOrderId = createPickedUpOrder(jwtToken, "QueueRefund", courierId);
        String closedOrderId = createPickedUpOrder(jwtToken, "QueueClosed", courierId);
        String otherTenantCourierId = createCourier(otherTenantJwtToken, "Other Recovery Queue", "0625252525");
        String otherTenantOrderId = createPickedUpOrder(otherTenantJwtToken, "OtherQueue", otherTenantCourierId);

        markDeliveryFailed(jwtToken, needsDecisionOrderId, DeliveryFailureReason.CUSTOMER_REFUSED, "Needs merchant decision");
        createFailedCustomerFollowUp(
                jwtToken,
                openFollowUpOrderId,
                Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS),
                "Open customer follow-up"
        );
        markDeliveryFailed(jwtToken, retryReadyOrderId, DeliveryFailureReason.INVALID_ADDRESS, "Address was wrong");
        recordRecovery(
                jwtToken,
                retryReadyOrderId,
                DeliveryFailureRecoveryDecision.RETRY_DELIVERY,
                "Customer confirmed corrected address",
                null
        );
        createFailedCustomerFollowUp(
                jwtToken,
                refundReviewOrderId,
                Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS),
                "Refund review follow-up"
        );
        String refundTaskId = objectMapper.readTree(mockMvc.perform(get("/api/courier-operations/orders/" + refundReviewOrderId + "/follow-ups")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()).get(0).get("taskId").asText();
        mockMvc.perform(post("/api/courier-operations/orders/" + refundReviewOrderId + "/follow-ups/" + refundTaskId + "/resolve")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFollowUpResolutionRequest(
                        "Refund review completed"
                ))))
                .andExpect(status().isOk());
        markDeliveryFailed(jwtToken, closedOrderId, DeliveryFailureReason.CUSTOMER_UNREACHABLE, "No answer");
        recordRecovery(
                jwtToken,
                closedOrderId,
                DeliveryFailureRecoveryDecision.CLOSE_UNRECOVERABLE,
                "Customer unreachable after repeated attempts",
                null
        );
        markDeliveryFailed(otherTenantJwtToken, otherTenantOrderId, DeliveryFailureReason.CUSTOMER_REFUSED, "Other tenant failure");

        mockMvc.perform(get("/api/courier-operations/orders/recovery-queue")
                .param("page", "0")
                .param("size", "2")
                .param("state", "ALL")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.counts.all").value(5))
                .andExpect(jsonPath("$.counts.needsDecision").value(1))
                .andExpect(jsonPath("$.counts.openFollowUp").value(1))
                .andExpect(jsonPath("$.counts.retryReady").value(1))
                .andExpect(jsonPath("$.counts.refundReview").value(1))
                .andExpect(jsonPath("$.counts.closedUnrecoverable").value(1))
                .andExpect(jsonPath("$.content[0].order.id").value(openFollowUpOrderId))
                .andExpect(jsonPath("$.content[0].recovery.openFollowUp.status").value("OPEN"))
                .andExpect(jsonPath("$.content[1].order.id").value(needsDecisionOrderId));

        mockMvc.perform(get("/api/courier-operations/orders/recovery-queue")
                .param("page", "0")
                .param("size", "10")
                .param("state", "RETRY_READY")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.counts.all").value(5))
                .andExpect(jsonPath("$.content[0].order.id").value(retryReadyOrderId))
                .andExpect(jsonPath("$.content[0].recovery.latestRecovery.decision").value("RETRY_DELIVERY"));

        mockMvc.perform(get("/api/courier-operations/orders/recovery-queue")
                .param("page", "0")
                .param("size", "10")
                .param("state", "ALL")
                .param("customerName", "QueueRefund")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.counts.all").value(1))
                .andExpect(jsonPath("$.counts.refundReview").value(1))
                .andExpect(jsonPath("$.content[0].order.id").value(refundReviewOrderId))
                .andExpect(jsonPath("$.content[0].recovery.latestFollowUp.status").value("RESOLVED"));
    }

    @Test
    void courierPerformanceUsesHistoricalAttemptsAfterRetry() throws Exception {
        String firstCourierId = createCourier(jwtToken, "Metrics First", "0611111111");
        String secondCourierId = createCourier(jwtToken, "Metrics Second", "0622222222");
        String assignedOrderId = createConfirmedOrder(jwtToken, "MetricsAssigned");
        createPickedUpOrder(jwtToken, "MetricsPicked", firstCourierId);
        String deliveredOrderId = createPickedUpOrder(jwtToken, "MetricsDelivered", firstCourierId);
        String failedOrderId = createPickedUpOrder(jwtToken, "MetricsFailed", firstCourierId);
        createPickedUpOrder(otherTenantJwtToken, "OtherMetrics", createCourier(otherTenantJwtToken, "Other Metrics", "0644444444"));

        assignCourier(jwtToken, assignedOrderId, firstCourierId)
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/courier-operations/orders/" + deliveredOrderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/courier-operations/orders/" + failedOrderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        DeliveryFailureReason.INVALID_ADDRESS,
                        "Address missing apartment"
                ))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/courier-operations/orders/" + failedOrderId + "/failure-recoveries")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.RETRY_DELIVERY,
                        "Retry after address correction",
                        null
                ))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/courier-operations/orders/" + failedOrderId + "/retry-delivery")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + failedOrderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.courierId").doesNotExist())
                .andExpect(jsonPath("$.failureReason").doesNotExist());

        mockMvc.perform(get("/api/courier-operations/courier-performance")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].courierId").value(firstCourierId))
                .andExpect(jsonPath("$[0].assignedOrdersCount").value(4))
                .andExpect(jsonPath("$[0].pickedUpOrdersCount").value(3))
                .andExpect(jsonPath("$[0].deliveredOrdersCount").value(1))
                .andExpect(jsonPath("$[0].failedOrdersCount").value(1))
                .andExpect(jsonPath("$[0].deliverySuccessRate").value(0.5))
                .andExpect(jsonPath("$[1].courierId").value(secondCourierId))
                .andExpect(jsonPath("$[1].assignedOrdersCount").value(0));

        Instant futureFrom = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Instant futureTo = futureFrom.plus(1, ChronoUnit.DAYS);
        mockMvc.perform(get("/api/courier-operations/courier-performance")
                .param("createdFrom", futureFrom.toString())
                .param("createdTo", futureTo.toString())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].courierId").value(firstCourierId))
                .andExpect(jsonPath("$[0].assignedOrdersCount").value(0))
                .andExpect(jsonPath("$[0].pickedUpOrdersCount").value(0))
                .andExpect(jsonPath("$[0].deliveredOrdersCount").value(0))
                .andExpect(jsonPath("$[0].failedOrdersCount").value(0));

        Instant pastFrom = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Instant pastTo = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        mockMvc.perform(get("/api/courier-operations/delivery-failures")
                .param("courierId", firstCourierId)
                .param("createdFrom", pastFrom.toString())
                .param("createdTo", pastTo.toString())
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].failure.orderId").value(failedOrderId))
                .andExpect(jsonPath("$.content[0].failure.reason").value("INVALID_ADDRESS"))
                .andExpect(jsonPath("$.content[0].order.orderId").value(failedOrderId))
                .andExpect(jsonPath("$.content[0].order.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.content[0].order.customerFirstName").value("MetricsFailed"));
    }

    private void cleanDatabase() {
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

    private String createCourier(String token, String name, String phone) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/couriers")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierRequest(name, phone))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("courierId").asText();
    }

    private void deactivateCourier(String token, String courierId) throws Exception {
        mockMvc.perform(patch("/api/couriers/" + courierId + "/active")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierActiveRequest(false))))
                .andExpect(status().isOk());
    }

    private String createConfirmedOrder(String token, String firstName) throws Exception {
        String orderId = createOrder(token, firstName);
        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation")
                .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/orders/" + orderId + "/confirm")
                .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        return orderId;
    }

    private String createPickedUpOrder(String token, String firstName, String courierId) throws Exception {
        String orderId = createConfirmedOrder(token, firstName);
        assignCourier(token, orderId, courierId)
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/orders/" + orderId + "/pick-up")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isOk());
        return orderId;
    }

    private void createFailedCustomerFollowUp(
            String token,
            String orderId,
            Instant dueAt,
            String note
    ) throws Exception {
        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/fail")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        DeliveryFailureReason.CUSTOMER_UNREACHABLE,
                        note
                ))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        DeliveryFailureRecoveryDecision.REFUND_OR_CUSTOMER_FOLLOW_UP,
                        note,
                        dueAt
                ))))
                .andExpect(status().isOk());
    }

    private void markDeliveryFailed(
            String token,
            String orderId,
            DeliveryFailureReason reason,
            String note
    ) throws Exception {
        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/fail")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRequest(
                        reason,
                        note
                ))))
                .andExpect(status().isOk());
    }

    private void recordRecovery(
            String token,
            String orderId,
            DeliveryFailureRecoveryDecision decision,
            String note,
            Instant followUpDueAt
    ) throws Exception {
        mockMvc.perform(post("/api/courier-operations/orders/" + orderId + "/failure-recoveries")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierOperationsController.DeliveryFailureRecoveryRequest(
                        decision,
                        note,
                        followUpDueAt
                ))))
                .andExpect(status().isOk());
    }

    private String createOrder(String token, String firstName) throws Exception {
        OrderController.CreateOrderRequest createRequest = new OrderController.CreateOrderRequest(
                new OrderController.CustomerRequest(firstName, "User", firstName.toLowerCase() + "@example.com", "0612345678"),
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

    private org.springframework.test.web.servlet.ResultActions assignCourier(
            String token,
            String orderId,
            String courierId
    ) throws Exception {
        return mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))));
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

    private UUID getTenantId(String email) {
        return entityManager
                .createQuery("select user.tenantId from User user where user.email = :email", UUID.class)
                .setParameter("email", email)
                .getSingleResult();
    }
}

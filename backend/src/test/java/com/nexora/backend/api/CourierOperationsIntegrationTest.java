package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
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

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
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
}

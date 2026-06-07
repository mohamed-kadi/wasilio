package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderIntegrationTest {

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

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM couriers").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }

    @Test
    void createOrder_returnsDetailsAndEventTimeline() throws Exception {
        String orderId = createOrder("Created");

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(orderId))
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.customer.firstName").value("Created"))
                .andExpect(jsonPath("$.address.city").value("Casablanca"))
                .andExpect(jsonPath("$.amount").value(100.00));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].eventType").value("OrderCreated"))
                .andExpect(jsonPath("$[0].aggregateSequence").value(1));
    }

    @Test
    void createOrder_propagatesCorrelationIdToResponseAndDomainEvent() throws Exception {
        UUID correlationId = UUID.randomUUID();
        MvcResult result = createOrderResult("Correlated", correlationId);
        String orderId = extractCreatedOrderId(result);

        assertEquals(
                correlationId.toString(),
                result.getResponse().getHeader(CorrelationIdContext.HEADER_NAME)
        );

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].correlationId").value(correlationId.toString()));
    }

    @Test
    void requestConfirmationAndRejectOrder_updatesOrderState() throws Exception {
        String orderId = createOrder("Rejectable");

        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMATION_REQUESTED"));

        mockMvc.perform(post("/api/orders/" + orderId + "/reject")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.RejectOrderRequest("Inventory unavailable"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.failureReason").value("Inventory unavailable"));
    }

    @Test
    void fulfilledLifecycle_succeedsThroughDeliveredAndBlocksFurtherMutation() throws Exception {
        String orderId = createOrder("Delivered");
        String courierId = createCourier("Courier 1");

        requestConfirmation(orderId);
        confirmOrder(orderId);
        assignCourier(orderId, courierId);
        pickUp(orderId, courierId);

        mockMvc.perform(post("/api/orders/" + orderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"))
                .andExpect(jsonPath("$.courierId").value(courierId));

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[5].eventType").value("OrderDelivered"));

        mockMvc.perform(post("/api/orders/" + orderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.FailOrderRequest("Customer unavailable"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));
    }

    @Test
    void failedLifecycle_marksFailedAndBlocksFurtherMutation() throws Exception {
        String orderId = createOrder("Failed");
        String courierId = createCourier("Courier 2");

        requestConfirmation(orderId);
        confirmOrder(orderId);
        assignCourier(orderId, courierId);
        pickUp(orderId, courierId);

        mockMvc.perform(post("/api/orders/" + orderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.FailOrderRequest("Customer unavailable"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.failureReason").value("Customer unavailable"));

        mockMvc.perform(post("/api/orders/" + orderId + "/deliver")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));
    }

    @Test
    void assignCourierBeforeConfirmed_returnsConflict() throws Exception {
        String orderId = createOrder("TooEarly");
        String courierId = createCourier("Too Early Courier");

        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Invalid state transition"));
    }

    @Test
    void invalidRequestBodies_returnBadRequest() throws Exception {
        String orderId = createOrder("Validation");

        OrderController.CreateOrderRequest invalidCreateRequest = new OrderController.CreateOrderRequest(
                new OrderController.CustomerRequest("", "User", "not-an-email", "123"),
                new OrderController.AddressRequest("Street", "", "State", "00000", "Country"),
                new BigDecimal("-1.00")
        );

        mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidCreateRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors").isArray());

        mockMvc.perform(post("/api/orders/" + orderId + "/reject")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.RejectOrderRequest(""))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(""))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/orders/" + orderId + "/fail")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.FailOrderRequest(""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void missingOrder_returnsNotFound() throws Exception {
        String missingOrderId = UUID.randomUUID().toString();
        UUID correlationId = UUID.randomUUID();

        mockMvc.perform(get("/api/orders/" + missingOrderId)
                .header(CorrelationIdContext.HEADER_NAME, correlationId.toString())
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isNotFound())
                .andExpect(header().string(CorrelationIdContext.HEADER_NAME, correlationId.toString()))
                .andExpect(jsonPath("$.title").value("Resource not found"))
                .andExpect(jsonPath("$.correlationId").value(correlationId.toString()));

        mockMvc.perform(post("/api/orders/" + missingOrderId + "/request-confirmation")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }

    @Test
    void listOrders_supportsPaginationStatusFilterAndStableNewestFirstSort() throws Exception {
        String firstOrderId = createOrder("First");
        String secondOrderId = createOrder("Second");
        String thirdOrderId = createOrder("Third");

        requestConfirmation(firstOrderId);
        confirmOrder(firstOrderId);

        mockMvc.perform(get("/api/orders")
                .param("page", "0")
                .param("size", "2")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].id").value(thirdOrderId))
                .andExpect(jsonPath("$.content[1].id").value(secondOrderId));

        mockMvc.perform(get("/api/orders")
                .param("status", "CONFIRMED")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(firstOrderId))
                .andExpect(jsonPath("$.content[0].status").value("CONFIRMED"));
    }

    @Test
    void listOrders_rejectsInvalidPaginationAndFilters() throws Exception {
        mockMvc.perform(get("/api/orders")
                .param("page", "-1")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"));

        mockMvc.perform(get("/api/orders")
                .param("size", "101")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"));

        mockMvc.perform(get("/api/orders")
                .param("status", "UNKNOWN")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad request"));
    }

    @Test
    void crossTenantOrderAccess_returnsNotFound() throws Exception {
        String orderId = createOrder("TenantScoped");

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());
    }

    private String createOrder(String firstName) throws Exception {
        return extractCreatedOrderId(createOrderResult(firstName, null));
    }

    private String createCourier(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/couriers")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CourierController.CourierRequest(name, "0611111111"))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("courierId").asText();
    }

    private MvcResult createOrderResult(String firstName, UUID correlationId) throws Exception {
        OrderController.CreateOrderRequest createRequest = new OrderController.CreateOrderRequest(
                new OrderController.CustomerRequest(firstName, "User", firstName.toLowerCase() + "@example.com", "0612345678"),
                new OrderController.AddressRequest("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                new BigDecimal("100.00")
        );

        MockHttpServletRequestBuilder request = post("/api/orders")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest));

        if (correlationId != null) {
            request.header(CorrelationIdContext.HEADER_NAME, correlationId.toString());
        }

        return mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
    }

    private String extractCreatedOrderId(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString().replace("\"", "");
    }

    private void requestConfirmation(String orderId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());
    }

    private void confirmOrder(String orderId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/confirm")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk());
    }

    private void assignCourier(String orderId, String courierId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new OrderController.AssignCourierRequest(courierId))))
                .andExpect(status().isOk());
    }

    private void pickUp(String orderId, String courierId) throws Exception {
        mockMvc.perform(post("/api/orders/" + orderId + "/pick-up")
                .header("Authorization", bearer(jwtToken))
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

package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.OrderRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
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
    private OrderRepository orderRepository;

    private String jwtToken;
    private String otherTenantJwtToken;
    private UUID tenantId;
    private UUID otherTenantId;

    @BeforeEach
    void setup() throws Exception {
        tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant(tenantId, "Test Tenant");
        entityManager.persist(tenant);

        User user = new User(UUID.randomUUID(), "test@example.com", passwordEncoder.encode("password"), Role.MERCHANT, tenantId);
        entityManager.persist(user);

        otherTenantId = UUID.randomUUID();
        Tenant otherTenant = new Tenant(otherTenantId, "Other Tenant");
        entityManager.persist(otherTenant);

        User otherUser = new User(UUID.randomUUID(), "other@example.com", passwordEncoder.encode("password"), Role.MERCHANT, otherTenantId);
        entityManager.persist(otherUser);

        entityManager.flush();

        // Login to get token
        AuthController.LoginRequest loginRequest = new AuthController.LoginRequest("test@example.com", "password");
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        AuthController.LoginResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), AuthController.LoginResponse.class);
        jwtToken = response.token();

        // Login other user
        AuthController.LoginRequest loginOther = new AuthController.LoginRequest("other@example.com", "password");
        MvcResult resultOther = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginOther)))
                .andExpect(status().isOk())
                .andReturn();
        otherTenantJwtToken = objectMapper.readValue(resultOther.getResponse().getContentAsString(), AuthController.LoginResponse.class).token();
    }

    @Test
    void testFullOrderLifecycle() throws Exception {
        // 1. Create Order
        OrderController.CreateOrderRequest createReq = new OrderController.CreateOrderRequest(
                new Customer("Test", "User", "test@test.com", "123"),
                new Address("Street", "City", "State", "00000", "Country"),
                new BigDecimal("100.00")
        );

        MvcResult createResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = createResult.getResponse().getContentAsString().replace("\"", "");

        // 2. Request Confirmation
        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation")
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk());

        // 3. Confirm Order
        mockMvc.perform(post("/api/orders/" + orderId + "/confirm")
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk());

        // 4. Assign Courier
        OrderController.AssignCourierRequest assignReq = new OrderController.AssignCourierRequest("Courier-1");
        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isOk());

        // 5. Pick Up
        mockMvc.perform(post("/api/orders/" + orderId + "/pick-up")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isOk());

        // 6. Deliver
        mockMvc.perform(post("/api/orders/" + orderId + "/deliver")
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk());

        // Verify Details
        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"));

        // Verify Events
        mockMvc.perform(get("/api/orders/" + orderId + "/events")
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));
    }

    @Test
    void testNegative_assignCourierBeforeConfirmed() throws Exception {
        OrderController.CreateOrderRequest createReq = new OrderController.CreateOrderRequest(
                new Customer("Test", "User", "test@test.com", "123"),
                new Address("Street", "City", "State", "00000", "Country"),
                new BigDecimal("100.00")
        );

        MvcResult createResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
                .andReturn();

        String orderId = createResult.getResponse().getContentAsString().replace("\"", "");

        OrderController.AssignCourierRequest assignReq = new OrderController.AssignCourierRequest("Courier-1");

        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isConflict());
    }

    @Test
    void testNegative_crossTenantAccessIsBlocked() throws Exception {
        OrderController.CreateOrderRequest createReq = new OrderController.CreateOrderRequest(
                new Customer("Test", "User", "test@test.com", "123"),
                new Address("Street", "City", "State", "00000", "Country"),
                new BigDecimal("100.00")
        );

        MvcResult createResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
                .andReturn();

        String orderId = createResult.getResponse().getContentAsString().replace("\"", "");

        // Other tenant tries to fetch the order
        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", "Bearer " + otherTenantJwtToken))
                .andExpect(status().isNotFound()); // Our repo uses findByIdAndTenantId
    }

    @Test
    void testNegative_mutateDeliveredOrder() throws Exception {
        OrderController.CreateOrderRequest createReq = new OrderController.CreateOrderRequest(
                new Customer("Test", "User", "test@test.com", "123"),
                new Address("Street", "City", "State", "00000", "Country"),
                new BigDecimal("100.00")
        );

        String orderId = mockMvc.perform(post("/api/orders")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
                .andReturn().getResponse().getContentAsString().replace("\"", "");

        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation").header("Authorization", "Bearer " + jwtToken));
        mockMvc.perform(post("/api/orders/" + orderId + "/confirm").header("Authorization", "Bearer " + jwtToken));
        mockMvc.perform(post("/api/orders/" + orderId + "/assign-courier")
                .header("Authorization", "Bearer " + jwtToken).contentType(MediaType.APPLICATION_JSON).content("{\"courierId\":\"1\"}"));
        mockMvc.perform(post("/api/orders/" + orderId + "/pick-up")
                .header("Authorization", "Bearer " + jwtToken).contentType(MediaType.APPLICATION_JSON).content("{\"courierId\":\"1\"}"));
        mockMvc.perform(post("/api/orders/" + orderId + "/deliver").header("Authorization", "Bearer " + jwtToken));

        // Now try to fail it
        OrderController.FailOrderRequest failReq = new OrderController.FailOrderRequest("Test");
        mockMvc.perform(post("/api/orders/" + orderId + "/fail")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(failReq)))
                .andExpect(status().isConflict());
    }
}

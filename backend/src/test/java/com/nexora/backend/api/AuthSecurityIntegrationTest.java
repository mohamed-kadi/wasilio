package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
import com.nexora.backend.infrastructure.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID tenantId;
    private UUID otherTenantId;

    @BeforeEach
    void setup() {
        tenantId = UUID.randomUUID();
        otherTenantId = UUID.randomUUID();

        transactionTemplate.executeWithoutResult(status -> {
            cleanDatabase();
            entityManager.persist(new Tenant(tenantId, "Tenant A"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "merchant-a@example.com",
                    passwordEncoder.encode("correct-password"),
                    Role.MERCHANT,
                    tenantId
            ));

            entityManager.persist(new Tenant(otherTenantId, "Tenant B"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "merchant-b@example.com",
                    passwordEncoder.encode("correct-password"),
                    Role.MERCHANT,
                    otherTenantId
            ));

            entityManager.flush();
        });
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM delivery_follow_up_tasks").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failure_recoveries").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM delivery_failures").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM confirmation_attempts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM projection_processed_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_intelligence_signals").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM order_intelligence_snapshots").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM inbound_orders").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM domain_events").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }

    @Test
    void validLogin_returnsToken() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(
                        "merchant-a@example.com",
                        "correct-password"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void wrongPassword_isUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(
                        "merchant-a@example.com",
                        "wrong-password"
                ))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void healthEndpoint_isPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void missingCorrelationId_generatesResponseHeader() throws Exception {
        MvcResult result = mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(header().exists(CorrelationIdContext.HEADER_NAME))
                .andReturn();

        assertDoesNotThrow(() -> UUID.fromString(result.getResponse().getHeader(CorrelationIdContext.HEADER_NAME)));
    }

    @Test
    void incomingCorrelationId_isReturnedInResponseHeader() throws Exception {
        UUID correlationId = UUID.randomUUID();

        mockMvc.perform(get("/actuator/health")
                .header(CorrelationIdContext.HEADER_NAME, correlationId.toString()))
                .andExpect(status().isOk())
                .andExpect(header().string(CorrelationIdContext.HEADER_NAME, correlationId.toString()));
    }

    @Test
    void invalidToken_isUnauthorized() throws Exception {
        UUID correlationId = UUID.randomUUID();

        mockMvc.perform(get("/api/orders")
                .header(CorrelationIdContext.HEADER_NAME, correlationId.toString())
                .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(CorrelationIdContext.HEADER_NAME, correlationId.toString()))
                .andExpect(jsonPath("$.correlationId").value(correlationId.toString()));
    }

    @Test
    void corsPreflight_allowsConfiguredOrigin() throws Exception {
        mockMvc.perform(options("/api/orders")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "Authorization,X-Correlation-ID"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void corsPreflight_rejectsUnconfiguredOrigin() throws Exception {
        mockMvc.perform(options("/api/orders")
                .header("Origin", "https://example.invalid")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void expiredToken_isUnauthorized() throws Exception {
        String expiredToken = expiredToken("merchant-a@example.com", tenantId);

        mockMvc.perform(get("/api/orders")
                .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tenantClaimTampering_isUnauthorized() throws Exception {
        String tamperedTenantToken = jwtService.generateToken(
                Map.of("role", "ROLE_MERCHANT"),
                "merchant-a@example.com",
                otherTenantId.toString()
        );

        mockMvc.perform(get("/api/orders")
                .header("Authorization", "Bearer " + tamperedTenantToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void crossTenantRead_isDenied() throws Exception {
        String tenantToken = login("merchant-a@example.com", "correct-password");
        String otherTenantToken = login("merchant-b@example.com", "correct-password");
        String orderId = createOrder(tenantToken);

        mockMvc.perform(get("/api/orders/" + orderId)
                .header("Authorization", "Bearer " + otherTenantToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void crossTenantMutation_isDenied() throws Exception {
        String tenantToken = login("merchant-a@example.com", "correct-password");
        String otherTenantToken = login("merchant-b@example.com", "correct-password");
        String orderId = createOrder(tenantToken);

        mockMvc.perform(post("/api/orders/" + orderId + "/request-confirmation")
                .header("Authorization", "Bearer " + otherTenantToken))
                .andExpect(status().isNotFound());
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

    private String createOrder(String token) throws Exception {
        OrderController.CreateOrderRequest createRequest = new OrderController.CreateOrderRequest(
                new OrderController.CustomerRequest("Amina", "Merchant", "amina@example.com", "0612345678"),
                new OrderController.AddressRequest("1 Main St", "Casablanca", "Casablanca-Settat", "20000", "Morocco"),
                new BigDecimal("199.00")
        );

        return mockMvc.perform(post("/api/orders")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()
                .replace("\"", "");
    }

    private String expiredToken(String email, UUID tokenTenantId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setClaims(Map.of(
                        "tenantId", tokenTenantId.toString(),
                        "role", "ROLE_MERCHANT"
                ))
                .setSubject(email)
                .setIssuedAt(new Date(now - 120_000))
                .setExpiration(new Date(now - 60_000))
                .signWith(Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret)), SignatureAlgorithm.HS256)
                .compact();
    }
}

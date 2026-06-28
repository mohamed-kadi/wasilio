package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
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
class ProductControllerIntegrationTest {

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
            entityManager.persist(new Tenant(tenantId, "Catalog Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "catalog@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    tenantId
            ));

            entityManager.persist(new Tenant(otherTenantId, "Other Catalog Tenant"));
            entityManager.persist(new User(
                    UUID.randomUUID(),
                    "other-catalog@example.com",
                    passwordEncoder.encode("password"),
                    Role.MERCHANT,
                    otherTenantId
            ));

            entityManager.flush();
        });

        jwtToken = login("catalog@example.com", "password");
        otherTenantJwtToken = login("other-catalog@example.com", "password");
    }

    @Test
    void tenantCanCreateProduct() throws Exception {
        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest(
                        "Argan Oil",
                        null,
                        "Cold pressed argan oil",
                        "149.00",
                        null,
                        "ARG-001",
                        "https://example.com/argan.jpg",
                        ProductStatus.ACTIVE
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Argan Oil"))
                .andExpect(jsonPath("$.slug").value("argan-oil"))
                .andExpect(jsonPath("$.priceAmount").value(149.00))
                .andExpect(jsonPath("$.currency").value("MAD"))
                .andExpect(jsonPath("$.sku").value("ARG-001"))
                .andExpect(jsonPath("$.imageUrl").value("https://example.com/argan.jpg"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void tenantCanListOnlyItsProducts() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Visible Product", "visible", "Shown", "200.00", "MAD", null, null, ProductStatus.DRAFT));
        createProduct(otherTenantJwtToken, productRequest("Other Product", "visible", "Hidden", "300.00", "MAD", null, null, ProductStatus.ACTIVE));

        mockMvc.perform(get("/api/products")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(productId))
                .andExpect(jsonPath("$.content[0].name").value("Visible Product"));
    }

    @Test
    void tenantCannotAccessAnotherTenantsProduct() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Private Product", "private-product", null, "100.00", "MAD", null, null, ProductStatus.DRAFT));

        mockMvc.perform(get("/api/products/" + productId)
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void productCanBeUpdated() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Draft Product", "draft-product", null, "100.00", "MAD", null, null, ProductStatus.DRAFT));

        mockMvc.perform(put("/api/products/" + productId)
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest(
                        "Updated Product",
                        "updated-product",
                        "Updated description",
                        "125.50",
                        "mad",
                        "UPD-001",
                        null,
                        ProductStatus.ACTIVE
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(productId))
                .andExpect(jsonPath("$.name").value("Updated Product"))
                .andExpect(jsonPath("$.slug").value("updated-product"))
                .andExpect(jsonPath("$.description").value("Updated description"))
                .andExpect(jsonPath("$.priceAmount").value(125.50))
                .andExpect(jsonPath("$.currency").value("MAD"))
                .andExpect(jsonPath("$.sku").value("UPD-001"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void productCanBeArchived() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Archive Product", "archive-product", null, "100.00", "MAD", null, null, ProductStatus.ACTIVE));

        mockMvc.perform(patch("/api/products/" + productId + "/archive")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(productId))
                .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }

    @Test
    void slugUniquenessIsTenantScoped() throws Exception {
        createProduct(jwtToken, productRequest("First Product", "shared-slug", null, "100.00", "MAD", null, null, ProductStatus.DRAFT));

        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest("Duplicate Product", "shared-slug", null, "110.00", "MAD", null, null, ProductStatus.DRAFT))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Resource already exists"));

        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(otherTenantJwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest("Other Tenant Product", "shared-slug", null, "120.00", "MAD", null, null, ProductStatus.ACTIVE))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("shared-slug"));
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM products").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM tenants").executeUpdate();
    }

    private ProductController.ProductRequest productRequest(
            String name,
            String slug,
            String description,
            String priceAmount,
            String currency,
            String sku,
            String imageUrl,
            ProductStatus status
    ) {
        return new ProductController.ProductRequest(
                name,
                slug,
                description,
                new BigDecimal(priceAmount),
                currency,
                sku,
                imageUrl,
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

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AuthController.LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}

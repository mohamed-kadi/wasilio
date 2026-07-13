package com.nexora.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.StorefrontProductProfileStatus;
import com.nexora.backend.domain.model.StorefrontProfileFaqItem;
import com.nexora.backend.domain.model.StorefrontProfileFeature;
import com.nexora.backend.domain.model.StorefrontProfileTrustBadge;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
                        "Argan Oil",
                        "Cold pressed argan oil",
                        "149.00",
                        "MAD",
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
    void tenantCanCreateProductWithGeneratedSku() throws Exception {
        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest(
                        "Portable Neck Fan",
                        "Portable Neck Fan",
                        "Hands-free cooling fan",
                        "249.00",
                        "MAD",
                        " ",
                        "https://example.com/fan.jpg",
                        ProductStatus.ACTIVE
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("portable-neck-fan"))
                .andExpect(jsonPath("$.sku").value("SKU-PORTABLE-NECK-FAN"));
    }

    @Test
    void productSlugAndCurrencyAreRequired() throws Exception {
        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest(
                        "Missing Slug",
                        " ",
                        "Description",
                        "100.00",
                        "MAD",
                        null,
                        null,
                        ProductStatus.DRAFT
                ))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(productRequest(
                        "Missing Currency",
                        "missing-currency",
                        "Description",
                        "100.00",
                        " ",
                        null,
                        null,
                        ProductStatus.DRAFT
                ))))
                .andExpect(status().isBadRequest());
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
    void productOwnerCanUploadPrimaryProductImage() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Media Product", "media-product", null, "100.00", "MAD", null, null, ProductStatus.ACTIVE));

        MvcResult uploadResult = mockMvc.perform(multipart("/api/products/" + productId + "/media")
                .file(pngUpload("product.png"))
                .param("purpose", "PRODUCT_IMAGE")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mediaId").isNotEmpty())
                .andExpect(jsonPath("$.productId").value(productId))
                .andExpect(jsonPath("$.purpose").value("PRODUCT_IMAGE"))
                .andExpect(jsonPath("$.originalFilename").value("product.png"))
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(pngBytes().length))
                .andExpect(jsonPath("$.publicUrl").value(org.hamcrest.Matchers.startsWith("https://media.example.test/media/")))
                .andReturn();

        String publicUrl = objectMapper.readTree(uploadResult.getResponse().getContentAsString())
                .get("publicUrl")
                .asText();

        mockMvc.perform(get("/api/products/" + productId)
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").value(publicUrl));
    }

    @Test
    void mediaUploadIsTenantScopedToProductOwner() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Private Media Product", "private-media-product", null, "100.00", "MAD", null, null, ProductStatus.ACTIVE));

        mockMvc.perform(multipart("/api/products/" + productId + "/media")
                .file(pngUpload("other.png"))
                .header("Authorization", bearer(otherTenantJwtToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void mediaUploadRejectsUnsupportedOrSpoofedImages() throws Exception {
        String productId = createProduct(jwtToken, productRequest("Invalid Media Product", "invalid-media-product", null, "100.00", "MAD", null, null, ProductStatus.ACTIVE));

        mockMvc.perform(multipart("/api/products/" + productId + "/media")
                .file(new MockMultipartFile(
                        "file",
                        "notes.txt",
                        MediaType.TEXT_PLAIN_VALUE,
                        "not an image".getBytes(StandardCharsets.UTF_8)
                ))
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart("/api/products/" + productId + "/media")
                .file(new MockMultipartFile(
                        "file",
                        "spoofed.png",
                        MediaType.IMAGE_PNG_VALUE,
                        "not an image".getBytes(StandardCharsets.UTF_8)
                ))
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isBadRequest());
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

    @Test
    void productOwnerCanCreateAndUpdateStorefrontProfile() throws Exception {
        String productId = createProduct(jwtToken, productRequest(
                "CoolAir Mini",
                "coolair-mini",
                "Portable cooling fan",
                "199.00",
                "MAD",
                "COOL-001",
                "https://example.com/coolair.jpg",
                ProductStatus.ACTIVE
        ));

        mockMvc.perform(get("/api/products/" + productId + "/storefront-profile")
                .header("Authorization", bearer(jwtToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put("/api/products/" + productId + "/storefront-profile")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(profileRequest(
                        "Stay cool anywhere",
                        "Portable cooling for Moroccan COD customers.",
                        StorefrontProductProfileStatus.DRAFT
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productId").value(productId))
                .andExpect(jsonPath("$.headline").value("Stay cool anywhere"))
                .andExpect(jsonPath("$.subheadline").value("Portable cooling for Moroccan COD customers."))
                .andExpect(jsonPath("$.benefits[0]").value("Fast delivery"))
                .andExpect(jsonPath("$.features[0].title").value("Rechargeable"))
                .andExpect(jsonPath("$.faq[0].question").value("Is delivery available?"))
                .andExpect(jsonPath("$.trustBadges[0].label").value("COD"))
                .andExpect(jsonPath("$.galleryImageUrls[0]").value("https://example.com/gallery-1.jpg"))
                .andExpect(jsonPath("$.seoTitle").value("CoolAir Mini Morocco"))
                .andExpect(jsonPath("$.seoDescription").value("Order CoolAir Mini with cash on delivery."))
                .andExpect(jsonPath("$.seoImageUrl").value("https://example.com/seo.jpg"))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        mockMvc.perform(put("/api/products/" + productId + "/storefront-profile")
                .header("Authorization", bearer(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(profileRequest(
                        "Updated landing headline",
                        null,
                        StorefrontProductProfileStatus.PUBLISHED
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productId").value(productId))
                .andExpect(jsonPath("$.headline").value("Updated landing headline"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void storefrontProfileIsTenantScopedToProductOwner() throws Exception {
        String productId = createProduct(jwtToken, productRequest(
                "Private Landing Product",
                "private-landing-product",
                null,
                "100.00",
                "MAD",
                null,
                null,
                ProductStatus.ACTIVE
        ));

        mockMvc.perform(put("/api/products/" + productId + "/storefront-profile")
                .header("Authorization", bearer(otherTenantJwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(profileRequest(
                        "Other tenant edit",
                        null,
                        StorefrontProductProfileStatus.PUBLISHED
                ))))
                .andExpect(status().isNotFound());
    }

    private void cleanDatabase() {
        entityManager.createNativeQuery("DELETE FROM media_assets").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM storefront_product_profiles").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM public_storefronts").executeUpdate();
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

    private ProductController.StorefrontProductProfileRequest profileRequest(
            String headline,
            String subheadline,
            StorefrontProductProfileStatus status
    ) {
        return new ProductController.StorefrontProductProfileRequest(
                headline,
                subheadline,
                List.of("Fast delivery", "Cash on delivery"),
                List.of(new StorefrontProfileFeature("Rechargeable", "Runs for hours on a single charge.")),
                List.of(new StorefrontProfileFaqItem("Is delivery available?", "Yes, delivery is available in major cities.")),
                List.of(new StorefrontProfileTrustBadge("COD", "Pay only when the order arrives.")),
                List.of("https://example.com/gallery-1.jpg"),
                "CoolAir Mini Morocco",
                "Order CoolAir Mini with cash on delivery.",
                "https://example.com/seo.jpg",
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

    private MockMultipartFile pngUpload(String filename) {
        return new MockMultipartFile(
                "file",
                filename,
                MediaType.IMAGE_PNG_VALUE,
                pngBytes()
        );
    }

    private byte[] pngBytes() {
        return new byte[] {
                (byte) 0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a,
                0x00,
                0x00,
                0x00,
                0x0d
        };
    }
}

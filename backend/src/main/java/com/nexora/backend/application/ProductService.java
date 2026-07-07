package com.nexora.backend.application;

import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final Clock clock;

    @Transactional
    public Product createProduct(UUID tenantId, ProductCommand command) {
        Instant now = Instant.now(clock);
        String slug = normalizeSlug(command.slug());
        ensureSlugAvailable(tenantId, slug, null);
        String name = normalizeRequired(command.name(), "Product name is required");
        BigDecimal priceAmount = requirePositivePrice(command.priceAmount());
        String sku = normalizeSkuForCreation(command.sku(), slug);

        return productRepository.save(Product.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .name(name)
                .slug(slug)
                .description(normalizeOptional(command.description()))
                .priceAmount(priceAmount)
                .currency(normalizeCurrency(command.currency()))
                .sku(sku)
                .imageUrl(normalizeOptional(command.imageUrl()))
                .status(command.status() == null ? ProductStatus.DRAFT : command.status())
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    @Transactional(readOnly = true)
    public Page<Product> listProducts(UUID tenantId, Pageable pageable) {
        return productRepository.findByTenantId(tenantId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<Product> listProducts(UUID tenantId, ProductStatus status, Pageable pageable) {
        if (status == null) {
            return listProducts(tenantId, pageable);
        }
        return productRepository.findByTenantIdAndStatus(tenantId, status, pageable);
    }

    @Transactional(readOnly = true)
    public Product getProduct(UUID tenantId, UUID productId) {
        return productRepository.findByIdAndTenantId(productId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
    }

    @Transactional(readOnly = true)
    public List<OrderLineSnapshot> snapshotOrderLines(UUID tenantId, List<OrderLineSelection> selections) {
        if (selections == null || selections.isEmpty()) {
            return List.of();
        }

        HashSet<UUID> seenProductIds = new HashSet<>();
        return selections.stream()
                .map(selection -> {
                    if (selection.productId() == null) {
                        throw new IllegalArgumentException("Product is required for each order line");
                    }
                    if (selection.quantity() <= 0) {
                        throw new IllegalArgumentException("Product quantity must be greater than zero");
                    }
                    if (!seenProductIds.add(selection.productId())) {
                        throw new IllegalArgumentException("Product can only appear once per order");
                    }

                    Product product = productRepository.findByIdAndTenantId(selection.productId(), tenantId)
                            .orElseThrow(() -> new IllegalArgumentException("Product not found"));
                    if (product.getStatus() != ProductStatus.ACTIVE) {
                        throw new IllegalArgumentException("Product must be ACTIVE to create product-based orders");
                    }

                    BigDecimal lineTotal = product.getPriceAmount().multiply(BigDecimal.valueOf(selection.quantity()));
                    return new OrderLineSnapshot(
                            product.getId(),
                            product.getName(),
                            product.getSku(),
                            product.getPriceAmount(),
                            product.getCurrency(),
                            selection.quantity(),
                            lineTotal
                    );
                })
                .toList();
    }

    @Transactional
    public Product updateProduct(UUID tenantId, UUID productId, ProductCommand command) {
        Product product = getProduct(tenantId, productId);
        String slug = normalizeSlug(command.slug());
        ensureSlugAvailable(tenantId, slug, productId);
        String name = normalizeRequired(command.name(), "Product name is required");
        BigDecimal priceAmount = requirePositivePrice(command.priceAmount());

        product.setName(name);
        product.setSlug(slug);
        product.setDescription(normalizeOptional(command.description()));
        product.setPriceAmount(priceAmount);
        product.setCurrency(normalizeCurrency(command.currency()));
        product.setSku(normalizeOptional(command.sku()));
        product.setImageUrl(normalizeOptional(command.imageUrl()));
        product.setStatus(command.status() == null ? product.getStatus() : command.status());
        product.setUpdatedAt(Instant.now(clock));
        return product;
    }

    @Transactional
    public Product archiveProduct(UUID tenantId, UUID productId) {
        Product product = getProduct(tenantId, productId);
        product.setStatus(ProductStatus.ARCHIVED);
        product.setUpdatedAt(Instant.now(clock));
        return product;
    }

    private void ensureSlugAvailable(UUID tenantId, String slug, UUID currentProductId) {
        boolean exists = currentProductId == null
                ? productRepository.existsByTenantIdAndSlug(tenantId, slug)
                : productRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, currentProductId);
        if (exists) {
            throw new ResourceConflictException("Product slug already exists for this tenant");
        }
    }

    private String normalizeSlug(String requestedSlug) {
        if (!hasText(requestedSlug)) {
            throw new IllegalArgumentException("Product slug is required");
        }
        String normalized = Normalizer.normalize(requestedSlug, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (!hasText(normalized)) {
            throw new IllegalArgumentException("Product slug could not be generated");
        }
        if (normalized.length() > 160) {
            return normalized.substring(0, 160).replaceAll("-+$", "");
        }
        return normalized;
    }

    private String normalizeCurrency(String currency) {
        if (!hasText(currency)) {
            throw new IllegalArgumentException("Product currency is required");
        }
        return currency.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeRequired(String value, String message) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private BigDecimal requirePositivePrice(BigDecimal priceAmount) {
        if (priceAmount == null || priceAmount.signum() <= 0) {
            throw new IllegalArgumentException("Product price must be greater than zero");
        }
        return priceAmount;
    }

    private String normalizeOptional(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private String normalizeSkuForCreation(String requestedSku, String slug) {
        if (hasText(requestedSku)) {
            return requestedSku.trim();
        }
        String generated = "SKU-" + slug.toUpperCase(Locale.ROOT);
        if (generated.length() > 100) {
            return generated.substring(0, 100).replaceAll("-+$", "");
        }
        return generated;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    public record ProductCommand(
            String name,
            String slug,
            String description,
            BigDecimal priceAmount,
            String currency,
            String sku,
            String imageUrl,
            ProductStatus status
    ) {}

    public record OrderLineSelection(UUID productId, int quantity) {}
}

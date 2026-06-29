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

    private static final String DEFAULT_CURRENCY = "MAD";

    private final ProductRepository productRepository;
    private final Clock clock;

    @Transactional
    public Product createProduct(UUID tenantId, ProductCommand command) {
        Instant now = Instant.now(clock);
        String slug = normalizeSlug(command.slug(), command.name());
        ensureSlugAvailable(tenantId, slug, null);

        return productRepository.save(Product.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .name(normalizeRequired(command.name()))
                .slug(slug)
                .description(normalizeOptional(command.description()))
                .priceAmount(command.priceAmount())
                .currency(normalizeCurrency(command.currency()))
                .sku(normalizeOptional(command.sku()))
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
        String slug = normalizeSlug(command.slug(), command.name());
        ensureSlugAvailable(tenantId, slug, productId);

        product.setName(normalizeRequired(command.name()));
        product.setSlug(slug);
        product.setDescription(normalizeOptional(command.description()));
        product.setPriceAmount(command.priceAmount());
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

    private String normalizeSlug(String requestedSlug, String fallbackName) {
        String rawSlug = hasText(requestedSlug) ? requestedSlug : fallbackName;
        String normalized = Normalizer.normalize(rawSlug, Normalizer.Form.NFD)
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
        return hasText(currency) ? currency.trim().toUpperCase(Locale.ROOT) : DEFAULT_CURRENCY;
    }

    private String normalizeRequired(String value) {
        return value.trim();
    }

    private String normalizeOptional(String value) {
        return hasText(value) ? value.trim() : null;
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

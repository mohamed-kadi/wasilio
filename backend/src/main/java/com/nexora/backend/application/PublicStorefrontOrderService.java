package com.nexora.backend.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.domain.repository.InboundOrderRepository;
import com.nexora.backend.domain.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
@RequiredArgsConstructor
public class PublicStorefrontOrderService {

    private static final int RAW_PAYLOAD_SCHEMA_VERSION = 1;
    private static final OrderSource PUBLIC_SOURCE = OrderSource.WASILIO_STOREFRONT;

    private final PublicStorefrontQueryService publicStorefrontQueryService;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final OrderIngestionService orderIngestionService;
    private final InboundOrderRepository inboundOrderRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public PublicOrderIntentResponse submitOrderIntent(String storeSlug, PublicOrderIntentRequest request) {
        ResolvedPublicStorefrontContext storefront = publicStorefrontQueryService.resolveStorefrontForApplication(storeSlug);
        NormalizedPublicOrderIntent intent = normalizeAndValidate(storefront, request);

        InboundOrder existing = inboundOrderRepository.findByTenantIdAndSourceAndIdempotencyKey(
                storefront.tenantId(),
                PUBLIC_SOURCE,
                intent.idempotencyKey()
        ).orElse(null);
        if (existing != null) {
            return responseFromExisting(existing, intent.payloadHash());
        }

        Product product = resolveProduct(storefront.tenantId(), intent.productId(), intent.productSlug());
        List<OrderLineSnapshot> orderLines = productService.snapshotOrderLines(
                storefront.tenantId(),
                List.of(new ProductService.OrderLineSelection(product.getId(), intent.quantity()))
        );
        BigDecimal amount = orderLines.stream()
                .map(OrderLineSnapshot::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        OrderIngestionService.IngestedOrderResult result = orderIngestionService.ingestAndNormalize(
                new OrderIngestionService.IngestOrderCommand(
                        storefront.tenantId(),
                        PUBLIC_SOURCE,
                        null,
                        intent.idempotencyKey(),
                        rawPayload(storefront, intent, product),
                        toCustomer(intent),
                        toAddress(storefront, intent),
                        amount,
                        orderLines
                )
        );
        if (result.status() == InboundOrderStatus.REJECTED) {
            throw new IllegalArgumentException("Public order rejected: " + result.rejectionReason());
        }
        return new PublicOrderIntentResponse(
                result.inboundOrderId(),
                "accepted",
                "Order received"
        );
    }

    private PublicOrderIntentResponse responseFromExisting(InboundOrder existing, String payloadHash) {
        String existingPayloadHash = extractPayloadHash(existing.getRawPayload());
        if (!payloadHash.equals(existingPayloadHash)) {
            throw new ResourceConflictException("Idempotency key already used with a different public order payload");
        }
        if (existing.getStatus() == InboundOrderStatus.REJECTED) {
            throw new IllegalArgumentException("Public order rejected: " + existing.getRejectionReason());
        }
        return new PublicOrderIntentResponse(
                existing.getInboundOrderId(),
                "accepted",
                "Order already received"
        );
    }

    private NormalizedPublicOrderIntent normalizeAndValidate(
            ResolvedPublicStorefrontContext storefront,
            PublicOrderIntentRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("Request payload is required");
        }
        PublicOrderSelectionRequest selection = requirePresent(request.selection(), "selection is required");
        PublicOrderProductRequest product = requirePresent(selection.product(), "selection.product is required");
        if (hasText(product.variantId())) {
            throw new IllegalArgumentException("variantId is not supported in V1");
        }

        UUID productId = product.productId();
        String productSlug = normalizeOptional(product.productSlug());
        if (productSlug != null) {
            productSlug = productSlug.toLowerCase(Locale.ROOT);
        }
        if (productId == null && productSlug == null) {
            throw new IllegalArgumentException("productId or productSlug is required");
        }
        if (productSlug != null && productSlug.length() > 160) {
            throw new IllegalArgumentException("productSlug must be 160 characters or fewer");
        }

        Integer quantity = selection.quantity();
        if (quantity == null || quantity < 1) {
            throw new IllegalArgumentException("quantity must be greater than or equal to 1");
        }

        PublicOrderCustomerRequest customer = requirePresent(request.customer(), "customer is required");
        String customerName = requireText(customer.name(), "customer.name is required", 255);
        String phone = requireText(customer.phone(), "customer.phone is required", 50);
        validatePhone(storefront, phone);

        PublicOrderDeliveryRequest delivery = requirePresent(request.delivery(), "delivery is required");
        String city = requireText(delivery.city(), "delivery.city is required", 100);
        String address = requireText(delivery.address(), "delivery.address is required", 255);
        String notes = normalizeOptional(delivery.notes());
        if (notes != null && notes.length() > 1000) {
            throw new IllegalArgumentException("delivery.notes must be 1000 characters or fewer");
        }

        String idempotencyKey = requireText(request.idempotencyKey(), "idempotencyKey is required", 255);
        String correlationId = normalizeOptional(request.correlationId());
        if (correlationId != null) {
            try {
                UUID.fromString(correlationId);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("correlationId must be a UUID");
            }
        }

        CanonicalPublicOrderPayload canonicalPayload = new CanonicalPublicOrderPayload(
                storefront.storeSlug(),
                productId,
                productSlug,
                quantity,
                customerName,
                phone,
                city,
                address,
                notes,
                normalizeAttribution(request.attribution())
        );
        return new NormalizedPublicOrderIntent(
                productId,
                productSlug,
                quantity,
                customerName,
                phone,
                city,
                address,
                notes,
                idempotencyKey,
                correlationId,
                canonicalPayload,
                payloadHash(canonicalPayload)
        );
    }

    private Product resolveProduct(UUID tenantId, UUID productId, String productSlug) {
        Product productById = productId == null
                ? null
                : productRepository.findByIdAndTenantId(productId, tenantId)
                        .orElseThrow(() -> new IllegalArgumentException("Public product not found"));
        Product productBySlug = productSlug == null
                ? null
                : productRepository.findByTenantIdAndSlug(tenantId, productSlug)
                        .orElseThrow(() -> new IllegalArgumentException("Public product not found"));

        if (productById != null && productBySlug != null && !productById.getId().equals(productBySlug.getId())) {
            throw new IllegalArgumentException("productId and productSlug do not match");
        }

        Product product = productById == null ? productBySlug : productById;
        if (product == null || product.getStatus() != ProductStatus.ACTIVE) {
            throw new IllegalArgumentException("Public product not found");
        }
        return product;
    }

    private Customer toCustomer(NormalizedPublicOrderIntent intent) {
        return new Customer(intent.customerName(), "", null, intent.phone());
    }

    private Address toAddress(ResolvedPublicStorefrontContext storefront, NormalizedPublicOrderIntent intent) {
        return new Address(intent.address(), intent.city(), null, null, storefront.defaultCountryCode());
    }

    private String rawPayload(
            ResolvedPublicStorefrontContext storefront,
            NormalizedPublicOrderIntent intent,
            Product product
    ) {
        PublicOrderRawPayload rawPayload = new PublicOrderRawPayload(
                "public-order-intent",
                RAW_PAYLOAD_SCHEMA_VERSION,
                intent.payloadHash(),
                intent.correlationId(),
                intent.canonicalPayload(),
                new ServerProductSnapshot(
                        product.getId(),
                        product.getSlug(),
                        product.getName(),
                        product.getSku(),
                        product.getPriceAmount(),
                        product.getCurrency(),
                        storefront.defaultCountryCode()
                )
        );
        try {
            return objectMapper.writeValueAsString(rawPayload);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Public order raw payload could not be serialized", ex);
        }
    }

    private String payloadHash(CanonicalPublicOrderPayload payload) {
        try {
            String canonicalJson = objectMapper.writeValueAsString(payload);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonicalJson.getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Public order payload could not be serialized", ex);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private String extractPayloadHash(String rawPayload) {
        try {
            JsonNode payload = objectMapper.readTree(rawPayload);
            JsonNode payloadHash = payload.get("payloadHash");
            if (payloadHash == null || !payloadHash.isTextual() || payloadHash.asText().isBlank()) {
                throw new ResourceConflictException("Idempotency key already used with an incompatible payload");
            }
            return payloadHash.asText();
        } catch (JsonProcessingException ex) {
            throw new ResourceConflictException("Idempotency key already used with an incompatible payload");
        }
    }

    private CanonicalAttribution normalizeAttribution(PublicOrderAttributionRequest attribution) {
        if (attribution == null) {
            return null;
        }
        CanonicalAttribution normalized = new CanonicalAttribution(
                normalizeOptional(attribution.source(), 255, "attribution.source"),
                normalizeOptional(attribution.medium(), 255, "attribution.medium"),
                normalizeOptional(attribution.campaign(), 255, "attribution.campaign"),
                normalizeOptional(attribution.content(), 255, "attribution.content"),
                normalizeOptional(attribution.term(), 255, "attribution.term"),
                normalizeOptional(attribution.referrerUrl(), 1000, "attribution.referrerUrl"),
                normalizeOptional(attribution.landingPageUrl(), 1000, "attribution.landingPageUrl")
        );
        if (normalized.source() == null
                && normalized.medium() == null
                && normalized.campaign() == null
                && normalized.content() == null
                && normalized.term() == null
                && normalized.referrerUrl() == null
                && normalized.landingPageUrl() == null) {
            return null;
        }
        return normalized;
    }

    private void validatePhone(ResolvedPublicStorefrontContext storefront, String phone) {
        try {
            if (!Pattern.compile(storefront.phonePattern()).matcher(phone).matches()) {
                throw new IllegalArgumentException("customer.phone does not match storefront phone pattern");
            }
        } catch (PatternSyntaxException ex) {
            throw new IllegalStateException("Storefront phone pattern is invalid", ex);
        }
    }

    private <T> T requirePresent(T value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private String requireText(String value, String message, int maxLength) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(message.replace(" is required", "") + " must be " + maxLength + " characters or fewer");
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeOptional(String value, int maxLength, String field) {
        String normalized = normalizeOptional(value);
        if (normalized != null && normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be " + maxLength + " characters or fewer");
        }
        return normalized;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private record NormalizedPublicOrderIntent(
            UUID productId,
            String productSlug,
            int quantity,
            String customerName,
            String phone,
            String city,
            String address,
            String notes,
            String idempotencyKey,
            String correlationId,
            CanonicalPublicOrderPayload canonicalPayload,
            String payloadHash
    ) {}

    private record CanonicalPublicOrderPayload(
            String storeSlug,
            UUID productId,
            String productSlug,
            int quantity,
            String customerName,
            String phone,
            String city,
            String address,
            String notes,
            CanonicalAttribution attribution
    ) {}

    private record CanonicalAttribution(
            String source,
            String medium,
            String campaign,
            String content,
            String term,
            String referrerUrl,
            String landingPageUrl
    ) {}

    private record PublicOrderRawPayload(
            String type,
            int schemaVersion,
            String payloadHash,
            String correlationId,
            CanonicalPublicOrderPayload payload,
            ServerProductSnapshot serverProductSnapshot
    ) {}

    private record ServerProductSnapshot(
            UUID productId,
            String productSlug,
            String productName,
            String sku,
            BigDecimal unitPrice,
            String currency,
            String countryCode
    ) {}
}

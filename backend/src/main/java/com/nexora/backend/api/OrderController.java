package com.nexora.backend.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.application.CourierService;
import com.nexora.backend.application.OrderIngestionService;
import com.nexora.backend.application.OrderLifecycleService;
import com.nexora.backend.application.OrderTimelineService;
import com.nexora.backend.application.ProductService;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.model.OrderSearchSavedView;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.domain.repository.OrderSearchSavedViewRepository;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class OrderController {

    private final OrderLifecycleService orderLifecycleService;
    private final OrderIngestionService orderIngestionService;
    private final ProductService productService;
    private final CourierService courierService;
    private final OrderRepository orderRepository;
    private final OrderSearchSavedViewRepository savedViewRepository;
    private final EventStore eventStore;
    private final ObjectMapper objectMapper;
    private final OrderTimelineService orderTimelineService;

    private UUID getCurrentTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return UUID.fromString(userDetails.getTenantId());
    }

    public record CreateOrderRequest(
            @Valid @NotNull CustomerRequest customer,
            @Valid @NotNull AddressRequest address,
            @Positive BigDecimal amount,
            @Valid @Size(max = 100) List<ProductLineRequest> productLines,
            OrderSource source,
            @Size(max = 255) String externalOrderId,
            @Size(max = 255) String idempotencyKey
    ) {
        public CreateOrderRequest(CustomerRequest customer, AddressRequest address, BigDecimal amount) {
            this(customer, address, amount, null, null, null, null);
        }

        public CreateOrderRequest(
                CustomerRequest customer,
                AddressRequest address,
                BigDecimal amount,
                OrderSource source,
                String externalOrderId,
                String idempotencyKey
        ) {
            this(customer, address, amount, null, source, externalOrderId, idempotencyKey);
        }

        @AssertTrue(message = "amount is required when productLines is empty")
        public boolean isAmountPresentWhenNoProductLines() {
            return hasProductLines() || amount != null;
        }

        Customer toCustomer() {
            return new Customer(customer.firstName(), customer.lastName(), customer.email(), customer.phone());
        }

        Address toAddress() {
            return new Address(address.street(), address.city(), address.state(), address.zipCode(), address.country());
        }

        boolean hasProductLines() {
            return productLines != null && !productLines.isEmpty();
        }

        List<ProductService.OrderLineSelection> toOrderLineSelections() {
            if (!hasProductLines()) {
                return List.of();
            }
            return productLines.stream()
                    .map(line -> new ProductService.OrderLineSelection(line.productId(), line.quantity()))
                    .toList();
        }
    }

    public record CustomerRequest(
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 50) String phone
    ) {}

    public record AddressRequest(
            @NotBlank @Size(max = 255) String street,
            @NotBlank @Size(max = 100) String city,
            @NotBlank @Size(max = 100) String state,
            @NotBlank @Size(max = 30) String zipCode,
            @NotBlank @Size(max = 100) String country
    ) {}

    public record ProductLineRequest(
            @NotNull UUID productId,
            @Positive int quantity
    ) {}

    public record RejectOrderRequest(@NotBlank @Size(max = 500) String reason) {}
    public record AssignCourierRequest(@NotBlank @Size(max = 100) String courierId) {}
    public record FailOrderRequest(@NotBlank @Size(max = 500) String reason) {}
    public record OrderSearchSavedViewRequest(
            @NotBlank @Size(max = 100) String name,
            @NotNull Map<String, String> filters
    ) {}

    public record OrderSearchSavedViewResponse(
            UUID viewId,
            String name,
            Map<String, String> filters,
            Instant createdAt,
            Instant updatedAt
    ) {
        static OrderSearchSavedViewResponse from(OrderSearchSavedView view, ObjectMapper objectMapper) {
            try {
                Map<String, String> filters = objectMapper.readValue(
                        view.getFiltersJson(),
                        new TypeReference<>() {}
                );
                return new OrderSearchSavedViewResponse(
                        view.getViewId(),
                        view.getName(),
                        filters,
                        view.getCreatedAt(),
                        view.getUpdatedAt()
                );
            } catch (JsonProcessingException ex) {
                throw new IllegalStateException("Saved view filters could not be read", ex);
            }
        }
    }

    public record OrdersPageResponse(
            List<Order> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static OrdersPageResponse from(Page<Order> orders) {
            return new OrdersPageResponse(
                    orders.getContent(),
                    orders.getNumber(),
                    orders.getSize(),
                    orders.getTotalElements(),
                    orders.getTotalPages()
            );
        }
    }

    @PostMapping
    public ResponseEntity<UUID> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        UUID tenantId = getCurrentTenantId();
        List<OrderLineSnapshot> orderLines = productService.snapshotOrderLines(tenantId, request.toOrderLineSelections());
        BigDecimal amount = orderLines.isEmpty()
                ? request.amount()
                : orderLines.stream()
                        .map(OrderLineSnapshot::lineTotal)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        OrderIngestionService.IngestedOrderResult result = orderIngestionService.ingestAndNormalize(
                new OrderIngestionService.IngestOrderCommand(
                        tenantId,
                        request.source(),
                        request.externalOrderId(),
                        request.idempotencyKey(),
                        toRawPayload(request),
                        request.toCustomer(),
                        request.toAddress(),
                        amount,
                        orderLines
                )
        );
        if (result.status() == InboundOrderStatus.REJECTED) {
            throw new IllegalArgumentException("Inbound order rejected: " + result.rejectionReason());
        }
        if (result.orderId() == null) {
            throw new IllegalStateException("Inbound order has not been normalized yet");
        }
        return ResponseEntity.ok(result.orderId());
    }

    @PostMapping("/{orderId}/request-confirmation")
    public ResponseEntity<Void> requestConfirmation(@PathVariable UUID orderId) {
        orderLifecycleService.requestConfirmation(getCurrentTenantId(), orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/confirm")
    public ResponseEntity<Void> confirmOrder(@PathVariable UUID orderId) {
        orderLifecycleService.confirmOrder(getCurrentTenantId(), orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/reject")
    public ResponseEntity<Void> rejectOrder(@PathVariable UUID orderId, @Valid @RequestBody RejectOrderRequest request) {
        orderLifecycleService.rejectOrder(getCurrentTenantId(), orderId, request.reason());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/assign-courier")
    public ResponseEntity<Void> assignToCourier(@PathVariable UUID orderId, @Valid @RequestBody AssignCourierRequest request) {
        UUID tenantId = getCurrentTenantId();
        UUID courierId = parseCourierId(request.courierId());
        courierService.requireActiveCourier(tenantId, courierId);
        orderLifecycleService.assignToCourier(tenantId, orderId, courierId.toString());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/pick-up")
    public ResponseEntity<Void> markPickedUp(@PathVariable UUID orderId, @Valid @RequestBody AssignCourierRequest request) {
        UUID tenantId = getCurrentTenantId();
        UUID courierId = parseCourierId(request.courierId());
        courierService.requireActiveCourier(tenantId, courierId);
        orderLifecycleService.markPickedUp(tenantId, orderId, courierId.toString());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/deliver")
    public ResponseEntity<Void> markDelivered(@PathVariable UUID orderId) {
        orderLifecycleService.markDelivered(getCurrentTenantId(), orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/fail")
    public ResponseEntity<Void> markFailed(@PathVariable UUID orderId, @Valid @RequestBody FailOrderRequest request) {
        orderLifecycleService.markFailed(getCurrentTenantId(), orderId, request.reason());
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<OrdersPageResponse> listOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) List<OrderStatus> status,
            @RequestParam(required = false) @Size(max = 50) String phone,
            @RequestParam(required = false) @Size(max = 200) String customerName,
            @RequestParam(required = false) @Size(max = 36) String orderId,
            @RequestParam(required = false) UUID courierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
        if (createdFrom != null && createdTo != null && !createdFrom.isBefore(createdTo)) {
            throw new IllegalArgumentException("createdFrom must be before createdTo");
        }

        UUID tenantId = getCurrentTenantId();
        PageRequest pageRequest = PageRequest.of(page, size);
        List<OrderStatus> statuses = status == null ? List.of() : status;
        Page<Order> orders = orderRepository.searchOrders(
                tenantId,
                !statuses.isEmpty(),
                statuses.isEmpty() ? List.of(OrderStatus.CREATED.name()) : statuses.stream().map(Enum::name).toList(),
                normalizeSearch(phone),
                normalizeSearch(customerName),
                normalizeSearch(orderId),
                courierId == null ? null : courierId.toString(),
                createdFrom != null,
                createdFrom,
                createdTo != null,
                createdTo,
                pageRequest
        );
        return ResponseEntity.ok(OrdersPageResponse.from(orders));
    }

    @GetMapping("/search-views")
    public ResponseEntity<List<OrderSearchSavedViewResponse>> listSearchViews() {
        return ResponseEntity.ok(savedViewRepository.findByTenantIdOrderByNameAscViewIdAsc(getCurrentTenantId()).stream()
                .map(view -> OrderSearchSavedViewResponse.from(view, objectMapper))
                .toList());
    }

    @PostMapping("/search-views")
    public ResponseEntity<OrderSearchSavedViewResponse> createSearchView(
            @Valid @RequestBody OrderSearchSavedViewRequest request
    ) {
        UUID tenantId = getCurrentTenantId();
        String name = request.name().trim();
        if (savedViewRepository.existsByTenantIdAndNameIgnoreCase(tenantId, name)) {
            throw new IllegalArgumentException("Saved view name already exists");
        }
        Instant now = Instant.now();
        OrderSearchSavedView view = savedViewRepository.save(OrderSearchSavedView.builder()
                .viewId(UUID.randomUUID())
                .tenantId(tenantId)
                .name(name)
                .filtersJson(toFiltersJson(request.filters()))
                .createdAt(now)
                .updatedAt(now)
                .build());
        return ResponseEntity.ok(OrderSearchSavedViewResponse.from(view, objectMapper));
    }

    @PutMapping("/search-views/{viewId}")
    public ResponseEntity<OrderSearchSavedViewResponse> updateSearchView(
            @PathVariable UUID viewId,
            @Valid @RequestBody OrderSearchSavedViewRequest request
    ) {
        UUID tenantId = getCurrentTenantId();
        OrderSearchSavedView view = savedViewRepository.findByViewIdAndTenantId(viewId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Saved view not found"));
        view.setName(request.name().trim());
        view.setFiltersJson(toFiltersJson(request.filters()));
        view.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(OrderSearchSavedViewResponse.from(savedViewRepository.save(view), objectMapper));
    }

    @DeleteMapping("/search-views/{viewId}")
    public ResponseEntity<Void> deleteSearchView(@PathVariable UUID viewId) {
        UUID tenantId = getCurrentTenantId();
        OrderSearchSavedView view = savedViewRepository.findByViewIdAndTenantId(viewId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Saved view not found"));
        savedViewRepository.delete(view);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrder(@PathVariable UUID orderId) {
        Order order = orderRepository.findByIdAndTenantId(orderId, getCurrentTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        return ResponseEntity.ok(order);
    }

    @GetMapping("/{orderId}/events")
    public ResponseEntity<List<DomainEvent>> getOrderEvents(@PathVariable UUID orderId) {
        UUID tenantId = getCurrentTenantId();
        if (orderRepository.findByIdAndTenantId(orderId, tenantId).isEmpty()) {
            throw new IllegalArgumentException("Order not found");
        }
        return ResponseEntity.ok(eventStore.getEventsForAggregate(tenantId, orderId));
    }

    @GetMapping("/{orderId}/timeline")
    public ResponseEntity<List<OrderTimelineService.OrderTimelineItem>> getOrderTimeline(@PathVariable UUID orderId) {
        return ResponseEntity.ok(orderTimelineService.getTimeline(getCurrentTenantId(), orderId));
    }

    private UUID parseCourierId(String courierId) {
        try {
            return UUID.fromString(courierId);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Courier not found");
        }
    }

    private String normalizeSearch(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String toFiltersJson(Map<String, String> filters) {
        try {
            return objectMapper.writeValueAsString(filters);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Saved view filters are invalid");
        }
    }

    private String toRawPayload(CreateOrderRequest request) {
        try {
            return objectMapper.writeValueAsString(request);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Order payload could not be serialized");
        }
    }
}

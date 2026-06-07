package com.nexora.backend.api;

import com.nexora.backend.application.OrderLifecycleService;
import com.nexora.backend.application.CourierService;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class OrderController {

    private final OrderLifecycleService orderLifecycleService;
    private final CourierService courierService;
    private final OrderRepository orderRepository;
    private final EventStore eventStore;

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
            @NotNull @Positive BigDecimal amount
    ) {
        Customer toCustomer() {
            return new Customer(customer.firstName(), customer.lastName(), customer.email(), customer.phone());
        }

        Address toAddress() {
            return new Address(address.street(), address.city(), address.state(), address.zipCode(), address.country());
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

    public record RejectOrderRequest(@NotBlank @Size(max = 500) String reason) {}
    public record AssignCourierRequest(@NotBlank @Size(max = 100) String courierId) {}
    public record FailOrderRequest(@NotBlank @Size(max = 500) String reason) {}

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
        UUID orderId = orderLifecycleService.createOrder(
                getCurrentTenantId(),
                request.toCustomer(),
                request.toAddress(),
                request.amount()
        );
        return ResponseEntity.ok(orderId);
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
            @RequestParam(required = false) OrderStatus status
    ) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }

        UUID tenantId = getCurrentTenantId();
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"))
        );
        Page<Order> orders = status == null
                ? orderRepository.findByTenantId(tenantId, pageRequest)
                : orderRepository.findByTenantIdAndStatus(tenantId, status, pageRequest);
        return ResponseEntity.ok(OrdersPageResponse.from(orders));
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

    private UUID parseCourierId(String courierId) {
        try {
            return UUID.fromString(courierId);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Courier not found");
        }
    }
}

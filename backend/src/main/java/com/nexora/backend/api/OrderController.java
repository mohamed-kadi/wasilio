package com.nexora.backend.api;

import com.nexora.backend.application.OrderLifecycleService;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderLifecycleService orderLifecycleService;
    private final OrderRepository orderRepository;
    private final EventStore eventStore;

    // Dummy helper to extract tenantId from security context in real life
    private UUID getCurrentTenantId() {
        return UUID.fromString("00000000-0000-0000-0000-000000000001");
    }

    public record CreateOrderRequest(Customer customer, Address address, BigDecimal amount) {}
    public record RejectOrderRequest(String reason) {}
    public record AssignCourierRequest(String courierId) {}
    public record FailOrderRequest(String reason) {}

    @PostMapping
    public ResponseEntity<UUID> createOrder(@RequestBody CreateOrderRequest request) {
        UUID orderId = orderLifecycleService.createOrder(getCurrentTenantId(), request.customer(), request.address(), request.amount());
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
    public ResponseEntity<Void> rejectOrder(@PathVariable UUID orderId, @RequestBody RejectOrderRequest request) {
        orderLifecycleService.rejectOrder(getCurrentTenantId(), orderId, request.reason());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/assign-courier")
    public ResponseEntity<Void> assignToCourier(@PathVariable UUID orderId, @RequestBody AssignCourierRequest request) {
        orderLifecycleService.assignToCourier(getCurrentTenantId(), orderId, request.courierId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/pick-up")
    public ResponseEntity<Void> markPickedUp(@PathVariable UUID orderId, @RequestBody AssignCourierRequest request) {
        orderLifecycleService.markPickedUp(getCurrentTenantId(), orderId, request.courierId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/deliver")
    public ResponseEntity<Void> markDelivered(@PathVariable UUID orderId) {
        orderLifecycleService.markDelivered(getCurrentTenantId(), orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/fail")
    public ResponseEntity<Void> markFailed(@PathVariable UUID orderId, @RequestBody FailOrderRequest request) {
        orderLifecycleService.markFailed(getCurrentTenantId(), orderId, request.reason());
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<List<Order>> listOrders() {
        return ResponseEntity.ok(orderRepository.findByTenantId(getCurrentTenantId()));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrder(@PathVariable UUID orderId) {
        return orderRepository.findByIdAndTenantId(orderId, getCurrentTenantId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{orderId}/events")
    public ResponseEntity<List<DomainEvent>> getOrderEvents(@PathVariable UUID orderId) {
        return ResponseEntity.ok(eventStore.getEventsForAggregate(getCurrentTenantId(), orderId));
    }
}

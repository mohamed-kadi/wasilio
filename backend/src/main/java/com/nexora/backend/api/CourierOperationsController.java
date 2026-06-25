package com.nexora.backend.api;

import com.nexora.backend.application.CourierPerformanceService;
import com.nexora.backend.application.DeliveryOperationsService;
import com.nexora.backend.application.DeliveryOperationsService.DeliveryFailureRecoveryResult;
import com.nexora.backend.domain.model.DeliveryFailure;
import com.nexora.backend.domain.model.DeliveryFailureRecovery;
import com.nexora.backend.domain.model.DeliveryFailureRecoveryDecision;
import com.nexora.backend.domain.model.DeliveryFailureReason;
import com.nexora.backend.domain.model.DeliveryFollowUpTask;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/courier-operations")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class CourierOperationsController {

    private final OrderRepository orderRepository;
    private final DeliveryOperationsService deliveryOperationsService;
    private final CourierPerformanceService courierPerformanceService;

    public record DeliveryFailureRequest(
            DeliveryFailureReason reason,
            @Size(max = 1000) String note
    ) {}

    public record DeliveryFailureRecoveryRequest(
            DeliveryFailureRecoveryDecision decision,
            @Size(max = 1000) String note,
            Instant followUpDueAt
    ) {}

    public record DeliveryFollowUpResolutionRequest(
            @Size(max = 1000) String note
    ) {}

    public record DeliveryFailureRecoveryResponse(
            UUID recoveryId,
            UUID tenantId,
            UUID orderId,
            DeliveryFailureRecoveryDecision decision,
            String note,
            String createdBy,
            Instant createdAt,
            DeliveryFollowUpTask followUpTask
    ) {
        static DeliveryFailureRecoveryResponse from(DeliveryFailureRecoveryResult result) {
            DeliveryFailureRecovery recovery = result.recovery();
            return new DeliveryFailureRecoveryResponse(
                    recovery.getRecoveryId(),
                    recovery.getTenantId(),
                    recovery.getOrderId(),
                    recovery.getDecision(),
                    recovery.getNote(),
                    recovery.getCreatedBy(),
                    recovery.getCreatedAt(),
                    result.followUpTask()
            );
        }
    }

    public record CourierPerformanceResponse(
            String courierId,
            String courierName,
            boolean active,
            long assignedOrdersCount,
            long pickedUpOrdersCount,
            long deliveredOrdersCount,
            long failedOrdersCount,
            double deliverySuccessRate
    ) {
        static CourierPerformanceResponse from(CourierPerformanceService.CourierPerformanceMetric metric) {
            long delivered = metric.deliveredOrdersCount();
            long failed = metric.failedOrdersCount();
            long completed = delivered + failed;
            double successRate = completed == 0 ? 0.0 : (double) delivered / completed;
            return new CourierPerformanceResponse(
                    metric.courierId(),
                    metric.courierName(),
                    metric.active(),
                    metric.assignedOrdersCount(),
                    metric.pickedUpOrdersCount(),
                    delivered,
                    failed,
                    successRate
            );
        }
    }

    public record CourierOperationsQueueResponse(
            List<Order> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static CourierOperationsQueueResponse from(Page<Order> orders) {
            return new CourierOperationsQueueResponse(
                    orders.getContent(),
                    orders.getNumber(),
                    orders.getSize(),
                    orders.getTotalElements(),
                    orders.getTotalPages()
            );
        }
    }

    @GetMapping("/assignment-queue")
    public ResponseEntity<CourierOperationsQueueResponse> assignmentQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        OrderStatus queueStatus = status == null ? OrderStatus.CONFIRMED : status;
        if (queueStatus != OrderStatus.CONFIRMED) {
            throw new IllegalArgumentException("status must be CONFIRMED");
        }
        return ResponseEntity.ok(CourierOperationsQueueResponse.from(orderRepository.findCourierOperationsQueue(
                getCurrentTenantId(),
                queueStatus,
                null,
                true,
                createdFrom != null,
                createdFrom,
                createdTo != null,
                createdTo,
                pageRequest(page, size)
        )));
    }

    @GetMapping("/pickup-queue")
    public ResponseEntity<CourierOperationsQueueResponse> pickupQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) UUID courierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        OrderStatus queueStatus = status == null ? OrderStatus.ASSIGNED_TO_COURIER : status;
        if (queueStatus != OrderStatus.ASSIGNED_TO_COURIER) {
            throw new IllegalArgumentException("status must be ASSIGNED_TO_COURIER");
        }
        return ResponseEntity.ok(CourierOperationsQueueResponse.from(orderRepository.findCourierOperationsQueue(
                getCurrentTenantId(),
                queueStatus,
                courierId == null ? null : courierId.toString(),
                false,
                createdFrom != null,
                createdFrom,
                createdTo != null,
                createdTo,
                pageRequest(page, size)
        )));
    }

    @GetMapping("/delivery-queue")
    public ResponseEntity<CourierOperationsQueueResponse> deliveryQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) UUID courierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        OrderStatus queueStatus = status == null ? OrderStatus.PICKED_UP : status;
        if (queueStatus != OrderStatus.PICKED_UP) {
            throw new IllegalArgumentException("status must be PICKED_UP");
        }
        return ResponseEntity.ok(CourierOperationsQueueResponse.from(orderRepository.findCourierOperationsQueue(
                getCurrentTenantId(),
                queueStatus,
                courierId == null ? null : courierId.toString(),
                false,
                createdFrom != null,
                createdFrom,
                createdTo != null,
                createdTo,
                pageRequest(page, size)
        )));
    }

    @PostMapping("/orders/{orderId}/deliver")
    public ResponseEntity<Void> markDelivered(@PathVariable UUID orderId) {
        deliveryOperationsService.markDelivered(getCurrentTenantId(), orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/orders/{orderId}/fail")
    public ResponseEntity<DeliveryFailure> markFailed(
            @PathVariable UUID orderId,
            @Valid @RequestBody DeliveryFailureRequest request
    ) {
        if (request.reason() == null) {
            throw new IllegalArgumentException("reason is required");
        }
        return ResponseEntity.ok(deliveryOperationsService.markFailed(
                getCurrentTenantId(),
                orderId,
                request.reason(),
                request.note()
        ));
    }

    @GetMapping("/orders/{orderId}/failure-recoveries")
    public ResponseEntity<List<DeliveryFailureRecovery>> listFailureRecoveries(@PathVariable UUID orderId) {
        return ResponseEntity.ok(deliveryOperationsService.listFailureRecoveries(getCurrentTenantId(), orderId));
    }

    @PostMapping("/orders/{orderId}/failure-recoveries")
    public ResponseEntity<DeliveryFailureRecoveryResponse> recordFailureRecovery(
            @PathVariable UUID orderId,
            @Valid @RequestBody DeliveryFailureRecoveryRequest request
    ) {
        if (request.decision() == null) {
            throw new IllegalArgumentException("decision is required");
        }
        return ResponseEntity.ok(DeliveryFailureRecoveryResponse.from(deliveryOperationsService.recordFailureRecovery(
                getCurrentTenantId(),
                orderId,
                request.decision(),
                request.note(),
                request.followUpDueAt(),
                getCurrentUserEmail()
        )));
    }

    @GetMapping("/orders/{orderId}/follow-ups")
    public ResponseEntity<List<DeliveryFollowUpTask>> listFollowUpTasks(@PathVariable UUID orderId) {
        return ResponseEntity.ok(deliveryOperationsService.listFollowUpTasks(getCurrentTenantId(), orderId));
    }

    @PostMapping("/orders/{orderId}/follow-ups/{taskId}/resolve")
    public ResponseEntity<DeliveryFollowUpTask> resolveFollowUpTask(
            @PathVariable UUID orderId,
            @PathVariable UUID taskId,
            @Valid @RequestBody(required = false) DeliveryFollowUpResolutionRequest request
    ) {
        return ResponseEntity.ok(deliveryOperationsService.resolveFollowUpTask(
                getCurrentTenantId(),
                orderId,
                taskId,
                request == null ? null : request.note(),
                getCurrentUserEmail()
        ));
    }

    @PostMapping("/orders/{orderId}/retry-delivery")
    public ResponseEntity<Void> retryDelivery(@PathVariable UUID orderId) {
        deliveryOperationsService.retryDelivery(getCurrentTenantId(), orderId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/courier-performance")
    public ResponseEntity<List<CourierPerformanceResponse>> courierPerformance() {
        return ResponseEntity.ok(courierPerformanceService.listPerformance(getCurrentTenantId()).stream()
                .map(CourierPerformanceResponse::from)
                .toList());
    }

    private PageRequest pageRequest(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
        return PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"))
        );
    }

    private UUID getCurrentTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return UUID.fromString(userDetails.getTenantId());
    }

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return userDetails.getUsername();
    }
}

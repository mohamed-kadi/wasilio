package com.nexora.backend.api;

import com.nexora.backend.application.CourierPerformanceService;
import com.nexora.backend.application.DeliveryOperationsService;
import com.nexora.backend.application.DeliveryOperationsService.DeliveryFailureRecoveryResult;
import com.nexora.backend.domain.model.DeliveryFailure;
import com.nexora.backend.domain.model.DeliveryFailureRecovery;
import com.nexora.backend.domain.model.DeliveryFailureRecoveryDecision;
import com.nexora.backend.domain.model.DeliveryFailureRecoveryState;
import com.nexora.backend.domain.model.DeliveryFailureReason;
import com.nexora.backend.domain.model.DeliveryFollowUpDueFilter;
import com.nexora.backend.domain.model.DeliveryFollowUpStatus;
import com.nexora.backend.domain.model.DeliveryFollowUpTask;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.DeliveryFailureRepository;
import com.nexora.backend.domain.repository.DeliveryFailureRecoveryRepository;
import com.nexora.backend.domain.repository.DeliveryFollowUpTaskRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.infrastructure.persistence.FailedOrderRecoveryQueueQueries;
import com.nexora.backend.infrastructure.persistence.FailedOrderRecoveryQueueQueries.RecoveryQueueFilters;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.UUID;

@RestController
@RequestMapping("/api/courier-operations")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class CourierOperationsController {

    private final OrderRepository orderRepository;
    private final DeliveryFailureRepository deliveryFailureRepository;
    private final DeliveryFailureRecoveryRepository deliveryFailureRecoveryRepository;
    private final DeliveryFollowUpTaskRepository deliveryFollowUpTaskRepository;
    private final DeliveryOperationsService deliveryOperationsService;
    private final CourierPerformanceService courierPerformanceService;
    private final FailedOrderRecoveryQueueQueries failedOrderRecoveryQueueQueries;

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
            List<OrderResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static CourierOperationsQueueResponse from(Page<Order> orders) {
            return new CourierOperationsQueueResponse(
                    orders.getContent().stream()
                            .map(OrderResponse::from)
                            .toList(),
                    orders.getNumber(),
                    orders.getSize(),
                    orders.getTotalElements(),
                    orders.getTotalPages()
            );
        }
    }

    public record DeliveryFollowUpOrderSummary(
            UUID orderId,
            OrderStatus status,
            String customerFirstName,
            String customerLastName,
            String customerPhone,
            BigDecimal amount,
            String courierId,
            String failureReason
    ) {
        static DeliveryFollowUpOrderSummary from(Order order) {
            return new DeliveryFollowUpOrderSummary(
                    order.getId(),
                    order.getStatus(),
                    order.getCustomer().getFirstName(),
                    order.getCustomer().getLastName(),
                    order.getCustomer().getPhone(),
                    order.getAmount(),
                    order.getCourierId(),
                    order.getFailureReason()
            );
        }
    }

    public record DeliveryFollowUpQueueItem(
            DeliveryFollowUpTask task,
            DeliveryFollowUpOrderSummary order
    ) {}

    public record DeliveryFailureOrderSummary(
            UUID orderId,
            OrderStatus status,
            String customerFirstName,
            String customerLastName,
            String customerPhone,
            BigDecimal amount,
            String courierId,
            String failureReason
    ) {
        static DeliveryFailureOrderSummary from(Order order) {
            return new DeliveryFailureOrderSummary(
                    order.getId(),
                    order.getStatus(),
                    order.getCustomer().getFirstName(),
                    order.getCustomer().getLastName(),
                    order.getCustomer().getPhone(),
                    order.getAmount(),
                    order.getCourierId(),
                    order.getFailureReason()
            );
        }
    }

    public record DeliveryFailureDrilldownItem(
            DeliveryFailure failure,
            DeliveryFailureOrderSummary order
    ) {}

    public record DeliveryFailureDrilldownPageResponse(
            List<DeliveryFailureDrilldownItem> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static DeliveryFailureDrilldownPageResponse from(Page<DeliveryFailure> failures, List<Order> orders) {
            Map<UUID, Order> ordersById = orders.stream()
                    .collect(Collectors.toMap(Order::getId, Function.identity()));
            return new DeliveryFailureDrilldownPageResponse(
                    failures.getContent().stream()
                            .map(failure -> {
                                Order order = ordersById.get(failure.getOrderId());
                                return new DeliveryFailureDrilldownItem(
                                        failure,
                                        order == null ? null : DeliveryFailureOrderSummary.from(order)
                                );
                            })
                            .toList(),
                    failures.getNumber(),
                    failures.getSize(),
                    failures.getTotalElements(),
                    failures.getTotalPages()
            );
        }
    }

    public record DeliveryFollowUpTasksPageResponse(
            List<DeliveryFollowUpQueueItem> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static DeliveryFollowUpTasksPageResponse from(Page<DeliveryFollowUpTask> tasks, List<Order> orders) {
            Map<UUID, Order> ordersById = orders.stream()
                    .collect(Collectors.toMap(Order::getId, Function.identity()));
            return new DeliveryFollowUpTasksPageResponse(
                    tasks.getContent().stream()
                            .map(task -> {
                                Order order = ordersById.get(task.getOrderId());
                                return new DeliveryFollowUpQueueItem(
                                        task,
                                        order == null ? null : DeliveryFollowUpOrderSummary.from(order)
                                );
                            })
                            .toList(),
                    tasks.getNumber(),
                    tasks.getSize(),
                    tasks.getTotalElements(),
                    tasks.getTotalPages()
            );
        }
    }

    public record FailedOrderRecoverySummary(
            UUID orderId,
            DeliveryFailureRecovery latestRecovery,
            DeliveryFollowUpTask openFollowUp,
            DeliveryFollowUpTask latestFollowUp
    ) {}

    public record FailedOrderRecoveryQueueItem(
            OrderResponse order,
            FailedOrderRecoverySummary recovery
    ) {}

    public record FailedOrderRecoveryCounts(
            long all,
            long needsDecision,
            long openFollowUp,
            long retryReady,
            long refundReview,
            long closedUnrecoverable
    ) {
        static FailedOrderRecoveryCounts from(Map<DeliveryFailureRecoveryState, Long> counts) {
            return new FailedOrderRecoveryCounts(
                    counts.getOrDefault(DeliveryFailureRecoveryState.ALL, 0L),
                    counts.getOrDefault(DeliveryFailureRecoveryState.NEEDS_DECISION, 0L),
                    counts.getOrDefault(DeliveryFailureRecoveryState.OPEN_FOLLOW_UP, 0L),
                    counts.getOrDefault(DeliveryFailureRecoveryState.RETRY_READY, 0L),
                    counts.getOrDefault(DeliveryFailureRecoveryState.REFUND_REVIEW, 0L),
                    counts.getOrDefault(DeliveryFailureRecoveryState.CLOSED_UNRECOVERABLE, 0L)
            );
        }
    }

    public record FailedOrderRecoveryQueueResponse(
            List<FailedOrderRecoveryQueueItem> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            FailedOrderRecoveryCounts counts
    ) {}

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

    @GetMapping("/orders/recovery-summaries")
    public ResponseEntity<List<FailedOrderRecoverySummary>> listFailedOrderRecoverySummaries(
            @RequestParam(name = "orderId") List<UUID> orderIds
    ) {
        List<UUID> requestedOrderIds = orderIds.stream().distinct().toList();
        if (requestedOrderIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        if (requestedOrderIds.size() > 100) {
            throw new IllegalArgumentException("orderId can include at most 100 values");
        }

        UUID tenantId = getCurrentTenantId();
        List<Order> failedOrders = orderRepository.findByTenantIdAndIdIn(tenantId, requestedOrderIds).stream()
                .filter(order -> order.getStatus() == OrderStatus.FAILED)
                .toList();
        List<UUID> failedOrderIds = failedOrders.stream()
                .map(Order::getId)
                .toList();
        return ResponseEntity.ok(buildFailedOrderRecoverySummaries(tenantId, failedOrderIds));
    }

    @GetMapping("/orders/recovery-queue")
    public ResponseEntity<FailedOrderRecoveryQueueResponse> failedOrderRecoveryQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "ALL") DeliveryFailureRecoveryState state,
            @RequestParam(required = false) @Size(max = 50) String phone,
            @RequestParam(required = false) @Size(max = 200) String customerName,
            @RequestParam(required = false) @Size(max = 36) String orderId,
            @RequestParam(required = false) UUID courierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        validatePageParameters(page, size);
        validateRange(createdFrom, createdTo);

        UUID tenantId = getCurrentTenantId();
        var queueResult = failedOrderRecoveryQueueQueries.findQueue(
                tenantId,
                new RecoveryQueueFilters(
                        normalizeSearch(phone),
                        normalizeSearch(customerName),
                        normalizeSearch(orderId),
                        courierId == null ? null : courierId.toString(),
                        createdFrom,
                        createdTo
                ),
                state,
                page,
                size
        );

        List<UUID> orderIds = queueResult.orderIds();
        Map<UUID, Order> ordersById = orderIds.isEmpty()
                ? Map.of()
                : orderRepository.findByTenantIdAndIdIn(tenantId, orderIds).stream()
                        .collect(Collectors.toMap(Order::getId, Function.identity()));
        Map<UUID, FailedOrderRecoverySummary> summariesByOrderId = buildFailedOrderRecoverySummaries(tenantId, orderIds).stream()
                .collect(Collectors.toMap(FailedOrderRecoverySummary::orderId, Function.identity()));
        List<FailedOrderRecoveryQueueItem> content = orderIds.stream()
                .map(currentOrderId -> {
                    Order order = ordersById.get(currentOrderId);
                    FailedOrderRecoverySummary recovery = summariesByOrderId.get(currentOrderId);
                    return order == null || recovery == null ? null : new FailedOrderRecoveryQueueItem(
                            OrderResponse.from(order),
                            recovery
                    );
                })
                .filter(Objects::nonNull)
                .toList();

        return ResponseEntity.ok(new FailedOrderRecoveryQueueResponse(
                content,
                page,
                size,
                queueResult.totalElements(),
                totalPages(queueResult.totalElements(), size),
                FailedOrderRecoveryCounts.from(queueResult.counts())
        ));
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

    @GetMapping("/follow-ups")
    public ResponseEntity<DeliveryFollowUpTasksPageResponse> listFollowUpTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "OPEN") DeliveryFollowUpStatus status,
            @RequestParam(defaultValue = "ALL") DeliveryFollowUpDueFilter dueFilter
    ) {
        UUID tenantId = getCurrentTenantId();
        Page<DeliveryFollowUpTask> tasks = deliveryOperationsService.listFollowUpTasks(
                tenantId,
                status,
                dueFilter,
                followUpPageRequest(page, size)
        );
        List<UUID> orderIds = tasks.getContent().stream()
                .map(DeliveryFollowUpTask::getOrderId)
                .distinct()
                .toList();
        List<Order> orders = orderIds.isEmpty()
                ? List.of()
                : orderRepository.findByTenantIdAndIdIn(tenantId, orderIds);

        return ResponseEntity.ok(DeliveryFollowUpTasksPageResponse.from(tasks, orders));
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
    public ResponseEntity<List<CourierPerformanceResponse>> courierPerformance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        validateRange(createdFrom, createdTo);
        return ResponseEntity.ok(courierPerformanceService.listPerformance(getCurrentTenantId(), createdFrom, createdTo).stream()
                .map(CourierPerformanceResponse::from)
                .toList());
    }

    @GetMapping("/delivery-failures")
    public ResponseEntity<DeliveryFailureDrilldownPageResponse> deliveryFailures(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID courierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo
    ) {
        validateRange(createdFrom, createdTo);
        UUID tenantId = getCurrentTenantId();
        Page<DeliveryFailure> failures = deliveryFailureRepository.findFailureDrilldown(
                tenantId,
                courierId,
                createdFrom != null,
                createdFrom,
                createdTo != null,
                createdTo,
                unsortedPageRequest(page, size)
        );
        List<UUID> orderIds = failures.getContent().stream()
                .map(DeliveryFailure::getOrderId)
                .distinct()
                .toList();
        List<Order> orders = orderIds.isEmpty()
                ? List.of()
                : orderRepository.findByTenantIdAndIdIn(tenantId, orderIds);

        return ResponseEntity.ok(DeliveryFailureDrilldownPageResponse.from(failures, orders));
    }

    private PageRequest pageRequest(int page, int size) {
        validatePageParameters(page, size);
        return PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"))
        );
    }

    private PageRequest followUpPageRequest(int page, int size) {
        validatePageParameters(page, size);
        return PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "taskId"))
        );
    }

    private PageRequest unsortedPageRequest(int page, int size) {
        validatePageParameters(page, size);
        return PageRequest.of(page, size);
    }

    private void validatePageParameters(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
    }

    private void validateRange(Instant createdFrom, Instant createdTo) {
        if (createdFrom != null && createdTo != null && !createdFrom.isBefore(createdTo)) {
            throw new IllegalArgumentException("createdFrom must be before createdTo");
        }
    }

    private DeliveryFailureRecovery latestRecovery(List<DeliveryFailureRecovery> recoveries) {
        return recoveries.isEmpty() ? null : recoveries.get(recoveries.size() - 1);
    }

    private DeliveryFollowUpTask openFollowUp(List<DeliveryFollowUpTask> followUps) {
        return followUps.stream()
                .filter(followUp -> followUp.getStatus() == DeliveryFollowUpStatus.OPEN)
                .findFirst()
                .orElse(null);
    }

    private DeliveryFollowUpTask latestFollowUp(List<DeliveryFollowUpTask> followUps) {
        return followUps.isEmpty() ? null : followUps.get(followUps.size() - 1);
    }

    private List<FailedOrderRecoverySummary> buildFailedOrderRecoverySummaries(UUID tenantId, List<UUID> orderIds) {
        if (orderIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, List<DeliveryFailureRecovery>> recoveriesByOrderId = deliveryFailureRecoveryRepository
                .findByTenantIdAndOrderIdInOrderByOrderIdAscCreatedAtAsc(tenantId, orderIds)
                .stream()
                .collect(Collectors.groupingBy(DeliveryFailureRecovery::getOrderId));
        Map<UUID, List<DeliveryFollowUpTask>> followUpsByOrderId = deliveryFollowUpTaskRepository
                .findByTenantIdAndOrderIdInOrderByOrderIdAscCreatedAtAsc(tenantId, orderIds)
                .stream()
                .collect(Collectors.groupingBy(DeliveryFollowUpTask::getOrderId));

        return orderIds.stream()
                .map(orderId -> {
                    List<DeliveryFailureRecovery> recoveries = recoveriesByOrderId.getOrDefault(orderId, List.of());
                    List<DeliveryFollowUpTask> followUps = followUpsByOrderId.getOrDefault(orderId, List.of());
                    return new FailedOrderRecoverySummary(
                            orderId,
                            latestRecovery(recoveries),
                            openFollowUp(followUps),
                            latestFollowUp(followUps)
                    );
                })
                .toList();
    }

    private String normalizeSearch(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private int totalPages(long totalElements, int size) {
        return totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
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

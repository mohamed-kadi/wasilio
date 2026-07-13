package com.nexora.backend.api;

import com.nexora.backend.application.ConfirmationWorkflowService;
import com.nexora.backend.application.OrderIntelligenceScoringService;
import com.nexora.backend.domain.model.ConfirmationAttempt;
import com.nexora.backend.domain.model.ConfirmationCallbackScope;
import com.nexora.backend.domain.model.ConfirmationOutcome;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class ConfirmationController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_SEARCH_LENGTH = 100;

    private final ConfirmationWorkflowService confirmationWorkflowService;
    private final OrderIntelligenceScoringService orderIntelligenceScoringService;

    public record ConfirmationQueueResponse(
            List<OrderResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static ConfirmationQueueResponse from(
                Page<Order> orders,
                Map<UUID, OrderIntelligenceScoringService.OrderIntelligenceResult> intelligence
        ) {
            return new ConfirmationQueueResponse(
                    orders.getContent().stream()
                            .map(order -> OrderResponse.from(
                                    order,
                                    OrderIntelligenceResponse.from(intelligence.get(order.getId()), 3)
                            ))
                            .toList(),
                    orders.getNumber(),
                    orders.getSize(),
                    orders.getTotalElements(),
                    orders.getTotalPages()
            );
        }
    }

    public record RecordConfirmationAttemptRequest(
            @NotNull ConfirmationOutcome outcome,
            @Size(max = 1000) String note,
            Instant callbackAt
    ) {}

    public record ConfirmationAttemptResponse(
            UUID attemptId,
            UUID tenantId,
            UUID orderId,
            int attemptNumber,
            ConfirmationOutcome outcome,
            String note,
            String createdBy,
            Instant createdAt,
            Instant callbackAt,
            Instant callbackResolvedAt,
            String callbackResolvedBy
    ) {
        static ConfirmationAttemptResponse from(ConfirmationAttempt attempt) {
            return new ConfirmationAttemptResponse(
                    attempt.getAttemptId(),
                    attempt.getTenantId(),
                    attempt.getOrderId(),
                    attempt.getAttemptNumber(),
                    attempt.getOutcome(),
                    attempt.getNote(),
                    attempt.getCreatedBy(),
                    attempt.getCreatedAt(),
                    attempt.getCallbackAt(),
                    attempt.getCallbackResolvedAt(),
                    attempt.getCallbackResolvedBy()
            );
        }
    }

    public record ConfirmationCallbacksPageResponse(
            List<ConfirmationCallbackResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static ConfirmationCallbacksPageResponse from(
                Page<ConfirmationWorkflowService.ConfirmationCallbackItem> callbacks,
                ConfirmationWorkflowService confirmationWorkflowService
        ) {
            return new ConfirmationCallbacksPageResponse(
                    callbacks.getContent().stream()
                            .map(item -> ConfirmationCallbackResponse.from(item, confirmationWorkflowService))
                            .toList(),
                    callbacks.getNumber(),
                    callbacks.getSize(),
                    callbacks.getTotalElements(),
                    callbacks.getTotalPages()
            );
        }
    }

    public record ConfirmationCallbackResponse(
            UUID callbackId,
            UUID tenantId,
            UUID orderId,
            int attemptNumber,
            Instant callbackAt,
            ConfirmationWorkflowService.ConfirmationCallbackStatus status,
            String note,
            String createdBy,
            Instant createdAt,
            OrderResponse order
    ) {
        static ConfirmationCallbackResponse from(
                ConfirmationWorkflowService.ConfirmationCallbackItem item,
                ConfirmationWorkflowService confirmationWorkflowService
        ) {
            ConfirmationAttempt callback = item.callback();
            return new ConfirmationCallbackResponse(
                    callback.getAttemptId(),
                    callback.getTenantId(),
                    callback.getOrderId(),
                    callback.getAttemptNumber(),
                    callback.getCallbackAt(),
                    confirmationWorkflowService.callbackStatus(callback),
                    callback.getNote(),
                    callback.getCreatedBy(),
                    callback.getCreatedAt(),
                    OrderResponse.from(item.order())
            );
        }
    }

    @GetMapping("/confirmations/queue")
    public ResponseEntity<ConfirmationQueueResponse> listConfirmationQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
            @RequestParam(required = false) String search
    ) {
        validatePage(page, size);
        validateDateRange(createdFrom, createdTo);
        validateSearch(search);

        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"))
        );

        UUID tenantId = getCurrentTenantId();
        Page<Order> orders = confirmationWorkflowService.listQueue(
                tenantId,
                status,
                toStartOfDay(createdFrom),
                toExclusiveEndOfDay(createdTo),
                search,
                pageRequest
        );
        Map<UUID, OrderIntelligenceScoringService.OrderIntelligenceResult> intelligence =
                orderIntelligenceScoringService.getOrCalculate(tenantId, orders.getContent());
        return ResponseEntity.ok(ConfirmationQueueResponse.from(orders, intelligence));
    }

    @PostMapping("/orders/{orderId}/confirmation-attempts")
    public ResponseEntity<ConfirmationAttemptResponse> recordConfirmationAttempt(
            @PathVariable UUID orderId,
            @Valid @RequestBody RecordConfirmationAttemptRequest request
    ) {
        ConfirmationAttempt attempt = confirmationWorkflowService.recordAttempt(
                getCurrentTenantId(),
                orderId,
                request.outcome(),
                request.note(),
                request.callbackAt(),
                getCurrentUsername()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ConfirmationAttemptResponse.from(attempt));
    }

    @GetMapping("/orders/{orderId}/confirmation-attempts")
    public ResponseEntity<List<ConfirmationAttemptResponse>> listConfirmationAttempts(@PathVariable UUID orderId) {
        List<ConfirmationAttemptResponse> attempts = confirmationWorkflowService.listAttempts(getCurrentTenantId(), orderId)
                .stream()
                .map(ConfirmationAttemptResponse::from)
                .toList();
        return ResponseEntity.ok(attempts);
    }

    @GetMapping("/confirmations/callbacks")
    public ResponseEntity<ConfirmationCallbacksPageResponse> listConfirmationCallbacks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "DUE") ConfirmationCallbackScope scope,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate callbackFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate callbackTo
    ) {
        validatePage(page, size);
        validateDateRange(callbackFrom, callbackTo);

        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.ASC, "callbackAt").and(Sort.by(Sort.Direction.ASC, "attemptId"))
        );

        Page<ConfirmationWorkflowService.ConfirmationCallbackItem> callbacks = confirmationWorkflowService.listCallbacks(
                getCurrentTenantId(),
                scope,
                toStartOfDay(callbackFrom),
                toExclusiveEndOfDay(callbackTo),
                pageRequest
        );

        return ResponseEntity.ok(ConfirmationCallbacksPageResponse.from(callbacks, confirmationWorkflowService));
    }

    @PostMapping("/confirmations/callbacks/{callbackId}/resolve")
    public ResponseEntity<ConfirmationAttemptResponse> resolveConfirmationCallback(@PathVariable UUID callbackId) {
        ConfirmationAttempt callback = confirmationWorkflowService.resolveCallback(
                getCurrentTenantId(),
                callbackId,
                getCurrentUsername()
        );
        return ResponseEntity.ok(ConfirmationAttemptResponse.from(callback));
    }

    private UUID getCurrentTenantId() {
        return UUID.fromString(getCurrentUserDetails().getTenantId());
    }

    private String getCurrentUsername() {
        return getCurrentUserDetails().getUsername();
    }

    private CustomUserDetails getCurrentUserDetails() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return userDetails;
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
    }

    private void validateDateRange(LocalDate createdFrom, LocalDate createdTo) {
        if (createdFrom != null && createdTo != null && createdTo.isBefore(createdFrom)) {
            throw new IllegalArgumentException("createdTo must be on or after createdFrom");
        }
    }

    private void validateSearch(String search) {
        if (search != null && search.trim().length() > MAX_SEARCH_LENGTH) {
            throw new IllegalArgumentException("search must be at most " + MAX_SEARCH_LENGTH + " characters");
        }
    }

    private Instant toStartOfDay(LocalDate date) {
        return date == null ? null : date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private Instant toExclusiveEndOfDay(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }
}

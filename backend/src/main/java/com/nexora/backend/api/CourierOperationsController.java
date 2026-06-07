package com.nexora.backend.api;

import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
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
import org.springframework.web.bind.annotation.RequestMapping;
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
                createdFrom,
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
                createdFrom,
                createdTo,
                pageRequest(page, size)
        )));
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
}

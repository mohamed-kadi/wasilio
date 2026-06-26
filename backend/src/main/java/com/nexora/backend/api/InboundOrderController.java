package com.nexora.backend.api;

import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.repository.InboundOrderRepository;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/inbound-orders")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class InboundOrderController {

    private final InboundOrderRepository inboundOrderRepository;

    public record InboundOrdersPageResponse(
            List<InboundOrderSummaryResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static InboundOrdersPageResponse from(Page<InboundOrder> inboundOrders) {
            return new InboundOrdersPageResponse(
                    inboundOrders.getContent().stream()
                            .map(InboundOrderSummaryResponse::from)
                            .toList(),
                    inboundOrders.getNumber(),
                    inboundOrders.getSize(),
                    inboundOrders.getTotalElements(),
                    inboundOrders.getTotalPages()
            );
        }
    }

    public record InboundOrderSummaryResponse(
            UUID inboundOrderId,
            OrderSource source,
            String externalOrderId,
            String idempotencyKey,
            InboundOrderStatus status,
            Instant receivedAt,
            UUID normalizedOrderId,
            String rejectionReason
    ) {
        static InboundOrderSummaryResponse from(InboundOrder inboundOrder) {
            return new InboundOrderSummaryResponse(
                    inboundOrder.getInboundOrderId(),
                    inboundOrder.getSource(),
                    inboundOrder.getExternalOrderId(),
                    inboundOrder.getIdempotencyKey(),
                    inboundOrder.getStatus(),
                    inboundOrder.getReceivedAt(),
                    inboundOrder.getNormalizedOrderId(),
                    inboundOrder.getStatus() == InboundOrderStatus.REJECTED ? inboundOrder.getRejectionReason() : null
            );
        }
    }

    public record InboundOrderDetailResponse(
            UUID inboundOrderId,
            OrderSource source,
            String externalOrderId,
            String idempotencyKey,
            InboundOrderStatus status,
            Instant receivedAt,
            UUID normalizedOrderId,
            Instant normalizedAt,
            String rejectionReason,
            String rawPayload
    ) {
        static InboundOrderDetailResponse from(InboundOrder inboundOrder) {
            return new InboundOrderDetailResponse(
                    inboundOrder.getInboundOrderId(),
                    inboundOrder.getSource(),
                    inboundOrder.getExternalOrderId(),
                    inboundOrder.getIdempotencyKey(),
                    inboundOrder.getStatus(),
                    inboundOrder.getReceivedAt(),
                    inboundOrder.getNormalizedOrderId(),
                    inboundOrder.getNormalizedAt(),
                    inboundOrder.getStatus() == InboundOrderStatus.REJECTED ? inboundOrder.getRejectionReason() : null,
                    inboundOrder.getRawPayload()
            );
        }
    }

    @GetMapping
    public ResponseEntity<InboundOrdersPageResponse> listInboundOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OrderSource source,
            @RequestParam(required = false) InboundOrderStatus status,
            @RequestParam(required = false) String search
    ) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }

        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("receivedAt"), Sort.Order.asc("inboundOrderId"))
        );
        Page<InboundOrder> inboundOrders = inboundOrderRepository.searchInboundOrders(
                getCurrentTenantId(),
                source,
                status,
                normalizeSearch(search),
                pageRequest
        );
        return ResponseEntity.ok(InboundOrdersPageResponse.from(inboundOrders));
    }

    @GetMapping("/{inboundOrderId}")
    public ResponseEntity<InboundOrderDetailResponse> getInboundOrder(@PathVariable UUID inboundOrderId) {
        InboundOrder inboundOrder = inboundOrderRepository.findByInboundOrderIdAndTenantId(inboundOrderId, getCurrentTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Inbound order not found"));
        return ResponseEntity.ok(InboundOrderDetailResponse.from(inboundOrder));
    }

    private UUID getCurrentTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return UUID.fromString(userDetails.getTenantId());
    }

    private String normalizeSearch(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        return search.trim();
    }
}

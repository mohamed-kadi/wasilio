package com.nexora.backend.api;

import com.nexora.backend.application.OrderIntelligenceReportService;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/intelligence")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class OrderIntelligenceReportController {

    private final OrderIntelligenceReportService reportService;

    @GetMapping("/report")
    public ResponseEntity<OrderIntelligenceReportService.OrderIntelligenceReport> report(
            @RequestParam(defaultValue = "12") int movementLimit,
            @RequestParam(defaultValue = "8") int signalLimit,
            @RequestParam(defaultValue = "8") int watchlistLimit
    ) {
        return ResponseEntity.ok(reportService.getReport(
                getCurrentTenantId(),
                movementLimit,
                signalLimit,
                watchlistLimit
        ));
    }

    private UUID getCurrentTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return UUID.fromString(userDetails.getTenantId());
    }
}

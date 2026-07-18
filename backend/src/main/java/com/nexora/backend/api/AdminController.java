package com.nexora.backend.api;

import com.nexora.backend.application.AdminBillingService;
import com.nexora.backend.domain.model.PaymentMethod;
import com.nexora.backend.domain.model.SubscriptionPlan;
import com.nexora.backend.domain.model.SubscriptionStatus;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.TenantPayment;
import com.nexora.backend.domain.model.TenantStatus;
import com.nexora.backend.domain.model.TenantSubscription;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminBillingService adminBillingService;

    public record TenantSummaryResponse(
            UUID tenantId,
            String name,
            TenantStatus status,
            Instant createdAt,
            Instant updatedAt,
            long usersCount,
            long ordersCount,
            SubscriptionResponse subscription,
            SubscriptionPlanResponse plan
    ) {
        static TenantSummaryResponse from(AdminBillingService.TenantSummary summary) {
            Tenant tenant = summary.tenant();
            return new TenantSummaryResponse(
                    tenant.getId(),
                    tenant.getName(),
                    tenant.getStatus(),
                    tenant.getCreatedAt(),
                    tenant.getUpdatedAt(),
                    summary.usersCount(),
                    summary.ordersCount(),
                    SubscriptionResponse.from(summary.subscription()),
                    SubscriptionPlanResponse.from(summary.plan())
            );
        }
    }

    public record TenantDetailResponse(
            UUID tenantId,
            String name,
            TenantStatus status,
            Instant createdAt,
            Instant updatedAt,
            long usersCount,
            long ordersCount,
            SubscriptionResponse subscription,
            SubscriptionPlanResponse plan,
            List<PaymentResponse> payments
    ) {
        static TenantDetailResponse from(AdminBillingService.TenantDetail detail) {
            Tenant tenant = detail.tenant();
            return new TenantDetailResponse(
                    tenant.getId(),
                    tenant.getName(),
                    tenant.getStatus(),
                    tenant.getCreatedAt(),
                    tenant.getUpdatedAt(),
                    detail.usersCount(),
                    detail.ordersCount(),
                    SubscriptionResponse.from(detail.subscription()),
                    SubscriptionPlanResponse.from(detail.plan()),
                    detail.payments().stream().map(PaymentResponse::from).toList()
            );
        }
    }

    public record SubscriptionPlanResponse(
            UUID planId,
            String code,
            String name,
            BigDecimal monthlyPrice,
            String currency,
            Integer orderLimit,
            Integer userLimit,
            boolean active,
            Instant createdAt,
            Instant updatedAt
    ) {
        static SubscriptionPlanResponse from(SubscriptionPlan plan) {
            if (plan == null) {
                return null;
            }
            return new SubscriptionPlanResponse(
                    plan.getPlanId(),
                    plan.getCode(),
                    plan.getName(),
                    plan.getMonthlyPrice(),
                    plan.getCurrency(),
                    plan.getOrderLimit(),
                    plan.getUserLimit(),
                    plan.isActive(),
                    plan.getCreatedAt(),
                    plan.getUpdatedAt()
            );
        }
    }

    public record SubscriptionResponse(
            UUID subscriptionId,
            UUID tenantId,
            UUID planId,
            SubscriptionStatus status,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            Instant trialEndsAt,
            Instant createdAt,
            Instant updatedAt
    ) {
        static SubscriptionResponse from(TenantSubscription subscription) {
            if (subscription == null) {
                return null;
            }
            return new SubscriptionResponse(
                    subscription.getSubscriptionId(),
                    subscription.getTenantId(),
                    subscription.getPlanId(),
                    subscription.getStatus(),
                    subscription.getCurrentPeriodStart(),
                    subscription.getCurrentPeriodEnd(),
                    subscription.getTrialEndsAt(),
                    subscription.getCreatedAt(),
                    subscription.getUpdatedAt()
            );
        }
    }

    public record PaymentResponse(
            UUID paymentId,
            UUID tenantId,
            UUID subscriptionId,
            String receiptNumber,
            PaymentMethod method,
            BigDecimal amount,
            String currency,
            Instant paidAt,
            Instant periodStart,
            Instant periodEnd,
            String collectedBy,
            String notes,
            Instant createdAt
    ) {
        static PaymentResponse from(TenantPayment payment) {
            return new PaymentResponse(
                    payment.getPaymentId(),
                    payment.getTenantId(),
                    payment.getSubscriptionId(),
                    payment.getReceiptNumber(),
                    payment.getMethod(),
                    payment.getAmount(),
                    payment.getCurrency(),
                    payment.getPaidAt(),
                    payment.getPeriodStart(),
                    payment.getPeriodEnd(),
                    payment.getCollectedBy(),
                    payment.getNotes(),
                    payment.getCreatedAt()
            );
        }
    }

    public record PaymentRecordsSummaryResponse(
            int paymentCount,
            Instant paidFrom,
            Instant paidTo,
            List<PaymentTotalResponse> totals,
            List<MonthlyPaymentTotalResponse> monthlyTotals
    ) {
        static PaymentRecordsSummaryResponse from(AdminBillingService.PaymentRecordsSummary summary) {
            return new PaymentRecordsSummaryResponse(
                    summary.paymentCount(),
                    summary.paidFrom(),
                    summary.paidTo(),
                    summary.totals().stream().map(PaymentTotalResponse::from).toList(),
                    summary.monthlyTotals().stream().map(MonthlyPaymentTotalResponse::from).toList()
            );
        }
    }

    public record PaymentTotalResponse(
            String currency,
            BigDecimal amount,
            long paymentCount
    ) {
        static PaymentTotalResponse from(AdminBillingService.PaymentTotal total) {
            return new PaymentTotalResponse(total.currency(), total.amount(), total.paymentCount());
        }
    }

    public record MonthlyPaymentTotalResponse(
            String month,
            String currency,
            BigDecimal amount,
            long paymentCount
    ) {
        static MonthlyPaymentTotalResponse from(AdminBillingService.MonthlyPaymentTotal total) {
            return new MonthlyPaymentTotalResponse(
                    total.month(),
                    total.currency(),
                    total.amount(),
                    total.paymentCount()
            );
        }
    }

    public record ReceiptResponse(
            UUID paymentId,
            UUID tenantId,
            String tenantName,
            TenantStatus tenantStatus,
            UUID subscriptionId,
            SubscriptionStatus subscriptionStatus,
            SubscriptionPlanResponse plan,
            String receiptNumber,
            PaymentMethod method,
            BigDecimal amount,
            String currency,
            Instant paidAt,
            Instant periodStart,
            Instant periodEnd,
            String collectedBy,
            String notes,
            Instant createdAt
    ) {
        static ReceiptResponse from(AdminBillingService.ReceiptDetail detail) {
            Tenant tenant = detail.tenant();
            TenantPayment payment = detail.payment();
            TenantSubscription subscription = detail.subscription();
            return new ReceiptResponse(
                    payment.getPaymentId(),
                    payment.getTenantId(),
                    tenant.getName(),
                    tenant.getStatus(),
                    payment.getSubscriptionId(),
                    subscription == null ? null : subscription.getStatus(),
                    SubscriptionPlanResponse.from(detail.plan()),
                    payment.getReceiptNumber(),
                    payment.getMethod(),
                    payment.getAmount(),
                    payment.getCurrency(),
                    payment.getPaidAt(),
                    payment.getPeriodStart(),
                    payment.getPeriodEnd(),
                    payment.getCollectedBy(),
                    payment.getNotes(),
                    payment.getCreatedAt()
            );
        }
    }

    public record UpdateTenantStatusRequest(@NotNull TenantStatus status) {}

    public record CreatePlanRequest(
            @NotBlank @Size(max = 50) String code,
            @NotBlank @Size(max = 120) String name,
            @NotNull @Positive BigDecimal monthlyPrice,
            @NotBlank @Size(min = 3, max = 3) String currency,
            Integer orderLimit,
            Integer userLimit
    ) {}

    public record UpsertSubscriptionRequest(
            @NotNull UUID planId,
            @NotNull SubscriptionStatus status,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            Instant trialEndsAt
    ) {}

    public record RecordPaymentRequest(
            @NotNull PaymentMethod method,
            @NotNull @Positive BigDecimal amount,
            @NotBlank @Size(min = 3, max = 3) String currency,
            Instant paidAt,
            Instant periodStart,
            Instant periodEnd,
            @Size(max = 1000) String notes
    ) {}

    @GetMapping("/tenants")
    public ResponseEntity<List<TenantSummaryResponse>> listTenants() {
        return ResponseEntity.ok(adminBillingService.listTenants().stream()
                .map(TenantSummaryResponse::from)
                .toList());
    }

    @GetMapping("/tenants/{tenantId}")
    public ResponseEntity<TenantDetailResponse> getTenant(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(TenantDetailResponse.from(adminBillingService.getTenant(tenantId)));
    }

    @PatchMapping("/tenants/{tenantId}/status")
    public ResponseEntity<TenantDetailResponse> updateTenantStatus(
            @PathVariable UUID tenantId,
            @Valid @RequestBody UpdateTenantStatusRequest request
    ) {
        return ResponseEntity.ok(TenantDetailResponse.from(
                adminBillingService.updateTenantStatus(tenantId, request.status())
        ));
    }

    @GetMapping("/plans")
    public ResponseEntity<List<SubscriptionPlanResponse>> listPlans() {
        return ResponseEntity.ok(adminBillingService.listPlans().stream()
                .map(SubscriptionPlanResponse::from)
                .toList());
    }

    @GetMapping("/payments/summary")
    public ResponseEntity<PaymentRecordsSummaryResponse> summarizePayments(
            @RequestParam(required = false) Instant paidFrom,
            @RequestParam(required = false) Instant paidTo
    ) {
        return ResponseEntity.ok(PaymentRecordsSummaryResponse.from(
                adminBillingService.summarizePaymentRecords(paidFrom, paidTo)
        ));
    }

    @GetMapping(value = "/payments/export", produces = "text/csv")
    public ResponseEntity<String> exportPayments(
            @RequestParam(required = false) Instant paidFrom,
            @RequestParam(required = false) Instant paidTo
    ) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"wasilio-payment-records.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(adminBillingService.exportPaymentRecordsCsv(paidFrom, paidTo));
    }

    @PostMapping("/plans")
    public ResponseEntity<SubscriptionPlanResponse> createPlan(@Valid @RequestBody CreatePlanRequest request) {
        return ResponseEntity.ok(SubscriptionPlanResponse.from(adminBillingService.createPlan(
                new AdminBillingService.CreatePlanCommand(
                        request.code(),
                        request.name(),
                        request.monthlyPrice(),
                        request.currency(),
                        request.orderLimit(),
                        request.userLimit()
                )
        )));
    }

    @PostMapping("/tenants/{tenantId}/subscription")
    public ResponseEntity<TenantDetailResponse> upsertSubscription(
            @PathVariable UUID tenantId,
            @Valid @RequestBody UpsertSubscriptionRequest request
    ) {
        return ResponseEntity.ok(TenantDetailResponse.from(adminBillingService.upsertSubscription(
                tenantId,
                new AdminBillingService.UpsertSubscriptionCommand(
                        request.planId(),
                        request.status(),
                        request.currentPeriodStart(),
                        request.currentPeriodEnd(),
                        request.trialEndsAt()
                )
        )));
    }

    @PostMapping("/tenants/{tenantId}/payments")
    public ResponseEntity<PaymentResponse> recordPayment(
            @PathVariable UUID tenantId,
            @Valid @RequestBody RecordPaymentRequest request
    ) {
        return ResponseEntity.ok(PaymentResponse.from(adminBillingService.recordPayment(
                tenantId,
                new AdminBillingService.RecordPaymentCommand(
                        request.method(),
                        request.amount(),
                        request.currency(),
                        request.paidAt(),
                        request.periodStart(),
                        request.periodEnd(),
                        request.notes()
                ),
                getCurrentUserDisplayName()
        )));
    }

    @GetMapping("/tenants/{tenantId}/payments/{paymentId}/receipt")
    public ResponseEntity<ReceiptResponse> getReceipt(
            @PathVariable UUID tenantId,
            @PathVariable UUID paymentId
    ) {
        return ResponseEntity.ok(ReceiptResponse.from(adminBillingService.getReceiptDetail(tenantId, paymentId)));
    }

    private String getCurrentUserDisplayName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return userDetails.getDisplayName();
    }
}

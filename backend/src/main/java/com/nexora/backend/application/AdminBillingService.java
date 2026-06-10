package com.nexora.backend.application;

import com.nexora.backend.domain.model.PaymentMethod;
import com.nexora.backend.domain.model.SubscriptionPlan;
import com.nexora.backend.domain.model.SubscriptionStatus;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.TenantPayment;
import com.nexora.backend.domain.model.TenantStatus;
import com.nexora.backend.domain.model.TenantSubscription;
import com.nexora.backend.domain.repository.OrderRepository;
import com.nexora.backend.domain.repository.SubscriptionPlanRepository;
import com.nexora.backend.domain.repository.TenantPaymentRepository;
import com.nexora.backend.domain.repository.TenantRepository;
import com.nexora.backend.domain.repository.TenantSubscriptionRepository;
import com.nexora.backend.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminBillingService {

    private static final DateTimeFormatter RECEIPT_DATE = DateTimeFormatter.ofPattern("yyyyMMdd")
            .withZone(ZoneOffset.UTC);

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final SubscriptionPlanRepository planRepository;
    private final TenantSubscriptionRepository subscriptionRepository;
    private final TenantPaymentRepository paymentRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<TenantSummary> listTenants() {
        return tenantRepository.findAll().stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public TenantDetail getTenant(UUID tenantId) {
        Tenant tenant = getTenantOrThrow(tenantId);
        return toDetail(tenant);
    }

    @Transactional
    public TenantDetail updateTenantStatus(UUID tenantId, TenantStatus status) {
        Tenant tenant = getTenantOrThrow(tenantId);
        tenant.setStatus(status);
        tenant.setUpdatedAt(Instant.now(clock));
        return toDetail(tenantRepository.save(tenant));
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlan> listPlans() {
        return planRepository.findAllByOrderByMonthlyPriceAsc();
    }

    @Transactional
    public SubscriptionPlan createPlan(CreatePlanCommand command) {
        validateCurrency(command.currency());
        String code = normalizeCode(command.code());
        if (planRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw new ResourceConflictException("Plan code already exists");
        }
        Instant now = Instant.now(clock);
        SubscriptionPlan plan = new SubscriptionPlan(
                UUID.randomUUID(),
                code,
                command.name().trim(),
                command.monthlyPrice(),
                command.currency().trim().toUpperCase(Locale.ROOT),
                command.orderLimit(),
                command.userLimit(),
                true,
                now,
                now
        );
        return planRepository.save(plan);
    }

    @Transactional
    public TenantDetail upsertSubscription(UUID tenantId, UpsertSubscriptionCommand command) {
        getTenantOrThrow(tenantId);
        SubscriptionPlan plan = planRepository.findById(command.planId())
                .orElseThrow(() -> new IllegalArgumentException("planId does not exist"));
        if (!plan.isActive()) {
            throw new IllegalArgumentException("plan is inactive");
        }

        Instant now = Instant.now(clock);
        TenantSubscription subscription = subscriptionRepository.findByTenantId(tenantId)
                .orElseGet(() -> new TenantSubscription(
                        UUID.randomUUID(),
                        tenantId,
                        command.planId(),
                        command.status(),
                        null,
                        null,
                        null,
                        now,
                        now
                ));
        subscription.setPlanId(command.planId());
        subscription.setStatus(command.status());
        subscription.setCurrentPeriodStart(command.currentPeriodStart());
        subscription.setCurrentPeriodEnd(command.currentPeriodEnd());
        subscription.setTrialEndsAt(command.trialEndsAt());
        subscription.setUpdatedAt(now);
        subscriptionRepository.save(subscription);
        return getTenant(tenantId);
    }

    @Transactional
    public TenantPayment recordPayment(UUID tenantId, RecordPaymentCommand command, String collectedBy) {
        getTenantOrThrow(tenantId);
        validateCurrency(command.currency());
        if (command.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        if (command.periodStart() != null && command.periodEnd() != null
                && !command.periodStart().isBefore(command.periodEnd())) {
            throw new IllegalArgumentException("periodStart must be before periodEnd");
        }

        Instant now = Instant.now(clock);
        Optional<TenantSubscription> subscription = subscriptionRepository.findByTenantId(tenantId);
        TenantPayment payment = new TenantPayment(
                UUID.randomUUID(),
                tenantId,
                subscription.map(TenantSubscription::getSubscriptionId).orElse(null),
                receiptNumber(now),
                command.method(),
                command.amount(),
                command.currency().trim().toUpperCase(Locale.ROOT),
                command.paidAt() == null ? now : command.paidAt(),
                command.periodStart(),
                command.periodEnd(),
                collectedBy,
                command.notes(),
                now
        );

        subscription.ifPresent(existing -> {
            if (existing.getStatus() == SubscriptionStatus.TRIALING
                    || existing.getStatus() == SubscriptionStatus.OVERDUE
                    || existing.getStatus() == SubscriptionStatus.SUSPENDED) {
                existing.setStatus(SubscriptionStatus.ACTIVE);
                existing.setUpdatedAt(now);
                subscriptionRepository.save(existing);
            }
        });

        return paymentRepository.save(payment);
    }

    @Transactional(readOnly = true)
    public TenantPayment getReceipt(UUID tenantId, UUID paymentId) {
        return paymentRepository.findByPaymentIdAndTenantId(paymentId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("paymentId does not exist for tenant"));
    }

    @Transactional(readOnly = true)
    public ReceiptDetail getReceiptDetail(UUID tenantId, UUID paymentId) {
        Tenant tenant = getTenantOrThrow(tenantId);
        TenantPayment payment = getReceipt(tenantId, paymentId);
        TenantSubscription subscription = payment.getSubscriptionId() == null
                ? subscriptionRepository.findByTenantId(tenantId).orElse(null)
                : subscriptionRepository.findById(payment.getSubscriptionId()).orElse(null);
        SubscriptionPlan plan = subscription == null ? null : planRepository.findById(subscription.getPlanId()).orElse(null);
        return new ReceiptDetail(tenant, payment, subscription, plan);
    }

    private TenantSummary toSummary(Tenant tenant) {
        Optional<TenantSubscription> subscription = subscriptionRepository.findByTenantId(tenant.getId());
        Optional<SubscriptionPlan> plan = subscription.flatMap(value -> planRepository.findById(value.getPlanId()));
        return new TenantSummary(
                tenant,
                subscription.orElse(null),
                plan.orElse(null),
                userRepository.countByTenantId(tenant.getId()),
                orderRepository.countByTenantId(tenant.getId())
        );
    }

    private TenantDetail toDetail(Tenant tenant) {
        Optional<TenantSubscription> subscription = subscriptionRepository.findByTenantId(tenant.getId());
        Optional<SubscriptionPlan> plan = subscription.flatMap(value -> planRepository.findById(value.getPlanId()));
        return new TenantDetail(
                tenant,
                subscription.orElse(null),
                plan.orElse(null),
                paymentRepository.findByTenantIdOrderByPaidAtDesc(tenant.getId()),
                userRepository.countByTenantId(tenant.getId()),
                orderRepository.countByTenantId(tenant.getId())
        );
    }

    private Tenant getTenantOrThrow(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("tenantId does not exist"));
    }

    private String receiptNumber(Instant timestamp) {
        return "R-" + RECEIPT_DATE.format(timestamp) + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code is required");
        }
        return code.trim().toLowerCase(Locale.ROOT);
    }

    private void validateCurrency(String currency) {
        if (currency == null || !currency.trim().matches("[A-Za-z]{3}")) {
            throw new IllegalArgumentException("currency must be a 3-letter code");
        }
    }

    public record TenantSummary(
            Tenant tenant,
            TenantSubscription subscription,
            SubscriptionPlan plan,
            long usersCount,
            long ordersCount
    ) {}

    public record TenantDetail(
            Tenant tenant,
            TenantSubscription subscription,
            SubscriptionPlan plan,
            List<TenantPayment> payments,
            long usersCount,
            long ordersCount
    ) {}

    public record ReceiptDetail(
            Tenant tenant,
            TenantPayment payment,
            TenantSubscription subscription,
            SubscriptionPlan plan
    ) {}

    public record CreatePlanCommand(
            String code,
            String name,
            BigDecimal monthlyPrice,
            String currency,
            Integer orderLimit,
            Integer userLimit
    ) {}

    public record UpsertSubscriptionCommand(
            UUID planId,
            SubscriptionStatus status,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            Instant trialEndsAt
    ) {}

    public record RecordPaymentCommand(
            PaymentMethod method,
            BigDecimal amount,
            String currency,
            Instant paidAt,
            Instant periodStart,
            Instant periodEnd,
            String notes
    ) {}
}

package com.nexora.backend.infrastructure.persistence;

import com.nexora.backend.domain.model.DeliveryFailureRecoveryState;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class FailedOrderRecoveryQueueQueries {

    private static final String LATEST_RECOVERY_CTE = """
            with latest_recoveries as (
                select tenant_id, order_id, decision
                from (
                    select
                        recovery.tenant_id,
                        recovery.order_id,
                        recovery.decision,
                        row_number() over (
                            partition by recovery.tenant_id, recovery.order_id
                            order by recovery.created_at desc
                        ) as recovery_rank
                    from delivery_failure_recoveries recovery
                ) ranked_recoveries
                where recovery_rank = 1
            )
            """;

    private static final String STATE_EXPRESSION = """
            case
                when exists (
                    select 1
                    from delivery_follow_up_tasks follow_up
                    where follow_up.tenant_id = orders_projection.tenant_id
                      and follow_up.order_id = orders_projection.id
                      and follow_up.status = 'OPEN'
                ) then 'OPEN_FOLLOW_UP'
                when latest_recovery.decision is null then 'NEEDS_DECISION'
                when latest_recovery.decision = 'RETRY_DELIVERY' then 'RETRY_READY'
                when latest_recovery.decision = 'CLOSE_UNRECOVERABLE' then 'CLOSED_UNRECOVERABLE'
                else 'REFUND_REVIEW'
            end
            """;

    private static final String BASE_FROM = """
            from orders orders_projection
            left join latest_recoveries latest_recovery
              on latest_recovery.tenant_id = orders_projection.tenant_id
             and latest_recovery.order_id = orders_projection.id
            where orders_projection.tenant_id = :tenantId
              and orders_projection.status = 'FAILED'
              and (:phone is null or lower(orders_projection.phone) like lower(concat('%', :phone, '%')))
              and (
                    :customerName is null
                    or lower(orders_projection.first_name) like lower(concat('%', :customerName, '%'))
                    or lower(orders_projection.last_name) like lower(concat('%', :customerName, '%'))
                    or lower(concat(coalesce(orders_projection.first_name, ''), ' ', coalesce(orders_projection.last_name, ''))) like lower(concat('%', :customerName, '%'))
              )
              and (:orderIdSearch is null or lower(cast(orders_projection.id as varchar)) like lower(concat('%', :orderIdSearch, '%')))
              and (:courierId is null or orders_projection.courier_id = :courierId)
              and (:createdFromEnabled = false or orders_projection.created_at >= :createdFrom)
              and (:createdToExclusiveEnabled = false or orders_projection.created_at < :createdToExclusive)
            """;

    private final EntityManager entityManager;

    public record RecoveryQueueFilters(
            String phone,
            String customerName,
            String orderIdSearch,
            String courierId,
            Instant createdFrom,
            Instant createdToExclusive
    ) {}

    public record RecoveryQueueResult(
            List<UUID> orderIds,
            long totalElements,
            Map<DeliveryFailureRecoveryState, Long> counts
    ) {}

    public RecoveryQueueResult findQueue(
            UUID tenantId,
            RecoveryQueueFilters filters,
            DeliveryFailureRecoveryState state,
            int page,
            int size
    ) {
        DeliveryFailureRecoveryState selectedState = state == null ? DeliveryFailureRecoveryState.ALL : state;
        List<UUID> orderIds = findOrderIds(tenantId, filters, selectedState, page, size);
        long totalElements = countSelectedState(tenantId, filters, selectedState);
        Map<DeliveryFailureRecoveryState, Long> counts = countByState(tenantId, filters);
        return new RecoveryQueueResult(orderIds, totalElements, counts);
    }

    private List<UUID> findOrderIds(
            UUID tenantId,
            RecoveryQueueFilters filters,
            DeliveryFailureRecoveryState state,
            int page,
            int size
    ) {
        Query query = entityManager.createNativeQuery("""
                %s
                select orders_projection.id
                %s
                  and (:state = 'ALL' or (%s) = :state)
                order by
                  case (%s)
                    when 'OPEN_FOLLOW_UP' then 0
                    when 'NEEDS_DECISION' then 1
                    when 'RETRY_READY' then 2
                    when 'REFUND_REVIEW' then 3
                    when 'CLOSED_UNRECOVERABLE' then 4
                    else 5
                  end,
                  orders_projection.created_at asc,
                  orders_projection.id asc
                limit :limit offset :offset
                """.formatted(LATEST_RECOVERY_CTE, BASE_FROM, STATE_EXPRESSION, STATE_EXPRESSION));
        bindFilters(query, tenantId, filters);
        query.setParameter("state", state.name());
        query.setParameter("limit", size);
        query.setParameter("offset", page * size);

        return query.getResultList().stream()
                .map(this::toUuid)
                .toList();
    }

    private long countSelectedState(UUID tenantId, RecoveryQueueFilters filters, DeliveryFailureRecoveryState state) {
        Query query = entityManager.createNativeQuery("""
                %s
                select count(*)
                %s
                  and (:state = 'ALL' or (%s) = :state)
                """.formatted(LATEST_RECOVERY_CTE, BASE_FROM, STATE_EXPRESSION));
        bindFilters(query, tenantId, filters);
        query.setParameter("state", state.name());
        return ((Number) query.getSingleResult()).longValue();
    }

    private Map<DeliveryFailureRecoveryState, Long> countByState(UUID tenantId, RecoveryQueueFilters filters) {
        Query query = entityManager.createNativeQuery("""
                %s
                select recovery_state, count(*)
                from (
                    select (%s) as recovery_state
                    %s
                ) recovery_states
                group by recovery_state
                """.formatted(LATEST_RECOVERY_CTE, STATE_EXPRESSION, BASE_FROM));
        bindFilters(query, tenantId, filters);

        Map<DeliveryFailureRecoveryState, Long> counts = new EnumMap<>(DeliveryFailureRecoveryState.class);
        for (DeliveryFailureRecoveryState state : DeliveryFailureRecoveryState.values()) {
            counts.put(state, 0L);
        }

        for (Object result : query.getResultList()) {
            Object[] row = (Object[]) result;
            DeliveryFailureRecoveryState state = DeliveryFailureRecoveryState.valueOf(row[0].toString());
            counts.put(state, ((Number) row[1]).longValue());
        }

        long total = counts.entrySet().stream()
                .filter(entry -> entry.getKey() != DeliveryFailureRecoveryState.ALL)
                .mapToLong(Map.Entry::getValue)
                .sum();
        counts.put(DeliveryFailureRecoveryState.ALL, total);
        return counts;
    }

    private void bindFilters(Query query, UUID tenantId, RecoveryQueueFilters filters) {
        query.setParameter("tenantId", tenantId);
        query.setParameter("phone", filters.phone());
        query.setParameter("customerName", filters.customerName());
        query.setParameter("orderIdSearch", filters.orderIdSearch());
        query.setParameter("courierId", filters.courierId());
        query.setParameter("createdFromEnabled", filters.createdFrom() != null);
        query.setParameter("createdFrom", filters.createdFrom() == null ? Instant.EPOCH : filters.createdFrom());
        query.setParameter("createdToExclusiveEnabled", filters.createdToExclusive() != null);
        query.setParameter(
                "createdToExclusive",
                filters.createdToExclusive() == null ? Instant.EPOCH : filters.createdToExclusive()
        );
    }

    private UUID toUuid(Object value) {
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof byte[] bytes) {
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
            return new UUID(buffer.getLong(), buffer.getLong());
        }
        return UUID.fromString(value.toString());
    }
}

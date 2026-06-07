package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByIdAndTenantId(UUID id, UUID tenantId);
    List<Order> findByTenantId(UUID tenantId);
    Page<Order> findByTenantId(UUID tenantId, Pageable pageable);
    Page<Order> findByTenantIdAndStatus(UUID tenantId, OrderStatus status, Pageable pageable);
    boolean existsByIdAndTenantIdNot(UUID id, UUID tenantId);

    @Query("""
            select orderProjection
            from Order orderProjection
            where orderProjection.tenantId = :tenantId
              and orderProjection.status = :status
              and (:courierId is null or orderProjection.courierId = :courierId)
              and (:unassignedOnly = false or orderProjection.courierId is null)
              and (:createdFrom is null or orderProjection.createdAt >= :createdFrom)
              and (:createdToExclusive is null or orderProjection.createdAt < :createdToExclusive)
            """)
    Page<Order> findCourierOperationsQueue(
            @Param("tenantId") UUID tenantId,
            @Param("status") OrderStatus status,
            @Param("courierId") String courierId,
            @Param("unassignedOnly") boolean unassignedOnly,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusive") Instant createdToExclusive,
            Pageable pageable
    );

    @Query(value = """
            select
                cast(c.courier_id as varchar) as courierId,
                c.name as courierName,
                c.active as active,
                count(case when o.status in ('ASSIGNED_TO_COURIER', 'PICKED_UP', 'DELIVERED', 'FAILED') then 1 end) as assignedOrdersCount,
                count(case when o.status in ('PICKED_UP', 'DELIVERED', 'FAILED') then 1 end) as pickedUpOrdersCount,
                count(case when o.status = 'DELIVERED' then 1 end) as deliveredOrdersCount,
                count(case when o.status = 'FAILED' then 1 end) as failedOrdersCount
            from couriers c
            left join orders o
                on o.tenant_id = c.tenant_id
                and o.courier_id = cast(c.courier_id as varchar)
            where c.tenant_id = :tenantId
            group by c.courier_id, c.name, c.active
            order by c.name asc, c.courier_id asc
            """, nativeQuery = true)
    List<CourierPerformanceRow> findCourierPerformance(@Param("tenantId") UUID tenantId);

    interface CourierPerformanceRow {
        String getCourierId();
        String getCourierName();
        boolean getActive();
        long getAssignedOrdersCount();
        long getPickedUpOrdersCount();
        long getDeliveredOrdersCount();
        long getFailedOrdersCount();
    }

    @Query("""
            select orderProjection
            from Order orderProjection
            where orderProjection.tenantId = :tenantId
              and orderProjection.status in :statuses
              and (:createdFrom is null or orderProjection.createdAt >= :createdFrom)
              and (:createdToExclusive is null or orderProjection.createdAt < :createdToExclusive)
              and (
                    :search is null
                    or lower(orderProjection.customer.firstName) like lower(concat('%', :search, '%'))
                    or lower(orderProjection.customer.lastName) like lower(concat('%', :search, '%'))
                    or orderProjection.customer.phone like concat('%', :search, '%')
              )
            """)
    Page<Order> findConfirmationQueue(
            @Param("tenantId") UUID tenantId,
            @Param("statuses") List<OrderStatus> statuses,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusive") Instant createdToExclusive,
            @Param("search") String search,
            Pageable pageable
    );
}

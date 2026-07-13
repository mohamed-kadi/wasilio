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
    List<Order> findByTenantIdAndIdIn(UUID tenantId, List<UUID> ids);
    List<Order> findTop20ByTenantIdAndCustomer_PhoneOrderByCreatedAtDesc(UUID tenantId, String phone);
    Page<Order> findByTenantId(UUID tenantId, Pageable pageable);
    Page<Order> findByTenantIdAndStatus(UUID tenantId, OrderStatus status, Pageable pageable);
    boolean existsByIdAndTenantIdNot(UUID id, UUID tenantId);
    long countByTenantId(UUID tenantId);

    @Query(value = """
            select *
            from orders o
            where o.tenant_id = :tenantId
              and (:statusFilterEnabled = false or o.status in (:statuses))
              and (:phone is null or lower(o.phone) like lower(concat('%', :phone, '%')))
              and (
                    :customerName is null
                    or lower(o.first_name) like lower(concat('%', :customerName, '%'))
                    or lower(o.last_name) like lower(concat('%', :customerName, '%'))
                    or lower(concat(coalesce(o.first_name, ''), ' ', coalesce(o.last_name, ''))) like lower(concat('%', :customerName, '%'))
              )
              and (:orderId is null or lower(cast(o.id as varchar)) like lower(concat('%', :orderId, '%')))
              and (:courierId is null or o.courier_id = :courierId)
              and (:createdFromEnabled = false or o.created_at >= :createdFrom)
              and (:createdToExclusiveEnabled = false or o.created_at < :createdToExclusive)
            order by o.created_at desc, o.id asc
            """,
            countQuery = """
            select count(*)
            from orders o
            where o.tenant_id = :tenantId
              and (:statusFilterEnabled = false or o.status in (:statuses))
              and (:phone is null or lower(o.phone) like lower(concat('%', :phone, '%')))
              and (
                    :customerName is null
                    or lower(o.first_name) like lower(concat('%', :customerName, '%'))
                    or lower(o.last_name) like lower(concat('%', :customerName, '%'))
                    or lower(concat(coalesce(o.first_name, ''), ' ', coalesce(o.last_name, ''))) like lower(concat('%', :customerName, '%'))
              )
              and (:orderId is null or lower(cast(o.id as varchar)) like lower(concat('%', :orderId, '%')))
              and (:courierId is null or o.courier_id = :courierId)
              and (:createdFromEnabled = false or o.created_at >= :createdFrom)
              and (:createdToExclusiveEnabled = false or o.created_at < :createdToExclusive)
            """,
            nativeQuery = true)
    Page<Order> searchOrders(
            @Param("tenantId") UUID tenantId,
            @Param("statusFilterEnabled") boolean statusFilterEnabled,
            @Param("statuses") List<String> statuses,
            @Param("phone") String phone,
            @Param("customerName") String customerName,
            @Param("orderId") String orderId,
            @Param("courierId") String courierId,
            @Param("createdFromEnabled") boolean createdFromEnabled,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusiveEnabled") boolean createdToExclusiveEnabled,
            @Param("createdToExclusive") Instant createdToExclusive,
            Pageable pageable
    );

    @Query("""
            select orderProjection
            from Order orderProjection
            where orderProjection.tenantId = :tenantId
              and orderProjection.status = :status
              and (:courierId is null or orderProjection.courierId = :courierId)
              and (:unassignedOnly = false or orderProjection.courierId is null)
              and (:createdFromEnabled = false or orderProjection.createdAt >= :createdFrom)
              and (:createdToExclusiveEnabled = false or orderProjection.createdAt < :createdToExclusive)
            """)
    Page<Order> findCourierOperationsQueue(
            @Param("tenantId") UUID tenantId,
            @Param("status") OrderStatus status,
            @Param("courierId") String courierId,
            @Param("unassignedOnly") boolean unassignedOnly,
            @Param("createdFromEnabled") boolean createdFromEnabled,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusiveEnabled") boolean createdToExclusiveEnabled,
            @Param("createdToExclusive") Instant createdToExclusive,
            Pageable pageable
    );

    @Query("""
            select orderProjection
            from Order orderProjection
            where orderProjection.tenantId = :tenantId
              and orderProjection.status in :statuses
              and (:createdFromEnabled = false or orderProjection.createdAt >= :createdFrom)
              and (:createdToExclusiveEnabled = false or orderProjection.createdAt < :createdToExclusive)
              and (
                    :searchEnabled = false
                    or lower(orderProjection.customer.firstName) like lower(concat('%', :search, '%'))
                    or lower(orderProjection.customer.lastName) like lower(concat('%', :search, '%'))
                    or orderProjection.customer.phone like concat('%', :search, '%')
              )
            """)
    Page<Order> findConfirmationQueue(
            @Param("tenantId") UUID tenantId,
            @Param("statuses") List<OrderStatus> statuses,
            @Param("createdFromEnabled") boolean createdFromEnabled,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusiveEnabled") boolean createdToExclusiveEnabled,
            @Param("createdToExclusive") Instant createdToExclusive,
            @Param("searchEnabled") boolean searchEnabled,
            @Param("search") String search,
            Pageable pageable
    );
}

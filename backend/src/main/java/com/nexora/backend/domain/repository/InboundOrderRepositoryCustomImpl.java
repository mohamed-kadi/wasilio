package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderSource;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RequiredArgsConstructor
class InboundOrderRepositoryCustomImpl implements InboundOrderRepositoryCustom {

    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of(
            "receivedAt",
            "inboundOrderId",
            "source",
            "status"
    );

    private final EntityManager entityManager;

    @Override
    public Page<InboundOrder> searchInboundOrders(
            UUID tenantId,
            OrderSource source,
            InboundOrderStatus status,
            String search,
            Pageable pageable
    ) {
        CriteriaBuilder criteriaBuilder = entityManager.getCriteriaBuilder();
        CriteriaQuery<InboundOrder> query = criteriaBuilder.createQuery(InboundOrder.class);
        Root<InboundOrder> root = query.from(InboundOrder.class);
        query.where(predicates(criteriaBuilder, root, tenantId, source, status, search));
        query.orderBy(sort(criteriaBuilder, root, pageable.getSort()));

        TypedQuery<InboundOrder> typedQuery = entityManager.createQuery(query);
        typedQuery.setFirstResult(Math.toIntExact(pageable.getOffset()));
        typedQuery.setMaxResults(pageable.getPageSize());

        return new PageImpl<>(
                typedQuery.getResultList(),
                pageable,
                count(criteriaBuilder, tenantId, source, status, search)
        );
    }

    private long count(
            CriteriaBuilder criteriaBuilder,
            UUID tenantId,
            OrderSource source,
            InboundOrderStatus status,
            String search
    ) {
        CriteriaQuery<Long> countQuery = criteriaBuilder.createQuery(Long.class);
        Root<InboundOrder> root = countQuery.from(InboundOrder.class);
        countQuery.select(criteriaBuilder.count(root));
        countQuery.where(predicates(criteriaBuilder, root, tenantId, source, status, search));
        return entityManager.createQuery(countQuery).getSingleResult();
    }

    private Predicate[] predicates(
            CriteriaBuilder criteriaBuilder,
            Root<InboundOrder> root,
            UUID tenantId,
            OrderSource source,
            InboundOrderStatus status,
            String search
    ) {
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(criteriaBuilder.equal(root.get("tenantId"), tenantId));

        if (source != null) {
            predicates.add(criteriaBuilder.equal(root.get("source"), source));
        }
        if (status != null) {
            predicates.add(criteriaBuilder.equal(root.get("status"), status));
        }
        if (search != null && !search.isBlank()) {
            String searchPattern = "%" + search.toLowerCase(Locale.ROOT) + "%";
            Expression<String> externalOrderId = criteriaBuilder.lower(
                    criteriaBuilder.coalesce(root.get("externalOrderId"), "")
            );
            Expression<String> idempotencyKey = criteriaBuilder.lower(root.get("idempotencyKey"));
            predicates.add(criteriaBuilder.or(
                    criteriaBuilder.like(externalOrderId, searchPattern),
                    criteriaBuilder.like(idempotencyKey, searchPattern)
            ));
        }

        return predicates.toArray(Predicate[]::new);
    }

    private List<jakarta.persistence.criteria.Order> sort(
            CriteriaBuilder criteriaBuilder,
            Root<InboundOrder> root,
            Sort sort
    ) {
        List<jakarta.persistence.criteria.Order> orders = new ArrayList<>();
        for (Sort.Order sortOrder : sort) {
            if (!ALLOWED_SORT_PROPERTIES.contains(sortOrder.getProperty())) {
                continue;
            }
            Path<?> path = root.get(sortOrder.getProperty());
            orders.add(sortOrder.isAscending() ? criteriaBuilder.asc(path) : criteriaBuilder.desc(path));
        }
        if (orders.isEmpty()) {
            orders.add(criteriaBuilder.desc(root.get("receivedAt")));
            orders.add(criteriaBuilder.asc(root.get("inboundOrderId")));
        }
        return orders;
    }
}

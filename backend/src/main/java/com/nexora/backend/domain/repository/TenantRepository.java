package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    boolean existsByNameIgnoreCase(String name);
}

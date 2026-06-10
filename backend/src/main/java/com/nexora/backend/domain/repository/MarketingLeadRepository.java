package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.MarketingLead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MarketingLeadRepository extends JpaRepository<MarketingLead, UUID> {
    List<MarketingLead> findAllByOrderByCreatedAtDesc();
}

package com.nexora.backend.application;

import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.TenantStatus;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.TenantRepository;
import com.nexora.backend.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TenantOnboardingService {

    private static final Pattern STRONG_PASSWORD = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,}$"
    );

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.onboarding.enabled:false}")
    private boolean onboardingEnabled;

    @Transactional
    public TenantOnboardingResult onboardTenant(TenantOnboardingCommand command) {
        if (!onboardingEnabled) {
            throw new AccessDeniedException("Tenant onboarding is disabled");
        }

        return createTenant(command, TenantStatus.ACTIVE);
    }

    @Transactional
    public TenantOnboardingResult onboardTenantFromStaff(TenantOnboardingCommand command) {
        return createTenant(command, TenantStatus.TRIALING);
    }

    private TenantOnboardingResult createTenant(TenantOnboardingCommand command, TenantStatus initialStatus) {
        String tenantName = normalizeDisplayName(command.tenantName(), "tenant name");
        String adminName = normalizeDisplayName(command.adminName(), "admin name");
        String adminEmail = normalizeEmail(command.adminEmail());
        validatePassword(command.password());

        if (tenantRepository.existsByNameIgnoreCase(tenantName)) {
            throw new ResourceConflictException("Tenant already exists");
        }

        if (userRepository.existsByEmailIgnoreCase(adminEmail)) {
            throw new ResourceConflictException("Admin email already exists");
        }

        UUID tenantId = UUID.randomUUID();
        UUID adminUserId = UUID.randomUUID();

        try {
            Tenant tenant = new Tenant(tenantId, tenantName);
            tenant.setStatus(initialStatus);
            tenantRepository.saveAndFlush(tenant);
            userRepository.saveAndFlush(new User(
                    adminUserId,
                    adminEmail,
                    adminName,
                    passwordEncoder.encode(command.password()),
                    Role.ADMIN,
                    tenantId
            ));
        } catch (DataIntegrityViolationException ex) {
            throw new ResourceConflictException("Tenant or admin email already exists");
        }

        return new TenantOnboardingResult(
                tenantId,
                tenantName,
                tenantId,
                tenantName,
                adminUserId,
                adminEmail,
                Role.ADMIN
        );
    }

    private String normalizeDisplayName(String value, String fieldName) {
        String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return normalized;
    }

    private String normalizeEmail(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("admin email is required");
        }
        return normalized;
    }

    private void validatePassword(String password) {
        if (password == null || !STRONG_PASSWORD.matcher(password).matches()) {
            throw new IllegalArgumentException(
                    "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol"
            );
        }
    }

    public record TenantOnboardingCommand(
            String tenantName,
            String adminName,
            String adminEmail,
            String password
    ) {}

    public record TenantOnboardingResult(
            UUID tenantId,
            String tenantName,
            UUID workspaceId,
            String workspaceName,
            UUID adminUserId,
            String adminEmail,
            Role adminRole
    ) {}
}

package com.nexora.backend.application;

import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.TenantStatus;
import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.repository.TenantRepository;
import com.nexora.backend.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SuperAdminBootstrapService {

    private static final Pattern STRONG_PASSWORD = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,}$"
    );

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public BootstrapResult bootstrap(String email, String password, String tenantName) {
        if (userRepository.existsByRole(Role.SUPER_ADMIN)) {
            return BootstrapResult.alreadyExists();
        }

        String normalizedEmail = normalizeEmail(email);
        String normalizedTenantName = normalizeTenantName(tenantName);
        validatePassword(password);

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalStateException("Cannot bootstrap super admin because the configured email already belongs to another user");
        }

        Tenant tenant = tenantRepository.findByNameIgnoreCase(normalizedTenantName)
                .orElseGet(() -> new Tenant(UUID.randomUUID(), normalizedTenantName));
        tenant.setStatus(TenantStatus.ACTIVE);
        Tenant savedTenant = tenantRepository.saveAndFlush(tenant);

        User superAdmin = new User(
                UUID.randomUUID(),
                normalizedEmail,
                "Nexora Super Admin",
                passwordEncoder.encode(password),
                Role.SUPER_ADMIN,
                savedTenant.getId()
        );
        userRepository.saveAndFlush(superAdmin);

        return BootstrapResult.created(normalizedEmail, savedTenant.getId());
    }

    private String normalizeEmail(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            throw new IllegalStateException("Super-admin bootstrap email is required");
        }
        return normalized;
    }

    private String normalizeTenantName(String tenantName) {
        String normalized = tenantName == null ? "" : tenantName.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            return "Nexora Internal";
        }
        return normalized;
    }

    private void validatePassword(String password) {
        if (password == null || !STRONG_PASSWORD.matcher(password).matches()) {
            throw new IllegalStateException(
                    "Super-admin bootstrap password must be at least 12 characters and include uppercase, lowercase, number, and symbol"
            );
        }
    }

    public record BootstrapResult(boolean created, String email, UUID tenantId) {
        static BootstrapResult alreadyExists() {
            return new BootstrapResult(false, null, null);
        }

        static BootstrapResult created(String email, UUID tenantId) {
            return new BootstrapResult(true, email, tenantId);
        }
    }
}

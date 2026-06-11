package com.nexora.backend.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.Role;
import com.nexora.backend.domain.model.Tenant;
import com.nexora.backend.domain.model.TenantStatus;
import com.nexora.backend.domain.repository.TenantRepository;
import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TenantAccessFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (shouldSkip(request, authentication)) {
            filterChain.doFilter(request, response);
            return;
        }

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        Tenant tenant = tenantRepository.findById(UUID.fromString(userDetails.getTenantId())).orElse(null);
        if (tenant == null || isBlocked(tenant.getStatus())) {
            writeBlockedTenantProblem(response, tenant == null ? TenantStatus.DISABLED : tenant.getStatus());
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean shouldSkip(HttpServletRequest request, Authentication authentication) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            return true;
        }
        if (path.startsWith("/api/auth/")
                || path.startsWith("/api/onboarding/")
                || path.startsWith("/actuator/health")
                || path.equals("/error")) {
            return true;
        }
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            return true;
        }

        return Role.SUPER_ADMIN.name().equals(userDetails.getRole());
    }

    private boolean isBlocked(TenantStatus status) {
        return status == TenantStatus.OVERDUE
                || status == TenantStatus.SUSPENDED
                || status == TenantStatus.DISABLED;
    }

    private void writeBlockedTenantProblem(HttpServletResponse response, TenantStatus status) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "This tenant account is " + status.name().toLowerCase() + ". Please contact Wasilio support or settle the outstanding payment."
        );
        problem.setTitle("Tenant account blocked");
        problem.setProperty("error", HttpStatus.FORBIDDEN.getReasonPhrase());
        problem.setProperty("tenantStatus", status.name());
        problem.setProperty("timestamp", Instant.now().toString());
        problem.setProperty("correlationId", CorrelationIdContext.getRequiredString());

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}

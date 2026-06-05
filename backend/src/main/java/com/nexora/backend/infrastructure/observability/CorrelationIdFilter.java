package com.nexora.backend.infrastructure.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        UUID correlationId = resolveCorrelationId(request.getHeader(CorrelationIdContext.HEADER_NAME));
        CorrelationIdContext.set(correlationId);
        MDC.put(CorrelationIdContext.MDC_KEY, correlationId.toString());
        response.setHeader(CorrelationIdContext.HEADER_NAME, correlationId.toString());

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(CorrelationIdContext.TENANT_MDC_KEY);
            MDC.remove(CorrelationIdContext.MDC_KEY);
            CorrelationIdContext.clear();
        }
    }

    private UUID resolveCorrelationId(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return UUID.randomUUID();
        }

        try {
            return UUID.fromString(headerValue.trim());
        } catch (IllegalArgumentException ex) {
            return UUID.randomUUID();
        }
    }
}

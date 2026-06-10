package com.nexora.backend.api;

import com.nexora.backend.infrastructure.security.AbuseProtectionService;
import com.nexora.backend.infrastructure.security.ClientIpResolver;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import com.nexora.backend.infrastructure.security.JwtService;
import com.nexora.backend.infrastructure.security.RateLimitDecision;
import com.nexora.backend.infrastructure.security.RateLimitExceededException;
import com.nexora.backend.infrastructure.security.SecurityAuditLogger;
import com.nexora.backend.application.PasswordResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AbuseProtectionService abuseProtectionService;
    private final SecurityAuditLogger securityAuditLogger;
    private final PasswordResetService passwordResetService;

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record LoginResponse(String token) {}
    public record PasswordResetRequest(@NotBlank @Email String email) {}
    public record PasswordResetConfirmRequest(@NotBlank String token, @NotBlank String newPassword) {}
    public record MessageResponse(String message) {}

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest
    ) {
        String email = normalizeEmail(request.email());
        String remoteIp = ClientIpResolver.resolve(servletRequest);

        RateLimitDecision decision = abuseProtectionService.checkLoginAllowed(email, remoteIp);
        if (!decision.allowed()) {
            securityAuditLogger.loginThrottled(email, remoteIp);
            throw new RateLimitExceededException("Login temporarily locked due to repeated failed attempts", decision.retryAfter());
        }

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password())
            );
        } catch (RuntimeException ex) {
            RateLimitDecision failureDecision = abuseProtectionService.recordLoginFailure(email, remoteIp);
            securityAuditLogger.loginFailed(email, remoteIp);
            if (!failureDecision.allowed()) {
                securityAuditLogger.loginThrottled(email, remoteIp);
            }
            throw ex;
        }

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", userDetails.getAuthorities().iterator().next().getAuthority());

        String jwt = jwtService.generateToken(extraClaims, userDetails.getUsername(), userDetails.getTenantId());
        abuseProtectionService.recordLoginSuccess(email);
        securityAuditLogger.loginSucceeded(userDetails.getUsername(), userDetails.getTenantId(), remoteIp);

        return ResponseEntity.ok(new LoginResponse(jwt));
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<MessageResponse> requestPasswordReset(
            @Valid @RequestBody PasswordResetRequest request,
            HttpServletRequest servletRequest
    ) {
        String email = normalizeEmail(request.email());
        String remoteIp = ClientIpResolver.resolve(servletRequest);

        RateLimitDecision decision = abuseProtectionService.recordPasswordResetAttempt(email, remoteIp);
        if (!decision.allowed()) {
            throw new RateLimitExceededException("Password reset temporarily locked due to repeated attempts", decision.retryAfter());
        }

        passwordResetService.requestPasswordReset(email, remoteIp);
        return ResponseEntity.ok(new MessageResponse("If the email exists, a password reset link has been sent."));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<MessageResponse> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request
    ) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok(new MessageResponse("Password has been reset. You can sign in with the new password."));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}

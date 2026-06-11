package com.nexora.backend.infrastructure.notification;

import com.nexora.backend.application.PasswordResetNotifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@Slf4j
@RequiredArgsConstructor
public class PasswordResetEmailNotifier implements PasswordResetNotifier {
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final EmailDeliveryProperties properties;

    @Override
    public void sendPasswordResetLink(String email, String resetUrl, Instant expiresAt) {
        if (properties.getMode() == EmailDeliveryProperties.Mode.LOG) {
            log.info("Password reset requested for {}. Reset link expires at {}: {}", email, expiresAt, resetUrl);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("APP_EMAIL_MODE=smtp requires SMTP mail configuration");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.getFrom());
        message.setTo(email);
        message.setSubject("Reset your Wasilio password");
        message.setText(buildBody(resetUrl, expiresAt));
        mailSender.send(message);

        log.info("Password reset email sent to {}. Link expires at {}", email, expiresAt);
    }

    private String buildBody(String resetUrl, Instant expiresAt) {
        return """
                Hello,

                We received a request to reset your Wasilio password.

                Open this link to choose a new password:
                %s

                This link expires at %s.

                If you did not request this, ignore this email or contact %s.

                Wasilio
                """.formatted(resetUrl, expiresAt, properties.getSupportContact());
    }
}

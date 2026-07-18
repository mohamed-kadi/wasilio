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
        sendLink(
                email,
                resetUrl,
                expiresAt,
                "Password reset requested",
                "Reset your Wasilio password",
                buildPasswordResetBody(resetUrl, expiresAt)
        );
    }

    @Override
    public void sendAccountSetupLink(String email, String setupUrl, Instant expiresAt) {
        sendLink(
                email,
                setupUrl,
                expiresAt,
                "Account setup requested",
                "Set up your Wasilio account",
                buildAccountSetupBody(setupUrl, expiresAt)
        );
    }

    private void sendLink(
            String email,
            String url,
            Instant expiresAt,
            String logLabel,
            String subject,
            String body
    ) {
        if (properties.getMode() == EmailDeliveryProperties.Mode.LOG) {
            log.info("{} for {}. Link expires at {}: {}", logLabel, email, expiresAt, url);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("APP_EMAIL_MODE=smtp requires SMTP mail configuration");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.getFrom());
        message.setTo(email);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);

        log.info("{} email sent to {}. Link expires at {}", subject, email, expiresAt);
    }

    private String buildPasswordResetBody(String resetUrl, Instant expiresAt) {
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

    private String buildAccountSetupBody(String setupUrl, Instant expiresAt) {
        return """
                Hello,

                Your Wasilio merchant workspace is ready.

                Open this link to choose your password and finish account setup:
                %s

                This link expires at %s.

                If you were not expecting this invitation, contact %s.

                Wasilio
                """.formatted(setupUrl, expiresAt, properties.getSupportContact());
    }
}

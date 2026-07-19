package com.nexora.backend.infrastructure.notification;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class PasswordResetEmailNotifierTest {

    private static final String EMAIL = "merchant@example.com";
    private static final String RESET_URL = "https://app.wasilio.test/reset-password?token=reset-token";
    private static final String SETUP_URL = "https://app.wasilio.test/reset-password?token=setup-token";
    private static final Instant EXPIRES_AT = Instant.parse("2026-07-18T18:30:00Z");

    @Test
    void logModeWritesAccountSetupLinkWithoutUsingJavaMail(CapturedOutput output) {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        EmailDeliveryProperties properties = properties(EmailDeliveryProperties.Mode.LOG);
        PasswordResetEmailNotifier notifier = new PasswordResetEmailNotifier(mailSenderProvider, properties);

        notifier.sendAccountSetupLink(EMAIL, SETUP_URL, EXPIRES_AT);

        assertThat(output)
                .contains("Account setup requested")
                .contains(EMAIL)
                .contains(SETUP_URL)
                .contains(EXPIRES_AT.toString());
        verifyNoInteractions(mailSenderProvider);
    }

    @Test
    void smtpModeSendsPasswordResetEmailThroughJavaMail() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        EmailDeliveryProperties properties = properties(EmailDeliveryProperties.Mode.SMTP);
        PasswordResetEmailNotifier notifier = new PasswordResetEmailNotifier(mailSenderProvider(mailSender), properties);

        notifier.sendPasswordResetLink(EMAIL, RESET_URL, EXPIRES_AT);

        SimpleMailMessage message = captureMessage(mailSender);
        assertThat(message.getFrom()).isEqualTo("Wasilio <no-reply@wasilio.test>");
        assertThat(message.getTo()).containsExactly(EMAIL);
        assertThat(message.getSubject()).isEqualTo("Reset your Wasilio password");
        assertThat(message.getText())
                .contains("We received a request to reset your Wasilio password.")
                .contains(RESET_URL)
                .contains(EXPIRES_AT.toString())
                .contains("support@wasilio.test");
    }

    @Test
    void smtpModeSendsAccountSetupEmailThroughJavaMail() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        EmailDeliveryProperties properties = properties(EmailDeliveryProperties.Mode.SMTP);
        PasswordResetEmailNotifier notifier = new PasswordResetEmailNotifier(mailSenderProvider(mailSender), properties);

        notifier.sendAccountSetupLink(EMAIL, SETUP_URL, EXPIRES_AT);

        SimpleMailMessage message = captureMessage(mailSender);
        assertThat(message.getFrom()).isEqualTo("Wasilio <no-reply@wasilio.test>");
        assertThat(message.getTo()).containsExactly(EMAIL);
        assertThat(message.getSubject()).isEqualTo("Set up your Wasilio account");
        assertThat(message.getText())
                .contains("Your Wasilio merchant workspace is ready.")
                .contains("choose your password")
                .contains(SETUP_URL)
                .contains(EXPIRES_AT.toString())
                .contains("support@wasilio.test");
    }

    @Test
    void smtpModeRequiresMailSenderConfiguration() {
        EmailDeliveryProperties properties = properties(EmailDeliveryProperties.Mode.SMTP);
        PasswordResetEmailNotifier notifier = new PasswordResetEmailNotifier(mailSenderProvider(null), properties);

        assertThatThrownBy(() -> notifier.sendAccountSetupLink(EMAIL, SETUP_URL, EXPIRES_AT))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_EMAIL_MODE=smtp requires SMTP mail configuration");
    }

    private SimpleMailMessage captureMessage(JavaMailSender mailSender) {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        return captor.getValue();
    }

    private EmailDeliveryProperties properties(EmailDeliveryProperties.Mode mode) {
        EmailDeliveryProperties properties = new EmailDeliveryProperties();
        properties.setMode(mode);
        properties.setFrom("Wasilio <no-reply@wasilio.test>");
        properties.setSupportContact("support@wasilio.test");
        return properties;
    }

    @SuppressWarnings("unchecked")
    private ObjectProvider<JavaMailSender> mailSenderProvider(JavaMailSender mailSender) {
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);
        return provider;
    }
}

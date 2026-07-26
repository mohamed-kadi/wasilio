package com.nexora.backend.infrastructure.notification;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;
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
    void smtpModeSendsPasswordResetEmailThroughJavaMail() throws Exception {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        EmailDeliveryProperties properties = properties(EmailDeliveryProperties.Mode.SMTP);
        PasswordResetEmailNotifier notifier = new PasswordResetEmailNotifier(mailSenderProvider(mailSender), properties);

        notifier.sendPasswordResetLink(EMAIL, RESET_URL, EXPIRES_AT);

        MimeMessage message = captureMessage(mailSender);
        assertThat(message.getFrom()[0].toString()).isEqualTo("Wasilio <no-reply@wasilio.test>");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo(EMAIL);
        assertThat(message.getSubject()).isEqualTo("Reset your Wasilio password");
        assertThat(messageText(message))
                .contains("Hello,")
                .contains("We received a request to reset your Wasilio password.")
                .contains(RESET_URL)
                .contains("Jul 18, 2026 at 18:30 UTC")
                .contains("https://app.wasilio.test/brand/wasilio-mark.svg")
                .contains("width=\"36\" height=\"36\"")
                .contains("font-size:26px")
                .contains("font-weight:800")
                .contains("Reset password")
                .contains("The Wasilio team")
                .contains("support@wasilio.test");
    }

    @Test
    void smtpModeSendsAccountSetupEmailThroughJavaMail() throws Exception {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        EmailDeliveryProperties properties = properties(EmailDeliveryProperties.Mode.SMTP);
        PasswordResetEmailNotifier notifier = new PasswordResetEmailNotifier(mailSenderProvider(mailSender), properties);

        notifier.sendAccountSetupLink(EMAIL, SETUP_URL, EXPIRES_AT);

        MimeMessage message = captureMessage(mailSender);
        assertThat(message.getFrom()[0].toString()).isEqualTo("Wasilio <no-reply@wasilio.test>");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo(EMAIL);
        assertThat(message.getSubject()).isEqualTo("Set up your Wasilio account");
        assertThat(messageText(message))
                .contains("Hello,")
                .contains("Your Wasilio merchant workspace is ready.")
                .contains("choose your password")
                .contains(SETUP_URL)
                .contains("Jul 18, 2026 at 18:30 UTC")
                .contains("https://app.wasilio.test/brand/wasilio-mark.svg")
                .contains("width=\"36\" height=\"36\"")
                .contains("font-size:26px")
                .contains("font-weight:800")
                .contains("Set password")
                .contains("The Wasilio team")
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

    private MimeMessage captureMessage(JavaMailSender mailSender) {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        return captor.getValue();
    }

    private String messageText(MimeMessage message) throws Exception {
        return contentText(message.getContent());
    }

    private String contentText(Object content) throws Exception {
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof Multipart multipart) {
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                builder.append(contentText(part.getContent()));
            }
            return builder.toString();
        }
        return String.valueOf(content);
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
        if (mailSender != null) {
            when(mailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        }
        return provider;
    }
}

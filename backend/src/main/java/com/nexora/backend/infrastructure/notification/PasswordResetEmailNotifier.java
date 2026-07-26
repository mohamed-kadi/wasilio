package com.nexora.backend.infrastructure.notification;

import com.nexora.backend.application.PasswordResetNotifier;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Component
@Slf4j
@RequiredArgsConstructor
public class PasswordResetEmailNotifier implements PasswordResetNotifier {
    private static final DateTimeFormatter EXPIRY_FORMATTER = DateTimeFormatter
            .ofPattern("MMM d, yyyy 'at' HH:mm 'UTC'", Locale.ENGLISH)
            .withZone(ZoneOffset.UTC);

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
                "Choose a new password",
                "We received a request to reset your Wasilio password.",
                "Reset password",
                "If you did not request this, you can ignore this email.",
                buildPasswordResetTextBody(resetUrl, expiresAt)
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
                "Your Wasilio workspace is ready",
                "Use this secure link to choose your password and access your merchant workspace.",
                "Set password",
                "If you were not expecting this invitation, contact support before opening the link.",
                buildAccountSetupTextBody(setupUrl, expiresAt)
        );
    }

    private void sendLink(
            String email,
            String url,
            Instant expiresAt,
            String logLabel,
            String subject,
            String headline,
            String intro,
            String actionLabel,
            String securityNote,
            String textBody
    ) {
        if (properties.getMode() == EmailDeliveryProperties.Mode.LOG) {
            log.info("{} for {}. Link expires at {}: {}", logLabel, email, expiresAt, url);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("APP_EMAIL_MODE=smtp requires SMTP mail configuration");
        }

        MimeMessage message = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(properties.getFrom());
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(
                    textBody,
                    buildHtmlBody(url, expiresAt, headline, intro, actionLabel, securityNote)
            );
        } catch (MessagingException ex) {
            throw new IllegalStateException("Failed to prepare email message", ex);
        }

        mailSender.send(message);

        log.info("{} email sent to {}. Link expires at {}", subject, email, expiresAt);
    }

    private String buildPasswordResetTextBody(String resetUrl, Instant expiresAt) {
        return """
                Hello,

                We received a request to reset your Wasilio password.

                Open this link to choose a new password:
                %s

                This link expires at %s.

                If you did not request this, you can ignore this email.
                For support, contact %s.

                The Wasilio team
                """.formatted(resetUrl, formatExpiry(expiresAt), properties.getSupportContact());
    }

    private String buildAccountSetupTextBody(String setupUrl, Instant expiresAt) {
        return """
                Hello,

                Your Wasilio merchant workspace is ready.

                Open this link to choose your password and finish account setup:
                %s

                This link expires at %s.

                If you were not expecting this invitation, contact %s before opening the link.

                The Wasilio team
                """.formatted(setupUrl, formatExpiry(expiresAt), properties.getSupportContact());
    }

    private String buildHtmlBody(
            String actionUrl,
            Instant expiresAt,
            String headline,
            String intro,
            String actionLabel,
            String securityNote
    ) {
        String safeActionUrl = html(actionUrl);
        String safeSupportContact = html(properties.getSupportContact());
        String markUrl = html(markUrlFor(actionUrl));
        String supportHref = "mailto:" + attribute(properties.getSupportContact());

        return """
                <!doctype html>
                <html lang="en">
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>%s</title>
                  </head>
                  <body style="margin:0;background:#f4f7f6;color:#111827;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:32px 16px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dfe7e4;border-radius:12px;overflow:hidden;">
                            <tr>
                              <td style="padding:24px 32px 12px 32px;">
                                <table role="presentation" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align:middle;padding:0 10px 0 0;">
                                      <img src="%s" width="36" height="36" alt="" style="display:block;border:0;width:36px;height:36px;border-radius:8px;">
                                    </td>
                                    <td style="vertical-align:middle;">
                                      <span style="display:block;color:#0f5b4a;font-size:26px;line-height:1;font-weight:800;letter-spacing:0;">Wasilio</span>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:4px 32px 8px 32px;">
                                <h1 style="margin:0;font-size:26px;line-height:1.25;color:#0f172a;font-weight:700;">%s</h1>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 32px 0 32px;">
                                <p style="margin:0;font-size:16px;line-height:1.65;color:#465364;">Hello,</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 32px 0 32px;">
                                <p style="margin:0;font-size:16px;line-height:1.65;color:#465364;">%s</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:26px 32px 10px 32px;">
                                <a href="%s" style="display:inline-block;background:#0f6b58;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1;padding:15px 22px;border-radius:8px;">%s</a>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:12px 32px 0 32px;">
                                <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">This secure link expires on <strong style="color:#334155;">%s</strong>.</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:18px 32px 0 32px;">
                                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
                                <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;word-break:break-all;"><a href="%s" style="color:#2563eb;text-decoration:underline;">%s</a></p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:22px 32px 18px 32px;">
                                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                                  <tr>
                                    <td style="padding:14px 16px;">
                                      <p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">%s For help, contact <a href="%s" style="color:#0f6b58;text-decoration:underline;">%s</a>.</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:0 32px 30px 32px;">
                                <p style="margin:0;font-size:15px;line-height:1.55;color:#334155;">The Wasilio team</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </body>
                </html>
                """.formatted(
                html(headline),
                markUrl,
                html(headline),
                html(intro),
                safeActionUrl,
                html(actionLabel),
                html(formatExpiry(expiresAt)),
                safeActionUrl,
                safeActionUrl,
                html(securityNote),
                supportHref,
                safeSupportContact
        );
    }

    private String markUrlFor(String actionUrl) {
        int schemeSeparator = actionUrl.indexOf("://");
        if (schemeSeparator < 0) {
            return "";
        }
        int pathStart = actionUrl.indexOf('/', schemeSeparator + 3);
        String origin = pathStart < 0 ? actionUrl : actionUrl.substring(0, pathStart);
        return origin + "/brand/wasilio-mark.svg";
    }

    private String formatExpiry(Instant expiresAt) {
        return EXPIRY_FORMATTER.format(expiresAt);
    }

    private String html(String value) {
        return value == null ? "" : value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String attribute(String value) {
        return html(value).replace(" ", "%20");
    }
}

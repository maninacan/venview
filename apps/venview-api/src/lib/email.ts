import { Resend } from 'resend';
import logger from './logger.js';

// Resend transactional email client. The API key is a send-only restricted
// key (see Doppler RESEND_API_KEY). Auth emails (signup/reset/invite) are sent
// by Supabase over Resend SMTP; this client is for app-level transactional
// email the API sends directly.
const apiKey = process.env['RESEND_API_KEY'];

// "Name <address>" — address must be on a Resend-verified domain.
export const EMAIL_FROM = process.env['EMAIL_FROM'] ?? 'venOS <no-reply@mail.venview.io>';

const resend = apiKey ? new Resend(apiKey) : null;

if (!resend) {
  logger.warn('email: RESEND_API_KEY not set — outgoing app emails will be skipped');
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Best-effort transactional send. Returns true on success, false if email is
 * unconfigured or the send failed — callers should never let email failures
 * break the surrounding operation.
 */
export async function sendEmail(args: SendEmailArgs): Promise<boolean> {
  if (!resend) {
    logger.warn('sendEmail: skipped (RESEND_API_KEY not set)', { subject: args.subject });
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });
    if (error) {
      logger.error('sendEmail: Resend returned an error', { error: error.message, subject: args.subject });
      return false;
    }
    return true;
  } catch (err) {
    logger.error('sendEmail: failed to send', {
      error: err instanceof Error ? err.message : String(err),
      subject: args.subject,
    });
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

/**
 * Branded welcome email sent when a new company is created. Best-effort.
 */
export async function sendWelcomeEmail(to: string, companyName: string): Promise<boolean> {
  const clientUrl = process.env['CLIENT_URL'] ?? 'https://app.venview.io';
  const company = escapeHtml(companyName);
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B2A4A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(11,42,74,0.08);">
          <tr><td style="background:#0B2A4A;padding:22px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.01em;">ven<span style="color:#FFD84D;">OS</span></span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#0B2A4A;">Welcome to venOS! 🎉</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              Your company <strong>${company}</strong> is ready. venOS helps event vendors know if they actually made money — track sales, costs, and true profit for every market, festival, and pop-up.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
              The fastest way to see it in action: add a recent event and open its Profit Summary.
            </p>
            <a href="${clientUrl}" style="display:inline-block;background:#0B2A4A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">Open venOS</a>
          </td></tr>
          <tr><td style="padding:0 32px 32px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
              You're receiving this because a venOS account was created with this email. If this wasn't you, you can ignore this message.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `Welcome to venOS!\n\nYour company ${companyName} is ready. venOS helps event vendors track sales, costs, and true profit for every event.\n\nOpen venOS: ${clientUrl}`;
  return sendEmail({ to, subject: 'Welcome to venOS 🎉', html, text });
}

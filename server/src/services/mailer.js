import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

const layout = (title, body) => `
<div style="font-family:Inter,Arial,sans-serif;background:#f4f6fb;padding:32px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0B1B3F,#1E4FD8);padding:24px;color:#fff">
      <div style="font-size:22px;font-weight:800;letter-spacing:.5px">GO SOFT</div>
      <div style="font-size:12px;opacity:.8">Business Simplified. Growth Amplified.</div>
    </div>
    <div style="padding:28px;color:#1f2937;font-size:15px;line-height:1.6">
      <h2 style="margin-top:0;color:#0B1B3F">${title}</h2>${body}
    </div>
    <div style="padding:16px 28px;font-size:12px;color:#6b7280;border-top:1px solid #eef0f5">Powered by Goyals Group</div>
  </div>
</div>`;

const button = (href, label) =>
  `<p><a href="${href}" style="display:inline-block;background:#1E4FD8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${label}</a></p>`;

export async function sendMail({ to, subject, title, html }) {
  const message = { from: env.smtp.from, to, subject, html: layout(title || subject, html) };
  if (!transporter) {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`);
    return { dev: true };
  }
  try {
    return await transporter.sendMail(message);
  } catch (err) {
    // Email problems must never break the request that triggered them.
    console.error('[mail] send failed:', err.message);
    return { error: err.message };
  }
}

export const mails = {
  verifyEmail: (to, name, link) =>
    sendMail({ to, subject: 'Verify your GO SOFT account', title: `Welcome, ${name}!`,
      html: `<p>Please confirm your email address to activate your workspace.</p>${button(link, 'Verify email')}<p style="font-size:13px;color:#6b7280">Link: ${link}</p>` }),
  resetPassword: (to, name, link) =>
    sendMail({ to, subject: 'Reset your GO SOFT password', title: 'Password reset',
      html: `<p>Hi ${name}, we received a request to reset your password. This link expires in 30 minutes.</p>${button(link, 'Reset password')}<p style="font-size:13px;color:#6b7280">If you did not request this, you can ignore this email.</p>` }),
  invite: (to, name, company, link) =>
    sendMail({ to, subject: `You're invited to ${company} on GO SOFT`, title: `Hi ${name}`,
      html: `<p>You have been added to <b>${company}</b> on GO SOFT. Set your password to get started.</p>${button(link, 'Accept invitation')}` }),
  companyStatus: (to, company, status, reason) =>
    sendMail({ to, subject: `GO SOFT account ${status}`, title: `${company} — account ${status}`,
      html: `<p>Your company workspace status changed to <b>${status}</b>.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}<p>Contact ${env.support.email} for help.</p>` }),
};

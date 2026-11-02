import { Notification, User } from '../models/index.js';
import { sendMail } from './mailer.js';

/** In-app notification (+ optional email). Never throws into the request path. */
export async function notify(companyId, userIds, { title, body, link, type = 'info', email = false }) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((user) => ({ company: companyId, user, title, body, link, type })));
    if (email) {
      const users = await User.find({ _id: { $in: ids }, status: 'active' }).select('email name').lean();
      await Promise.all(users.map((u) => sendMail({ to: u.email, subject: title, title, html: `<p>Hi ${u.name},</p><p>${body || ''}</p>` })));
    }
  } catch (e) { console.error('[notify]', e.message); }
}

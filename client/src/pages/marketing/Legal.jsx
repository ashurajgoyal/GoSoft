import { useParams, Navigate } from 'react-router-dom';
import { Seo } from '../../components/Seo';

/*
 * TEMPLATE LEGAL CONTENT — have these policies reviewed by your legal advisor before launch.
 * Phase 5 moves them into the Super Admin website CMS so they can be edited without a deploy.
 */
const PAGES = {
  'privacy-policy': {
    title: 'Privacy Policy',
    sections: [
      ['Who we are', 'GO SOFT is a business management platform operated by Goyals Group ("we", "us"). This policy explains how we collect, use and protect personal information when you use GO SOFT.'],
      ['Information we collect', 'Account information (name, email, phone), company information (business name, GSTIN, address), data you and your team enter into GO SOFT (such as invoices, employee and payroll records), and technical data such as IP address, device and usage logs.'],
      ['How we use information', 'To provide and secure the service, process subscriptions, send service notifications, provide support, and improve GO SOFT. We do not sell your personal information.'],
      ['Data isolation & security', 'Each company workspace is logically isolated. We use encryption in transit, encryption of sensitive fields at rest, role-based access controls and audit logging.'],
      ['Data retention', 'We keep your data while your account is active. Data is not deleted automatically because a subscription expires. You can export your data and request account deletion at any time.'],
      ['Your rights', 'You can access, correct, export or request deletion of your personal information by contacting us.'],
      ['Contact', 'For privacy questions, contact our support team using the details on the Contact page.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Acceptance', 'By creating an account or using GO SOFT you agree to these terms on behalf of yourself and the company you represent.'],
      ['Your account', 'You are responsible for keeping your credentials secure and for the actions of users you invite to your workspace.'],
      ['Acceptable use', 'You must not misuse the service, attempt to access other customers’ data, interfere with the platform, or use it for unlawful purposes. We may suspend accounts that violate these terms.'],
      ['Subscriptions', 'Paid plans are billed in advance on a monthly or annual basis. Plan limits and included modules are described on the Pricing page.'],
      ['Your data', 'You own the data you put into GO SOFT. We process it only to provide the service.'],
      ['Compliance', 'GO SOFT provides tools to help with GST and payroll calculations. You remain responsible for the accuracy of your filings and statutory compliance.'],
      ['Liability', 'To the extent permitted by law, our liability is limited to the fees paid for the service in the 12 months preceding a claim.'],
    ],
  },
  'refund-policy': {
    title: 'Refund Policy',
    sections: [
      ['Free trial', 'Every new workspace starts with a free trial so you can evaluate GO SOFT before paying.'],
      ['Refund requests', 'If you are not satisfied with a paid plan, contact support within 7 days of the payment date to request a refund. Approved refunds are returned to the original payment method.'],
      ['Processing time', 'Approved refunds are typically processed within 5–10 business days, depending on your bank or payment provider.'],
    ],
  },
  'cancellation-policy': {
    title: 'Cancellation Policy',
    sections: [
      ['Cancelling', 'You can cancel your subscription at any time from the Subscription page. Your plan remains active until the end of the current billing period.'],
      ['After cancellation', 'When the period ends, your workspace enters a grace period with read-only access and data export. Your data is not deleted automatically.'],
      ['Reactivation', 'You can renew at any time to restore full access to your existing data.'],
    ],
  },
};

export default function Legal() {
  const { slug } = useParams();
  const page = PAGES[slug];
  if (!page) return <Navigate to="/" replace />;
  return (
    <>
      <Seo title={page.title} path={`/legal/${slug}`} />
      <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="text-4xl font-extrabold text-navy-900 dark:text-white">{page.title}</h1>
        {import.meta.env.DEV && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Template content — review with a legal advisor before launch.</p>}
        <div className="mt-10 space-y-8">
          {page.sections.map(([h, p]) => (
            <section key={h}><h2 className="text-lg font-bold text-navy-900 dark:text-white">{h}</h2><p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">{p}</p></section>
          ))}
        </div>
      </article>
    </>
  );
}

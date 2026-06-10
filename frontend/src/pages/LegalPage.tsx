import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '../lib/seo';
import BrandLogo from '../components/BrandLogo';

type LegalPageKind = 'terms' | 'privacy' | 'payment';

const pages = {
  terms: {
    title: 'Terms of Service',
    path: '/terms',
    description: 'Terms for using Wasilio COD operations software during pilot and production use.',
    heading: 'Terms of Service',
    updated: 'June 10, 2026',
    sections: [
      ['Service', 'Wasilio provides COD order operations software for merchant teams, including confirmation queues, callback tracking, courier workflow support, tenant administration, and billing support tools.'],
      ['Pilot Access', 'Pilot access may be limited, manually approved, or suspended while Wasilio evaluates fit, support capacity, payment status, and operational risk.'],
      ['Customer Data', 'Merchants are responsible for entering accurate order, customer, courier, and payment information and for using the service in compliance with applicable privacy and commerce obligations.'],
      ['Availability', 'Wasilio is provided as an early-stage SaaS product. We aim for reliable operation, but maintenance windows, outages, or feature changes may occur during controlled pilots.'],
      ['Acceptable Use', 'Do not use Wasilio to process unlawful orders, abuse rate limits, attempt unauthorized access, or interfere with other tenants.'],
      ['Contact', 'Questions about these terms can be sent to the support contact configured for the deployment.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    path: '/privacy',
    description: 'Privacy policy for Wasilio lead capture and COD merchant operations data.',
    heading: 'Privacy Policy',
    updated: 'June 10, 2026',
    sections: [
      ['Information We Collect', 'Wasilio may collect account details, lead form submissions, order and customer records entered by merchants, courier workflow data, payment records, IP addresses, and operational logs.'],
      ['How We Use Information', 'We use information to operate the service, support merchants, process demo requests, secure accounts, diagnose issues, and improve COD workflows.'],
      ['Lead Capture', 'Demo request forms collect contact name, store name, phone or WhatsApp number, city, order volume, message, and campaign source so Wasilio can follow up with prospective pilot clients.'],
      ['Data Isolation', 'Merchant workspace data is tenant scoped in the application. Internal super-admin access is limited to operational support, billing, and launch-readiness administration.'],
      ['Retention', 'Operational data is retained as needed to provide the service, preserve auditability, and support merchant workflows unless deletion is required or agreed separately.'],
      ['Contact', 'Privacy questions or deletion requests can be sent to the support contact configured for the deployment.'],
    ],
  },
  payment: {
    title: 'Payment And Refund Policy',
    path: '/payment-refund-policy',
    description: 'Manual payment and refund policy for Wasilio pilot merchants.',
    heading: 'Payment And Refund Policy',
    updated: 'June 10, 2026',
    sections: [
      ['Manual Billing', 'Wasilio supports manual billing for pilot merchants, including cash, bank transfer, check, or other agreed payment methods recorded by Wasilio operations.'],
      ['Receipts', 'Receipts can be generated from recorded tenant payments. Receipt records are operational receipts and are not a substitute for tax or accounting advice.'],
      ['Trials', 'Pilot trials may be free, discounted, or manually invoiced depending on the agreement with the merchant. Trial terms should be confirmed before onboarding.'],
      ['Refunds', 'Refunds, credits, or extensions are reviewed case by case based on service availability, payment period, merchant usage, and written agreement with Wasilio operations.'],
      ['Suspension', 'Overdue, suspended, or disabled tenants may be blocked from merchant workflows until payment or support review is complete.'],
      ['Contact', 'Payment questions can be sent to the support contact configured for the deployment.'],
    ],
  },
} satisfies Record<LegalPageKind, {
  title: string;
  path: string;
  description: string;
  heading: string;
  updated: string;
  sections: Array<[string, string]>;
}>;

export default function LegalPage({ kind }: { kind: LegalPageKind }) {
  const page = pages[kind];
  const supportEmail = import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL as string | undefined;
  usePageMeta({
    title: `${page.title} | Wasilio`,
    description: page.description,
    path: page.path,
  });

  return (
    <main className="min-h-screen bg-white text-gray-950">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="Wasilio home">
            <BrandLogo markClassName="h-8 w-8" textClassName="text-xl" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-950">
            <ArrowLeft size={16} />
            Back
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-5 py-12">
        <p className="text-sm font-semibold uppercase text-blue-700">Publication policy</p>
        <h1 className="mt-3 text-4xl font-bold text-gray-950">{page.heading}</h1>
        <p className="mt-3 text-sm text-gray-500">Last updated: {page.updated}</p>
        {supportEmail && (
          <p className="mt-4 text-sm text-gray-600">
            Contact: <a className="font-medium text-blue-700 hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
        )}
        <div className="mt-10 space-y-8">
          {page.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-xl font-semibold text-gray-950">{heading}</h2>
              <p className="mt-3 leading-7 text-gray-700">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

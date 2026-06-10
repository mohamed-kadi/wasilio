import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, MessageCircle, PhoneCall, ShieldCheck, Truck } from 'lucide-react';
import { ApiError, captureMarketingLead, getErrorMessage } from '../api/client';
import { usePageMeta } from '../lib/seo';
import { campaignSourceFromLocation, installMetaPixel, trackLeadSubmitted } from '../lib/tracking';
import { useAuthStore } from '../store/authStore';

const orderVolumes = ['Under 100/month', '100-500/month', '500-1,500/month', '1,500+/month'];

export default function LandingPage() {
  const session = useAuthStore((state) => state.session);
  const whatsappUrl = import.meta.env.VITE_PUBLIC_WHATSAPP_URL as string | undefined;
  const [contactName, setContactName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [monthlyOrderVolume, setMonthlyOrderVolume] = useState(orderVolumes[1]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const campaignSource = useMemo(() => campaignSourceFromLocation(), []);

  usePageMeta({
    title: 'Nexora | COD Operations For Moroccan Merchants',
    description: 'Nexora helps Moroccan COD merchants manage confirmations, callbacks, courier workflows, delivery outcomes, manual payments, and receipts.',
    path: '/',
  });

  useEffect(() => {
    installMetaPixel();
  }, []);

  if (session?.user.role === 'SUPER_ADMIN') {
    return <Navigate to="/admin/billing" replace />;
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      await captureMarketingLead({
        contactName,
        storeName,
        phone,
        email: email || undefined,
        city: city || undefined,
        monthlyOrderVolume,
        message: message || undefined,
        campaignSource: campaignSource || undefined,
      });
      setSubmitted(true);
      trackLeadSubmitted();
      setContactName('');
      setStoreName('');
      setPhone('');
      setEmail('');
      setCity('');
      setMessage('');
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(toFieldErrorMap(submitError));
      }
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-blue-700">nexora</Link>
          <nav className="flex items-center gap-3 text-sm">
            <a href="#pricing" className="hidden font-medium text-gray-600 hover:text-gray-950 sm:inline">Pricing</a>
            <a href="#contact" className="hidden font-medium text-gray-600 hover:text-gray-950 sm:inline">Demo</a>
            <Link to="/login" className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_45%,#f1f8f5_100%)]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">COD operations for Moroccan merchants</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-gray-950 sm:text-5xl">
              Nexora turns WhatsApp follow-ups and delivery spreadsheets into one controlled COD workflow.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-700">
              Manage order confirmation, callbacks, courier assignment, pickup, delivery outcomes, and payment status before your team loses time chasing updates across tools.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">
                Request a pilot demo
                <ArrowRight size={17} />
              </a>
              <a href={whatsappUrl || '#contact'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                <MessageCircle size={17} />
                WhatsApp
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3">
              <Metric label="Orders awaiting confirmation" value="42" tone="blue" />
              <Metric label="Callbacks due today" value="18" tone="amber" />
              <Metric label="Ready for courier assignment" value="27" tone="green" />
            </div>
            <div className="mt-4 rounded-md border border-gray-200">
              {[
                ['Amina Shop', 'CALL_BACK_LATER', 'Casablanca'],
                ['Atlas Store', 'CONFIRMED', 'Rabat'],
                ['Casa Beauty', 'PICKED_UP', 'Marrakech'],
                ['Rif Market', 'DELIVERED', 'Tanger'],
              ].map(([store, status, cityName]) => (
                <div key={store} className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{store}</p>
                    <p className="text-xs text-gray-500">{cityName}</p>
                  </div>
                  <span className="self-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature icon={<PhoneCall size={20} />} title="Confirmation queue" text="Prioritize new COD orders, record every call attempt, and keep follow-ups visible." />
          <Feature icon={<Truck size={20} />} title="Courier operations" text="Assign orders, track pickup, record delivery outcomes, and keep failed deliveries explainable." />
          <Feature icon={<ShieldCheck size={20} />} title="Pilot control" text="Manage tenant status, manual payments, and receipts before opening public self-service." />
        </div>
      </section>

      <section id="pricing" className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-700">Pilot offer</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950">Start with a managed trial before paid rollout.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Price label="Pilot setup" value="Demo first" detail="We configure the first workspace with your team." />
            <Price label="Manual billing" value="MAD" detail="Cash or bank-transfer receipts are supported." />
            <Price label="Best fit" value="COD teams" detail="Stores handling repeated confirmation and delivery workflows." />
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-700">Trial client acquisition</p>
          <h2 className="mt-3 text-3xl font-bold text-gray-950">Request a Nexora pilot demo.</h2>
          <p className="mt-4 leading-7 text-gray-700">
            Share your store details and order volume. We will review fit, schedule a walkthrough, and prepare onboarding for selected pilot merchants.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-700">
            {['No online payment required for the first pilot discussion.', 'Works with cash and bank-transfer billing.', 'Built for Moroccan COD confirmation and courier workflows.'].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 text-green-700" size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {submitted && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Demo request received. Nexora operations can now follow up from the internal lead list.
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact name" name="contactName" value={contactName} error={fieldErrors.contactName} onChange={setContactName} />
            <Field label="Store name" name="storeName" value={storeName} error={fieldErrors.storeName} onChange={setStoreName} />
            <Field label="Phone / WhatsApp" name="phone" value={phone} error={fieldErrors.phone} onChange={setPhone} />
            <Field label="Email" name="email" type="email" value={email} error={fieldErrors.email} onChange={setEmail} required={false} />
            <Field label="City" name="city" value={city} error={fieldErrors.city} onChange={setCity} required={false} />
            <label>
              <span className="mb-1 block text-sm font-medium text-gray-700">Monthly COD orders</span>
              <select
                value={monthlyOrderVolume}
                onChange={(event) => setMonthlyOrderVolume(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {orderVolumes.map((volume) => (
                  <option key={volume} value={volume}>{volume}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">What is hard about your current COD workflow?</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            <ClipboardList size={17} />
            {loading ? 'Sending request' : 'Request demo'}
          </button>
        </form>
      </section>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Nexora. COD operations software for controlled merchant pilots.</p>
          <nav className="flex flex-wrap gap-4">
            <Link to="/terms" className="font-medium hover:text-gray-950">Terms</Link>
            <Link to="/privacy" className="font-medium hover:text-gray-950">Privacy</Link>
            <Link to="/payment-refund-policy" className="font-medium hover:text-gray-950">Payment policy</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">{icon}</div>
      <h3 className="mt-4 font-semibold text-gray-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'green' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
    green: 'bg-green-50 text-green-800',
  };
  return (
    <div className={`rounded-md px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Price({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-semibold text-gray-600">{label}</p>
      <p className="mt-3 text-2xl font-bold text-gray-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{detail}</p>
    </article>
  );
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  error?: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}

function Field({ label, name, value, error, type = 'text', required = true, onChange }: FieldProps) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function toFieldErrorMap(error: ApiError): Record<string, string> {
  return error.fieldErrors.reduce<Record<string, string>>((errors, fieldError) => {
    errors[fieldError.field] = fieldError.message;
    return errors;
  }, {});
}

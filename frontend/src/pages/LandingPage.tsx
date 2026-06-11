import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, Globe2, MessageCircle, PhoneCall, ShieldCheck, Truck } from 'lucide-react';
import { ApiError, captureMarketingLead, getErrorMessage } from '../api/client';
import { usePageMeta } from '../lib/seo';
import { campaignSourceFromLocation, installMetaPixel, trackLeadSubmitted } from '../lib/tracking';
import { useAuthStore } from '../store/authStore';
import BrandLogo from '../components/BrandLogo';

type Language = 'fr' | 'ar' | 'en';

const languages: Array<{ code: Language; label: string; shortLabel: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'fr', label: 'Francais', shortLabel: 'FR', dir: 'ltr' },
  { code: 'ar', label: 'العربية', shortLabel: 'AR', dir: 'rtl' },
  { code: 'en', label: 'English', shortLabel: 'EN', dir: 'ltr' },
];

const orderVolumeValues = ['Under 100/month', '100-500/month', '500-1,500/month', '1,500+/month'];

const copy = {
  fr: {
    metaTitle: 'Wasilio | Operations COD pour marchands marocains',
    metaDescription:
      'Wasilio aide les marchands COD au Maroc a gerer confirmations, relances, coursiers, livraisons, paiements manuels et recus.',
    navPricing: 'Offre pilote',
    navContact: 'Demo',
    signIn: 'Se connecter',
    eyebrow: 'Operations COD pour marchands marocains',
    headline: 'Wasilio aide votre equipe a controler les commandes COD du WhatsApp jusqu a la livraison.',
    subhead:
      'Centralisez confirmations, rappels clients, affectation coursier, ramassage, echecs de livraison et statut de paiement avant que les suivis se perdent entre WhatsApp et les fichiers.',
    primaryCta: 'Demander une demo pilote',
    whatsapp: 'WhatsApp',
    trust: ['Concu pour le COD au Maroc', 'Casablanca, Rabat, Tanger, Marrakech', 'Pilote accompagne avant ouverture publique'],
    metrics: [
      ['Commandes a confirmer', '42'],
      ['Rappels prevus aujourd hui', '18'],
      ['Pretes pour coursier', '27'],
    ],
    demoRows: [
      ['Amina Shop', 'RAPPEL PLUS TARD', 'Casablanca'],
      ['Atlas Store', 'CONFIRMEE', 'Rabat'],
      ['Casa Beauty', 'RAMASSEE', 'Marrakech'],
      ['Rif Market', 'LIVREE', 'Tanger'],
    ],
    features: [
      ['File de confirmation', 'Priorisez les nouvelles commandes, notez chaque appel et gardez les rappels visibles.'],
      ['Operations coursiers', 'Affectez les commandes, suivez le ramassage et documentez les echecs de livraison.'],
      ['Pilotage controle', 'Suivez les marchands pilotes, paiements manuels et recus avant le self-service public.'],
    ],
    processEyebrow: 'Pourquoi maintenant',
    processTitle: 'Le premier objectif est simple: obtenir des marchands pilotes serieux.',
    process:
      'La page doit expliquer rapidement le probleme, montrer que Wasilio connait le terrain COD marocain, puis convertir vers une conversation qualifiee.',
    processSteps: ['Probleme clair', 'Workflow visible', 'Demo qualifiee'],
    pricingEyebrow: 'Offre pilote',
    pricingTitle: 'Commencer par un essai accompagne, pas par un checkout automatique.',
    prices: [
      ['Installation pilote', 'Demo d abord', 'Nous configurons le premier espace avec votre equipe.'],
      ['Facturation manuelle', 'MAD', 'Paiement cash ou virement avec recus.'],
      ['Meilleur fit', 'Equipes COD', 'Boutiques avec confirmations et livraisons repetitives.'],
    ],
    contactEyebrow: 'Acquisition client pilote',
    contactTitle: 'Demander une demo Wasilio.',
    contactText:
      'Partagez votre boutique et votre volume. Les marchands pilotes qualifies peuvent recevoir une configuration accompagnee, des conditions de lancement preferentielles et une revue de leur workflow COD.',
    bullets: [
      'Aucun paiement en ligne requis pour la premiere discussion.',
      'Compatible avec facturation cash ou virement.',
      'Pense pour les confirmations et livraisons COD au Maroc.',
    ],
    submitted: 'Demande recue. L equipe Wasilio peut maintenant vous recontacter.',
    form: {
      contactName: 'Nom du contact',
      storeName: 'Nom de la boutique',
      phone: 'Telephone / WhatsApp',
      email: 'Email',
      city: 'Ville',
      volume: 'Commandes COD par mois',
      challenge: 'Qu est-ce qui complique votre workflow COD aujourd hui ?',
      submit: 'Demander la demo',
      sending: 'Envoi en cours',
      approvedSignup: 'Deja approuve ? Creer votre espace',
    },
    orderVolumes: ['Moins de 100/mois', '100-500/mois', '500-1 500/mois', '1 500+/mois'],
    footer: '© 2026 Wasilio. Logiciel operations COD pour pilotes marchands controles.',
    terms: 'Conditions',
    privacy: 'Confidentialite',
    payment: 'Politique de paiement',
  },
  ar: {
    metaTitle: 'Wasilio | عمليات الدفع عند الاستلام للتجار في المغرب',
    metaDescription:
      'Wasilio يساعد تجار الدفع عند الاستلام في المغرب على تنظيم تأكيد الطلبات، المتابعات، الموزعين، التسليم، الاداء اليدوي والوصولات.',
    navPricing: 'عرض التجربة',
    navContact: 'تجربة',
    signIn: 'تسجيل الدخول',
    eyebrow: 'عمليات الدفع عند الاستلام للتجار في المغرب',
    headline: 'Wasilio يساعد فريقك على التحكم في طلبات COD من واتساب حتى التسليم.',
    subhead:
      'اجمع تأكيد الطلبات، مواعيد الاتصال، تعيين الموزعين، الاستلام، مشاكل التسليم وحالة الاداء في مكان واحد بدل التشتت بين واتساب والملفات.',
    primaryCta: 'اطلب تجربة موجهة',
    whatsapp: 'واتساب',
    trust: ['مصمم لسوق COD في المغرب', 'الدار البيضاء، الرباط، طنجة، مراكش', 'تجربة مرافقة قبل الاطلاق العام'],
    metrics: [
      ['طلبات تنتظر التأكيد', '42'],
      ['اتصالات اليوم', '18'],
      ['جاهزة للموزع', '27'],
    ],
    demoRows: [
      ['Amina Shop', 'اتصال لاحق', 'الدار البيضاء'],
      ['Atlas Store', 'مؤكد', 'الرباط'],
      ['Casa Beauty', 'تم الاستلام', 'مراكش'],
      ['Rif Market', 'تم التسليم', 'طنجة'],
    ],
    features: [
      ['قائمة التأكيد', 'رتب الطلبات الجديدة، سجل كل اتصال، واجعل المتابعات واضحة للفريق.'],
      ['عمليات الموزعين', 'عين الطلبات، تابع الاستلام، وسجل سبب فشل التسليم عند الحاجة.'],
      ['تحكم في التجربة', 'تابع التجار التجريبيين، الاداءات اليدوية والوصولات قبل فتح التسجيل العام.'],
    ],
    processEyebrow: 'لماذا الآن',
    processTitle: 'الهدف الاول واضح: جلب تجار جادين للتجربة.',
    process:
      'الصفحة يجب ان تشرح المشكل بسرعة، تبين ان Wasilio يفهم واقع COD في المغرب، ثم تحول الزائر الى محادثة مؤهلة.',
    processSteps: ['مشكل واضح', 'مسار عمل ظاهر', 'تجربة مؤهلة'],
    pricingEyebrow: 'عرض التجربة',
    pricingTitle: 'نبدأ بتجربة مرافقة، وليس بأداء اوتوماتيكي.',
    prices: [
      ['اعداد التجربة', 'Demo اولا', 'نجهز اول مساحة عمل مع فريقك.'],
      ['فوترة يدوية', 'MAD', 'كاش او تحويل بنكي مع وصولات.'],
      ['الانسب', 'فرق COD', 'متاجر لديها تأكيدات وتسليمات متكررة.'],
    ],
    contactEyebrow: 'اكتساب عميل تجريبي',
    contactTitle: 'اطلب تجربة Wasilio.',
    contactText: 'شاركنا معلومات المتجر وحجم الطلبات. التجار المؤهلون للتجربة يمكنهم الحصول على اعداد مرفق، شروط انطلاق خاصة، ومراجعة لمسار COD.',
    bullets: [
      'لا حاجة لأي أداء أونلاين في أول محادثة.',
      'يدعم الفوترة بالكاش او التحويل البنكي.',
      'مصمم لتأكيد الطلبات والتسليم COD في المغرب.',
    ],
    submitted: 'تم استلام الطلب. فريق Wasilio سيتواصل معك.',
    form: {
      contactName: 'اسم المسؤول',
      storeName: 'اسم المتجر',
      phone: 'الهاتف / واتساب',
      email: 'البريد الالكتروني',
      city: 'المدينة',
      volume: 'طلبات COD في الشهر',
      challenge: 'ما الذي يصعب عليك في مسار COD اليوم؟',
      submit: 'اطلب التجربة',
      sending: 'جار الارسال',
      approvedSignup: 'تمت الموافقة؟ انشئ مساحة العمل',
    },
    orderVolumes: ['اقل من 100/شهر', '100-500/شهر', '500-1,500/شهر', '+1,500/شهر'],
    footer: '© 2026 Wasilio. برنامج عمليات COD لتجارب تجار مضبوطة.',
    terms: 'الشروط',
    privacy: 'الخصوصية',
    payment: 'سياسة الاداء',
  },
  en: {
    metaTitle: 'Wasilio | COD Operations For Moroccan Merchants',
    metaDescription:
      'Wasilio helps Moroccan COD merchants manage confirmations, callbacks, courier workflows, delivery outcomes, manual payments, and receipts.',
    navPricing: 'Pilot offer',
    navContact: 'Demo',
    signIn: 'Sign in',
    eyebrow: 'COD operations for Moroccan merchants',
    headline: 'Wasilio helps your team control COD orders from WhatsApp follow-up to delivery.',
    subhead:
      'Centralize confirmations, callbacks, courier assignment, pickup, failed delivery reasons, and payment status before updates disappear across chats and spreadsheets.',
    primaryCta: 'Request a pilot demo',
    whatsapp: 'WhatsApp',
    trust: ['Built for Moroccan COD', 'Casablanca, Rabat, Tangier, Marrakech', 'Managed pilot before public launch'],
    metrics: [
      ['Orders awaiting confirmation', '42'],
      ['Callbacks due today', '18'],
      ['Ready for courier assignment', '27'],
    ],
    demoRows: [
      ['Amina Shop', 'CALL BACK', 'Casablanca'],
      ['Atlas Store', 'CONFIRMED', 'Rabat'],
      ['Casa Beauty', 'PICKED UP', 'Marrakech'],
      ['Rif Market', 'DELIVERED', 'Tangier'],
    ],
    features: [
      ['Confirmation queue', 'Prioritize new COD orders, record every call attempt, and keep follow-ups visible.'],
      ['Courier operations', 'Assign orders, track pickup, record delivery outcomes, and explain failed deliveries.'],
      ['Pilot control', 'Manage tenant status, manual payments, and receipts before opening public self-service.'],
    ],
    processEyebrow: 'Why this page',
    processTitle: 'The first goal is simple: attract serious pilot merchants.',
    process:
      'The page should explain the problem quickly, show Moroccan COD fit, then convert the visitor into a qualified conversation.',
    processSteps: ['Clear problem', 'Visible workflow', 'Qualified demo'],
    pricingEyebrow: 'Pilot offer',
    pricingTitle: 'Start with a managed trial, not an automated checkout.',
    prices: [
      ['Pilot setup', 'Demo first', 'We configure the first workspace with your team.'],
      ['Manual billing', 'MAD', 'Cash or bank-transfer receipts are supported.'],
      ['Best fit', 'COD teams', 'Stores handling repeated confirmation and delivery workflows.'],
    ],
    contactEyebrow: 'Trial client acquisition',
    contactTitle: 'Request a Wasilio pilot demo.',
    contactText:
      'Share your store details and order volume. Qualified pilot merchants may receive guided setup, preferential launch terms, and a review of their COD workflow.',
    bullets: [
      'No online payment required for the first pilot discussion.',
      'Works with cash and bank-transfer billing.',
      'Built for Moroccan COD confirmation and courier workflows.',
    ],
    submitted: 'Demo request received. Wasilio operations can now follow up.',
    form: {
      contactName: 'Contact name',
      storeName: 'Store name',
      phone: 'Phone / WhatsApp',
      email: 'Email',
      city: 'City',
      volume: 'Monthly COD orders',
      challenge: 'What is hard about your current COD workflow?',
      submit: 'Request demo',
      sending: 'Sending request',
      approvedSignup: 'Already approved? Create your workspace',
    },
    orderVolumes: orderVolumeValues,
    footer: '© 2026 Wasilio. COD operations software for controlled merchant pilots.',
    terms: 'Terms',
    privacy: 'Privacy',
    payment: 'Payment policy',
  },
} satisfies Record<Language, LandingCopy>;

interface LandingCopy {
  metaTitle: string;
  metaDescription: string;
  navPricing: string;
  navContact: string;
  signIn: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: string;
  whatsapp: string;
  trust: string[];
  metrics: string[][];
  demoRows: string[][];
  features: string[][];
  processEyebrow: string;
  processTitle: string;
  process: string;
  processSteps: string[];
  pricingEyebrow: string;
  pricingTitle: string;
  prices: string[][];
  contactEyebrow: string;
  contactTitle: string;
  contactText: string;
  bullets: string[];
  submitted: string;
  form: {
    contactName: string;
    storeName: string;
    phone: string;
    email: string;
    city: string;
    volume: string;
    challenge: string;
    submit: string;
    sending: string;
    approvedSignup: string;
  };
  orderVolumes: string[];
  footer: string;
  terms: string;
  privacy: string;
  payment: string;
}

export default function LandingPage() {
  const session = useAuthStore((state) => state.session);
  const whatsappUrl = import.meta.env.VITE_PUBLIC_WHATSAPP_URL as string | undefined;
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const content = copy[language];
  const direction = languages.find((item) => item.code === language)?.dir ?? 'ltr';
  const [contactName, setContactName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [monthlyOrderVolume, setMonthlyOrderVolume] = useState(orderVolumeValues[1]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const campaignSource = useMemo(() => campaignSourceFromLocation(), []);

  usePageMeta({
    title: content.metaTitle,
    description: content.metaDescription,
    path: '/',
  });

  useEffect(() => {
    installMetaPixel();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    window.localStorage.setItem('wasilio.landing.language', language);
  }, [direction, language]);

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
    <main dir={direction} className="min-h-screen bg-white text-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <Link to="/" aria-label="Wasilio home">
            <BrandLogo markClassName="h-8 w-8" textClassName="text-xl" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#pricing" className="hidden font-medium text-gray-600 hover:text-gray-950 sm:inline">
              {content.navPricing}
            </a>
            <a href="#contact" className="hidden font-medium text-gray-600 hover:text-gray-950 sm:inline">
              {content.navContact}
            </a>
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <Link to="/login" className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50">
              {content.signIn}
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-gray-200 bg-[linear-gradient(135deg,#f2f7f5_0%,#ffffff_48%,#eef6ff_100%)]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-gray-950 sm:text-5xl">{content.headline}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-700">{content.subhead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 rounded-md bg-[#0F5B4A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0b493b]">
                {content.primaryCta}
                <ArrowRight size={17} className={direction === 'rtl' ? 'rotate-180' : ''} />
              </a>
              <a href={whatsappUrl || '#contact'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                <MessageCircle size={17} />
                {content.whatsapp}
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl gap-2 text-sm text-gray-700 sm:grid-cols-3">
              {content.trust.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0F5B4A]" size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {content.metrics.map(([label, value], index) => (
                <Metric key={label} label={label} value={value} tone={index === 0 ? 'green' : index === 1 ? 'amber' : 'blue'} />
              ))}
            </div>
            <div className="mt-4 rounded-md border border-gray-200">
              {content.demoRows.map(([store, status, cityName]) => (
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

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {content.features.map(([title, text], index) => (
            <Feature
              key={title}
              icon={index === 0 ? <PhoneCall size={20} /> : index === 1 ? <Truck size={20} /> : <ShieldCheck size={20} />}
              title={title}
              text={text}
            />
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.processEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950">{content.processTitle}</h2>
            <p className="mt-4 leading-7 text-gray-700">{content.process}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {content.processSteps.map((step, index) => (
              <article key={step} className="rounded-lg border border-gray-200 bg-white p-5">
                <p className="text-sm font-semibold text-gray-500">0{index + 1}</p>
                <p className="mt-3 text-lg font-bold text-gray-950">{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.pricingEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold text-gray-950">{content.pricingTitle}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {content.prices.map(([label, value, detail]) => (
            <Price key={label} label={label} value={value} detail={detail} />
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.contactEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950">{content.contactTitle}</h2>
            <p className="mt-4 leading-7 text-gray-700">{content.contactText}</p>
            <ul className="mt-6 space-y-3 text-sm text-gray-700">
              {content.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0F5B4A]" size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            {submitted && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{content.submitted}</div>
            )}
            {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={content.form.contactName} name="contactName" value={contactName} error={fieldErrors.contactName} onChange={setContactName} />
              <Field label={content.form.storeName} name="storeName" value={storeName} error={fieldErrors.storeName} onChange={setStoreName} />
              <Field label={content.form.phone} name="phone" value={phone} error={fieldErrors.phone} onChange={setPhone} />
              <Field label={content.form.email} name="email" type="email" value={email} error={fieldErrors.email} onChange={setEmail} required={false} />
              <Field label={content.form.city} name="city" value={city} error={fieldErrors.city} onChange={setCity} required={false} />
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">{content.form.volume}</span>
                <select
                  value={monthlyOrderVolume}
                  onChange={(event) => setMonthlyOrderVolume(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5B4A]"
                >
                  {orderVolumeValues.map((volume, index) => (
                    <option key={volume} value={volume}>
                      {content.orderVolumes[index]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">{content.form.challenge}</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5B4A]"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0F5B4A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0b493b] disabled:opacity-50"
            >
              <ClipboardList size={17} />
              {loading ? content.form.sending : content.form.submit}
            </button>
            <Link to="/signup" className="mt-3 block text-center text-sm font-medium text-gray-600 hover:text-gray-950">
              {content.form.approvedSignup}
            </Link>
          </form>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>{content.footer}</p>
          <nav className="flex flex-wrap gap-4">
            <Link to="/terms" className="font-medium hover:text-gray-950">
              {content.terms}
            </Link>
            <Link to="/privacy" className="font-medium hover:text-gray-950">
              {content.privacy}
            </Link>
            <Link to="/payment-refund-policy" className="font-medium hover:text-gray-950">
              {content.payment}
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function LanguageSwitcher({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white p-1" aria-label="Language selector">
      <Globe2 size={15} className="mx-1 text-gray-500" />
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          aria-label={item.label}
          aria-pressed={language === item.code}
          onClick={() => onChange(item.code)}
          className={`rounded px-2 py-1 text-xs font-semibold ${
            language === item.code ? 'bg-[#0F5B4A] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {item.shortLabel}
        </button>
      ))}
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#e9f4f0] text-[#0F5B4A]">{icon}</div>
      <h3 className="mt-4 font-semibold text-gray-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'green' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
    green: 'bg-[#e9f4f0] text-[#0F5B4A]',
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
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5B4A] ${
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

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'fr';
  }

  const stored = window.localStorage.getItem('wasilio.landing.language');
  if (stored === 'fr' || stored === 'ar' || stored === 'en') {
    return stored;
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith('ar')) {
    return 'ar';
  }

  return 'fr';
}

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
    metaTitle: 'Wasilio | Confirmation COD pour marchands marocains',
    metaDescription:
      'Wasilio aide les marchands COD au Maroc a confirmer les commandes, suivre les rappels et passer seulement les commandes confirmees aux coursiers.',
    navPricing: 'Modele pilote',
    navContact: 'Demo',
    signIn: 'Acces pilote',
    eyebrow: 'Confirmation COD pour marchands marocains',
    headline: 'Arretez de perdre des commandes COD entre appels, rappels et WhatsApp.',
    subhead:
      'Wasilio donne a votre equipe une file claire pour confirmer chaque commande, planifier les rappels, voir les appels manques et passer seulement les commandes confirmees aux coursiers.',
    primaryCta: 'Demander une demo',
    whatsapp: 'WhatsApp',
    trust: ['Specialise dans la confirmation COD', 'Essai accompagne pour marchands pilotes', 'Facturation manuelle: cash ou virement'],
    metrics: [
      ['Commandes a confirmer', '42'],
      ['Rappels a ne pas oublier', '18'],
      ['Confirmees pour coursier', '27'],
    ],
    demoRows: [
      ['Amina Shop', 'RAPPEL PLUS TARD', 'Casablanca'],
      ['Atlas Store', 'CONFIRMEE', 'Rabat'],
      ['Casa Beauty', 'RAMASSEE', 'Marrakech'],
      ['Rif Market', 'LIVREE', 'Tanger'],
    ],
    features: [
      ['File de confirmation', 'Une liste unique pour appeler, noter le resultat et eviter les doubles appels.'],
      ['Rappels visibles', 'Chaque rappel programme reste dans la queue jusqu a resolution, au lieu de disparaitre dans WhatsApp.'],
      ['Passage coursier propre', 'Les commandes confirmees avancent vers affectation, ramassage, livraison ou echec documente.'],
    ],
    processEyebrow: 'Workflow de confirmation',
    processTitle: 'Chaque commande garde une prochaine action claire.',
    process:
      'Au lieu de chercher qui a appele le client, Wasilio garde l historique des tentatives, les rappels dus et le statut final avant la livraison.',
    processSteps: ['Nouvelle commande', 'Appel ou rappel', 'Confirmee ou rejetee'],
    pricingEyebrow: 'Modele pilote',
    pricingTitle: 'Business model simple: essai accompagne, puis abonnement mensuel manuel.',
    prices: [
      ['Etape 1', 'Demo gratuite', 'On regarde votre workflow de confirmation avant toute decision.'],
      ['Etape 2', 'Pilote accompagne', 'Un espace de test est configure pour votre equipe si le besoin est clair.'],
      ['Etape 3', 'Abonnement MAD', 'Paiement mensuel manuel par cash ou virement, avec recu.'],
    ],
    contactEyebrow: 'Demande de demo',
    contactTitle: 'Voyons si votre probleme de confirmation vaut un pilote Wasilio.',
    contactText:
      'Partagez votre boutique, votre volume COD et ce qui bloque aujourd hui: appels oublies, rappels non suivis, clients injoignables ou commandes envoyees trop vite au coursier.',
    bullets: [
      'Le premier appel sert a comprendre votre workflow, pas a vendre un checkout.',
      'Le pilote cible les equipes qui confirment beaucoup de commandes chaque jour.',
      'Le paiement reste manuel au lancement: cash ou virement avec recu.',
    ],
    submitted: 'Demande recue. L equipe Wasilio peut maintenant vous recontacter.',
    form: {
      contactName: 'Nom du contact',
      storeName: 'Nom de la boutique',
      phone: 'Telephone / WhatsApp',
      email: 'Email',
      city: 'Ville',
      volume: 'Commandes COD par mois',
      challenge: 'Quel est votre plus gros probleme de confirmation aujourd hui ?',
      submit: 'Demander la demo',
      sending: 'Envoi en cours',
      approvedSignup: 'Les espaces pilotes sont ouverts apres validation.',
    },
    orderVolumes: ['Moins de 100/mois', '100-500/mois', '500-1 500/mois', '1 500+/mois'],
    footer: '© 2026 Wasilio. Logiciel de confirmation COD pour marchands pilotes.',
    terms: 'Conditions',
    privacy: 'Confidentialite',
    payment: 'Politique de paiement',
  },
  ar: {
    metaTitle: 'Wasilio | تأكيد طلبات COD للتجار في المغرب',
    metaDescription:
      'Wasilio يساعد تجار COD في المغرب على تأكيد الطلبات، تتبع المواعيد، وتمرير الطلبات المؤكدة فقط للموزعين.',
    navPricing: 'نموذج التجربة',
    navContact: 'تجربة',
    signIn: 'دخول التجربة',
    eyebrow: 'تأكيد طلبات COD للتجار في المغرب',
    headline: 'توقف عن ضياع طلبات COD بين المكالمات، المواعيد وواتساب.',
    subhead:
      'Wasilio يعطي فريقك لائحة واضحة لتأكيد كل طلب، برمجة الاتصالات اللاحقة، رؤية المكالمات غير الناجحة، وتمرير الطلبات المؤكدة فقط للموزعين.',
    primaryCta: 'اطلب ديمو',
    whatsapp: 'واتساب',
    trust: ['متخصص في تأكيد COD', 'تجربة مرافقة للتجار الجادين', 'فوترة يدوية: كاش او تحويل'],
    metrics: [
      ['طلبات تنتظر التأكيد', '42'],
      ['مواعيد لا يجب نسيانها', '18'],
      ['مؤكدة للموزع', '27'],
    ],
    demoRows: [
      ['Amina Shop', 'اتصال لاحق', 'الدار البيضاء'],
      ['Atlas Store', 'مؤكد', 'الرباط'],
      ['Casa Beauty', 'تم الاستلام', 'مراكش'],
      ['Rif Market', 'تم التسليم', 'طنجة'],
    ],
    features: [
      ['لائحة التأكيد', 'مكان واحد للاتصال، تسجيل النتيجة، وتفادي تكرار المكالمات.'],
      ['المواعيد واضحة', 'كل اتصال لاحق يبقى ظاهرا حتى يتم حله بدل ان يضيع في واتساب.'],
      ['تسليم منظم للموزع', 'الطلبات المؤكدة فقط تنتقل للتعيين، الاستلام، التسليم او سبب الفشل.'],
    ],
    processEyebrow: 'مسار التأكيد',
    processTitle: 'كل طلب عنده الخطوة القادمة واضحة.',
    process:
      'بدل البحث عمن اتصل بالزبون، Wasilio يحفظ محاولات الاتصال، المواعيد القريبة، والقرار النهائي قبل التسليم.',
    processSteps: ['طلب جديد', 'اتصال او موعد', 'مؤكد او مرفوض'],
    pricingEyebrow: 'نموذج التجربة',
    pricingTitle: 'نموذج واضح: ديمو، ثم تجربة مرافقة، ثم اشتراك شهري يدوي.',
    prices: [
      ['الخطوة 1', 'ديمو مجاني', 'نراجع طريقة تأكيد الطلبات قبل اي قرار.'],
      ['الخطوة 2', 'تجربة مرافقة', 'نجهز مساحة اختبار للفريق اذا كان الاحتياج واضحا.'],
      ['الخطوة 3', 'اشتراك بالدرهم', 'اداء شهري يدوي كاش او تحويل مع وصل.'],
    ],
    contactEyebrow: 'طلب ديمو',
    contactTitle: 'لنرى هل مشكل تأكيد الطلبات يستحق تجربة Wasilio.',
    contactText: 'شاركنا المتجر، حجم طلبات COD، وما الذي يعرقل التأكيد اليوم: مواعيد منسية، زبائن غير متاحين، او طلبات تذهب بسرعة للموزع.',
    bullets: [
      'اول اتصال لفهم workflow وليس لبيع checkout.',
      'التجربة مناسبة للفرق التي تؤكد طلبات كثيرة يوميا.',
      'الاداء في البداية يدوي: كاش او تحويل مع وصل.',
    ],
    submitted: 'تم استلام الطلب. فريق Wasilio سيتواصل معك.',
    form: {
      contactName: 'اسم المسؤول',
      storeName: 'اسم المتجر',
      phone: 'الهاتف / واتساب',
      email: 'البريد الالكتروني',
      city: 'المدينة',
      volume: 'طلبات COD في الشهر',
      challenge: 'ما هو اكبر مشكل عندك في تأكيد الطلبات اليوم؟',
      submit: 'اطلب التجربة',
      sending: 'جار الارسال',
      approvedSignup: 'مساحات التجربة تفتح بعد الموافقة.',
    },
    orderVolumes: ['اقل من 100/شهر', '100-500/شهر', '500-1,500/شهر', '+1,500/شهر'],
    footer: '© 2026 Wasilio. برنامج تأكيد COD لتجار تجريبيين.',
    terms: 'الشروط',
    privacy: 'الخصوصية',
    payment: 'سياسة الاداء',
  },
  en: {
    metaTitle: 'Wasilio | COD Confirmation For Moroccan Merchants',
    metaDescription:
      'Wasilio helps Moroccan COD merchants confirm orders, track callbacks, and hand only confirmed orders to couriers.',
    navPricing: 'Pilot model',
    navContact: 'Demo',
    signIn: 'Pilot access',
    eyebrow: 'COD confirmation for Moroccan merchants',
    headline: 'Stop losing COD orders between calls, callbacks, and WhatsApp.',
    subhead:
      'Wasilio gives your team one clear queue to confirm every order, schedule callbacks, see missed attempts, and hand only confirmed orders to couriers.',
    primaryCta: 'Request a demo',
    whatsapp: 'WhatsApp',
    trust: ['Focused on COD confirmation', 'Guided pilot for serious merchants', 'Manual billing: cash or bank transfer'],
    metrics: [
      ['Orders awaiting confirmation', '42'],
      ['Callbacks not to miss', '18'],
      ['Confirmed for courier', '27'],
    ],
    demoRows: [
      ['Amina Shop', 'CALL BACK', 'Casablanca'],
      ['Atlas Store', 'CONFIRMED', 'Rabat'],
      ['Casa Beauty', 'PICKED UP', 'Marrakech'],
      ['Rif Market', 'DELIVERED', 'Tangier'],
    ],
    features: [
      ['Confirmation queue', 'One place to call customers, record the result, and avoid duplicate follow-up.'],
      ['Visible callbacks', 'Every scheduled callback stays visible until it is resolved instead of disappearing in WhatsApp.'],
      ['Clean courier handoff', 'Confirmed orders move to assignment, pickup, delivery, or a documented failure reason.'],
    ],
    processEyebrow: 'Confirmation workflow',
    processTitle: 'Every order keeps a clear next action.',
    process:
      'Instead of asking who called the customer, Wasilio keeps the attempt history, due callbacks, and final confirmation status in one workflow before delivery.',
    processSteps: ['New order', 'Call or callback', 'Confirmed or rejected'],
    pricingEyebrow: 'Pilot model',
    pricingTitle: 'Simple business model: demo, guided pilot, then monthly manual subscription.',
    prices: [
      ['Step 1', 'Free demo', 'We review your confirmation workflow before any decision.'],
      ['Step 2', 'Guided pilot', 'A test workspace is configured if the operational need is clear.'],
      ['Step 3', 'MAD subscription', 'Monthly manual payment by cash or bank transfer, with receipt.'],
    ],
    contactEyebrow: 'Demo request',
    contactTitle: 'Let us see if your confirmation problem is worth a Wasilio pilot.',
    contactText:
      'Share your store, COD volume, and what breaks today: forgotten callbacks, unreachable customers, duplicate calls, or orders sent to couriers before they are truly confirmed.',
    bullets: [
      'The first call is a workflow review, not an online checkout.',
      'The pilot is for teams confirming many COD orders every day.',
      'Billing stays manual at launch: cash or bank transfer with receipt.',
    ],
    submitted: 'Demo request received. Wasilio operations can now follow up.',
    form: {
      contactName: 'Contact name',
      storeName: 'Store name',
      phone: 'Phone / WhatsApp',
      email: 'Email',
      city: 'City',
      volume: 'Monthly COD orders',
      challenge: 'What is your biggest confirmation problem today?',
      submit: 'Request demo',
      sending: 'Sending request',
      approvedSignup: 'Pilot workspaces are opened after approval.',
    },
    orderVolumes: orderVolumeValues,
    footer: '© 2026 Wasilio. COD confirmation software for controlled merchant pilots.',
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
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <Link to="/" aria-label="Wasilio home">
            <BrandLogo markClassName="h-8 w-8" textClassName="text-xl" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#pricing" className="hidden font-medium text-slate-600 hover:text-slate-950 sm:inline">
              {content.navPricing}
            </a>
            <a href="#contact" className="hidden font-medium text-slate-600 hover:text-slate-950 sm:inline">
              {content.navContact}
            </a>
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <Link to="/login" className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50">
              {content.signIn}
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-[#f7fbf9]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="inline-flex w-fit rounded-md bg-[#E8F4EF] px-3 py-1 text-sm font-semibold uppercase text-[#0F5B4A]">{content.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">{content.headline}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">{content.subhead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 rounded-md bg-[#E2552D] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c84725]">
                {content.primaryCta}
                <ArrowRight size={17} className={direction === 'rtl' ? 'rotate-180' : ''} />
              </a>
              <a href={whatsappUrl || '#contact'} className="inline-flex items-center gap-2 rounded-md border border-[#0F5B4A]/30 bg-white px-5 py-3 text-sm font-semibold text-[#0F5B4A] hover:bg-[#E8F4EF]">
                <MessageCircle size={17} />
                {content.whatsapp}
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl gap-2 text-sm text-slate-700 sm:grid-cols-3">
              {content.trust.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-md border border-white bg-white/70 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0F5B4A]" size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#0F5B4A]/20 bg-white p-4 shadow-lg shadow-slate-200/70">
            <div className="mb-4 rounded-md bg-slate-950 px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase text-[#F6B24A]">Live confirmation desk</p>
              <p className="mt-1 text-sm text-slate-200">One queue for calls, callbacks, and courier handoff.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {content.metrics.map(([label, value], index) => (
                <Metric key={label} label={label} value={value} tone={index === 0 ? 'green' : index === 1 ? 'amber' : 'blue'} />
              ))}
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              {content.demoRows.map(([store, status, cityName]) => (
                <div key={store} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{store}</p>
                    <p className="text-xs text-slate-500">{cityName}</p>
                  </div>
                  <span className="self-center rounded-md bg-[#FFF1D7] px-2 py-1 text-xs font-semibold text-[#8A4F00]">{status}</span>
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

      <section className="border-y border-slate-200 bg-[#102A43] text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#F6B24A]">{content.processEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold text-white">{content.processTitle}</h2>
            <p className="mt-4 leading-7 text-slate-200">{content.process}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {content.processSteps.map((step, index) => (
              <article key={step} className="rounded-lg border border-white/15 bg-white/10 p-5">
                <p className="text-sm font-semibold text-[#F6B24A]">0{index + 1}</p>
                <p className="mt-3 text-lg font-bold text-white">{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.pricingEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">{content.pricingTitle}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {content.prices.map(([label, value, detail], index) => (
            <Price key={label} label={label} value={value} detail={detail} featured={index === 1} />
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-slate-200 bg-[#F7FAF9]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.contactEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">{content.contactTitle}</h2>
            <p className="mt-4 leading-7 text-slate-700">{content.contactText}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {content.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0F5B4A]" size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="rounded-lg border border-[#0F5B4A]/20 bg-white p-5 shadow-lg shadow-slate-200/70">
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E2552D]"
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
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E2552D]"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#E2552D] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c84725] disabled:opacity-50"
            >
              <ClipboardList size={17} />
              {loading ? content.form.sending : content.form.submit}
            </button>
            <p className="mt-3 text-center text-sm font-medium text-gray-600">
              {content.form.approvedSignup}
            </p>
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
  const currentLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <label className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
      <Globe2 size={15} className="text-slate-500" />
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={currentLanguage.code}
        onChange={(event) => onChange(event.target.value as Language)}
        className="max-w-[4.5rem] bg-transparent text-xs font-semibold uppercase text-slate-700 outline-none"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.shortLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#E8F4EF] text-[#0F5B4A]">{icon}</div>
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'green' }) {
  const tones = {
    blue: 'bg-[#EAF2FF] text-[#214C8A]',
    amber: 'bg-[#FFF1D7] text-[#8A4F00]',
    green: 'bg-[#E8F4EF] text-[#0F5B4A]',
  };
  return (
    <div className={`rounded-md px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Price({ label, value, detail, featured = false }: { label: string; value: string; detail: string; featured?: boolean }) {
  return (
    <article className={`rounded-lg border p-5 ${featured ? 'border-[#E2552D] bg-[#FFF7F2]' : 'border-slate-200 bg-white'}`}>
      <p className={`text-sm font-semibold ${featured ? 'text-[#B94623]' : 'text-slate-600'}`}>{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
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
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E2552D] ${
          error ? 'border-red-300' : 'border-slate-300'
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

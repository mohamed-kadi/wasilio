import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Globe2,
  MessageCircle,
  PackageCheck,
  PhoneCall,
  ReceiptText,
  Truck,
  Users,
} from 'lucide-react';
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
    headline: 'Le bureau de controle pour vos commandes COD au Maroc.',
    subhead:
      'Wasilio aide votre equipe a confirmer les commandes, suivre les rappels, coordonner les coursiers et comprendre les echecs de livraison depuis un seul espace.',
    primaryCta: 'Demander un pilotage',
    whatsapp: 'Parler sur WhatsApp',
    heroModel: ['Audit rapide du workflow', 'Espace pilote configure avec vous', 'Paiement mensuel manuel en MAD'],
    trust: ['Fait pour WhatsApp, appels et cash a la livraison', 'Pilote ouvert apres validation humaine', 'Recu disponible pour cash ou virement'],
    heroPromise: 'Pas une inscription ouverte: votre demande est revue, puis nous configurons le premier workflow avec vous.',
    metrics: [
      ['Commandes a confirmer', '42'],
      ['Rappels a ne pas oublier', '18'],
      ['Confirmees pour coursier', '27'],
    ],
    deskTitle: 'Bureau de suivi COD',
    deskText: 'Une vue pour decider: appeler, relancer, rejeter ou passer au coursier.',
    demoRows: [
      ['Amina Shop', 'RAPPEL PLUS TARD', 'Casablanca'],
      ['Atlas Store', 'CONFIRMEE', 'Rabat'],
      ['Casa Beauty', 'RAMASSEE', 'Marrakech'],
      ['Rif Market', 'LIVREE', 'Tanger'],
    ],
    features: [
      ['Priorite du jour', 'La page d accueil montre ce qui attend confirmation, ce qui est chez les coursiers, et ce qui a echoue.'],
      ['Relances controlees', 'Les rappels restent visibles jusqu a resolution, meme quand la journee devient chargee.'],
      ['Handoff coursier', 'Seules les commandes pretes avancent vers affectation, ramassage ou suivi d echec.'],
    ],
    proofEyebrow: 'Pourquoi les equipes COD perdent de l argent',
    proofTitle: 'Wasilio remet les appels, rappels et livraisons dans un seul flux.',
    proofCards: [
      ['Moins de commandes oubliees', 'Les rappels et commandes en attente restent visibles au lieu de disparaitre dans WhatsApp.'],
      ['Moins de confusion coursier', 'Les commandes passent par affectation, ramassage, livraison ou echec avec une trace claire.'],
      ['Meilleur suivi pilote', 'Les paiements manuels, recus et statuts client donnent une base commerciale pour demarrer.'],
    ],
    processEyebrow: 'Workflow de confirmation',
    processTitle: 'Votre equipe ne devine plus la prochaine action.',
    process:
      'Wasilio garde les tentatives, les notes et la decision finale dans le meme workflow avant la livraison.',
    processSteps: ['Nouvelle commande', 'Appel ou rappel', 'Confirmee ou rejetee'],
    pricingEyebrow: 'Modele pilote',
    pricingTitle: 'Demo gratuite, pilote configure ensemble, puis abonnement mensuel.',
    prices: [
      ['Etape 1', 'Diagnostic gratuit', 'On regarde votre workflow COD, vos volumes et vos pertes avant toute decision.'],
      ['Etape 2', 'Pilote accompagne', 'Un espace de test est configure avec vos premieres files de confirmation et livraison.'],
      ['Etape 3', 'Abonnement MAD', 'Paiement mensuel manuel par cash ou virement, avec recu dans Wasilio.'],
    ],
    contactEyebrow: 'Demande de demo',
    contactTitle: 'Demandez une revue de votre workflow COD.',
    contactText:
      'Partagez votre boutique, votre volume COD et le blocage principal. Nous vous recontactons par telephone ou WhatsApp, puis nous ouvrons un espace pilote seulement si le besoin est clair.',
    bullets: [
      'Premier appel: comprendre vos operations et vos pertes.',
      'Pilote: configuration guidee de votre premier workflow.',
      'Paiement: manuel au lancement, cash ou virement avec recu.',
    ],
    afterSubmitTitle: 'Apres votre demande',
    afterSubmitSteps: ['Nous appelons ou envoyons un WhatsApp', 'Nous qualifions le besoin COD', 'Nous creons le pilote si le fit est clair'],
    submitted: 'Demande recue. L equipe Wasilio peut maintenant vous recontacter.',
    form: {
      contactName: 'Nom du contact',
      storeName: 'Nom de la boutique',
      phone: 'Telephone / WhatsApp',
      email: 'Email',
      city: 'Ville',
      volume: 'Commandes COD par mois',
      challenge: 'Quel est votre plus gros probleme de confirmation aujourd hui ?',
      submit: 'Envoyer la demande',
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
    headline: 'مكتب التحكم في طلبات COD داخل المغرب.',
    subhead:
      'Wasilio يساعد فريقك يؤكد الطلبات، يتابع المواعيد، ينسق مع الموزعين، ويفهم اسباب فشل التسليم من مكان واحد.',
    primaryCta: 'اطلب تجربة مرافقة',
    whatsapp: 'تواصل عبر واتساب',
    heroModel: ['مراجعة سريعة للعملية', 'مساحة تجربة نجهزها معك', 'اشتراك شهري يدوي بالدرهم'],
    trust: ['مناسب لواتساب، المكالمات، والدفع عند التسليم', 'التجربة تفتح بعد مراجعة بشرية', 'وصل متاح للكاش او التحويل'],
    heroPromise: 'ليست منصة تسجيل مفتوحة: نراجع الطلب ثم نجهز اول workflow معك.',
    metrics: [
      ['طلبات تنتظر التأكيد', '42'],
      ['مواعيد لا يجب نسيانها', '18'],
      ['مؤكدة للموزع', '27'],
    ],
    deskTitle: 'مكتب متابعة COD',
    deskText: 'رؤية واحدة للقرار: اتصال، متابعة، رفض او تمرير للموزع.',
    demoRows: [
      ['Amina Shop', 'اتصال لاحق', 'الدار البيضاء'],
      ['Atlas Store', 'مؤكد', 'الرباط'],
      ['Casa Beauty', 'تم الاستلام', 'مراكش'],
      ['Rif Market', 'تم التسليم', 'طنجة'],
    ],
    features: [
      ['اولوية اليوم', 'الصفحة الرئيسية تبين ما ينتظر التأكيد، ما هو عند الموزعين، وما فشل.'],
      ['متابعات مضبوطة', 'المواعيد تبقى ظاهرة حتى يتم حلها، حتى في ايام الضغط.'],
      ['تسليم للموزع', 'فقط الطلبات الجاهزة تنتقل للتعيين، الاستلام او تتبع سبب الفشل.'],
    ],
    proofEyebrow: 'لماذا فرق COD تخسر المال',
    proofTitle: 'Wasilio يجمع الاتصالات، المتابعات، والتسليم في مسار واحد.',
    proofCards: [
      ['طلبات منسية اقل', 'المواعيد والطلبات المنتظرة تبقى ظاهرة بدل ان تضيع في واتساب.'],
      ['لخبطة اقل مع الموزع', 'الطلبات تمر عبر التعيين، الاستلام، التسليم او الفشل مع اثر واضح.'],
      ['تتبع افضل للتجربة', 'الاداء اليدوي، الوصولات، وحالة العميل تعطي قاعدة تجارية للبداية.'],
    ],
    processEyebrow: 'مسار التأكيد',
    processTitle: 'الفريق لا يحتاج ان يخمن الخطوة القادمة.',
    process:
      'Wasilio يحفظ المحاولات، الملاحظات، والقرار النهائي في نفس المسار قبل التسليم.',
    processSteps: ['طلب جديد', 'اتصال او موعد', 'مؤكد او مرفوض'],
    pricingEyebrow: 'نموذج التجربة',
    pricingTitle: 'ديمو مجاني، تجربة نجهزها معك، ثم اشتراك شهري.',
    prices: [
      ['الخطوة 1', 'تشخيص مجاني', 'نراجع طريقة COD، الحجم، والخسائر قبل اي قرار.'],
      ['الخطوة 2', 'تجربة مرافقة', 'نجهز مساحة اختبار مع اول لوائح التأكيد والتسليم.'],
      ['الخطوة 3', 'اشتراك بالدرهم', 'اداء شهري يدوي كاش او تحويل مع وصل داخل Wasilio.'],
    ],
    contactEyebrow: 'طلب ديمو',
    contactTitle: 'اطلب مراجعة لطريقة COD عندك.',
    contactText: 'شاركنا المتجر، حجم طلبات COD، واكبر عائق اليوم. نتواصل معك بالهاتف او واتساب ونفتح تجربة فقط اذا كان الاحتياج واضحا.',
    bullets: [
      'اول اتصال لفهم العمليات والخسائر.',
      'التجربة تشمل اعداد اول workflow معك.',
      'الاداء في البداية يدوي: كاش او تحويل مع وصل.',
    ],
    afterSubmitTitle: 'بعد الطلب',
    afterSubmitSteps: ['نتصل بك او نرسل واتساب', 'نؤكد احتياج COD', 'نفتح التجربة اذا كان fit واضحا'],
    submitted: 'تم استلام الطلب. فريق Wasilio سيتواصل معك.',
    form: {
      contactName: 'اسم المسؤول',
      storeName: 'اسم المتجر',
      phone: 'الهاتف / واتساب',
      email: 'البريد الالكتروني',
      city: 'المدينة',
      volume: 'طلبات COD في الشهر',
      challenge: 'ما هو اكبر مشكل عندك في تأكيد الطلبات اليوم؟',
      submit: 'ارسل الطلب',
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
    headline: 'The control desk for Moroccan COD orders.',
    subhead:
      'Wasilio helps your team confirm orders, track callbacks, coordinate couriers, and understand failed deliveries from one workspace.',
    primaryCta: 'Request guided pilot',
    whatsapp: 'Talk on WhatsApp',
    heroModel: ['Quick workflow audit', 'Pilot workspace configured with you', 'Monthly manual MAD payment'],
    trust: ['Built for WhatsApp, calls, and cash-on-delivery', 'Pilot opened after human review', 'Receipt available for cash or bank transfer'],
    heroPromise: 'Not open self-service signup: your request is reviewed, then we configure the first workflow with you.',
    metrics: [
      ['Orders awaiting confirmation', '42'],
      ['Callbacks not to miss', '18'],
      ['Confirmed for courier', '27'],
    ],
    deskTitle: 'COD follow-up desk',
    deskText: 'One view to decide: call, follow up, reject, or send to courier.',
    demoRows: [
      ['Amina Shop', 'CALL BACK', 'Casablanca'],
      ['Atlas Store', 'CONFIRMED', 'Rabat'],
      ['Casa Beauty', 'PICKED UP', 'Marrakech'],
      ['Rif Market', 'DELIVERED', 'Tangier'],
    ],
    features: [
      ['Daily priority', 'The dashboard shows what needs confirmation, what is with couriers, and what failed.'],
      ['Controlled follow-up', 'Callbacks stay visible until resolved, even when the day gets busy.'],
      ['Courier handoff', 'Only ready orders move to assignment, pickup, or failure tracking.'],
    ],
    proofEyebrow: 'Why COD teams lose money',
    proofTitle: 'Wasilio brings calls, callbacks, and delivery handoff into one flow.',
    proofCards: [
      ['Fewer forgotten orders', 'Pending callbacks and orders stay visible instead of disappearing inside WhatsApp threads.'],
      ['Less courier confusion', 'Orders move through assignment, pickup, delivered, or failed with a clear trace.'],
      ['Better pilot follow-up', 'Manual payments, receipts, and tenant status give the business a launch-ready base.'],
    ],
    processEyebrow: 'Confirmation workflow',
    processTitle: 'Your team stops guessing the next action.',
    process:
      'Wasilio keeps attempts, notes, and the final decision in the same workflow before delivery.',
    processSteps: ['New order', 'Call or callback', 'Confirmed or rejected'],
    pricingEyebrow: 'Pilot model',
    pricingTitle: 'Free demo, guided pilot setup, then monthly subscription.',
    prices: [
      ['Step 1', 'Free diagnosis', 'We review your COD workflow, order volume, and losses before any decision.'],
      ['Step 2', 'Guided pilot', 'A test workspace is configured with your first confirmation and delivery queues.'],
      ['Step 3', 'MAD subscription', 'Monthly manual payment by cash or bank transfer, with a Wasilio receipt.'],
    ],
    contactEyebrow: 'Demo request',
    contactTitle: 'Request a review of your COD workflow.',
    contactText:
      'Share your store, COD volume, and main operational block. We follow up by phone or WhatsApp, then open a pilot workspace only when the need is clear.',
    bullets: [
      'First call: understand your operations and losses.',
      'Pilot: guided setup of your first workflow.',
      'Payment: manual at launch, cash or bank transfer with receipt.',
    ],
    afterSubmitTitle: 'After you request',
    afterSubmitSteps: ['We call or send a WhatsApp', 'We qualify the COD need', 'We create the pilot if the fit is clear'],
    submitted: 'Demo request received. Wasilio operations can now follow up.',
    form: {
      contactName: 'Contact name',
      storeName: 'Store name',
      phone: 'Phone / WhatsApp',
      email: 'Email',
      city: 'City',
      volume: 'Monthly COD orders',
      challenge: 'What is your biggest confirmation problem today?',
      submit: 'Send request',
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
  heroModel: string[];
  trust: string[];
  heroPromise: string;
  metrics: string[][];
  deskTitle: string;
  deskText: string;
  demoRows: string[][];
  features: string[][];
  proofEyebrow: string;
  proofTitle: string;
  proofCards: string[][];
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
  afterSubmitTitle: string;
  afterSubmitSteps: string[];
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
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-10 lg:min-h-[calc(100vh-73px)] lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="inline-flex w-fit rounded-md bg-[#E8F4EF] px-3 py-1 text-sm font-semibold uppercase text-[#0F5B4A]">{content.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">{content.headline}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">{content.subhead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 rounded-md bg-[#E2552D] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c84725]">
                {content.primaryCta}
                <ArrowRight size={17} className={direction === 'rtl' ? 'rotate-180' : ''} />
              </a>
              <a href={whatsappUrl || '#contact'} className="inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-[#0F5B4A] hover:text-[#0B4639]">
                <MessageCircle size={17} />
                {content.whatsapp}
              </a>
            </div>
            <p className="mt-4 max-w-2xl rounded-md border border-[#0F5B4A]/20 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#0F5B4A] shadow-sm">
              {content.heroPromise}
            </p>

            <div className="mt-6 flex max-w-2xl flex-col overflow-hidden rounded-lg border border-[#0F5B4A]/20 bg-white text-sm font-semibold text-slate-800 shadow-sm sm:flex-row">
              {content.heroModel.map((item, index) => (
                <div key={item} className="flex flex-1 items-center gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E8F4EF] text-xs font-bold text-[#0F5B4A]">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid max-w-2xl gap-2 text-sm text-slate-700 sm:grid-cols-3">
              {content.trust.map((item) => (
                <div key={item} className="flex items-start gap-2 px-1 py-1">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0F5B4A]" size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#0F5B4A]/20 bg-white p-4 shadow-lg shadow-slate-200/70">
            <div className="mb-4 rounded-md bg-slate-950 px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase text-[#F6B24A]">{content.deskTitle}</p>
              <p className="mt-1 text-sm text-slate-200">{content.deskText}</p>
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
              icon={index === 0 ? <PhoneCall size={20} /> : index === 1 ? <MessageCircle size={20} /> : <Truck size={20} />}
              title={title}
              text={text}
            />
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.proofEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-950">{content.proofTitle}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {content.proofCards.map(([title, text], index) => (
              <ProofCard
                key={title}
                icon={index === 0 ? <Users size={20} /> : index === 1 ? <PackageCheck size={20} /> : <ReceiptText size={20} />}
                title={title}
                text={text}
              />
            ))}
          </div>
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
            <div className="mt-6 rounded-lg border border-[#0F5B4A]/20 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold uppercase text-[#0F5B4A]">{content.afterSubmitTitle}</p>
              <ol className="mt-3 grid gap-2 text-sm text-slate-700">
                {content.afterSubmitSteps.map((step, index) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8F4EF] text-xs font-bold text-[#0F5B4A]">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
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

function ProofCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-[#0F5B4A]/20 bg-[#F7FAF9] p-5">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#0F5B4A] shadow-sm">{icon}</div>
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

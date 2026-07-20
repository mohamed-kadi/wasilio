import { type SyntheticEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Globe2,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { ApiError, captureMarketingLead, getErrorMessage } from '../api/client';
import { usePageMeta } from '../lib/seo';
import { campaignSourceFromLocation, installMetaPixel, trackLeadSubmitted } from '../lib/tracking';
import { useAuthStore } from '../store/authStore';
import BrandLogo from '../components/BrandLogo';

type Language = 'fr' | 'ar' | 'en';
type ChannelKind = 'manual' | 'product' | 'whatsapp' | 'meta' | 'google';

const languages: Array<{ code: Language; label: string; shortLabel: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'fr', label: 'Francais', shortLabel: 'FR', dir: 'ltr' },
  { code: 'ar', label: 'العربية', shortLabel: 'AR', dir: 'rtl' },
  { code: 'en', label: 'English', shortLabel: 'EN', dir: 'ltr' },
];

const orderVolumeValues = ['Under 100/month', '100-500/month', '500-1,500/month', '1,500+/month'];
const sourceChannels: ChannelKind[] = ['manual', 'product', 'whatsapp', 'meta', 'google'];
const otherCityValue = '__other_city__';
const moroccanCityOptions = [
  'Casablanca',
  'Rabat',
  'Marrakech',
  'Fes',
  'Tanger',
  'Agadir',
  'Meknes',
  'Oujda',
  'Kenitra',
  'Tetouan',
  'Sale',
  'Temara',
  'Mohammedia',
  'El Jadida',
  'Safi',
  'Beni Mellal',
  'Nador',
  'Taza',
  'Essaouira',
  'Dakhla',
  'Laayoune',
  'Ouarzazate',
  'Guelmim',
  'Taroudannt',
  'Khouribga',
  'Settat',
  'Larache',
  'Al Hoceima',
  'Ifrane',
  'Khemisset',
  'Tiznit',
];

const copy = {
  fr: {
    metaTitle: 'Wasilio | Confirmation COD et priorisation',
    metaDescription:
      'Wasilio aide les marchands COD au Maroc a prioriser les commandes, organiser les relances et coordonner les coursiers.',
    navLinks: [
      ['#orders', 'Commandes'],
      ['#sources', 'Canaux'],
      ['#intelligence', 'Intelligence'],
      ['#workflow', 'Parcours'],
      ['#pricing', 'Modele pilote'],
      ['#contact', 'Demo'],
    ],
    signIn: 'Acces pilote',
    eyebrow: 'Operations COD pour marchands marocains',
    headline: 'Confirmez les commandes qui meritent le prochain appel.',
    subhead:
      'Wasilio regroupe confirmation, relances, affectation coursier, echecs de livraison et priorites du jour dans un espace clair pour votre equipe.',
    primaryCta: 'Demander une demo',
    whatsapp: 'Parler sur WhatsApp',
    whatsappMessage: 'Bonjour Wasilio, je veux une demo pour mon suivi COD.',
    heroPromise: "Pilotage guide: nous validons le besoin avant d'ouvrir un espace marchand.",
    metrics: [
      ['A appeler', '42'],
      ['A revoir', '9'],
      ['Pretes coursier', '27'],
    ],
    deskTitle: 'Vue decision COD',
    deskText: 'Prioriser, appeler, relancer ou envoyer au coursier.',
    deskFooter: 'Une vue simple garde les decisions importantes au meme endroit.',
    demoRows: [
      ['Priorite du matin', 'APPELER MAINTENANT', 'Informations client completes'],
      ['Relance du jour', 'CONTINUER SUIVI', 'Decision client attendue'],
      ['Avant coursier', 'VERIFIER DETAILS', 'Derniere validation requise'],
    ],
    intelligenceEyebrow: 'Priorisation intelligente',
    intelligenceTitle: 'Mettez les bonnes commandes devant votre equipe, au bon moment.',
    intelligenceText:
      'Wasilio aide votre equipe a voir les commandes a traiter maintenant, celles qui demandent une verification, et celles qui peuvent avancer vers la livraison. Le message reste simple: priorite, prudence, prochaine action.',
    intelligencePoints: [
      'Moins de temps perdu sur les commandes faibles.',
      'Plus de discipline avant le cout coursier.',
      'Meilleure recuperation quand une livraison echoue.',
    ],
    intelligenceDemo: {
      title: 'Lecture equipe',
      primaryLabel: 'Priorite',
      primaryValue: 'Elevee',
      reviewLabel: 'Prudence',
      reviewValue: 'A revoir',
      action: 'Prochaine action',
      actionValue: 'Valider avant envoi',
      note: 'Recommandation claire pour guider la prochaine decision.',
    },
    sourceEyebrow: "D'ou viennent les commandes",
    sourceTitle: 'Les pubs amenent du trafic. Wasilio garde le suivi propre.',
    sourceText:
      'Une pub Facebook ou Google amene un visiteur vers une page de demande ou une page produit marchand. Ensuite Wasilio garde la demande, le canal et la suite a traiter au bon endroit.',
    sources: [
      ['Saisie manuelle', 'Pour les commandes recues par appel, boutique, DM ou discussion WhatsApp.'],
      ['Page produit', 'Votre page produit envoie la commande COD dans Wasilio avec le produit, le client et la source.'],
      ['WhatsApp', "L'equipe peut creer la commande apres chat, puis suivre confirmation et relance."],
      ['Facebook / Instagram', 'Les pubs envoient vers la demo Wasilio ou une page produit marchand.'],
      ['Google Ads', 'Le trafic arrive sur une page tracee; la source peut rester visible pour le suivi.'],
    ],
    workflowEyebrow: 'Suivi simple',
    workflowTitle: 'Un chemin simple, de la confirmation a la performance.',
    workflowSteps: [
      ['Confirmation', 'Appeler, relancer ou decider avec preuves.'],
      ['Coursier', 'Passer seulement les commandes pretes a livrer.'],
      ['Livraison', 'Suivre ramassage, livraison et echec.'],
      ['Recuperation', 'Decider relance, nouvel essai, remboursement ou cloture.'],
    ],
    pricingEyebrow: 'Modele pilote',
    pricingTitle: 'Commencez par une demo gratuite, claire et utile.',
    pricingCta: 'Demander la demo gratuite',
    prices: [
      ['1', 'Demo gratuite', 'Premier appel simple: on regarde votre suivi COD et les priorites qui ralentissent votre equipe.'],
      ['2', 'Pilote accompagne', 'Nous configurons votre premier espace autour de vos priorites quotidiennes.'],
      ['3', 'Paiement MAD', 'Paiement mensuel manuel par cash ou virement, avec recu dans Wasilio.'],
    ],
    contactEyebrow: 'Demande de demo',
    contactTitle: 'Demandez une revue de votre suivi COD.',
    contactText:
      'Partagez votre boutique, votre volume COD et le blocage principal. Nous vous recontactons par telephone ou WhatsApp.',
    bullets: [
      'Nous separons les prospects Wasilio des commandes de vos clients.',
      'Nous validons le canal principal: manuel, page produit, WhatsApp ou pubs.',
      'Nous ouvrons un pilote seulement si le processus est clair.',
    ],
    afterSubmitTitle: 'Apres votre demande',
    afterSubmitSteps: ['Contact par appel ou WhatsApp', 'Qualification du besoin COD', 'Creation du pilote si le fit est clair'],
    submitted: "Demande recue. L'equipe Wasilio peut maintenant vous recontacter.",
    form: {
      contactName: 'Nom du contact',
      storeName: 'Nom de la boutique',
      phone: 'Telephone / WhatsApp',
      email: 'Email',
      city: 'Ville',
      cityPlaceholder: 'Choisir une ville',
      otherCity: 'Autre ville',
      customCity: 'Nom de la ville',
      volume: 'Commandes COD par mois',
      challenge: "Quel est votre plus gros probleme de confirmation aujourd'hui ?",
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
    metaTitle: 'Wasilio | تأكيد COD وترتيب الاولويات',
    metaDescription:
      'Wasilio يساعد تجار COD في المغرب على ترتيب الطلبات، تنظيم المتابعات، والتنسيق مع الموزعين.',
    navLinks: [
      ['#orders', 'الطلبات'],
      ['#sources', 'القنوات'],
      ['#intelligence', 'الذكاء'],
      ['#workflow', 'المسار'],
      ['#pricing', 'التجربة'],
      ['#contact', 'ديمو'],
    ],
    signIn: 'دخول التجربة',
    eyebrow: 'عمليات COD للتجار في المغرب',
    headline: 'أكد الطلبات التي تستحق الاتصال التالي.',
    subhead:
      'Wasilio يجمع التأكيد، المتابعات، تعيين الموزع، فشل التسليم، واولويات اليوم في مساحة واضحة للفريق.',
    primaryCta: 'اطلب ديمو',
    whatsapp: 'تواصل عبر واتساب',
    whatsappMessage: 'سلام Wasilio، اريد ديمو لمتابعة طلبات COD.',
    heroPromise: 'تجربة مرافقة: نراجع الاحتياج قبل فتح مساحة التاجر.',
    metrics: [
      ['للاتصال', '42'],
      ['للمراجعة', '9'],
      ['جاهزة للموزع', '27'],
    ],
    deskTitle: 'رؤية قرار COD',
    deskText: 'ترتيب الاولوية، الاتصال، المتابعة او الارسال للموزع.',
    deskFooter: 'رؤية بسيطة تبقي القرارات المهمة في نفس المكان.',
    demoRows: [
      ['اولوية الصباح', 'اتصل الان', 'معلومات الزبون مكتملة'],
      ['متابعة اليوم', 'اكمل المتابعة', 'قرار الزبون ما زال منتظرا'],
      ['قبل الموزع', 'تحقق من التفاصيل', 'تأكيد اخير مطلوب'],
    ],
    intelligenceEyebrow: 'ترتيب ذكي للاولوية',
    intelligenceTitle: 'ضع الطلبات المناسبة امام فريقك في الوقت المناسب.',
    intelligenceText:
      'Wasilio يساعد الفريق يرى الطلبات التي تحتاج اجراء الان، الطلبات التي تحتاج مراجعة، والطلبات التي يمكن ان تنتقل الى التسليم. الرسالة تبقى بسيطة: اولوية، حذر، الخطوة التالية.',
    intelligencePoints: [
      'وقت اقل مع الطلبات الضعيفة.',
      'انضباط اكثر قبل تكلفة الموزع.',
      'تعاف افضل عندما يفشل التسليم.',
    ],
    intelligenceDemo: {
      title: 'قراءة الفريق',
      primaryLabel: 'الاولوية',
      primaryValue: 'مرتفعة',
      reviewLabel: 'الحذر',
      reviewValue: 'مراجعة',
      action: 'الخطوة التالية',
      actionValue: 'تحقق قبل الارسال',
      note: 'توجيه واضح للقرار التالي.',
    },
    sourceEyebrow: 'من اين تأتي الطلبات',
    sourceTitle: 'الاعلانات تجلب الزوار. Wasilio يحافظ على مسار الطلب واضح.',
    sourceText:
      'اعلان Facebook او Google يجلب الزائر الى طلب ديمو او صفحة منتج للتاجر. بعدها Wasilio يحفظ الطلب، القناة، والخطوة التالية في المكان الصحيح.',
    sources: [
      ['ادخال يدوي', 'للطلبات القادمة من مكالمة، متجر، DM او محادثة واتساب.'],
      ['صفحة منتج', 'صفحة المنتج ترسل طلب COD الى Wasilio مع المنتج، الزبون، والمصدر.'],
      ['واتساب', 'الفريق ينشئ الطلب بعد المحادثة ثم يتابع التأكيد والموعد.'],
      ['Facebook / Instagram', 'الاعلانات ترسل الى ديمو Wasilio او صفحة منتج التاجر.'],
      ['Google Ads', 'الترافيك يصل الى صفحة قابلة للتتبع ويمكن حفظ المصدر.'],
    ],
    workflowEyebrow: 'متابعة بسيطة',
    workflowTitle: 'مسار واضح من التأكيد الى قياس الاداء.',
    workflowSteps: [
      ['التأكيد', 'اتصال، متابعة او قرار مع اسباب واضحة.'],
      ['الموزع', 'ارسال الطلبات الجاهزة فقط للتسليم.'],
      ['التسليم', 'تتبع الاستلام، التسليم، والفشل.'],
      ['التعافي', 'قرار متابعة، محاولة جديدة، مراجعة رد المال او اغلاق.'],
    ],
    pricingEyebrow: 'نموذج التجربة',
    pricingTitle: 'ابدأ بديمو مجاني واضح ومفيد.',
    pricingCta: 'اطلب الديمو المجاني',
    prices: [
      ['1', 'ديمو مجاني', 'اتصال اول بسيط: نراجع متابعة COD واولويات اليوم التي تبطئ الفريق.'],
      ['2', 'تجربة مرافقة', 'نجهز اول مساحة حول اولويات فريقك اليومية.'],
      ['3', 'اداء بالدرهم', 'اداء شهري يدوي كاش او تحويل مع وصل داخل Wasilio.'],
    ],
    contactEyebrow: 'طلب ديمو',
    contactTitle: 'اطلب مراجعة لطريقة COD عندك.',
    contactText: 'شاركنا المتجر، حجم طلبات COD، واكبر عائق اليوم. نتواصل معك بالهاتف او واتساب.',
    bullets: [
      'نفرق بين عملاء Wasilio وطلبات زبنائك.',
      'نحدد القناة الرئيسية: يدوي، صفحة منتج، واتساب او اعلانات.',
      'نفتح تجربة فقط اذا كان المسار واضحا.',
    ],
    afterSubmitTitle: 'بعد الطلب',
    afterSubmitSteps: ['اتصال او واتساب', 'تأكيد احتياج COD', 'فتح التجربة اذا كان fit واضحا'],
    submitted: 'تم استلام الطلب. فريق Wasilio سيتواصل معك.',
    form: {
      contactName: 'اسم المسؤول',
      storeName: 'اسم المتجر',
      phone: 'الهاتف / واتساب',
      email: 'البريد الالكتروني',
      city: 'المدينة',
      cityPlaceholder: 'اختر المدينة',
      otherCity: 'مدينة اخرى',
      customCity: 'اسم المدينة',
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
    metaTitle: 'Wasilio | COD Confirmation And Order Prioritization',
    metaDescription:
      'Wasilio helps Moroccan COD merchants prioritize orders, organize follow-ups, and coordinate couriers.',
    navLinks: [
      ['#orders', 'Orders'],
      ['#sources', 'Channels'],
      ['#intelligence', 'Intelligence'],
      ['#workflow', 'Process'],
      ['#pricing', 'Pilot model'],
      ['#contact', 'Demo'],
    ],
    signIn: 'Pilot access',
    eyebrow: 'COD operations for Moroccan merchants',
    headline: 'Confirm the orders worth the next call.',
    subhead:
      'Wasilio brings confirmation, callbacks, courier handoff, failed delivery, and daily priorities into one clear workspace for your team.',
    primaryCta: 'Request demo',
    whatsapp: 'Talk on WhatsApp',
    whatsappMessage: 'Hello Wasilio, I want a demo for my COD operations.',
    heroPromise: 'Guided pilot: we review the need before opening a merchant workspace.',
    metrics: [
      ['Call next', '42'],
      ['Needs review', '9'],
      ['Courier ready', '27'],
    ],
    deskTitle: 'COD decision view',
    deskText: 'Prioritize, call, follow up, or send to courier.',
    deskFooter: 'One simple view keeps important decisions in the same place.',
    demoRows: [
      ['Morning priority', 'CALL NOW', 'Customer details are complete'],
      ['Today follow-up', 'CONTINUE FOLLOW-UP', 'Customer decision is pending'],
      ['Before courier', 'VERIFY DETAILS', 'Final validation is required'],
    ],
    intelligenceEyebrow: 'Smart prioritization',
    intelligenceTitle: 'Put the right orders in front of your team at the right time.',
    intelligenceText:
      'Wasilio helps your team see which orders need action now, which ones need careful review, and which can move toward delivery. The message stays simple: priority, caution, next action.',
    intelligencePoints: [
      'Less time wasted on weak orders.',
      'More discipline before courier cost is spent.',
      'Better recovery when delivery fails.',
    ],
    intelligenceDemo: {
      title: 'Team readout',
      primaryLabel: 'Priority',
      primaryValue: 'High',
      reviewLabel: 'Caution',
      reviewValue: 'Review',
      action: 'Next action',
      actionValue: 'Validate before dispatch',
      note: 'Clear guidance for the next business action.',
    },
    sourceEyebrow: 'Where orders come from',
    sourceTitle: 'Ads bring traffic. Wasilio keeps the order path clear.',
    sourceText:
      'A Facebook or Google ad brings a visitor to a demo request or a merchant product page. Wasilio keeps the request, channel, and next step in the right place.',
    sources: [
      ['Manual entry', 'For orders received by phone, shop, DM, or WhatsApp conversation.'],
      ['Product page', 'Your product page sends the COD order into Wasilio with product, customer, and source context.'],
      ['WhatsApp', 'Your team can create the order after chat, then track confirmation and callback.'],
      ['Facebook / Instagram', 'Ads send buyers to a merchant page or prospects to a Wasilio demo.'],
      ['Google Ads', 'Traffic lands on a tracked page; the source can stay visible for follow-up.'],
    ],
    workflowEyebrow: 'Simple follow-through',
    workflowTitle: 'A simple path from confirmation to performance.',
    workflowSteps: [
      ['Confirmation', 'Call, follow up, or decide with clear context.'],
      ['Courier handoff', 'Send only delivery-ready orders.'],
      ['Delivery', 'Track pickup, delivery, and failed attempts.'],
      ['Recovery', 'Decide follow-up, retry, refund review, or closure.'],
    ],
    pricingEyebrow: 'Pilot model',
    pricingTitle: 'Start with a clear, useful free demo.',
    pricingCta: 'Request the free demo',
    prices: [
      ['1', 'Free demo', 'A simple first call: we review your COD follow-up and the daily priorities slowing the team.'],
      ['2', 'Guided pilot', 'We configure your first workspace around the daily priorities your team needs.'],
      ['3', 'MAD payment', 'Monthly manual payment by cash or bank transfer, with a Wasilio receipt.'],
    ],
    contactEyebrow: 'Demo request',
    contactTitle: 'Request a review of your COD process.',
    contactText:
      'Share your store, COD volume, and main business bottleneck. We follow up by phone or WhatsApp.',
    bullets: [
      'We first understand whether you need manual orders, product pages, WhatsApp, or ads.',
      'We shape the first workspace around your daily confirmation work.',
      'We open a pilot only when the setup is clear.',
    ],
    afterSubmitTitle: 'After you request',
    afterSubmitSteps: ['Call or WhatsApp follow-up', 'COD need qualification', 'Pilot created if the fit is clear'],
    submitted: 'Demo request received. Wasilio operations can now follow up.',
    form: {
      contactName: 'Contact name',
      storeName: 'Store name',
      phone: 'Phone / WhatsApp',
      email: 'Email',
      city: 'City',
      cityPlaceholder: 'Choose a city',
      otherCity: 'Other city',
      customCity: 'City name',
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
  navLinks: string[][];
  signIn: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: string;
  whatsapp: string;
  whatsappMessage: string;
  heroPromise: string;
  metrics: string[][];
  deskTitle: string;
  deskText: string;
  deskFooter: string;
  demoRows: string[][];
  intelligenceEyebrow: string;
  intelligenceTitle: string;
  intelligenceText: string;
  intelligencePoints: string[];
  intelligenceDemo: {
    title: string;
    primaryLabel: string;
    primaryValue: string;
    reviewLabel: string;
    reviewValue: string;
    action: string;
    actionValue: string;
    note: string;
  };
  sourceEyebrow: string;
  sourceTitle: string;
  sourceText: string;
  sources: string[][];
  workflowEyebrow: string;
  workflowTitle: string;
  workflowSteps: string[][];
  pricingEyebrow: string;
  pricingTitle: string;
  pricingCta: string;
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
    cityPlaceholder: string;
    otherCity: string;
    customCity: string;
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
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const content = copy[language];
  const direction = languages.find((item) => item.code === language)?.dir ?? 'ltr';
  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(import.meta.env.VITE_PUBLIC_WHATSAPP_URL as string | undefined, content.whatsappMessage),
    [content.whatsappMessage],
  );
  const [contactName, setContactName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [monthlyOrderVolume, setMonthlyOrderVolume] = useState(orderVolumeValues[1]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const campaignSource = useMemo(() => campaignSourceFromLocation(), []);
  const selectedCity = city === otherCityValue ? customCity.trim() : city;

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

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
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
        city: selectedCity || undefined,
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
      setCustomCity('');
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
    <main dir={direction} className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <Link to="/" aria-label="Wasilio home">
            <BrandLogo markClassName="h-8 w-8" textClassName="text-xl" />
          </Link>

          <nav
            aria-label="Landing page sections"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold text-slate-600 lg:flex"
          >
            {content.navLinks.map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-1.5 hover:bg-white hover:text-slate-950">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <Link to="/login" className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50">
              {content.signIn}
            </Link>
          </div>
        </div>
      </header>

      <section id="orders" className="scroll-mt-20 border-b border-emerald-900/10 bg-[#f7fbf9]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[1.04fr_0.76fr] lg:items-center lg:py-14">
          <div>
            <p className="inline-flex w-fit rounded-md bg-[#E8F4EF] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#0F5B4A]">
              {content.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.04] text-slate-950 sm:text-5xl">
              {content.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">{content.subhead}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 rounded-md bg-[#E2552D] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c84725]">
                {content.primaryCta}
                <ArrowRight size={17} className={direction === 'rtl' ? 'rotate-180' : ''} />
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md px-3 py-3 text-sm font-semibold text-[#0F5B4A] hover:bg-white">
                <MessageCircle size={17} />
                {content.whatsapp}
              </a>
            </div>

            <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-md border border-[#0F5B4A]/20 bg-white px-4 py-3 text-sm leading-6 text-[#0F5B4A] shadow-sm">
              <ShieldCheck className="mt-0.5 shrink-0" size={17} />
              <p className="font-medium">{content.heroPromise}</p>
            </div>
          </div>

          <HeroDecisionPanel content={content} />
        </div>
      </section>

      <section id="sources" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-10">
        <SectionHeader eyebrow={content.sourceEyebrow} title={content.sourceTitle} text={content.sourceText} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {content.sources.map(([title, text], index) => (
            <CompactCard
              key={title}
              channel={sourceChannels[index]}
              title={title}
              text={text}
            />
          ))}
        </div>
      </section>

      <section id="intelligence" className="scroll-mt-20 border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[0.95fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#0F5B4A]">{content.intelligenceEyebrow}</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-slate-950">{content.intelligenceTitle}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-slate-700">{content.intelligenceText}</p>
            <ul className="mt-5 grid gap-3 text-sm text-slate-700">
              {content.intelligencePoints.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0F5B4A]" size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <IntelligenceReadout content={content} />
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 bg-[#102A43] text-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-sm font-bold uppercase tracking-wide text-[#F6B24A]">{content.workflowEyebrow}</p>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">{content.workflowTitle}</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {content.workflowSteps.map(([title, text], index) => (
              <WorkflowStep key={title} index={index + 1} title={title} text={text} />
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto grid max-w-6xl scroll-mt-20 grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[0.75fr_1.15fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#0F5B4A]">{content.pricingEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">{content.pricingTitle}</h2>
          <a href="#contact" className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#E2552D] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c84725]">
            {content.pricingCta}
            <ArrowRight size={17} className={direction === 'rtl' ? 'rotate-180' : ''} />
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {content.prices.map(([label, value, detail], index) => (
            <Price key={label} label={label} value={value} detail={detail} featured={index === 0} />
          ))}
        </div>
      </section>

      <section id="contact" className="scroll-mt-20 border-t border-slate-200 bg-[#F7FAF9]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[0.72fr_1.08fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#0F5B4A]">{content.contactEyebrow}</p>
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
              <p className="text-sm font-bold uppercase tracking-wide text-[#0F5B4A]">{content.afterSubmitTitle}</p>
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
              <CitySelect
                label={content.form.city}
                placeholder={content.form.cityPlaceholder}
                otherLabel={content.form.otherCity}
                value={city}
                error={fieldErrors.city}
                onChange={(value) => {
                  setCity(value);
                  if (value !== otherCityValue) {
                    setCustomCity('');
                  }
                }}
              />
              {city === otherCityValue && (
                <Field label={content.form.customCity} name="customCity" value={customCity} onChange={setCustomCity} required={false} />
              )}
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
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

function HeroDecisionPanel({ content }: { content: LandingCopy }) {
  return (
    <article className="w-full rounded-lg border border-[#0F5B4A]/20 bg-white p-4 shadow-lg shadow-slate-200/70 lg:max-w-md lg:justify-self-end">
      <div className="rounded-md bg-slate-950 px-4 py-3 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-[#F6B24A]">{content.deskTitle}</p>
        <p className="mt-1 text-sm leading-6 text-slate-200">{content.deskText}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {content.metrics.map(([label, value], index) => (
          <QueueMetric key={label} label={label} value={value} tone={index === 0 ? 'green' : index === 1 ? 'amber' : 'blue'} />
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
        {content.demoRows.map(([order, action, detail]) => (
          <div key={order} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{order}</p>
              <span className="shrink-0 rounded-md bg-[#FFF1D7] px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#8A4F00]">
                {action}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{content.deskFooter}</p>
    </article>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0F5B4A]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-950">{title}</h2>
      <p className="mt-4 leading-7 text-slate-700">{text}</p>
    </div>
  );
}

function CompactCard({ channel, title, text }: { channel: ChannelKind; title: string; text: string }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <ChannelVisual channel={channel} />
      <div className="p-4">
        <h3 className="mt-3 font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </article>
  );
}

function ChannelVisual({ channel }: { channel: ChannelKind }) {
  const visuals: Record<ChannelKind, { label: string; className: string; badge: ReactNode }> = {
    manual: {
      label: 'COD',
      className: 'bg-slate-900 text-white',
      badge: <ClipboardList size={20} />,
    },
    product: {
      label: 'Store',
      className: 'bg-[#E8F4EF] text-[#0F5B4A]',
      badge: <span className="text-sm font-black">W</span>,
    },
    whatsapp: {
      label: 'WhatsApp',
      className: 'bg-[#E7F8EF] text-[#0B7A3B]',
      badge: <MessageCircle size={20} />,
    },
    meta: {
      label: 'Facebook / Instagram',
      className: 'bg-[#EAF2FF] text-[#214C8A]',
      badge: <span className="text-sm font-black">f</span>,
    },
    google: {
      label: 'Google Ads',
      className: 'bg-[#FFF4DE] text-[#8A4F00]',
      badge: <span className="text-sm font-black">G</span>,
    },
  };
  const visual = visuals[channel];

  return (
    <div className={`flex h-20 items-center justify-between px-4 ${visual.className}`}>
      <span className="text-xs font-bold uppercase tracking-wide">{visual.label}</span>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-current shadow-sm">
        {visual.badge}
      </span>
    </div>
  );
}

function IntelligenceReadout({ content }: { content: LandingCopy }) {
  const demo = content.intelligenceDemo;

  return (
    <article className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#E8F4EF] text-[#0F5B4A]">
          <ShieldCheck size={20} />
        </div>
        <p className="font-bold text-slate-950">{demo.title}</p>
      </div>
      <div className="mt-5 grid gap-3">
        <ReadoutRow label={demo.primaryLabel} value={demo.primaryValue} tone="green" />
        <ReadoutRow label={demo.reviewLabel} value={demo.reviewValue} tone="amber" />
        <ReadoutRow label={demo.action} value={demo.actionValue} tone="blue" />
      </div>
      <p className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-600">{demo.note}</p>
    </article>
  );
}

function ReadoutRow({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'blue' }) {
  const tones = {
    green: 'bg-[#E8F4EF] text-[#0F5B4A]',
    amber: 'bg-[#FFF1D7] text-[#8A4F00]',
    blue: 'bg-[#EAF2FF] text-[#214C8A]',
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}>{value}</span>
    </div>
  );
}

function QueueMetric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'green' }) {
  const tones = {
    blue: 'bg-[#EAF2FF] text-[#214C8A]',
    amber: 'bg-[#FFF1D7] text-[#8A4F00]',
    green: 'bg-[#E8F4EF] text-[#0F5B4A]',
  };
  return (
    <div className={`rounded-md px-3 py-3 ${tones[tone]}`}>
      <p className="text-[0.68rem] font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function WorkflowStep({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-white/15 bg-white/10 p-4">
      <p className="text-xs font-bold text-[#F6B24A]">0{index}</p>
      <h3 className="mt-2 font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
    </article>
  );
}

function Price({ label, value, detail, featured = false }: { label: string; value: string; detail: string; featured?: boolean }) {
  return (
    <article className={`rounded-lg border p-5 ${featured ? 'border-[#E2552D] bg-[#FFF7F2] shadow-lg shadow-orange-100' : 'border-slate-200 bg-white'}`}>
      <p className={`inline-flex rounded-full px-2.5 py-1 text-sm font-bold ${featured ? 'bg-[#E2552D] text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</p>
      <p className={`mt-4 font-bold text-slate-950 ${featured ? 'text-2xl' : 'text-xl'}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
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

function CitySelect({
  label,
  placeholder,
  otherLabel,
  value,
  error,
  onChange,
}: {
  label: string;
  placeholder: string;
  otherLabel: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <select
        aria-label={label}
        name="city"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E2552D] ${
          error ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'
        }`}
      >
        <option value="">{placeholder}</option>
        {moroccanCityOptions.map((cityOption) => (
          <option key={cityOption} value={cityOption}>
            {cityOption}
          </option>
        ))}
        <option value={otherCityValue}>{otherLabel}</option>
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function buildWhatsappUrl(configuredUrl: string | undefined, message: string) {
  const trimmedUrl = configuredUrl?.trim();
  const encodedMessage = encodeURIComponent(message);

  if (!trimmedUrl) {
    return `https://wa.me/?text=${encodedMessage}`;
  }

  if (/[?&]text=/.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `${trimmedUrl}${trimmedUrl.includes('?') ? '&' : '?'}text=${encodedMessage}`;
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

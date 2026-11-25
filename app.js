import { investment } from './finance.js';
import { renderTool } from './tools.js';

const copy = {
  en: {
    skip: 'Skip to content', brandLine: 'REAL ESTATE INTELLIGENCE', workspace: 'Workspace', toolNav: 'Financial tools',
    overview: 'Overview', investment: 'Investment analysis', mortgage: 'Mortgage calculator', payments: 'Payment plans',
    compare: 'Compare properties', resale: 'Resale scenarios', source: 'GitHub repository', currency: 'AED · UAE dirham',
    overviewTitle: 'Investment overview', overviewDescription: 'Analyze UAE property deals, from purchase costs to exit returns.',
    sample: 'Illustrative figures', heroKicker: 'UAE PROPERTY WORKSPACE', heroTitle: 'Underwrite your next property.',
    heroDescription: 'Estimate returns, model financing and compare payment schedules before committing to a deal.',
    heroAction: 'Analyze an investment', snapshotTitle: 'Sample investment',
    snapshotDescription: 'A starting point for exploring the rental yield calculator.',
    seeAssumptions: 'Open yield calculator', purchasePrice: 'Purchase price', grossYield: 'Gross rental yield',
    netYield: 'Net rental yield', annualNet: 'Annual net income',
    purchaseHint: 'Before acquisition costs', grossHint: 'Before vacancy and expenses',
    netHint: 'After vacancy, expenses and fees', annualHint: 'Before debt service',
    toolsDescription: 'Choose a tool to model a deal using your own figures.',
    investmentDescription: 'Calculate rental yield, net income and year-by-year cash flow.',
    mortgageDescription: 'Estimate monthly repayments and see how the loan balance changes over time.',
    paymentsDescription: 'Build and compare developer installment schedules through handover and beyond.',
    compareDescription: 'Compare acquisition costs, yields and net income across two properties.',
    resaleDescription: 'Project a sale price and evaluate how transaction costs affect returns.',
    footerNote: 'Estimates are calculated in your browser. Verify costs and contract terms independently.',
    report: 'Print report', printTitle: 'Property investment report', openMenu: 'Open navigation', closeMenu: 'Close navigation',
    darkMode: 'Dark mode', switchLanguage: 'Switch to Arabic',
  },
  ar: {
    skip: 'انتقل إلى المحتوى', brandLine: 'تحليل الاستثمارات العقارية', workspace: 'مساحة العمل', toolNav: 'الأدوات المالية',
    overview: 'نظرة عامة', investment: 'تحليل الاستثمار', mortgage: 'حاسبة التمويل العقاري', payments: 'خطط السداد',
    compare: 'مقارنة العقارات', resale: 'سيناريوهات إعادة البيع', source: 'المستودع على GitHub', currency: 'AED · الدرهم الإماراتي',
    overviewTitle: 'نظرة عامة على الاستثمار', overviewDescription: 'حلّل الصفقات العقارية في الإمارات من تكاليف الشراء إلى عوائد البيع.',
    sample: 'أرقام توضيحية', heroKicker: 'مساحة عمل للاستثمار العقاري في الإمارات', heroTitle: 'قيّم عقارك الاستثماري المقبل.',
    heroDescription: 'قدّر العوائد، وادرس خيارات التمويل، وقارن جداول السداد قبل الالتزام بالصفقة.',
    heroAction: 'حلّل استثمارًا', snapshotTitle: 'مثال على استثمار',
    snapshotDescription: 'نقطة بداية لاستكشاف حاسبة عائد الإيجار.',
    seeAssumptions: 'افتح حاسبة العائد', purchasePrice: 'سعر الشراء', grossYield: 'إجمالي عائد الإيجار',
    netYield: 'صافي عائد الإيجار', annualNet: 'صافي الدخل السنوي',
    purchaseHint: 'قبل تكاليف الاستحواذ', grossHint: 'قبل احتساب الشغور والمصاريف',
    netHint: 'بعد احتساب الشغور والمصاريف والرسوم', annualHint: 'قبل سداد أقساط التمويل',
    toolsDescription: 'اختر أداة لدراسة صفقة باستخدام أرقامك.',
    investmentDescription: 'احسب عائد الإيجار وصافي الدخل والتدفق النقدي لكل سنة.',
    mortgageDescription: 'قدّر الأقساط الشهرية وتابع تغير رصيد القرض بمرور الوقت.',
    paymentsDescription: 'أنشئ وقارن جداول أقساط المطوّرين حتى التسليم وبعده.',
    compareDescription: 'قارن تكاليف الاستحواذ والعوائد وصافي الدخل لعقارين.',
    resaleDescription: 'قدّر سعر البيع وادرس أثر تكاليف الصفقة على العائد.',
    footerNote: 'يحسب متصفحك التقديرات محليًا. تحقّق من التكاليف وشروط العقد بصورة مستقلة.',
    report: 'طباعة التقرير', printTitle: 'تقرير الاستثمار العقاري', openMenu: 'فتح قائمة التنقل', closeMenu: 'إغلاق قائمة التنقل',
    darkMode: 'الوضع الداكن', switchLanguage: 'التبديل إلى الإنجليزية',
  },
};

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart: '<path d="M4 4v16h16M8 16v-3m5 3V9m5 7V6"/>',
  home: '<path d="m3 10 9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 20v-7h6v7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5h2m4 0h2"/>',
  compare: '<path d="M3 7h17m-4-4 4 4-4 4m5 6H4m4-4-4 4 4 4"/>',
  trend: '<path d="m3 17 6-6 4 4 7-8m-5 0h5v5"/>',
  code: '<path d="m9 6-6 6 6 6m6-12 6 6-6 6"/>',
  external: '<path d="M13 5h6v6m0-6-8 8m7 0v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9a14 14 0 0 1 0 18m0-18a14 14 0 0 0 0 18"/>',
  moon: '<path d="M20.5 14.7A9 9 0 0 1 9.3 3.5 9 9 0 1 0 20.5 14.7Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  pin: '<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 1h17m0 3h-5a2 2 0 0 0 0 4h5m-5-2h.1"/>',
  percent: '<path d="M5 19 19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  print: '<path d="M6 8V3h12v5m0 9h2a1 1 0 0 0 1-1v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a1 1 0 0 0 1 1h2m0-3h12v7H6zm11-3h1"/>',
};

const toolIcons = { investment: 'chart', mortgage: 'home', payments: 'calendar', compare: 'compare', resale: 'trend' };
const sample = { price: 1_000_000, rent: 80_000, expenses: 12_000, fees: 4, vacancy: 5 };
const totals = investment(sample);
const overview = document.querySelector('#overview');
const toolView = document.querySelector('#tool-view');
const main = document.querySelector('#main-content');
const sidebar = document.querySelector('#sidebar');
const primaryNav = document.querySelector('#primary-nav');
const menuButton = document.querySelector('#menu-toggle');
const languageButton = document.querySelector('#language-toggle');
const themeButton = document.querySelector('#theme-toggle');
const reportButton = document.querySelector('#report-button');
const darkPreference = matchMedia('(prefers-color-scheme: dark)');
const mobile = matchMedia('(max-width: 760px)');
let language = preference('language') === 'ar' ? 'ar' : 'en';
let theme = preference('theme');
let activeRoute;

function preference(key, value) {
  try {
    const name = 'spider-dxb:' + key;
    if (value !== undefined) localStorage.setItem(name, value);
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

function applyTheme() {
  const dark = theme ? theme === 'dark' : darkPreference.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.firstElementChild.innerHTML = icon(dark ? 'sun' : 'moon');
}

function setMenu(open, restoreFocus = false) {
  sidebar.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', copy[language][open ? 'closeMenu' : 'openMenu']);
  menuButton.firstElementChild.innerHTML = icon(open ? 'close' : 'menu');
  if (restoreFocus) menuButton.focus();
}

function renderOverview() {
  const strings = copy[language];
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const metrics = [
    ['purchasePrice', 'purchaseHint', 'home', money.format(sample.price), 'AED'],
    ['grossYield', 'grossHint', 'percent', pct.format(totals.grossYield / 100)],
    ['netYield', 'netHint', 'trend', pct.format(totals.netYield / 100)],
    ['annualNet', 'annualHint', 'wallet', money.format(totals.net), 'AED'],
  ];
  document.querySelector('#snapshot-grid').innerHTML = metrics.map(([label, hint, glyph, value, currency]) => `
    <article class="snapshot-card">
      <div class="snapshot-card-heading"><h3>${strings[label]}</h3><span class="tile-icon">${icon(glyph)}</span></div>
      <p class="snapshot-value"><bdi>${value}</bdi>${currency ? `<small>${currency}</small>` : ''}</p>
      <p class="snapshot-hint">${strings[hint]}</p>
    </article>`).join('');
  document.querySelector('#tool-link-grid').innerHTML = Object.entries(toolIcons).map(([key, glyph]) => `
    <a class="tool-link" href="#${key}">
      <span class="tile-icon">${icon(glyph)}</span>
      <div><h3>${strings[key]}</h3><p>${strings[key + 'Description']}</p></div>
      <span class="tool-arrow">${icon('arrow')}</span>
    </a>`).join('');
}

function applyLanguage() {
  const strings = copy[language];
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-copy]').forEach((node) => { node.textContent = strings[node.dataset.copy]; });
  primaryNav.setAttribute('aria-label', strings.workspace);
  languageButton.title = strings.switchLanguage;
  const languageLabel = document.querySelector('#language-label');
  languageLabel.lang = language === 'ar' ? 'en' : 'ar';
  languageLabel.textContent = language === 'ar' ? 'English' : 'العربية';
  themeButton.setAttribute('aria-label', strings.darkMode);
  reportButton.setAttribute('aria-label', strings.report);
  setMenu(false);
  renderOverview();
}

function navigate({ focus = false, refresh = false } = {}) {
  const fragment = location.hash.slice(1);
  if (fragment === 'main-content' && activeRoute) return;
  const next = Object.hasOwn(toolIcons, fragment) ? fragment : 'overview';
  if (activeRoute === next && !refresh) return;
  activeRoute = next;
  const isOverview = next === 'overview';
  const strings = copy[language];
  overview.hidden = !isOverview;
  toolView.hidden = isOverview;
  reportButton.hidden = isOverview;
  document.querySelector('#current-page').textContent = strings[next];
  primaryNav.querySelectorAll('[data-route]').forEach((link) => {
    if (link.dataset.route === next) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (!isOverview) toolView.replaceChildren(renderTool(next, language));
  else toolView.replaceChildren();
  document.title = `THE SPIDER DXB | ${strings[isOverview ? 'overviewTitle' : next]}`;
  setMenu(false);
  if (focus) {
    const heading = main.querySelector(isOverview ? '#overview-title' : '#tool-title');
    window.scrollTo(0, 0);
    (heading || main).focus({ preventScroll: true });
  }
}

document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
});
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'false';
  setMenu(open);
  if (open) primaryNav.querySelector('[aria-current]').focus();
});
sidebar.addEventListener('click', (event) => {
  if (mobile.matches && event.target.closest('a[href^="#"]')?.hash === location.hash) setMenu(false, true);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setMenu(false, true);
});
document.addEventListener('pointerdown', (event) => {
  if (sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
});
mobile.addEventListener('change', () => setMenu(false));
languageButton.addEventListener('click', () => {
  language = language === 'ar' ? 'en' : 'ar';
  preference('language', language);
  applyLanguage();
  navigate({ refresh: true });
});
themeButton.addEventListener('click', () => {
  theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  preference('theme', theme);
  applyTheme();
});
darkPreference.addEventListener('change', applyTheme);
reportButton.addEventListener('click', () => {
  const form = toolView.querySelector('form');
  if (!form) return;
  // Clear the previous result's validity before native constraint validation.
  form.dataset.valid = 'false';
  form.requestSubmit();
  if (form.dataset.valid === 'true') window.print();
});
window.addEventListener('hashchange', () => navigate({ focus: true }));

applyTheme();
applyLanguage();
navigate();
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch((error) => {
    console.warn('Offline installation failed.', error);
  });
}

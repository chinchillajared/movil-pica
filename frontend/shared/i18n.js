const STORAGE_KEY = "mechanic_lang";
const SUPPORTED = ["es", "en"];

function detectLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED.includes(saved)) return saved;
  const nav = (navigator.language || "en").toLowerCase();
  const primary = nav.split("-")[0];
  return SUPPORTED.includes(primary) ? primary : "en";
}

function resolvePath(base, relative) {
  if (!base) return relative;
  if (base.endsWith("/")) return base + relative;
  return base + "/" + relative;
}

async function loadLocale(lang) {
  const url = resolvePath(document.documentElement.dataset.localeBase || "/locales", `${lang}.json`);
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load locale: ${lang}`);
  return res.json();
}

function applyTranslations(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (dict[key] !== undefined) el.setAttribute("title", dict[key]);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (dict[key] !== undefined) el.setAttribute("aria-label", dict[key]);
  });
  document.documentElement.lang = window.I18N.lang;
}

const APP_DATE_MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const APP_DATE_MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatAppDate(dateStr) {
  if (!dateStr) return "";
  var s = String(dateStr).slice(0, 10);
  var p = s.split("-");
  if (p.length < 3) return dateStr;
  var m = parseInt(p[1], 10) - 1;
  var d = parseInt(p[2], 10);
  var lang = window.I18N && window.I18N.lang ? window.I18N.lang : "es";
  if (lang === "en") return APP_DATE_MONTHS_EN[m] + " " + d + ", " + p[0];
  return d + " de " + APP_DATE_MONTHS_ES[m] + " de " + p[0];
}

function buildSwitcher(currentLang) {  if (currentLang === undefined && window.I18N) currentLang = window.I18N.lang;
  document.querySelectorAll("[data-lang-switcher]").forEach((el) => {
    el.innerHTML = "";
    SUPPORTED.forEach((code) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.lang = code;
      btn.className =
        "px-2 py-1 text-sm rounded-md border " +
        (code === currentLang
          ? "bg-brand-600 text-white border-brand-600"
          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50");
      btn.textContent = code.toUpperCase();
      btn.addEventListener("click", () => {
        localStorage.setItem(STORAGE_KEY, code);
        window.I18N.setLanguage(code);
      });
      el.appendChild(btn);
    });
  });
}

async function applySiteLogo() {
  const imgs = document.querySelectorAll("[data-site-logo]");
  if (!imgs.length) return;
  let logo = "";
  try {
    const res = await fetch("/api/site/settings", { cache: "no-cache" });
    const data = await res.json();
    logo = (data && data.logo_data_url) || "";
  } catch (e) {
    logo = "";
  }
  imgs.forEach((img) => {
    if (logo) {
      img.src = logo;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
  });
}

window.I18N = {
  lang: null,
  dict: {},
  async init() {
    const lang = detectLanguage();
    await this.setLanguage(lang, { skipStorage: true });
  },
  buildSwitcher: buildSwitcher,
  async setLanguage(lang, { skipStorage = false } = {}) {
    this.lang = SUPPORTED.includes(lang) ? lang : "en";
    if (!skipStorage) localStorage.setItem(STORAGE_KEY, this.lang);
    this.dict = await loadLocale(this.lang);
    applyTranslations(this.dict);
    buildSwitcher(this.lang);
    document.dispatchEvent(new CustomEvent("i18n:ready", { detail: { lang: this.lang, dict: this.dict } }));
  },
  t(key) {
    return this.dict[key] || key;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  window.I18N.init();
  applySiteLogo();
});

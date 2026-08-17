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

function applySiteFavicon(logo) {
  if (!logo) return;
  const image = new Image();
  image.onload = () => {
    const size = 64;
    const padding = 6;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    const scale = Math.min((size - padding * 2) / image.naturalWidth, (size - padding * 2) / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
    let link = document.querySelector("link[data-site-favicon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.sizes = "64x64";
      link.dataset.siteFavicon = "true";
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL("image/png");
  };
  image.src = logo;
}

function logoWithBrandBackground(logo) {
  if (!logo) return Promise.resolve("");
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(logo);
        return;
      }
      context.fillStyle = "#0b1628";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const isWhite = pixels.data[i] > 238 && pixels.data[i + 1] > 238 && pixels.data[i + 2] > 238;
        if (pixels.data[i + 3] === 0 || isWhite) {
          pixels.data[i] = 11;
          pixels.data[i + 1] = 22;
          pixels.data[i + 2] = 40;
          pixels.data[i + 3] = 255;
        }
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(logo);
    image.src = logo;
  });
}

function applySiteBackgrounds(images, imageCount, opacity, pages) {
  const path = window.location.pathname;
  const page = path === "/user/" || path === "/user/index.html"
    ? "home"
    : (path.match(/^\/user\/([^/]+)\.html$/) || ["", ""])[1].replace(".html", "");
  const selectedPages = pages && pages.length ? pages : ["home"];
  if (selectedPages.indexOf(page) === -1 || !images || !images.length) return;
  let banner = document.querySelector("[data-site-background]");
  if (!banner) {
    const main = document.querySelector("main");
    if (!main || !main.parentNode) return;
    banner = document.createElement("div");
    banner.dataset.siteBackground = "true";
    banner.className = "pointer-events-none absolute inset-0 bg-cover bg-center";
    main.classList.add("relative", "overflow-hidden");
    main.insertBefore(banner, main.firstChild);
  }
  mainContentAboveBanner(banner);
  const visibleImages = images.slice(0, imageCount || images.length);
  banner.innerHTML = "";
  banner.classList.add("flex");
  banner.style.opacity = String(Math.max(0, Math.min(100, opacity == null ? 100 : opacity)) / 100);
  visibleImages.forEach((src, index) => {
    const panel = document.createElement("div");
    panel.className = "min-w-0 flex-1 bg-cover bg-center";
    if (index === 0) panel.style.clipPath = "polygon(0 0, 100% 0, 86% 100%, 0 100%)";
    else if (index === visibleImages.length - 1) panel.style.clipPath = "polygon(14% 0, 100% 0, 100% 100%, 0 100%)";
    else panel.style.clipPath = "polygon(14% 0, 100% 0, 86% 100%, 0 100%)";
    panel.style.backgroundImage = "url(\"" + src + "\")";
    banner.appendChild(panel);
  });
}

function mainContentAboveBanner(banner) {
  const main = banner.parentElement;
  if (!main) return;
  Array.from(main.children).forEach((child) => {
    if (child !== banner) child.classList.add("relative", "z-10");
  });
}

async function applySiteBranding() {
  const imgs = document.querySelectorAll("[data-site-logo]");
  let data = {};
  try {
    const res = await fetch("/api/site/settings", { cache: "no-cache" });
    data = await res.json();
  } catch (e) {
    data = {};
  }
  const logo = data.logo_data_url || "";
  const siteName = data.site_name || "Mecánico en Cóbano";
  const siteTitle = data.site_title || "Mecánico en Cóbano";
  const siteTagline = data.site_tagline || "Diagnóstico, mantenimiento y reparacion automotriz";
  const logoWidth = Number(data.logo_width) || 160;
  const logoHeight = Number(data.logo_height) || 64;
  document.documentElement.style.setProperty("--site-logo-width", `${logoWidth}px`);
  document.documentElement.style.setProperty("--site-logo-height", `${logoHeight}px`);
  applySiteFavicon(logo);
  const displayLogo = await logoWithBrandBackground(logo);
  imgs.forEach((img) => {
    if (logo) {
      img.src = displayLogo;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
  });
  document.querySelectorAll("[data-site-logo-fallback]").forEach((el) => {
    el.classList.toggle("hidden", !!logo);
  });
  document.querySelectorAll("[data-site-name]").forEach((el) => { el.textContent = siteName; });
  document.querySelectorAll("[data-site-title]").forEach((el) => { el.textContent = siteTitle; });
  document.querySelectorAll("[data-site-tagline]").forEach((el) => { el.textContent = siteTagline; });
  applySiteBackgrounds(data.background_images || [], data.background_image_count, data.background_opacity, data.background_pages);
  if (window.location.pathname.indexOf("/user/") === 0 && !document.querySelector("footer")) {
    const footer = document.createElement("footer");
    footer.className = "px-6 py-3 text-center text-xs text-slate-400";
    footer.innerHTML = "&copy; <span data-site-year></span> <span data-site-name></span>";
    document.body.appendChild(footer);
  }
  document.querySelectorAll("[data-site-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  window.siteBrandingData = data;
  document.dispatchEvent(new CustomEvent("site:branding", { detail: data }));
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
  applySiteBranding();
});

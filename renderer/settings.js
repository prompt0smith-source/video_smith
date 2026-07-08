(() => {
  const STORAGE_KEY = "pearl.lang";
  let isSettingsOpen = false;
  let gearAnim = null;

  function getDict(lang) {
    if (lang === "en") return window.PearlLangEn || {};
    return window.PearlLangKo || {};
  }

  function getRotationDeg(el){
    const tr = getComputedStyle(el).transform;
    if (!tr || tr === "none") return 0;
    const m = new DOMMatrixReadOnly(tr);
    return Math.atan2(m.b, m.a) * (180 / Math.PI);
  }

  function animateGear(direction) {
    const gear = document.getElementById("gearIcon");
    if (!gear || !gear.animate) return;
    const current = getRotationDeg(gear);
    const target = current + direction * 45;
    if (gearAnim) gearAnim.cancel();
    gearAnim = gear.animate([
      { transform: `rotate(${current}deg) scale(1)` },
      { transform: `rotate(${target}deg) scale(1.02)` }
    ], {
      duration: 180,
      easing: "cubic-bezier(0.2, 0, 0.2, 1)",
      fill: "forwards"
    });
  }

  function toggleSettings(open) {
    const drawer = document.getElementById("settingsDrawer");
    const overlay = document.getElementById("settingsOverlay");
    if (!drawer || !overlay) return;
    const next = typeof open === "boolean" ? open : !isSettingsOpen;
    if (next === isSettingsOpen) return;

    isSettingsOpen = next;
    drawer.classList.toggle("open", next);
    overlay.classList.toggle("hidden", !next);
    drawer.setAttribute("aria-hidden", next ? "false" : "true");
    animateGear(next ? +1 : -1);
  }

  function applyLanguage(lang) {
    const d = getDict(lang);
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      if (el.id === "outputFolderHint") return;
      const val = d[key];
      if (!val) return;
      el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      const val = d[key];
      if (!val) return;
      el.innerHTML = val;
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      const val = d[key];
      if (!val) return;
      el.title = val;
      el.setAttribute("aria-label", val);
    });

    const dropHint = document.getElementById("dropHint");
    if (dropHint && d.dropHint1 && d.dropHint2) dropHint.innerHTML = `${d.dropHint1}<br/>${d.dropHint2}`;

    const btnRegion = document.getElementById("btnRegion");
    if (btnRegion) {
      const isOn = btnRegion.classList.contains("regionOn");
      btnRegion.textContent = isOn ? (d.regionOn || "Region On") : (d.regionOff || "Region Off");
    }

    const outputFolderHint = document.getElementById("outputFolderHint");
    if (outputFolderHint) {
      const p = outputFolderHint.dataset.outputPath || "";
      outputFolderHint.textContent = p || d.outputFolderDefault || "Default: project folder";
    }
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent("pearl-languagechange", {
      detail: { lang, dict: d }
    }));
  }

  function init() {
    const btnOpen = document.getElementById("btnSettings");
    const overlay = document.getElementById("settingsOverlay");
    const btnClose = document.getElementById("btnSettingsClose");
    const sel = document.getElementById("selLang");
    const lang = localStorage.getItem(STORAGE_KEY) || "ko";
    if (sel) sel.value = lang;

    btnOpen?.addEventListener("click", () => toggleSettings(true));
    overlay?.addEventListener("click", () => toggleSettings(false));
    btnClose?.addEventListener("click", () => toggleSettings(false));
    sel?.addEventListener("change", () => applyLanguage(sel.value));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") toggleSettings(false);
    });

    applyLanguage(lang);
  }

  window.PearlSettings = { init, applyLanguage, getDict, toggleSettings, get isOpen(){ return isSettingsOpen; } };
})();

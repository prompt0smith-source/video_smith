(() => {
  const STORAGE_KEY = "pearl.lang";
  let isSettingsOpen = false;
  let isThirdPartyOpen = false;
  let activeLegalDoc = "thirdParty";
  let thirdPartyReturnFocus = null;
  let gearAnim = null;
  const LEGAL_DOCS = {
    legal: { title: "legalNoticePanelTitle", body: "legalNoticePanelBody" },
    openSource: { title: "openSourceLicensesTitle", body: "openSourceLicensesBody" },
    thirdParty: { title: "thirdPartyNoticesTitle", body: "thirdPartyNoticesBody" },
    ffmpeg: { title: "ffmpegNoticeTitle", body: "ffmpegNoticeBody" },
    privacy: { title: "privacyPolicyTitle", body: "privacyPolicyBody" },
    userContent: { title: "userContentNoticeTitle", body: "userContentNoticeBody" }
  };

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
    const target = current + direction * 32;
    if (gearAnim) gearAnim.cancel();
    gearAnim = gear.animate([
      { transform: `rotate(${current}deg) scale(1)` },
      { transform: `rotate(${target}deg) scale(1.01)` }
    ], {
      duration: 140,
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

  function currentLang() {
    return localStorage.getItem(STORAGE_KEY) || "ko";
  }

  function setLegalDocContent(docKey = activeLegalDoc) {
    activeLegalDoc = LEGAL_DOCS[docKey] ? docKey : "thirdParty";
    const d = getDict(currentLang());
    const spec = LEGAL_DOCS[activeLegalDoc];
    const title = document.getElementById("thirdPartyModalTitle");
    const body = document.querySelector("#thirdPartyModal .thirdPartyBody");
    if (title) title.textContent = d[spec.title] || d.thirdPartyNoticesTitle || "Notices";
    if (body) body.innerHTML = d[spec.body] || d.thirdPartyNoticesBody || "";
    document.querySelectorAll("[data-legal-doc]").forEach((button) => {
      const active = button.dataset.legalDoc === activeLegalDoc;
      button.classList.toggle("active", active);
      if (button.getAttribute("role") === "tab") button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function toggleThirdPartyNotices(open, docKey = activeLegalDoc) {
    const modal = document.getElementById("thirdPartyModal");
    if (!modal) return;
    if (open) setLegalDocContent(docKey);
    const next = typeof open === "boolean" ? open : !isThirdPartyOpen;
    if (next === isThirdPartyOpen) return;

    isThirdPartyOpen = next;
    modal.classList.toggle("hidden", !next);
    modal.setAttribute("aria-hidden", next ? "false" : "true");

    if (next) {
      thirdPartyReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      document.getElementById("thirdPartyModalOk")?.focus();
    } else {
      const target = thirdPartyReturnFocus;
      thirdPartyReturnFocus = null;
      if (target && document.contains(target)) target.focus();
    }
  }

  function showLegalNoticeModal(docKey = "legal") {
    toggleThirdPartyNotices(true, docKey);
  }

  function showOpenSourceNoticeModal() {
    showLegalNoticeModal("openSource");
  }

  function showThirdPartyNoticesModal() {
    showLegalNoticeModal("thirdParty");
  }

  function showPrivacyPolicyModal() {
    showLegalNoticeModal("privacy");
  }

  function showUserContentNoticeModal() {
    showLegalNoticeModal("userContent");
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
    if (isThirdPartyOpen) setLegalDocContent(activeLegalDoc);
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent("pearl-languagechange", {
      detail: { lang, dict: d }
    }));
  }

  function init() {
    const btnOpen = document.getElementById("btnSettings");
    const overlay = document.getElementById("settingsOverlay");
    const btnClose = document.getElementById("btnSettingsClose");
    const thirdPartyModal = document.getElementById("thirdPartyModal");
    const btnThirdPartyClose = document.getElementById("thirdPartyModalClose");
    const btnThirdPartyOk = document.getElementById("thirdPartyModalOk");
    const sel = document.getElementById("selLang");
    const lang = localStorage.getItem(STORAGE_KEY) || "ko";
    if (sel) sel.value = lang;

    btnOpen?.addEventListener("click", () => toggleSettings(true));
    overlay?.addEventListener("click", () => toggleSettings(false));
    btnClose?.addEventListener("click", () => toggleSettings(false));
    document.querySelectorAll("[data-legal-doc]").forEach((button) => {
      button.addEventListener("click", () => showLegalNoticeModal(button.dataset.legalDoc || "legal"));
    });
    btnThirdPartyClose?.addEventListener("click", () => toggleThirdPartyNotices(false));
    btnThirdPartyOk?.addEventListener("click", () => toggleThirdPartyNotices(false));
    thirdPartyModal?.addEventListener("mousedown", (e) => {
      if (e.target === thirdPartyModal) toggleThirdPartyNotices(false);
    });
    sel?.addEventListener("change", () => applyLanguage(sel.value));
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (isThirdPartyOpen) {
        toggleThirdPartyNotices(false);
        return;
      }
      toggleSettings(false);
    });

    applyLanguage(lang);
  }

  window.PearlSettings = {
    init,
    applyLanguage,
    getDict,
    toggleSettings,
    toggleThirdPartyNotices,
    showLegalNoticeModal,
    showOpenSourceNoticeModal,
    showThirdPartyNoticesModal,
    showPrivacyPolicyModal,
    showUserContentNoticeModal,
    get isOpen(){ return isSettingsOpen; },
    get isThirdPartyOpen(){ return isThirdPartyOpen; }
  };
})();

/*
  PearlCut renderer app (vanilla JS)
*/
(() => {
  const fpsOptions = [
    { label: "23.976fps", value: 23.976 },
    { label: "24fps", value: 24 },
    { label: "25fps", value: 25 },
    { label: "29.97fps", value: 29.97 },
    { label: "30fps", value: 30 },
    { label: "50fps", value: 50 },
    { label: "59.94fps", value: 59.94 },
    { label: "60fps", value: 60 }
  ];

  const resOptions = [
    { label: "SD (Standard Definition - 480p/576p): 640x480 ~ 854x480", name: "SD" },
    { label: "HD (High Definition - 720p): 1280x720", name: "HD" },
    { label: "FHD (Full HD - 1080p): 1920x1080", name: "FHD" },
    { label: "QHD (Quad HD - 1440p): 2560x1440", name: "QHD" },
    { label: "UHD / 4K (Ultra HD): 3840x2160", name: "UHD / 4K" }
  ];
  const aspectRatioOptions = [
    { value: "16:9", name: "16:9", desc: "기본 와이드" },
    { value: "16:10", name: "16:10", desc: "노트북/태블릿" },
    { value: "4:3", name: "4:3", desc: "클래식 화면" },
    { value: "1:1", name: "1:1", desc: "정사각형" },
    { value: "9:16", name: "9:16", desc: "모바일 세로" },
    { value: "10:16", name: "10:16", desc: "태블릿 세로" },
    { value: "20:9", name: "20:9", desc: "모바일 와이드" },
    { value: "21:9", name: "21:9", desc: "시네마 와이드" }
  ];

  const fmtOptions = ["MP4", "MOV", "AVI", "MKV", "WMV", "WebM"];
  const MIN_TIMELINE_CLIP_SEC = 0.01;
  const MIN_OVERLAY_CLIP_SEC = 0.01;
  const TIMELINE_TIME_STEP_SEC = 0.01;
  const FADE_SNAP_STEP_SEC = 0.01;
  const BACKGROUND_CLIP_DURATION_SEC = 5;
  const AUTO_SNAP_TARGET_PX = 16;
  const DETACHED_AUDIO_PLAY_SEEK_SEC = 0.18;
  const DETACHED_AUDIO_PAUSE_SEEK_SEC = 0.02;
  const DETACHED_AUDIO_RATE_LIMIT_MS = 90;
  const THEME_PREF_KEY = "videosmith.theme.preference";
  const TIMELINE_LABEL_COLUMN_PX = 52;
  const MIN_TIMELINE_VIEW_SEC = 10;
  const THEME_TRANSITION_MS = 320;
  const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;
  const CUSTOM_FONT_STORAGE_KEY = "videosmith.customFonts.v1";
  const ADD_CUSTOM_FONT_VALUE = "__add_custom_font__";
  const BASE_FONT_FAMILIES = ["Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Pretendard", "Arial", "Georgia"];
  const SUPPORTED_FONT_EXTS = new Set(["ttf", "otf", "ttc", "woff", "woff2"]);
  const IMPORT_VIDEO_EXT = new Set(["mp4", "mov", "avi", "mkv", "wmv", "webm"]);
  const IMPORT_AUDIO_EXT = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);
  const IMPORT_IMAGE_EXT = new Set([
    "jpg", "jpeg", "jpe", "jfif", "jif",
    "png", "apng",
    "bmp", "dib",
    "gif", "webp",
    "tif", "tiff",
    "avif", "heic", "heif",
    "svg", "ico", "cur",
    "ppm", "pgm", "pbm", "pnm", "pam",
    "tga", "dds", "hdr", "exr",
    "jxl", "jp2", "j2k", "jpf", "jpm", "jpx", "mj2"
  ]);

  const transitionItems = [
    { type: "cut", nameKey: "transitionTypeCut", nameFallback: "컷", descKey: "transitionDescCut", descFallback: "효과 없이 바로 전환" },
    { type: "fade", nameKey: "transitionTypeFade", nameFallback: "페이드 인/아웃", descKey: "transitionDescFade", descFallback: "프로젝트 배경색을 거치며 부드럽게 전환" },
    { type: "cross", nameKey: "transitionTypeCross", nameFallback: "크로스 디졸브", descKey: "transitionDescCross", descFallback: "두 클립이 자연스럽게 겹치며 전환" },
    { type: "sun_glitter_flash", nameKey: "transitionTypeSunGlitterFlash", nameFallback: "웜 선 글리터", descKey: "transitionDescSunGlitterFlash", descFallback: "따뜻한 태양빛 글리터가 두 번 번쩍이고 다음 장면으로 넘어갑니다." },
    { type: "focus_pull_in", nameKey: "transitionTypeFocusPullIn", nameFallback: "포커스 빨려들기", descKey: "transitionDescFocusPullIn", descFallback: "지정한 중심점으로 빨려들며 정리됩니다." },
    { type: "cyber_mosaic_burst", nameKey: "transitionTypeCyberMosaicBurst", nameFallback: "사이버 모자이크 버스트", descKey: "transitionDescCyberMosaicBurst", descFallback: "불규칙한 사각형 클러스터가 점프하듯 번지며 다음 장면을 드러냅니다." },
    { type: "blur_slide_left", nameKey: "transitionTypeBlurSlideLeft", nameFallback: "블러 슬라이드 왼쪽", descKey: "transitionDescBlurSlideLeft", descFallback: "현재 클립만 왼쪽으로 블러 아웃됩니다." },
    { type: "blur_slide_right", nameKey: "transitionTypeBlurSlideRight", nameFallback: "블러 슬라이드 오른쪽", descKey: "transitionDescBlurSlideRight", descFallback: "현재 클립만 오른쪽으로 블러 아웃됩니다." },
    { type: "blur_slide_up", nameKey: "transitionTypeBlurSlideUp", nameFallback: "블러 슬라이드 위쪽", descKey: "transitionDescBlurSlideUp", descFallback: "현재 클립만 위로 블러 아웃됩니다." },
    { type: "blur_slide_down", nameKey: "transitionTypeBlurSlideDown", nameFallback: "블러 슬라이드 아래쪽", descKey: "transitionDescBlurSlideDown", descFallback: "현재 클립만 아래로 블러 아웃됩니다." }
  ];
  const textOverlayTransitionItems = [
    { type: "none", nameKey: "", nameFallback: "없음" },
    ...transitionItems.filter((item) => [
      "fade",
      "cross",
      "sun_glitter_flash",
      "focus_pull_in",
      "cyber_mosaic_burst",
      "blur_slide_left",
      "blur_slide_right",
      "blur_slide_up",
      "blur_slide_down"
    ].includes(item.type))
  ];

  const effectDefs = window.VideoSmithEffectDefs || null;
  const textItems = [effectDefs?.paletteItems?.text || { type: "text", name: "설명 텍스트(Text Overlay)", desc: "타이틀/자막/3D 자막" }];
  const fxItems = (effectDefs?.fxTypes || ["point_pop_line", "underline", "circle"])
    .map((type) => effectDefs?.paletteItems?.[type])
    .filter(Boolean);
  const backgroundClipColorOptions = [
    { value: "#ffffff", labelKey: "backgroundColorWhite", labelFallback: "화이트" },
    { value: "#f8fafc", labelKey: "backgroundColorSoftWhite", labelFallback: "소프트 화이트" },
    { value: "#e5e7eb", labelKey: "backgroundColorLightGray", labelFallback: "라이트 그레이" },
    { value: "#111827", labelKey: "backgroundColorCharcoal", labelFallback: "차콜" },
    { value: "#0f172a", labelKey: "backgroundColorNavy", labelFallback: "네이비" },
    { value: "#dbeafe", labelKey: "backgroundColorSky", labelFallback: "스카이" }
  ];
  const editToolItems = [
    {
      type: "chroma_key",
      name: "크로마키",
      desc: "영상 클립에 드래그하면 배경 제거용 색상 픽업이 열립니다."
    }
  ];
  const ALL_FX_TYPES = new Set(effectDefs?.allFxTypes || ["circle", "underline", "point_pop_line"]);
  const POP_FX_TYPES = new Set(["point_pop_line", "checkpoint_pop"]);
  const SWEEP_FX_TYPES = new Set(["underline", "highlight_bar_sweep", "section_divider_slide"]);
  const BOX_FX_TYPES = new Set(["focus_box_draw", "soft_spotlight"]);
  const RECT_FX_TYPES = new Set(["focus_box_draw", "soft_spotlight", "highlight_bar_sweep"]);
  const LINE_FX_TYPES = new Set(["callout_line_draw"]);

  const $ = (id) => document.getElementById(id);

  const els = {
    layout: $("layout"),
    btnUpload: $("btnUpload"),
    btnSave: $("btnSave"),
    btnLoad: $("btnLoad"),
    btnRender: $("btnRender"),
    btnRegion: $("btnRegion"),
    selFps: $("selFps"),
    selRes: $("selRes"),
    selFmt: $("selFmt"),
    backgroundColorInput: $("backgroundColorInput"),
    backgroundColorHex: $("backgroundColorHex"),
    clipList: $("clipList"),
    editToolPalette: $("editToolPalette"),
    transitionPalette: $("transitionPalette"),
    textPalette: $("textPalette"),
    effectsPalette: $("effectsPalette"),
    backgroundPalette: $("backgroundPalette"),
    backgroundClipColorSelect: $("backgroundClipColorSelect"),
    backgroundClipColorInput: $("backgroundClipColorInput"),
    backgroundClipColorHex: $("backgroundClipColorHex"),
    backgroundClipEyedropperBtn: $("backgroundClipEyedropperBtn"),
    dropZone: $("dropZone"),
    video: $("video"),
    curTime: $("curTime"),
    durTime: $("durTime"),
    btnBack10: $("btnBack10"),
    btnStop: $("btnStop"),
    btnPause: $("btnPause"),
    btnPlay: $("btnPlay"),
    btnFwd10: $("btnFwd10"),
    btnTheme: $("btnTheme"),
    btnPreviewAspectRatio: $("btnPreviewAspectRatio"),
    ruler: $("ruler"),
    videoLane: $("videoLane"),
    audioLane: $("audioLane"),
    playhead: $("playhead"),
    regionOverlay: $("regionOverlay"),
    regionStartHandle: $("regionStartHandle"),
    regionEndHandle: $("regionEndHandle"),
    zoom: $("zoom"),
    btnZoomOut: $("btnZoomOut"),
    btnZoomIn: $("btnZoomIn"),
    zoomValue: $("zoomValue"),
    toast: $("toast"),
    modal: $("modal"),
    modalBody: $("modalBody"),
    modalOk: $("modalOk"),
    videoCropModal: $("videoCropModal"),
    videoCropModalClose: $("videoCropModalClose"),
    videoCropModalMeta: $("videoCropModalMeta"),
    videoCropPreviewFrame: $("videoCropPreviewFrame"),
    videoCropPreviewVideo: $("videoCropPreviewVideo"),
    videoCropPreviewOverlay: $("videoCropPreviewOverlay"),
    btnVideoCropDone: $("btnVideoCropDone"),
    imageCutoutModal: $("imageCutoutModal"),
    imageCutoutMeta: $("imageCutoutMeta"),
    imageCutoutViewport: $("imageCutoutViewport"),
    imageCutoutCanvas: $("imageCutoutCanvas"),
    btnImageCutoutBrush: $("btnImageCutoutBrush"),
    btnImageCutoutAutoRect: $("btnImageCutoutAutoRect"),
    btnImageCutoutSave: $("btnImageCutoutSave"),
    btnImageCutoutCancel: $("btnImageCutoutCancel"),
    btnImageCutoutClose: $("btnImageCutoutClose"),
    imageCutoutCloseTopBtn: $("imageCutoutCloseTopBtn"),
    termsModal: $("termsModal"),
    termsAgreeCheck: $("termsAgreeCheck"),
    btnTermsAccept: $("btnTermsAccept"),
    btnTermsDecline: $("btnTermsDecline"),
    dropHighlight: $("dropHighlight"),
    renderStatus: $("renderStatus"),
    uploadStatus: $("uploadStatus"),
    autoSaveStatus: $("autoSaveStatus"),
    autoSaveLabel: $("autoSaveLabel"),
    pitchCanvas: $("pitchCanvas"),
    splitterV: $("splitterV"),
    splitterH: $("splitterH"),
    timelineViewport: $("timelineViewport"),
    videoTrack: $("videoTrack"),
    audioTrack: $("audioTrack"),
    bottom: $("bottom"),
    videoLabelCol: $("videoLabelCol"),
    audioLabelCol: $("audioLabelCol"),
    timelineContextMenu: $("timelineContextMenu"),
    ctxCopySection: $("ctxCopySection"),
    ctxPasteSection: $("ctxPasteSection"),
    ctxDeleteSection: $("ctxDeleteSection"),
    btnAddVideoSection: $("btnAddVideoSection"),
    btnAddAudioSection: $("btnAddAudioSection"),
    aspectRatioModal: $("aspectRatioModal"),
    aspectRatioGrid: $("aspectRatioGrid"),
    btnAspectRatioClose: $("btnAspectRatioClose"),
    customFontModal: $("customFontModal"),
    customFontFileInput: $("customFontFileInput"),
    customFontNameInput: $("customFontNameInput"),
    customFontFileHint: $("customFontFileHint"),
    customFontTermsCheck: $("customFontTermsCheck"),
    btnCustomFontAdd: $("btnCustomFontAdd"),
    btnCustomFontCancel: $("btnCustomFontCancel"),
    btnCustomFontClose: $("btnCustomFontClose"),
    toolSheetTabs: $("toolSheetTabs"),
    overlayInspectorEmpty: $("overlayInspectorEmpty"),
    overlayInspectorForm: $("overlayInspectorForm"),
    overlayTextInput: $("overlayTextInput"),
    overlayFontSizeInput: $("overlayFontSizeInput"),
    overlayFontSizeValue: $("overlayFontSizeValue"),
    overlayOpacityInput: $("overlayOpacityInput"),
    overlayOpacityValue: $("overlayOpacityValue"),
    overlayFadeInInput: $("overlayFadeInInput"),
    overlayFadeInValue: $("overlayFadeInValue"),
    overlayFadeOutInput: $("overlayFadeOutInput"),
    overlayFadeOutValue: $("overlayFadeOutValue"),
    overlayTransitionInTypeInput: $("overlayTransitionInTypeInput"),
    overlayTransitionInDurationInput: $("overlayTransitionInDurationInput"),
    overlayTransitionInDurationValue: $("overlayTransitionInDurationValue"),
    overlayTransitionOutTypeInput: $("overlayTransitionOutTypeInput"),
    overlayTransitionOutDurationInput: $("overlayTransitionOutDurationInput"),
    overlayTransitionOutDurationValue: $("overlayTransitionOutDurationValue"),
    overlayTransitionStrengthInput: $("overlayTransitionStrengthInput"),
    overlayTransitionStrengthValue: $("overlayTransitionStrengthValue"),
    overlayPosXInput: $("overlayPosXInput"),
    overlayPosXValue: $("overlayPosXValue"),
    overlayPosYInput: $("overlayPosYInput"),
    overlayPosYValue: $("overlayPosYValue"),
    overlayColorInput: $("overlayColorInput"),
    overlayNoFillInput: $("overlayNoFillInput"),
    overlayStrokeColorInput: $("overlayStrokeColorInput"),
    overlayNoStrokeInput: $("overlayNoStrokeInput"),
    overlayStrokeWidthInput: $("overlayStrokeWidthInput"),
    overlayStrokeWidthValue: $("overlayStrokeWidthValue"),
    overlayFontWeightInput: $("overlayFontWeightInput"),
    overlayFontFamilyInput: $("overlayFontFamilyInput"),
    overlayTextAlignInput: $("overlayTextAlignInput"),
    videoInspectorEmpty: $("videoInspectorEmpty"),
    videoInspectorForm: $("videoInspectorForm"),
    videoInspectorTitle: $("videoInspectorTitle"),
    videoInspectorMeta: $("videoInspectorMeta"),
    videoEditTransformBtn: $("videoEditTransformBtn"),
    videoEditCropBtn: $("videoEditCropBtn"),
    videoScaleInput: $("videoScaleInput"),
    videoScaleValue: $("videoScaleValue"),
    videoScaleXInput: $("videoScaleXInput"),
    videoScaleYInput: $("videoScaleYInput"),
    videoPosXInput: $("videoPosXInput"),
    videoPosXValue: $("videoPosXValue"),
    videoPosYInput: $("videoPosYInput"),
    videoPosYValue: $("videoPosYValue"),
    videoAnchorXInput: $("videoAnchorXInput"),
    videoAnchorXValue: $("videoAnchorXValue"),
    videoAnchorYInput: $("videoAnchorYInput"),
    videoAnchorYValue: $("videoAnchorYValue"),
    videoRotationInput: $("videoRotationInput"),
    videoRotationValue: $("videoRotationValue"),
    videoOpacityInput: $("videoOpacityInput"),
    videoOpacityValue: $("videoOpacityValue"),
    videoChromaEnabledInput: $("videoChromaEnabledInput"),
    videoChromaColorInput: $("videoChromaColorInput"),
    videoChromaColorHex: $("videoChromaColorHex"),
    videoChromaEyedropperBtn: $("videoChromaEyedropperBtn"),
    videoChromaSimilarityInput: $("videoChromaSimilarityInput"),
    videoChromaSimilarityValue: $("videoChromaSimilarityValue"),
    videoChromaBlendInput: $("videoChromaBlendInput"),
    videoChromaBlendValue: $("videoChromaBlendValue"),
    videoChromaReflectionInput: $("videoChromaReflectionInput"),
    videoChromaReflectionValue: $("videoChromaReflectionValue"),
    videoFitModeInput: $("videoFitModeInput"),
    videoCropLeftInput: $("videoCropLeftInput"),
    videoCropRightInput: $("videoCropRightInput"),
    videoCropTopInput: $("videoCropTopInput"),
    videoCropBottomInput: $("videoCropBottomInput"),
    videoSourceInInput: $("videoSourceInInput"),
    videoSourceOutInput: $("videoSourceOutInput"),
    videoPlaybackWindowHint: $("videoPlaybackWindowHint"),
    videoPresetCenter: $("videoPresetCenter"),
    videoPresetTopLeft: $("videoPresetTopLeft"),
    videoPresetTopRight: $("videoPresetTopRight"),
    videoPresetBottomLeft: $("videoPresetBottomLeft"),
    videoPresetBottomRight: $("videoPresetBottomRight"),
    btnVideoResetTransform: $("btnVideoResetTransform"),
    btnVideoResetChroma: $("btnVideoResetChroma"),
    btnVideoResetCrop: $("btnVideoResetCrop"),
    btnVideoResetAll: $("btnVideoResetAll"),
  };
  const renderGraph = window.VideoSmithRenderGraph || null;
  const timelineTransportApi = window.VideoSmithTimelineTransport || null;

  function clampVideoRotationDeg(value) {
    return Math.max(-180, Math.min(180, Number(value || 0)));
  }

  function normalizeAngleDeltaDeg(value) {
    let angle = Number(value || 0);
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  function getContextMenuIconMarkup(type) {
    switch (String(type || "")) {
      case "copy":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="10" height="10" rx="2"></rect><rect x="5" y="5" width="10" height="10" rx="2"></rect></svg>';
      case "paste":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h6"></path><path d="M9 3h6v4H9z"></path><path d="M7 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"></path></svg>';
      case "cut":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"></rect><rect x="13" y="13" width="7" height="7" rx="1.5"></rect><path d="M10.5 13.5L13.5 10.5"></path></svg>';
      case "delete":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 12h8l1-12"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';
      default:
        return "";
    }
  }

  function setContextMenuButtonContent(button, { iconType = "", label = "" } = {}) {
    if (!button) return;
    const iconEl = button.querySelector(".ctxIcon");
    const labelEl = button.querySelector(".ctxLabel");
    if (iconEl) iconEl.innerHTML = getContextMenuIconMarkup(iconType);
    if (labelEl) labelEl.textContent = label;
    button.dataset.iconType = iconType;
  }
  const overlapResolverApi = window.VideoSmithOverlapResolver || null;
  const zoomMotion = window.VideoSmithZoomMotion || null;
  const transitionMotion = window.VideoSmithTransitionMotion || null;
  const clipVisuals = window.VideoSmithClipVisuals || null;
  const overlayEngine = window.VideoSmithOverlayEngine || null;
  const previewSessionApi = window.VideoSmithPreviewSession || null;
  const toolTabs = window.VideoSmithToolTabs || null;
  window.__VIDEOSMITH_DEBUG__ = window.__VIDEOSMITH_DEBUG__ || { transport: false, overlap: false, preview: false };
  function getDebugFlags() {
    return window.__VIDEOSMITH_DEBUG__ || { transport: false, overlap: false, preview: false };
  }
  function getSystemTheme() {
    try {
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }
  function getStoredThemePreference() {
    try {
      return localStorage.getItem(THEME_PREF_KEY) || "dark";
    } catch {
      return "dark";
    }
  }
  function prefersReducedThemeMotion() {
    try {
      return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    } catch {
      return false;
    }
  }
  function resolveTheme(preference) {
    return preference === "system" ? getSystemTheme() : preference;
  }
  function getActiveThemeName() {
    return document.body?.dataset?.theme || resolveTheme(getStoredThemePreference());
  }
  function applyTheme(preference = getStoredThemePreference()) {
    const nextPreference = preference || "dark";
    const resolved = resolveTheme(nextPreference);
    const changed = document.body.dataset.theme !== resolved || document.body.dataset.themePreference !== nextPreference;
    if (changed) {
      if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
        themeTransitionTimer = 0;
      }
      document.body.classList.remove("theme-switching");
      if (!prefersReducedThemeMotion()) {
        void document.body.offsetWidth;
        document.body.classList.add("theme-switching");
      }
    }
    document.body.dataset.themePreference = nextPreference;
    document.body.dataset.theme = resolved;
    els.btnTheme?.setAttribute("title", `Theme: ${resolved}`);
    if (els.btnTheme) els.btnTheme.textContent = resolved === "dark" ? "☾" : "◐";
    if (changed && !prefersReducedThemeMotion()) {
      themeTransitionTimer = window.setTimeout(() => {
        themeTransitionTimer = 0;
        document.body.classList.remove("theme-switching");
      }, THEME_TRANSITION_MS);
    }
    if (changed && ((els.effectsPalette?.childElementCount || 0) > 0 || (els.transitionPalette?.childElementCount || 0) > 0)) {
      buildPalettes();
    }
  }
  function cycleThemePreference() {
    const current = getStoredThemePreference();
    const next = current === "system" ? "dark" : (current === "dark" ? "light" : "system");
    try { localStorage.setItem(THEME_PREF_KEY, next); } catch {}
    applyTheme(next);
  }

  function updateRangeVisual(input) {
    if (!input || input.type !== "range") return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || min);
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    input.style.setProperty("--range-pct", `${clamped}%`);
  }

  function hydrateRangeInputs(root = document) {
    if (!root) return;
    if (root.matches?.('input[type="range"]')) updateRangeVisual(root);
    root.querySelectorAll?.('input[type="range"]').forEach(updateRangeVisual);
  }

  function updateZoomValue() {
    if (!els.zoomValue || !els.zoom) return;
    const value = Number(els.zoom.value || state?.ui?.pxPerSec || 90);
    els.zoomValue.textContent = `${Math.round(Number.isFinite(value) ? value : 90)}`;
  }

  function setupRangeVisuals() {
    if (rangeVisualsBound) return;
    rangeVisualsBound = true;
    hydrateRangeInputs();
    const syncRange = (event) => {
      const target = event.target;
      if (target?.matches?.('input[type="range"]')) updateRangeVisual(target);
    };
    document.addEventListener("input", syncRange);
    document.addEventListener("change", syncRange);
    if (typeof MutationObserver !== "function" || !document.body) return;
    rangeMutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes?.forEach((node) => {
          if (node?.nodeType === Node.ELEMENT_NODE) hydrateRangeInputs(node);
        });
        if (mutation.type === "attributes") hydrateRangeInputs(mutation.target);
      });
    });
    rangeMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["min", "max", "value", "disabled"]
    });
  }

  const cmdStack = new window.CommandStack();
  const TERMS_ACCEPT_KEY = "pearl.terms.accepted.once";
  const TERMS_ACCEPT_KEY_LEGACY = "pearl.terms.accepted.effectiveDate";

  const state = {
    settings: {
      fps: 30,
      resolutionName: "FHD",
      container: "MP4",
      aspectRatio: "16:9",
      renderMode: "video",
      audioContainer: "MP3",
      outputFolder: "",
      backgroundColor: "#000000",
      backgroundClipColor: "#ffffff"
    },
    project: {
      videoClips: [],
      audioItems: [],
      overlayItems: [],
      videoSections: 1,
      audioSections: 1,
      transitions: {}, // key: boundary index
      duration: 0
    },
    ui: {
      pxPerSec: 90,
      currentTime: 0,
      isPlaying: false,
      viewDuration: 10,
      selectedClipId: null,
      selectedKeys: [],
      selectionOrder: [],
      previewClipId: null,
      previewEditMode: "transform",
      previewDragMode: null,
      videoCropModalOpen: false,
      videoCropDraft: null,
      activeLane: null,
      activeSection: { video: 1, audio: 1 },
      region: { enabled: false, start: 0, end: 0 },
      boundaries: [],
      internalDragging: false,
      dropPreview: {
        video: { visible: false, startSec: 0, durationSec: 0, section: 1 },
        audio: { visible: false, startSec: 0, durationSec: 0 }
      },
      sectionClipboard: null,
      itemClipboard: null,
      sectionMenuTarget: null,
      fxPopover: { overlayId: null, x: 0, y: 0 },
      transitionPopover: { key: null, anchorX: 0, anchorY: 0 },
      motionPathDrawOverlayId: null
    },
    dragging: {
      item: null,
      boundaryHover: null,
      transitionHoverTarget: null,
      transitionDropEffect: "none",
      transitionLeaveTimer: 0,
      transitionLastOverTs: 0
    }
  };
  const previewChromaCanvasState = new WeakMap();
  const DEFAULT_CHROMA_KEY_COLOR = "#00ff00";

  const dropMetaCache = new Map();
  let playheadRafId = null;
  let playheadLastTs = 0;
  let projectGraphCache = null;
  let toolSheetController = null;
  let transport = null;
  const previewSessions = new Map();
  let detachedAudioSession = null;
  let statusTickTimer = null;
  let statusTick = 0;
  let uploadBusy = false;
  let analyzeBusy = false;
  const analyzeQueue = [];
  let analyzeRunning = false;
  const thumbQueue = [];
  let thumbRunning = false;
  const palettePreviewMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let palettePreviewDisposers = [];
  let palettePreviewImage = null;
  let palettePreviewImageReady = false;
  let palettePreviewImageRequested = false;
  let activePaletteDragImageEl = null;
  let rangeVisualsBound = false;
  let rangeMutationObserver = null;
  let themeTransitionTimer = 0;
  let previewFrameRefreshRaf = 0;
  let previewResizeObserver = null;
  let customFonts = [];
  let pendingCustomFontFilePath = "";
  let lastTimeReadoutValue = "";
  let lastDurationReadoutValue = "";
  let autoSaveInFlight = null;
  const persistenceState = {
    manualSaveSignature: "",
    projectFilePath: "",
    lastAutoSaveSignature: "",
    lastAutoSaveAt: 0,
    autoSaveBusy: false,
    autoSaveTimer: 0
  };
  const timelinePanState = {
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0
  };
  const imageCutoutState = {
    open: false,
    clipId: "",
    baseImagePath: "",
    baseImage: null,
    sourceWidth: 0,
    sourceHeight: 0,
    displayRect: null,
    mask: null,
    dirty: false,
    tool: "brush",
    pointerActive: false,
    lastPoint: null,
    rectDraft: null,
    compositeDirty: true,
    compositeCanvas: document.createElement("canvas"),
    alphaCanvas: document.createElement("canvas")
  };

  function updateBusyStatus() {
    if (!els.uploadStatus) return;
    const label = uploadBusy ? "Uploading" : (analyzeBusy ? "Analyzing" : "");
    if (!label) {
      if (statusTickTimer) {
        clearInterval(statusTickTimer);
        statusTickTimer = null;
      }
      els.uploadStatus.textContent = "";
      setTimeout(() => {
        els.uploadStatus?.classList.remove("show");
      }, 260);
      return;
    }
    statusTick = 0;
    els.uploadStatus.classList.add("show");
    els.uploadStatus.textContent = label;
    if (statusTickTimer) clearInterval(statusTickTimer);
    statusTickTimer = setInterval(() => {
      const nowLabel = uploadBusy ? "Uploading" : (analyzeBusy ? "Analyzing" : "");
      if (!nowLabel) return;
      statusTick = (statusTick + 1) % 4;
      els.uploadStatus.textContent = nowLabel + ".".repeat(statusTick);
    }, 220);
  }

  function setUploadStatus(active) {
    uploadBusy = !!active;
    updateBusyStatus();
  }

  function setAnalyzeStatus(active) {
    analyzeBusy = !!active;
    updateBusyStatus();
  }

  function enqueueAudioAnalysis(audioId, mediaPath, options = {}) {
    if (!audioId || !mediaPath) return;
    analyzeQueue.push(async () => {
      const audio = state.project.audioItems.find(a => a.id === audioId);
      if (!audio) return;
      const waveformPeaks = options.waveform === false ? (audio.waveformPeaks || []) : await computeWavePeaksFromPath(mediaPath);
      const pitchContour = options.pitch ? await computePitchContourFromPath(mediaPath) : (audio.pitchContour || []);
      const again = state.project.audioItems.find(a => a.id === audioId);
      if (!again) return;
      again.waveformPeaks = waveformPeaks || [];
      again.pitchContour = pitchContour || [];
      again._analyzeQueued = false;
      renderTimeline();
    });
    void drainAnalyzeQueue();
  }

  async function drainAnalyzeQueue() {
    if (analyzeRunning) return;
    analyzeRunning = true;
    setAnalyzeStatus(analyzeQueue.length > 0);
    try {
      while (analyzeQueue.length) {
        const task = analyzeQueue.shift();
        if (!task) continue;
        try {
          await task();
        } catch {
          // keep queue running even if one analysis fails
        }
      }
    } finally {
      analyzeRunning = false;
      setAnalyzeStatus(false);
    }
  }

  function enqueueThumbBuild(clipId, count = 1, priority = "normal") {
    if (!clipId) return;
    const clip = state.project.videoClips.find(c => c.id === clipId);
    if (!clip) return;
    if (Number(clip._thumbRequestCount || 0) >= count) return;
    clip._thumbRequestCount = count;
    const pushTask = async () => {
      const clip = state.project.videoClips.find(c => c.id === clipId);
      if (!clip) return;
      await enrichClipVisuals(clip, count);
    };
    if (priority === "high") thumbQueue.unshift(pushTask);
    else thumbQueue.push(pushTask);
    void drainThumbQueue();
  }

  async function drainThumbQueue() {
    if (thumbRunning) return;
    thumbRunning = true;
    try {
      while (thumbQueue.length) {
        const task = thumbQueue.shift();
        if (!task) continue;
        try {
          await task();
        } catch {
          // skip broken preview source and continue
        }
      }
    } finally {
      thumbRunning = false;
    }
  }

  function clipKey(kind, id) {
    return `${kind}:${id}`;
  }

  function t(key, fallback) {
    const lang = localStorage.getItem("pearl.lang") || "ko";
    const dict = window.PearlSettings?.getDict?.(lang) || {};
    return dict[key] || fallback;
  }

  function normalizeAspectRatio(value) {
    const raw = String(value || "16:9").trim();
    return aspectRatioOptions.some((item) => item.value === raw) ? raw : "16:9";
  }

  function getAspectRatioOption(value = state.settings.aspectRatio) {
    const normalized = normalizeAspectRatio(value);
    return aspectRatioOptions.find((item) => item.value === normalized) || aspectRatioOptions[0];
  }

  function getAspectRatioParts(value = state.settings.aspectRatio) {
    const normalized = normalizeAspectRatio(value);
    const [w, h] = normalized.split(":").map((part) => Math.max(1, Number(part || 1)));
    return { value: normalized, w, h };
  }

  function getAspectRatioCssValue(value = state.settings.aspectRatio) {
    const ratio = getAspectRatioParts(value);
    return `${ratio.w} / ${ratio.h}`;
  }

  function syncAspectRatioUi(options = {}) {
    state.settings.aspectRatio = normalizeAspectRatio(state.settings.aspectRatio);
    const item = getAspectRatioOption();
    if (els.btnPreviewAspectRatio) {
      els.btnPreviewAspectRatio.textContent = item.name;
      els.btnPreviewAspectRatio.title = `화면 비율 설정: ${item.name} (${item.desc})`;
    }
    if (els.dropZone) {
      els.dropZone.style.setProperty("--preview-aspect-ratio", getAspectRatioCssValue());
    }
    applyPreviewFrameLayout();
    if (els.aspectRatioGrid) {
      [...els.aspectRatioGrid.querySelectorAll(".aspectRatioPresetBtn")].forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.aspectRatio === state.settings.aspectRatio);
      });
    }
    if (options.render) {
      resetPreviewSessions();
      renderPreviewAtTime(state.ui.currentTime);
    }
  }

  function buildAspectRatioGrid() {
    if (!els.aspectRatioGrid) return;
    els.aspectRatioGrid.innerHTML = "";
    aspectRatioOptions.forEach((item) => {
      const parts = getAspectRatioParts(item.value);
      const preset = document.createElement("button");
      preset.type = "button";
      preset.className = "aspectRatioPresetBtn";
      preset.dataset.aspectRatio = item.value;

      const previewBox = document.createElement("span");
      previewBox.className = "aspectRatioPreviewBox";
      const frame = document.createElement("span");
      frame.className = "aspectRatioPreviewFrame";
      if (parts.w >= parts.h) {
        frame.style.width = "38px";
        frame.style.height = `${Math.max(12, Math.round(38 * (parts.h / parts.w)))}px`;
      } else {
        frame.style.height = "38px";
        frame.style.width = `${Math.max(12, Math.round(38 * (parts.w / parts.h)))}px`;
      }
      previewBox.appendChild(frame);

      const text = document.createElement("span");
      const name = document.createElement("span");
      name.className = "aspectRatioPresetName";
      name.textContent = item.name;
      const desc = document.createElement("span");
      desc.className = "aspectRatioPresetDesc";
      desc.textContent = item.desc;
      text.appendChild(name);
      text.appendChild(desc);
      preset.appendChild(previewBox);
      preset.appendChild(text);
      preset.addEventListener("click", () => {
        if (state.settings.aspectRatio === item.value) return;
        state.settings.aspectRatio = item.value;
        syncAspectRatioUi({ render: true });
      });
      els.aspectRatioGrid.appendChild(preset);
    });
    syncAspectRatioUi();
  }

  function openAspectRatioModal() {
    buildAspectRatioGrid();
    els.aspectRatioModal?.classList.remove("hidden");
  }

  function closeAspectRatioModal() {
    els.aspectRatioModal?.classList.add("hidden");
  }

  function isEditableShortcutTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest('[contenteditable="true"]')) return true;
    const field = target.closest("input, textarea, select");
    if (!field) return false;
    if (!(field instanceof HTMLInputElement)) return true;
    const type = String(field.type || "").toLowerCase();
    return type !== "button" && type !== "checkbox" && type !== "radio" && type !== "range" && type !== "submit";
  }

  function formatAutoSaveClock(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function updateAutoSaveIndicator() {
    if (!els.autoSaveStatus || !els.autoSaveLabel) return;
    const saving = !!persistenceState.autoSaveBusy;
    const lastSaved = formatAutoSaveClock(persistenceState.lastAutoSaveAt);
    const label = saving
      ? "Auto Saving..."
      : (lastSaved ? `Auto Saved ${lastSaved}` : "Auto Save");
    els.autoSaveStatus.classList.toggle("saving", saving);
    els.autoSaveStatus.classList.toggle("saved", !saving && !!lastSaved);
    els.autoSaveLabel.textContent = label;
    els.autoSaveStatus.title = saving
      ? "임시 저장 중입니다."
      : (lastSaved ? `마지막 임시 저장 ${lastSaved}` : "5분마다 임시 저장됩니다.");
  }

  function updateOutputFolderHint() {
    const outputFolderHint = document.getElementById("outputFolderHint");
    if (!outputFolderHint) return;
    outputFolderHint.dataset.outputPath = state.settings.outputFolder || "";
    outputFolderHint.textContent = state.settings.outputFolder || t("outputFolderDefault", "기본값: 프로젝트 폴더");
  }

  function normalizeBackgroundColor(value) {
    return normalizeColor(value, "#000000");
  }

  function applyProjectBackgroundColor() {
    const color = normalizeBackgroundColor(state.settings.backgroundColor);
    state.settings.backgroundColor = color;
    document.documentElement.style.setProperty("--project-preview-bg", color);
    document.documentElement.style.setProperty("--project-preview-solid-bg", color);
    if (els.backgroundColorInput) els.backgroundColorInput.value = color;
    if (els.backgroundColorHex) els.backgroundColorHex.value = color.toUpperCase();
  }

  function getTransitionItems() {
    return transitionItems.map((item) => ({
      type: item.type,
      name: t(item.nameKey, item.nameFallback),
      desc: t(item.descKey, item.descFallback)
    }));
  }

  function getBackgroundClipColorOptions() {
    return backgroundClipColorOptions.map((item) => ({
      value: normalizeBackgroundColor(item.value),
      label: t(item.labelKey, item.labelFallback)
    }));
  }

  function getBackgroundClipColorValue() {
    return normalizeBackgroundColor(state.settings.backgroundClipColor || "#ffffff");
  }

  function getBackgroundClipColorLabel(color) {
    const normalized = normalizeBackgroundColor(color || "#ffffff");
    return getBackgroundClipColorOptions().find((item) => item.value === normalized)?.label || normalized.toUpperCase();
  }

  function clearPaletteDragImage() {
    if (activePaletteDragImageEl?.parentNode) activePaletteDragImageEl.parentNode.removeChild(activePaletteDragImageEl);
    activePaletteDragImageEl = null;
    document.querySelectorAll(".paletteItem.isDragging").forEach((node) => node.classList.remove("isDragging"));
    document.body?.classList.remove("palette-dragging");
  }

  function createPaletteDragImage(item = {}, dragItem = {}) {
    clearPaletteDragImage();
    const ghost = document.createElement("div");
    const kind = String(dragItem.kind || item.kind || "item");
    ghost.className = "dragPreviewGhost";
    ghost.dataset.kind = kind;
    ghost.setAttribute("aria-hidden", "true");

    if (kind === "background") {
      const color = normalizeBackgroundColor(dragItem.color || state.settings.backgroundClipColor || "#ffffff");
      const swatch = document.createElement("span");
      swatch.className = "dragPreviewSwatch";
      swatch.style.background = color;
      ghost.appendChild(swatch);
    } else {
      const mark = document.createElement("span");
      mark.className = "dragPreviewMark";
      mark.textContent = kind === "transition" ? "TR" : (kind === "fx" ? "FX" : "T");
      ghost.appendChild(mark);
    }

    const copy = document.createElement("span");
    copy.className = "dragPreviewCopy";
    const title = document.createElement("span");
    title.className = "dragPreviewTitle";
    title.textContent = kind === "background" ? t("backgroundClipCardName", "배경 클립") : (item.name || "Item");
    const meta = document.createElement("span");
    meta.className = "dragPreviewMeta";
    if (kind === "background") {
      const color = normalizeBackgroundColor(dragItem.color || state.settings.backgroundClipColor || "#ffffff").toUpperCase();
      meta.textContent = `${formatTimelineSec(dragItem.durationSec || BACKGROUND_CLIP_DURATION_SEC)}s · ${color}`;
    } else {
      meta.textContent = item.desc || kind.toUpperCase();
    }
    copy.append(title, meta);
    ghost.appendChild(copy);
    document.body.appendChild(ghost);
    activePaletteDragImageEl = ghost;
    return ghost;
  }

  function syncBackgroundClipColorControls() {
    const color = getBackgroundClipColorValue();
    if (els.backgroundClipColorInput) els.backgroundClipColorInput.value = color;
    if (els.backgroundClipColorHex) els.backgroundClipColorHex.value = color.toUpperCase();
  }

  function setBackgroundClipColor(value, options = {}) {
    const color = normalizeBackgroundColor(value || "#ffffff");
    state.settings.backgroundClipColor = color;
    fillBackgroundClipColorSelect();
    syncBackgroundClipColorControls();
    if (options.rebuild !== false) buildBackgroundPalette();
    return color;
  }

  async function openBackgroundClipEyedropper() {
    if (typeof window.EyeDropper !== "function") {
      toast("스포이드가 지원되지 않아 일반 색상 선택으로 조절해 주세요.", 1800);
      return false;
    }
    try {
      const picker = new window.EyeDropper();
      const result = await picker.open();
      const picked = normalizeBackgroundColor(result?.sRGBHex || state.settings.backgroundClipColor || "#ffffff");
      setBackgroundClipColor(picked);
      toast(`배경 색상: ${picked.toUpperCase()}`, 1600);
      return true;
    } catch (err) {
      if (err?.name !== "AbortError") {
        toast("배경 색상 스포이드를 열지 못했습니다.", 1800);
      }
      return false;
    }
  }

  function clearSelection() {
    state.ui.selectedKeys = [];
    state.ui.selectionOrder = [];
    state.ui.selectedClipId = null;
    hideFxPopover();
    hideTransitionPopover();
    closeVideoCropModal();
  }

  function normalizeVideoCropDraft(raw = {}) {
    const clampCropPair = (leftValue, rightValue) => {
      let left = clamp01(leftValue, 0);
      let right = clamp01(rightValue, 0);
      const sum = left + right;
      if (sum > 0.96) {
        const scale = 0.96 / Math.max(sum, 0.0001);
        left *= scale;
        right *= scale;
      }
      return [left, right];
    };
    const [cropLeft, cropRight] = clampCropPair(raw.cropLeft, raw.cropRight);
    const [cropTop, cropBottom] = clampCropPair(raw.cropTop, raw.cropBottom);
    return {
      clipId: String(raw.clipId || ""),
      cropLeft,
      cropRight,
      cropTop,
      cropBottom
    };
  }

  function getVideoCropDraftForClip(clip = null) {
    if (!clip) return null;
    const draft = state.ui.videoCropDraft;
    if (!draft || draft.clipId !== clip.id) return null;
    return normalizeVideoCropDraft(draft);
  }

  function isVideoCropModeActive(clip = null) {
    if (state.ui.previewEditMode !== "crop") return false;
    return !!getVideoCropDraftForClip(clip || getSelectedVideoClip());
  }

  function getVideoCropPreviewClip(clip = null) {
    const targetClip = clip || getSelectedVideoClip();
    if (!targetClip) return null;
    const draft = getVideoCropDraftForClip(targetClip);
    if (!draft) return targetClip;
    return {
      ...targetClip,
      cropLeft: draft.cropLeft,
      cropRight: draft.cropRight,
      cropTop: draft.cropTop,
      cropBottom: draft.cropBottom
    };
  }

  function applyVideoCropDraft(nextDraft, options = {}) {
    state.ui.videoCropDraft = normalizeVideoCropDraft(nextDraft || {});
    if (options.render === false) return;
    renderPreviewAtTime(state.ui.currentTime);
    renderVideoInspector();
  }

  function beginVideoCropMode() {
    const clip = getSelectedVideoClip();
    if (!clip) return false;
    const clipStart = Math.max(0, Number(clip.start || 0));
    const clipEnd = clipStart + Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(clip));
    if (Number(state.ui.currentTime || 0) < clipStart - 1e-6 || Number(state.ui.currentTime || 0) > clipEnd + 1e-6) {
      state.ui.currentTime = snapTimelineTimeSec(clipStart);
    }
    state.ui.previewEditMode = "crop";
    state.ui.videoCropModalOpen = false;
    state.ui.videoCropDraft = normalizeVideoCropDraft({
      clipId: clip.id,
      cropLeft: clip.cropLeft,
      cropRight: clip.cropRight,
      cropTop: clip.cropTop,
      cropBottom: clip.cropBottom
    });
    els.videoCropModal?.classList.add("hidden");
    if (els.videoCropPreviewOverlay) els.videoCropPreviewOverlay.innerHTML = "";
    safePauseVideo(els.videoCropPreviewVideo);
    renderPreviewAtTime(state.ui.currentTime);
    renderVideoInspector();
    return true;
  }

  function exitVideoCropMode(options = {}) {
    const shouldRender = options.render !== false;
    state.ui.previewEditMode = "transform";
    state.ui.videoCropDraft = null;
    state.ui.videoCropModalOpen = false;
    els.videoCropModal?.classList.add("hidden");
    if (els.videoCropPreviewOverlay) els.videoCropPreviewOverlay.innerHTML = "";
    safePauseVideo(els.videoCropPreviewVideo);
    if (!shouldRender) return;
    renderPreviewAtTime(state.ui.currentTime);
    renderVideoInspector();
  }

  function commitVideoCropMode() {
    const clip = getSelectedVideoClip();
    const draft = getVideoCropDraftForClip(clip);
    if (!clip || !draft) {
      exitVideoCropMode();
      return false;
    }
    const before = snapshotHistoryState();
    clip.cropLeft = draft.cropLeft;
    clip.cropRight = draft.cropRight;
    clip.cropTop = draft.cropTop;
    clip.cropBottom = draft.cropBottom;
    initVideoClipFields(clip, {
      defaultSourceIn: getClipSourceIn(clip, 0),
      defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
    });
    recalcTimeline();
    state.ui.previewEditMode = "transform";
    state.ui.videoCropDraft = null;
    state.ui.videoCropModalOpen = false;
    els.videoCropModal?.classList.add("hidden");
    if (els.videoCropPreviewOverlay) els.videoCropPreviewOverlay.innerHTML = "";
    safePauseVideo(els.videoCropPreviewVideo);
    renderAll();
    commitHistorySnapshot(before);
    return true;
  }

  function cloneHistoryValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function snapshotHistoryState() {
    return {
      project: cloneHistoryValue(state.project),
      ui: {
        selectedKeys: [...state.ui.selectedKeys],
        selectionOrder: [...state.ui.selectionOrder],
        selectedClipId: state.ui.selectedClipId || null,
        activeLane: state.ui.activeLane || null,
        activeSection: { ...state.ui.activeSection },
        currentTime: Number(state.ui.currentTime || 0)
      }
    };
  }

  function restoreHistoryState(snapshot) {
    if (!snapshot?.project) return;
    state.project = cloneHistoryValue(snapshot.project);
    state.ui.transitionPopover.key = null;
    state.ui.previewEditMode = "transform";
    state.ui.videoCropDraft = null;
    state.ui.videoCropModalOpen = false;
    if (snapshot.ui) {
      state.ui.selectedKeys = [...(snapshot.ui.selectedKeys || [])];
      state.ui.selectionOrder = [...(snapshot.ui.selectionOrder || [])];
      state.ui.selectedClipId = snapshot.ui.selectedClipId || null;
      state.ui.activeLane = snapshot.ui.activeLane || null;
      state.ui.activeSection = {
        video: Math.max(1, Number(snapshot.ui.activeSection?.video || 1)),
        audio: Math.max(1, Number(snapshot.ui.activeSection?.audio || 1))
      };
      state.ui.currentTime = snapTimelineTimeSec(Math.max(0, Number(snapshot.ui.currentTime || 0)));
    } else {
      clearSelection();
    }
    recalcTimeline();
    const validSelectionOrder = (state.ui.selectionOrder || []).filter((key) => !!getItemByKey(key)?.data);
    state.ui.selectionOrder = validSelectionOrder;
    state.ui.selectedKeys = [...new Set(validSelectionOrder)];
    if (!state.ui.selectedKeys.length || !state.project.videoClips.some((clip) => clip.id === state.ui.selectedClipId)) {
      const lastVideoKey = [...validSelectionOrder].reverse().find((key) => key.startsWith("video:"));
      state.ui.selectedClipId = lastVideoKey ? lastVideoKey.slice("video:".length) : null;
    }
    renderAll();
  }

  function historyProjectEquals(left, right) {
    return JSON.stringify(left?.project || null) === JSON.stringify(right?.project || null);
  }

  function pushHistorySnapshot(before, after) {
    if (!before || !after || historyProjectEquals(before, after)) return false;
    cmdStack.do({
      do() {
        restoreHistoryState(after);
      },
      undo() {
        restoreHistoryState(before);
      }
    });
    return true;
  }

  function commitHistorySnapshot(before) {
    if (!before) return false;
    return pushHistorySnapshot(before, snapshotHistoryState());
  }

  function runProjectMutationWithHistory(mutate) {
    const before = snapshotHistoryState();
    const result = mutate();
    if (result === false) return result;
    const after = snapshotHistoryState();
    pushHistorySnapshot(before, after);
    return result;
  }

  function isSelected(kind, id) {
    return state.ui.selectedKeys.includes(clipKey(kind, id));
  }

  function selectSingle(kind, id, section = null) {
    const key = clipKey(kind, id);
    state.ui.selectedKeys = [key];
    state.ui.selectionOrder = [key];
    state.ui.selectedClipId = kind === "video" ? id : null;
    if (kind !== "overlay" || state.ui.motionPathDrawOverlayId !== id) {
      state.ui.motionPathDrawOverlayId = null;
    }
    if (kind !== "overlay") {
      hideFxPopover();
    } else {
      const overlay = state.project.overlayItems.find((item) => item.id === id);
      if (!isFxOverlayType(overlay?.overlayType)) hideFxPopover();
    }
    if (kind === "video" || kind === "audio" || kind === "overlay") {
      const sec = Number(section || 1);
      const laneKind = kind === "overlay" ? "video" : kind;
      state.ui.activeSection[laneKind] = Math.max(1, sec);
    }
    if ((kind !== "video" || state.ui.videoCropDraft?.clipId !== id) && state.ui.previewEditMode === "crop") {
      exitVideoCropMode({ render: false });
    }
  }

  function toggleSelection(kind, id, section = null) {
    const key = clipKey(kind, id);
    if (isSelected(kind, id)) {
      state.ui.selectedKeys = state.ui.selectedKeys.filter(k => k !== key);
      state.ui.selectionOrder = state.ui.selectionOrder.filter(k => k !== key);
      if (state.ui.selectedClipId === id) state.ui.selectedClipId = null;
      return;
    }
    state.ui.selectedKeys = [...state.ui.selectedKeys, key].slice(-8);
    state.ui.selectionOrder = [...state.ui.selectionOrder.filter(k => k !== key), key].slice(-8);
    if (kind === "video") state.ui.selectedClipId = id;
    if (kind === "overlay") {
      const overlay = state.project.overlayItems.find((item) => item.id === id);
      if (!isFxOverlayType(overlay?.overlayType)) hideFxPopover();
    }
    if (kind === "video" || kind === "audio" || kind === "overlay") {
      const sec = Number(section || 1);
      const laneKind = kind === "overlay" ? "video" : kind;
      state.ui.activeSection[laneKind] = Math.max(1, sec);
    }
  }

  function selectSectionItems(kind, section = null, options = {}) {
    const laneKind = kind === "audio" ? "audio" : "video";
    const sec = Math.max(1, Number(section || 1));
    const orderRank = { video: 0, overlay: 1, audio: 0 };
    const entries = laneKind === "audio"
      ? (state.project.audioItems || []).filter((item) => Math.max(1, Number(item.section || 1)) === sec)
        .map((item) => ({
          key: clipKey("audio", item.id),
          kind: "audio",
          start: Number(item.start || 0)
        }))
      : [
          ...(state.project.videoClips || []).filter((item) => Math.max(1, Number(item.section || 1)) === sec)
            .map((item) => ({
              key: clipKey("video", item.id),
              kind: "video",
              start: Number(item.start || 0)
            })),
          ...(state.project.overlayItems || []).filter((item) => Math.max(1, Number(item.section || 1)) === sec)
            .map((item) => ({
              key: clipKey("overlay", item.id),
              kind: "overlay",
              start: Number(item.start || 0)
            }))
        ];

    entries.sort((left, right) =>
      (Number(left.start || 0) - Number(right.start || 0))
      || ((orderRank[left.kind] || 0) - (orderRank[right.kind] || 0))
      || String(left.key || "").localeCompare(String(right.key || ""))
    );

    state.ui.selectedKeys = entries.map((entry) => entry.key);
    state.ui.selectionOrder = [...state.ui.selectedKeys];
    state.ui.activeSection[laneKind] = sec;
    state.ui.selectedClipId = null;

    if (laneKind === "video") {
      const preferredKey = options.primaryKind === "video" && options.primaryId
        ? clipKey("video", options.primaryId)
        : "";
      const selectedVideoKey = entries.find((entry) => entry.key === preferredKey)?.key
        || entries.find((entry) => entry.kind === "video")?.key
        || "";
      state.ui.selectedClipId = selectedVideoKey ? selectedVideoKey.slice("video:".length) : null;
    }

    hideFxPopover();
    hideTransitionPopover();
    closeVideoCropModal();
  }

  function toast(msg, ms = 1400) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), ms);
  }

  function ensureTimelineValueBubble() {
    let bubble = document.getElementById("gainBubble");
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.id = "gainBubble";
      bubble.className = "gainBubble hidden";
      document.body.appendChild(bubble);
    }
    return bubble;
  }

  function showTimelineValueBubble(text, x, y) {
    const bubble = ensureTimelineValueBubble();
    bubble.textContent = text;
    bubble.style.left = `${Math.round(x)}px`;
    bubble.style.top = `${Math.round(y)}px`;
    bubble.classList.remove("hidden");
  }

  function hideTimelineValueBubble() {
    ensureTimelineValueBubble().classList.add("hidden");
  }

  function showAlert(lines) {
    els.modalBody.innerHTML = "";
    const ul = document.createElement("ul");
    ul.style.margin = "0";
    ul.style.paddingLeft = "18px";
    lines.forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    els.modalBody.appendChild(ul);
    els.modal.classList.remove("hidden");
  }

  els.modalOk.onclick = () => els.modal.classList.add("hidden");

  function ensureTermsAccepted() {
    return new Promise((resolve) => {
      const accepted = localStorage.getItem(TERMS_ACCEPT_KEY);
      const legacyAccepted = localStorage.getItem(TERMS_ACCEPT_KEY_LEGACY);
      if (!accepted && legacyAccepted) localStorage.setItem(TERMS_ACCEPT_KEY, "1");
      if ((accepted || localStorage.getItem(TERMS_ACCEPT_KEY)) === "1") {
        resolve(true);
        return;
      }
      const modal = els.termsModal;
      const chk = els.termsAgreeCheck;
      const btnOk = els.btnTermsAccept;
      const btnNo = els.btnTermsDecline;
      if (!modal || !chk || !btnOk || !btnNo) {
        resolve(true);
        return;
      }
      chk.checked = false;
      btnOk.disabled = true;
      modal.classList.remove("hidden");

      chk.onchange = () => {
        btnOk.disabled = !chk.checked;
      };
      btnOk.onclick = () => {
        if (!chk.checked) return;
        localStorage.setItem(TERMS_ACCEPT_KEY, "1");
        modal.classList.add("hidden");
        resolve(true);
      };
      btnNo.onclick = () => {
        window.close();
        resolve(false);
      };
    });
  }

  function fileUrl(p) {
    const norm = String(p || "").replace(/\\/g, "/");
    const withLeadingSlash = /^[A-Za-z]:\//.test(norm) ? `/${norm}` : norm;
    return encodeURI(`file://${withLeadingSlash}`);
  }

  function getFileExtension(pathLike) {
    const name = String(pathLike || "").split(/[\\/]/).pop() || "";
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
  }

  function getFileBaseName(pathLike) {
    const name = String(pathLike || "").split(/[\\/]/).pop() || "";
    return name.replace(/\.[^.]+$/, "").trim();
  }

  function normalizeCustomFontName(value, fallback = "Custom Font") {
    return String(value || fallback)
      .replace(/[^\w\s가-힣.-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48) || fallback;
  }

  function makeCustomFontFamily(name) {
    return `VideoSmith ${normalizeCustomFontName(name)}`;
  }

  function loadCustomFonts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUSTOM_FONT_STORAGE_KEY) || "[]");
      customFonts = (Array.isArray(parsed) ? parsed : [])
        .map((item) => ({
          family: String(item?.family || "").trim(),
          name: normalizeCustomFontName(item?.name || item?.family || ""),
          path: String(item?.path || "").trim()
        }))
        .filter((item) => item.family && item.path && SUPPORTED_FONT_EXTS.has(getFileExtension(item.path)));
    } catch {
      customFonts = [];
    }
    registerCustomFontFaces();
    return customFonts;
  }

  function saveCustomFonts() {
    try {
      localStorage.setItem(CUSTOM_FONT_STORAGE_KEY, JSON.stringify(customFonts));
    } catch {
      // ignore local storage failures
    }
  }

  function registerCustomFontFaces() {
    let style = document.getElementById("customFontFaces");
    if (!style) {
      style = document.createElement("style");
      style.id = "customFontFaces";
      document.head.appendChild(style);
    }
    style.textContent = customFonts
      .map((font) => {
        const family = String(font.family || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const url = fileUrl(font.path).replace(/"/g, "%22");
        return `@font-face{font-family:"${family}";src:url("${url}");font-display:swap;}`;
      })
      .join("\n");
  }

  function upsertCustomFont(font) {
    if (!font?.path) return null;
    const name = normalizeCustomFontName(font.name || getFileBaseName(font.path));
    const family = font.family || makeCustomFontFamily(name);
    const next = { family, name, path: String(font.path || "") };
    customFonts = [
      next,
      ...customFonts.filter((item) => item.family !== family && item.path !== next.path)
    ];
    saveCustomFonts();
    registerCustomFontFaces();
    return next;
  }

  function getCustomFontByFamily(family) {
    return customFonts.find((font) => font.family === family) || null;
  }

  function refreshFontFamilySelect(selectedFamily = "", selectedFontFile = "") {
    if (!els.overlayFontFamilyInput) return;
    const current = selectedFamily || els.overlayFontFamilyInput.value || "Malgun Gothic";
    els.overlayFontFamilyInput.innerHTML = "";
    BASE_FONT_FAMILIES.forEach((font) => {
      const opt = document.createElement("option");
      opt.value = font;
      opt.textContent = font;
      els.overlayFontFamilyInput.appendChild(opt);
    });
    if (selectedFontFile && !getCustomFontByFamily(current)) {
      upsertCustomFont({
        family: current,
        name: current.replace(/^VideoSmith\s+/, ""),
        path: selectedFontFile
      });
    }
    customFonts.forEach((font) => {
      const opt = document.createElement("option");
      opt.value = font.family;
      opt.textContent = font.name;
      opt.dataset.fontPath = font.path;
      els.overlayFontFamilyInput.appendChild(opt);
    });
    const addOpt = document.createElement("option");
    addOpt.value = ADD_CUSTOM_FONT_VALUE;
    addOpt.textContent = "+ 새 글씨체 추가하기...";
    els.overlayFontFamilyInput.appendChild(addOpt);
    const hasSelected = [...els.overlayFontFamilyInput.options].some((opt) => opt.value === current);
    els.overlayFontFamilyInput.value = hasSelected ? current : "Malgun Gothic";
  }

  function syncCustomFontDialogState() {
    const hasFile = !!pendingCustomFontFilePath && SUPPORTED_FONT_EXTS.has(getFileExtension(pendingCustomFontFilePath));
    const hasName = !!String(els.customFontNameInput?.value || "").trim();
    const agreed = !!els.customFontTermsCheck?.checked;
    if (els.btnCustomFontAdd) els.btnCustomFontAdd.disabled = !(hasFile && hasName && agreed);
  }

  function closeCustomFontModal() {
    pendingCustomFontFilePath = "";
    els.customFontModal?.classList.add("hidden");
  }

  function openCustomFontModal() {
    pendingCustomFontFilePath = "";
    if (els.customFontFileInput) els.customFontFileInput.value = "";
    if (els.customFontNameInput) els.customFontNameInput.value = "";
    if (els.customFontTermsCheck) els.customFontTermsCheck.checked = false;
    if (els.customFontFileHint) els.customFontFileHint.textContent = "선택된 파일 없음";
    syncCustomFontDialogState();
    els.customFontModal?.classList.remove("hidden");
  }

  function getSelectedTextOverlayFontFamily() {
    const overlay = getSelectedOverlayItem?.();
    return overlay?.overlayType === "text" ? String(overlay.fontFamily || "Malgun Gothic") : "Malgun Gothic";
  }

  function normalizeToArrayBuffer(bufLike) {
    if (!bufLike) throw new Error("empty buffer");
    if (bufLike instanceof ArrayBuffer) return bufLike.slice(0);
    if (ArrayBuffer.isView(bufLike)) {
      return bufLike.buffer.slice(bufLike.byteOffset, bufLike.byteOffset + bufLike.byteLength);
    }
    // Node Buffer serialized through IPC can arrive as { type: "Buffer", data: number[] }
    if (bufLike.type === "Buffer" && Array.isArray(bufLike.data)) {
      const u8 = new Uint8Array(bufLike.data);
      return u8.buffer.slice(0);
    }
    throw new Error("unsupported buffer payload");
  }

  async function computeWavePeaksFromPath(filePath, buckets = 256) {
    try {
      const buf = await window.pearl.readFileBuffer(filePath);
      const arrayBuffer = normalizeToArrayBuffer(buf);
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuf = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const channelData = audioBuf.getChannelData(0);
      const peaks = new Array(buckets).fill(0);
      const blockSize = Math.max(1, Math.floor(channelData.length / buckets));
      for (let i = 0; i < buckets; i++) {
        const start = i * blockSize;
        const end = Math.min(channelData.length, start + blockSize);
        let max = 0;
        for (let j = start; j < end; j++) {
          const v = Math.abs(channelData[j]);
          if (v > max) max = v;
        }
        peaks[i] = max;
      }
      await audioCtx.close();
      return peaks;
    } catch {
      return [];
    }
  }

  async function computePitchContourFromPath(filePath, buckets = 256) {
    try {
      const buf = await window.pearl.readFileBuffer(filePath);
      const arrayBuffer = normalizeToArrayBuffer(buf);
      const { series, duration } = await window.PearlPitch.computePitchSeriesFromArrayBuffer(arrayBuffer, { winSize: 2048, hop: 512 });
      if (!series?.length || !duration) return [];

      const vals = series.map(x => x.f0).filter(v => v > 0);
      if (!vals.length) return [];
      const minF = Math.max(50, Math.min(...vals));
      const maxF = Math.max(minF + 1, Math.min(1200, Math.max(...vals)));

      const out = new Array(buckets).fill(0);
      const cnt = new Array(buckets).fill(0);
      for (const p of series) {
        if (!p.f0 || p.f0 <= 0) continue;
        const idx = Math.min(buckets - 1, Math.max(0, Math.floor((p.t / duration) * buckets)));
        const n = (p.f0 - minF) / (maxF - minF);
        out[idx] += Math.max(0, Math.min(1, n));
        cnt[idx] += 1;
      }
      for (let i = 0; i < buckets; i++) out[i] = cnt[i] ? out[i] / cnt[i] : 0;
      return out;
    } catch {
      return [];
    }
  }

  function revokeThumbUrls(urls = []) {
    urls.forEach((url) => {
      try {
        if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
      } catch {
        // ignore bad blob urls
      }
    });
  }

  async function canvasToThumbUrl(canvas) {
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve("");
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, "image/jpeg", 0.72);
    });
  }

  async function createClipThumbnails(videoPath, durationSec, count = 5) {
    try {
      const duration = Math.max(0.2, Number(durationSec) || 0);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = fileUrl(videoPath);
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("thumb metadata load failed"));
      });
      const w = 96;
      const h = 54;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      const out = [];
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? Math.min(Math.max(0.05, duration * 0.08), Math.max(0.05, duration - 0.05)) : ((duration * (i + 0.5)) / count);
        video.currentTime = Math.max(0, Math.min(duration - 0.05, t));
        await new Promise((resolve) => {
          const onSeek = () => {
            video.removeEventListener("seeked", onSeek);
            resolve();
          };
          video.addEventListener("seeked", onSeek);
        });
        ctx.drawImage(video, 0, 0, w, h);
        out.push(await canvasToThumbUrl(canvas));
      }
      return out;
    } catch {
      return [];
    }
  }

  async function enrichClipVisuals(clip, count = 1) {
    if (!clip || clip.kind !== "video") return;
    const p = clip.previewPath || clip.internalPath || clip.originalPath;
    if (!p) return;
    const thumbs = await createClipThumbnails(p, getVideoClipPlaybackDuration(clip), count);
    if (!thumbs.length) return;
    clip.thumbs = thumbs;
    clip._thumbReadyCount = thumbs.length;
    renderTimeline();
  }

  function makeOverlayId() {
    return `overlay_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  function clamp01(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(1, num));
  }

  function normalizeColor(value, fallback) {
    const raw = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
    return fallback;
  }

  function clampMotionPathDelta(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(-1.5, Math.min(1.5, num));
  }

  function getMotionPathEase(progress, easing = "easeInOutQuad") {
    const p = clamp01(progress, 0);
    if (easing === "easeOutCubic") return 1 - Math.pow(1 - p, 3);
    if (easing === "easeInOutQuad") return p < 0.5 ? 2 * p * p : 1 - (Math.pow((-2 * p) + 2, 2) / 2);
    return p;
  }

  function getMotionPathStateAtTime(overlay, timeSec) {
    if (!overlay || overlay.overlayType !== "motion_path_move") return null;
    const start = Number(overlay.start || 0);
    const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.2));
    const end = start + duration;
    if (timeSec < start - 1e-6) return null;
    const progress = clamp01((Number(timeSec || 0) - start) / duration, 0);
    return {
      start,
      end,
      duration,
      progress,
      easedProgress: getMotionPathEase(progress, overlay.easing || "easeInOutQuad"),
      deltaX: clampMotionPathDelta(overlay.deltaX, 0),
      deltaY: clampMotionPathDelta(overlay.deltaY, 0)
    };
  }

  function getMotionPathOffsetForClip(clip, timeSec) {
    if (!clip) return { x: 0, y: 0 };
    return (state.project.overlayItems || [])
      .filter((overlay) => overlay?.overlayType === "motion_path_move" && overlay?.targetClipId === clip.id)
      .reduce((acc, overlay) => {
        const stateAtTime = getMotionPathStateAtTime(overlay, timeSec);
        if (!stateAtTime) return acc;
        acc.x += stateAtTime.deltaX * stateAtTime.easedProgress;
        acc.y += stateAtTime.deltaY * stateAtTime.easedProgress;
        return acc;
      }, { x: 0, y: 0 });
  }

  function getVideoChromaKeyState(clip) {
    if (!clip) {
      return {
        enabled: false,
        color: DEFAULT_CHROMA_KEY_COLOR,
        similarity: 0.14,
        blend: 0.08,
        reflectionTolerance: 0
      };
    }
    const raw = clipVisuals?.getClipChromaKeyState
      ? clipVisuals.getClipChromaKeyState(clip)
      : clip;
    return {
      enabled: !!raw?.enabled || !!raw?.chromaKeyEnabled,
      color: normalizeColor(raw?.color ?? raw?.chromaKeyColor, DEFAULT_CHROMA_KEY_COLOR),
      similarity: Math.max(0.01, Math.min(0.6, Number(raw?.similarity ?? raw?.chromaKeySimilarity ?? 0.14))),
      blend: Math.max(0, Math.min(0.4, Number(raw?.blend ?? raw?.chromaKeyBlend ?? 0.08))),
      reflectionTolerance: Math.max(0, Math.min(0.5, Number(raw?.reflectionTolerance ?? raw?.chromaKeyReflectionTolerance ?? 0)))
    };
  }

  function rgbFromHexColor(color) {
    const normalized = normalizeColor(color, DEFAULT_CHROMA_KEY_COLOR).slice(1);
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }

  function rgbToLumaChroma(r, g, b) {
    const y = (0.299 * r) + (0.587 * g) + (0.114 * b);
    return {
      y: y / 255,
      cb: (b - y) / 255,
      cr: (r - y) / 255
    };
  }

  function snapFadeValueSec(value) {
    return Math.max(0, Number((Math.round((Number(value || 0) / FADE_SNAP_STEP_SEC)) * FADE_SNAP_STEP_SEC).toFixed(2)));
  }
  function snapTimelineTimeSec(value) {
    return Math.max(0, Number((Math.round((Number(value || 0) / TIMELINE_TIME_STEP_SEC)) * TIMELINE_TIME_STEP_SEC).toFixed(2)));
  }
  function snapTimelineDeltaSec(value) {
    return Number((Math.round((Number(value || 0) / TIMELINE_TIME_STEP_SEC)) * TIMELINE_TIME_STEP_SEC).toFixed(2));
  }
  function formatTimelineSec(value) {
    const safe = Math.max(0, Number(value || 0));
    return snapTimelineTimeSec(safe).toFixed(2);
  }
  function getTimelineAutoSnapThresholdSec() {
    return Math.max(TIMELINE_TIME_STEP_SEC / 2, AUTO_SNAP_TARGET_PX / Math.max(20, Number(state.ui.pxPerSec || 90)));
  }

  function getClipAudioEnabled(clip) {
    if (!clip) return false;
    if (typeof clip.audioEnabled === "boolean") return clip.audioEnabled;
    if (clip.linkMode === "detached" && clip.linkedAudioId) return false;
    return true;
  }

  function getClipSourceIn(clip, fallback = 0) {
    if (clipVisuals?.getClipSourceIn) return clipVisuals.getClipSourceIn(clip, fallback);
    return Math.max(0, Number(clip?.sourceIn ?? clip?.in ?? fallback));
  }

  function getClipSourceOut(clip, fallback = null) {
    if (clipVisuals?.getClipSourceOut) return clipVisuals.getClipSourceOut(clip, fallback);
    const sourceIn = getClipSourceIn(clip, 0);
    const raw = Number(clip?.sourceOut ?? clip?.out);
    if (Number.isFinite(raw) && raw > sourceIn) return raw;
    const fallbackDuration = Number.isFinite(Number(fallback)) ? Number(fallback) : MIN_TIMELINE_CLIP_SEC;
    return Math.max(sourceIn + MIN_TIMELINE_CLIP_SEC, sourceIn + Math.max(MIN_TIMELINE_CLIP_SEC, fallbackDuration));
  }

  function getVideoClipPlaybackIn(clip) {
    if (clipVisuals?.getClipPlaybackIn) return clipVisuals.getClipPlaybackIn(clip);
    return Math.max(getClipSourceIn(clip, 0), Number(clip?.in ?? getClipSourceIn(clip, 0)));
  }

  function getVideoClipPlaybackOut(clip) {
    if (clipVisuals?.getClipPlaybackOut) return clipVisuals.getClipPlaybackOut(clip);
    const playbackIn = getVideoClipPlaybackIn(clip);
    return Math.max(
      playbackIn + MIN_TIMELINE_CLIP_SEC,
      Math.min(getClipSourceOut(clip, playbackIn + MIN_TIMELINE_CLIP_SEC), Number(clip?.out ?? getClipSourceOut(clip, playbackIn + MIN_TIMELINE_CLIP_SEC)))
    );
  }

  function getVideoClipPlaybackDuration(clip) {
    if (clipVisuals?.getClipPlaybackDuration) return clipVisuals.getClipPlaybackDuration(clip);
    return Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipPlaybackOut(clip) - getVideoClipPlaybackIn(clip));
  }

  function getVideoClipTimelineDuration(clip) {
    if (clipVisuals?.getClipTimelineDuration) return clipVisuals.getClipTimelineDuration(clip);
    const raw = Number(clip?.timelineDuration);
    if (Number.isFinite(raw) && raw >= MIN_TIMELINE_CLIP_SEC) return raw;
    return getVideoClipPlaybackDuration(clip);
  }

  function getVideoClipPlaybackRate(clip) {
    if (clipVisuals?.getClipPlaybackRate) return clipVisuals.getClipPlaybackRate(clip);
    const timelineDuration = Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(clip));
    return Math.max(MIN_TIMELINE_CLIP_SEC / timelineDuration, getVideoClipPlaybackDuration(clip) / timelineDuration);
  }

  function mapVideoClipTimelineOffsetToSourceTime(clip, timelineOffset) {
    if (clipVisuals?.mapClipTimelineOffsetToSourceTime) return clipVisuals.mapClipTimelineOffsetToSourceTime(clip, timelineOffset);
    const playbackIn = getVideoClipPlaybackIn(clip);
    const playbackOut = getVideoClipPlaybackOut(clip);
    const timelineDuration = getVideoClipTimelineDuration(clip);
    const clampedOffset = Math.max(0, Math.min(timelineDuration, Number(timelineOffset || 0)));
    if (clampedOffset >= timelineDuration - 1e-6) return playbackOut;
    return Math.max(
      playbackIn,
      Math.min(playbackOut - 0.001, playbackIn + (clampedOffset * getVideoClipPlaybackRate(clip)))
    );
  }

  function getVideoClipTimelineEnd(clip) {
    return Math.max(0, Number(clip?.start || 0)) + getVideoClipTimelineDuration(clip);
  }

  function initVideoClipFields(clip, options = {}) {
    if (!clip) return clip;
    if (clipVisuals?.initVideoClipFields) {
      clipVisuals.initVideoClipFields(clip, options);
      return clip;
    }
    clip.sourceIn = getClipSourceIn(clip, Number(options.defaultSourceIn || 0));
    clip.sourceOut = getClipSourceOut(clip, Number(options.defaultDuration || MIN_TIMELINE_CLIP_SEC));
    clip.in = Math.max(clip.sourceIn, Number(clip.in ?? clip.sourceIn));
    clip.out = Math.max(clip.in + MIN_TIMELINE_CLIP_SEC, Math.min(clip.sourceOut, Number(clip.out ?? clip.sourceOut)));
    clip.timelineDuration = Math.max(MIN_TIMELINE_CLIP_SEC, Number(clip.timelineDuration || (clip.out - clip.in) || MIN_TIMELINE_CLIP_SEC));
    clip.scaleX = Math.max(0.05, Number(clip.scaleX ?? clip.scale ?? 1));
    clip.scaleY = Math.max(0.05, Number(clip.scaleY ?? clip.scale ?? 1));
    clip.positionX = Math.max(-0.5, Math.min(1.5, Number(clip.positionX ?? 0.5)));
    clip.positionY = Math.max(-0.5, Math.min(1.5, Number(clip.positionY ?? 0.5)));
    clip.anchorX = clamp01(clip.anchorX, 0.5);
    clip.anchorY = clamp01(clip.anchorY, 0.5);
    clip.rotation = Math.max(-360, Math.min(360, Number(clip.rotation || 0)));
    clip.opacity = Math.max(0, Math.min(1, Number(clip.opacity ?? 1)));
    clip.cropLeft = clamp01(clip.cropLeft, 0);
    clip.cropRight = clamp01(clip.cropRight, 0);
    clip.cropTop = clamp01(clip.cropTop, 0);
    clip.cropBottom = clamp01(clip.cropBottom, 0);
    clip.fitMode = ["contain", "fill", "stretch"].includes(String(clip.fitMode || "contain")) ? String(clip.fitMode) : "contain";
    clip.placementPreset = String(clip.placementPreset || "center");
    return clip;
  }

  function setVideoClipSourceRange(clip, sourceIn, sourceOut) {
    if (!clip) return clip;
    const maxDuration = Math.max(MIN_TIMELINE_CLIP_SEC, Number(clip.meta?.duration || sourceOut || clip.out || MIN_TIMELINE_CLIP_SEC));
    if (clipVisuals?.setClipSourceRange) {
      clipVisuals.setClipSourceRange(clip, sourceIn, sourceOut, { maxDuration });
      return clip;
    }
    clip.sourceIn = Math.max(0, Number(sourceIn || 0));
    clip.sourceOut = Math.max(clip.sourceIn + MIN_TIMELINE_CLIP_SEC, Math.min(maxDuration, Number(sourceOut || clip.sourceIn + MIN_TIMELINE_CLIP_SEC)));
    clip.in = clip.sourceIn;
    clip.out = clip.sourceOut;
    return clip;
  }

  function applyVideoPlacementPreset(clip, preset) {
    if (!clip) return clip;
    if (clipVisuals?.applyPlacementPreset) {
      clipVisuals.applyPlacementPreset(clip, preset);
      return clip;
    }
    const normalized = String(preset || "center").toLowerCase();
    if (normalized === "top-left") {
      clip.positionX = 0;
      clip.positionY = 0;
      clip.anchorX = 0;
      clip.anchorY = 0;
    } else if (normalized === "top-right") {
      clip.positionX = 1;
      clip.positionY = 0;
      clip.anchorX = 1;
      clip.anchorY = 0;
    } else if (normalized === "bottom-left") {
      clip.positionX = 0;
      clip.positionY = 1;
      clip.anchorX = 0;
      clip.anchorY = 1;
    } else if (normalized === "bottom-right") {
      clip.positionX = 1;
      clip.positionY = 1;
      clip.anchorX = 1;
      clip.anchorY = 1;
    } else {
      clip.positionX = 0.5;
      clip.positionY = 0.5;
      clip.anchorX = 0.5;
      clip.anchorY = 0.5;
    }
    clip.placementPreset = normalized;
    return clip;
  }

  function getSelectedVideoClip() {
    const key = state.ui.selectionOrder[state.ui.selectionOrder.length - 1];
    if (!key || !key.startsWith("video:")) return null;
    const id = key.slice("video:".length);
    return state.project.videoClips.find((item) => item.id === id) || null;
  }

  function getAudioItemSourcePath(audio) {
    return audio?.previewPath || audio?.internalPath || audio?.sourcePath || audio?.originalPath || "";
  }

  function getAudioItemSourceIn(audio, fallback = 0) {
    const num = Number(audio?.sourceIn ?? audio?.in ?? fallback);
    return Number.isFinite(num) ? Math.max(0, num) : Math.max(0, Number(fallback || 0));
  }

  function getAudioItemSourceOut(audio, fallback = null) {
    const sourceIn = getAudioItemSourceIn(audio, 0);
    const raw = Number(audio?.sourceOut ?? audio?.out);
    if (Number.isFinite(raw) && raw > sourceIn) return raw;
    const fallbackDuration = Number.isFinite(Number(fallback)) ? Number(fallback) : Number(audio?.duration || MIN_TIMELINE_CLIP_SEC);
    return Math.max(sourceIn + MIN_TIMELINE_CLIP_SEC, sourceIn + Math.max(MIN_TIMELINE_CLIP_SEC, fallbackDuration));
  }

  function getAudioItemPlaybackDuration(audio) {
    return Math.max(MIN_TIMELINE_CLIP_SEC, getAudioItemSourceOut(audio, Number(audio?.duration || MIN_TIMELINE_CLIP_SEC)) - getAudioItemSourceIn(audio, 0));
  }

  function getAudioItemTimelineDuration(audio) {
    return Math.max(MIN_TIMELINE_CLIP_SEC, Number(audio?.duration || getAudioItemPlaybackDuration(audio) || MIN_TIMELINE_CLIP_SEC));
  }

  function getAudioItemPlaybackRate(audio) {
    const timelineDuration = getAudioItemTimelineDuration(audio);
    return Math.max(MIN_TIMELINE_CLIP_SEC / timelineDuration, getAudioItemPlaybackDuration(audio) / timelineDuration);
  }

  function mapAudioItemTimelineOffsetToSourceTime(audio, timelineOffset) {
    const sourceIn = getAudioItemSourceIn(audio, 0);
    const sourceOut = getAudioItemSourceOut(audio, Number(audio?.duration || MIN_TIMELINE_CLIP_SEC));
    const timelineDuration = getAudioItemTimelineDuration(audio);
    const clampedOffset = Math.max(0, Math.min(timelineDuration, Number(timelineOffset || 0)));
    if (clampedOffset >= timelineDuration - 1e-6) return sourceOut;
    return Math.max(
      sourceIn,
      Math.min(sourceOut - 0.001, sourceIn + (clampedOffset * getAudioItemPlaybackRate(audio)))
    );
  }

  function syncAudioItemTiming(audio, options = {}) {
    if (!audio) return audio;
    const linkedClip = options.linkedClip || null;
    if (linkedClip && audio.linkMode === "linked") {
      audio.start = Number(linkedClip.start || 0);
      audio.section = Math.max(1, Number(linkedClip.section || audio.section || 1));
      audio.sourceIn = Math.max(0, Number(linkedClip.in || 0));
      audio.sourceOut = Math.max(audio.sourceIn + MIN_TIMELINE_CLIP_SEC, Number(linkedClip.out || audio.sourceIn + MIN_TIMELINE_CLIP_SEC));
      audio.duration = Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(linkedClip));
    } else {
      audio.sourceIn = getAudioItemSourceIn(audio, 0);
      audio.sourceOut = getAudioItemSourceOut(audio, Number(audio.duration || MIN_TIMELINE_CLIP_SEC));
      audio.duration = getAudioItemTimelineDuration(audio);
      audio.start = Math.max(0, Number(audio.start || 0));
      audio.section = Math.max(1, Number(audio.section || 1));
    }
    audio.linkMode = audio.linkMode === "linked" ? "linked" : "detached";
    audio.gain = clamp01(audio.gain, 1);
    audio.mediaRole = audio.linkMode === "linked" && audio.linkedVideoId ? "linked_av" : "audio_only";
    if (!Array.isArray(audio.waveformPeaks)) audio.waveformPeaks = [];
    if (!Array.isArray(audio.pitchContour)) audio.pitchContour = [];
    return audio;
  }

  function createLinkedAudioItemFromVideoClip(clip, overrides = {}) {
    const previewPath = overrides.previewPath || clip?.previewPath || clip?.internalPath || clip?.originalPath || "";
    const sourcePath = overrides.sourcePath || clip?.sourcePath || clip?.originalPath || clip?.internalPath || "";
    const sourceIn = Math.max(0, Number(overrides.sourceIn ?? clip?.in ?? 0));
    const sourceOut = Math.max(
      sourceIn + MIN_TIMELINE_CLIP_SEC,
      Number(overrides.sourceOut ?? clip?.out ?? (sourceIn + Math.max(MIN_TIMELINE_CLIP_SEC, Number(clip?.out || 0) - Number(clip?.in || 0))))
    );
    return syncAudioItemTiming({
      id: overrides.id || clip?.linkedAudioId || `${clip?.id || "clip"}_aud`,
      kind: "audio",
      mediaRole: overrides.mediaRole || "linked_av",
      name: overrides.name || `${clip?.name || "Clip"} (Audio)`,
      originalPath: overrides.originalPath || clip?.originalPath,
      internalPath: overrides.internalPath || previewPath,
      previewPath,
      sourcePath,
      start: Number(overrides.start ?? clip?.start ?? 0),
      duration: Math.max(MIN_TIMELINE_CLIP_SEC, Number(overrides.duration ?? getVideoClipTimelineDuration(clip))),
      section: Math.max(1, Number(overrides.section ?? clip?.section ?? 1)),
      gain: Number(overrides.gain ?? 1),
      manualFadeInSec: Number(overrides.manualFadeInSec ?? clip?.manualFadeInSec ?? 0),
      manualFadeOutSec: Number(overrides.manualFadeOutSec ?? clip?.manualFadeOutSec ?? 0),
      linkedVideoId: overrides.linkedVideoId || clip?.id || null,
      linkMode: String(overrides.linkMode || "linked"),
      waveformPeaks: Array.isArray(overrides.waveformPeaks) ? overrides.waveformPeaks : [],
      pitchContour: Array.isArray(overrides.pitchContour) ? overrides.pitchContour : [],
      sourceIn,
      sourceOut
    }, { linkedClip: overrides.linkMode === "linked" ? clip : null });
  }

  function getAudioItemPreviewState(audio, timelineTime, opts = {}) {
    if (!audio) return { localClipTime: 0, sourceTime: 0, volume: 0 };
    const localClipTime = Number(timelineTime || 0) - Number(audio.start || 0);
    const fade = getClipVisualFadeState({ in: 0 }, localClipTime, {
      fadeInSec: opts.ignoreManual ? 0 : Number(audio.manualFadeInSec || 0),
      fadeOutSec: opts.ignoreManual ? 0 : Number(audio.manualFadeOutSec || 0),
      clipEnd: getAudioItemTimelineDuration(audio)
    });
    const sourceTime = mapAudioItemTimelineOffsetToSourceTime(audio, localClipTime);
    return {
      localClipTime,
      sourceTime,
      volume: clamp01(clamp01(audio.gain, 1) * clamp01(fade.volume, 1), 0)
    };
  }

  function normalizeTimedFxValues(defaults, fallback = {}) {
    const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(defaults.duration || fallback.duration || 1));
    let drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(defaults.drawDuration || fallback.drawDuration || Math.min(duration, 0.6)));
    let fadeOutDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Number(defaults.fadeOutDuration || fallback.fadeOutDuration || 0.25));
    if (drawDuration + fadeOutDuration > duration) {
      const scale = duration / Math.max(drawDuration + fadeOutDuration, MIN_OVERLAY_CLIP_SEC);
      drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, drawDuration * scale);
      fadeOutDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, fadeOutDuration * scale);
    }
    const remain = Math.max(0, duration - drawDuration - fadeOutDuration);
    const holdDuration = Math.max(0, Math.min(Number(defaults.holdDuration ?? fallback.holdDuration ?? remain), remain));
    return { duration, drawDuration, holdDuration, fadeOutDuration };
  }

  function normalizeOverlayItem(raw = {}) {
    const overlayType = String(raw.overlayType || "text");
    const defaults = effectDefs?.makeOverlayDefaults?.(overlayType, raw) || raw;
    if (overlayType === "circle") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.42, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "circle",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.5, 0.5),
        color: normalizeColor(defaults.color, "#ffdb4d"),
        radius: Math.max(0.03, Number(defaults.radius || defaults.size || 0.11)),
        radiusX: Math.max(0.03, Number(defaults.radiusX || defaults.radius || defaults.size || 0.11)),
        radiusY: Math.max(0.03, Number(defaults.radiusY || defaults.radius || defaults.size || 0.11)),
        size: Math.max(0.03, Number(defaults.size || defaults.radius || 0.11)),
        strokeWidth: Math.max(1, Number(defaults.strokeWidth || 6)),
        sparkleCount: Math.max(2, Math.round(Number(defaults.sparkleCount || 8))),
        sparkleDistance: Math.max(0.01, Number(defaults.sparkleDistance || 0.06)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 1)))
      };
    }
    if (overlayType === "underline") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.55, drawDuration: 0.9, holdDuration: 0.4, fadeOutDuration: 0.28 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "underline",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.8, 0.8),
        color: normalizeColor(defaults.color, "#38bdf8"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        width: Math.max(0.08, Number(defaults.width || defaults.size || 0.24)),
        size: Math.max(0.08, Number(defaults.size || defaults.width || 0.24)),
        lineThickness: Math.max(2, Number(defaults.lineThickness || 10)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        easing: String(defaults.easing || "easeOutCubic"),
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 1)))
      };
    }
    if (overlayType === "point_pop_line") {
      const durationMs = Math.max(120, Math.round(Number(defaults.durationMs || (Number(defaults.duration || 0.52) * 1000) || 520)));
      const duration = Math.max(MIN_OVERLAY_CLIP_SEC, durationMs / 1000);
      const spreadAmount = clamp01(defaults.spreadAmount ?? defaults.jitter ?? 0.18, 0.18);
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "point_pop_line",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration,
        durationMs,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.5, 0.5),
        color: normalizeColor(defaults.color, "#38bdf8"),
        radius: Math.max(0.01, Number(defaults.radius || 0.07)),
        lineLength: Math.max(0.01, Number(defaults.lineLength || defaults.size || 0.045)),
        strokeWidth: Math.max(1, Number(defaults.strokeWidth || 5)),
        lineCount: Math.max(8, Math.min(14, Math.round(Number(defaults.lineCount || 10)))),
        spreadAmount,
        jitter: spreadAmount,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 0.96))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "focus_box_draw") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.42, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "focus_box_draw",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.44, 0.44),
        color: normalizeColor(defaults.color, "#38bdf8"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        boxWidth: Math.max(0.08, Number(defaults.boxWidth || 0.28)),
        boxHeight: Math.max(0.08, Number(defaults.boxHeight || 0.18)),
        strokeWidth: Math.max(1, Number(defaults.strokeWidth || 6)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 0.96))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "zoom_focus" || overlayType === "zoom_out_focus") {
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: overlayType,
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: Math.max(MIN_OVERLAY_CLIP_SEC, Number(defaults.duration || 1.8)),
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.46, 0.46),
        boxWidth: Math.max(0.08, Math.min(1, Number(defaults.boxWidth || defaults.width || 0.34))),
        boxHeight: Math.max(0.08, Math.min(1, Number(defaults.boxHeight || defaults.height || 0.24))),
        color: normalizeColor(defaults.color, "#60a5fa"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: 1,
        easing: String(defaults.easing || "fastFocusZoom")
      };
    }
    if (overlayType === "motion_path_move") {
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "motion_path_move",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: Math.max(MIN_OVERLAY_CLIP_SEC, Number(defaults.duration || 1.2)),
        color: normalizeColor(defaults.color, "#38bdf8"),
        strokeWidth: Math.max(2, Number(defaults.strokeWidth || 4)),
        deltaX: clampMotionPathDelta(defaults.deltaX, 0),
        deltaY: clampMotionPathDelta(defaults.deltaY, 0),
        targetClipId: defaults.targetClipId || defaults.clipId || null,
        manualFadeInSec: 0,
        manualFadeOutSec: 0,
        opacity: 1,
        easing: String(defaults.easing || "easeInOutQuad")
      };
    }
    if (overlayType === "callout_line_draw") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.18, drawDuration: 0.52, holdDuration: 0.42, fadeOutDuration: 0.24 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "callout_line_draw",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.38, 0.38),
        y: clamp01(defaults.y ?? 0.44, 0.44),
        color: normalizeColor(defaults.color, "#38bdf8"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        lineLength: Math.max(0.04, Number(defaults.lineLength || 0.22)),
        lineAngle: Math.max(-180, Math.min(180, Number(defaults.lineAngle ?? -18))),
        strokeWidth: Math.max(1, Number(defaults.strokeWidth || 6)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 0.96))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "soft_spotlight") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.44, drawDuration: 0.28, holdDuration: 0.78, fadeOutDuration: 0.38 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "soft_spotlight",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.48, 0.48),
        color: normalizeColor(defaults.color, "#ffffff"),
        boxWidth: Math.max(0.08, Number(defaults.boxWidth || 0.26)),
        boxHeight: Math.max(0.08, Number(defaults.boxHeight || 0.16)),
        softness: Math.max(0.05, Math.min(1, Number(defaults.softness || 0.56))),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.05, Math.min(1, Number(defaults.opacity ?? 0.42))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "highlight_bar_sweep") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.18, drawDuration: 0.42, holdDuration: 0.52, fadeOutDuration: 0.24 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "highlight_bar_sweep",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.42, 0.42),
        color: normalizeColor(defaults.color, "#fde68a"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        width: Math.max(0.08, Number(defaults.width || 0.34)),
        boxHeight: Math.max(0.05, Number(defaults.boxHeight || 0.12)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.05, Math.min(1, Number(defaults.opacity ?? 0.44))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "checkpoint_pop") {
      const durationMs = Math.max(140, Math.round(Number(defaults.durationMs || (Number(defaults.duration || 0.68) * 1000) || 680)));
      const duration = Math.max(MIN_OVERLAY_CLIP_SEC, durationMs / 1000);
      const spreadAmount = clamp01(defaults.spreadAmount ?? defaults.jitter ?? 0.12, 0.12);
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "checkpoint_pop",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration,
        durationMs,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.48, 0.48),
        color: normalizeColor(defaults.color, "#22c55e"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        radius: Math.max(0.01, Number(defaults.radius || 0.052)),
        lineLength: Math.max(0.01, Number(defaults.lineLength || 0.032)),
        strokeWidth: Math.max(1, Number(defaults.strokeWidth || 4.5)),
        lineCount: Math.max(6, Math.min(12, Math.round(Number(defaults.lineCount || 8)))),
        spreadAmount,
        jitter: spreadAmount,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 0.98))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "section_divider_slide") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.22, drawDuration: 0.48, holdDuration: 0.5, fadeOutDuration: 0.24 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "section_divider_slide",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.24, 0.24),
        color: normalizeColor(defaults.color, "#cbd5e1"),
        accentColor: normalizeColor(defaults.accentColor, "#38bdf8"),
        width: Math.max(0.12, Number(defaults.width || 0.78)),
        lineThickness: Math.max(2, Number(defaults.lineThickness || 4)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 0.96))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    if (overlayType === "drop_wave") {
      const timed = normalizeTimedFxValues(defaults, { duration: 1.24, drawDuration: 0.18, holdDuration: 0.74, fadeOutDuration: 0.32 });
      return {
        id: defaults.id || makeOverlayId(),
        kind: "overlay",
        overlayType: "drop_wave",
        section: Math.max(1, Number(defaults.section || 1)),
        start: Math.max(0, Number(defaults.start || 0)),
        duration: timed.duration,
        x: clamp01(defaults.x ?? 0.5, 0.5),
        y: clamp01(defaults.y ?? 0.46, 0.46),
        // Legacy style fields are still preserved for backward-compatible loads,
        // but the active render path now uses physical distortion parameters only.
        color: normalizeColor(defaults.color, "#67e8f9"),
        accentColor: normalizeColor(defaults.accentColor, "#ffffff"),
        radius: Math.max(0.03, Number(defaults.radius || 0.12)),
        waveCount: Math.max(2, Math.min(8, Math.round(Number(defaults.waveCount || 4)))),
        waveSpacing: Math.max(0.01, Number(defaults.waveSpacing || 0.055)),
        amplitude: Math.max(0, Number(defaults.amplitude || 0.032)),
        speed: Math.max(0.1, Number(defaults.speed || 1.2)),
        softness: Math.max(0.05, Math.min(1, Number(defaults.softness || 0.64))),
        strokeWidth: Math.max(1, Number(defaults.strokeWidth || 5.5)),
        drawDuration: timed.drawDuration,
        holdDuration: timed.holdDuration,
        fadeOutDuration: timed.fadeOutDuration,
        manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
        manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
        opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 0.94))),
        easing: String(defaults.easing || "easeOutCubic")
      };
    }
    return {
      id: defaults.id || makeOverlayId(),
      kind: "overlay",
      overlayType: "text",
      section: Math.max(1, Number(defaults.section || 1)),
      start: Math.max(0, Number(defaults.start || 0)),
      duration: Math.max(MIN_OVERLAY_CLIP_SEC, Number(defaults.duration || defaults.dur || 2)),
      text: defaults.text == null ? "Text" : String(defaults.text),
      x: defaults.x === "(w-text_w)/2" ? 0.5 : clamp01(defaults.x ?? 0.5, 0.5),
      y: defaults.y === "h-120" ? 0.82 : clamp01(defaults.y ?? 0.82, 0.82),
      boxWidth: Math.max(0.12, Number(defaults.boxWidth || 0.26)),
      fontSize: Math.max(18, Number(defaults.fontSize || 64)),
      color: normalizeColor(defaults.color, "#ffffff"),
      noFill: !!defaults.noFill,
      fontFamily: String(defaults.fontFamily || "Malgun Gothic"),
      fontFile: String(defaults.fontFile || ""),
      fontWeight: String(defaults.fontWeight || "700"),
      textAlign: ["left", "center", "right"].includes(String(defaults.textAlign || "")) ? String(defaults.textAlign) : "center",
      strokeColor: normalizeColor(defaults.strokeColor, "#000000"),
      strokeWidth: Math.max(0, Number(defaults.strokeWidth ?? 0)),
      noStroke: !!defaults.noStroke,
      manualFadeInSec: Math.max(0, Number(defaults.manualFadeInSec || 0)),
      manualFadeOutSec: Math.max(0, Number(defaults.manualFadeOutSec || 0)),
      opacity: Math.max(0.1, Math.min(1, Number(defaults.opacity ?? 1))),
      transitionInType: normalizeTextOverlayTransitionType(defaults.transitionInType),
      transitionInDurationSec: Math.max(0, Number(defaults.transitionInDurationSec ?? 0)),
      transitionOutType: normalizeTextOverlayTransitionType(defaults.transitionOutType),
      transitionOutDurationSec: Math.max(0, Number(defaults.transitionOutDurationSec ?? 0)),
      transitionStrength: Math.max(0.4, Math.min(1.6, Number(defaults.transitionStrength ?? 1)))
    };
  }

  function migrateLegacyOverlayItems() {
    if (!Array.isArray(state.project.overlayItems)) state.project.overlayItems = [];
    if (state.project.overlayItems.length) {
      state.project.overlayItems = state.project.overlayItems.map((item) => normalizeOverlayItem(item));
      return;
    }
    const migrated = [];
    for (const clip of state.project.videoClips || []) {
      if (!Array.isArray(clip.overlays) || !clip.overlays.length) continue;
      const clipDuration = getVideoClipTimelineDuration(clip);
      clip.overlays.forEach((legacy) => {
        const at = Math.max(0, Math.min(clipDuration - TIMELINE_TIME_STEP_SEC, Number(legacy.at || 0)));
        migrated.push(normalizeOverlayItem({
          id: legacy.id || makeOverlayId(),
          section: clip.section || 1,
          start: Number(clip.start || 0) + at,
          duration: Math.max(MIN_OVERLAY_CLIP_SEC, Number(legacy.dur || 2)),
          text: legacy.text || "설명 텍스트",
          x: legacy.x === "(w-text_w)/2" ? 0.5 : (typeof legacy.x === "number" ? legacy.x : 0.5),
          y: legacy.y === "h-120" ? 0.82 : (typeof legacy.y === "number" ? legacy.y : 0.82),
          fontSize: legacy.fontSize || 64,
          color: legacy.color || "#ffffff",
          fontFamily: legacy.fontFamily || "Malgun Gothic",
          fontWeight: legacy.fontWeight || "700",
          textAlign: legacy.textAlign || "center",
          strokeColor: legacy.strokeColor || "#000000",
          strokeWidth: legacy.strokeWidth ?? 0,
          opacity: legacy.opacity ?? 1
        }));
      });
      clip.overlays = [];
    }
    state.project.overlayItems = migrated;
  }

  function getSelectedOverlayItem() {
    const key = state.ui.selectionOrder[state.ui.selectionOrder.length - 1];
    if (!key || !key.startsWith("overlay:")) return null;
    const id = key.slice("overlay:".length);
    return state.project.overlayItems.find((item) => item.id === id) || null;
  }

  function getItemByKey(key) {
    const [kind, id] = String(key || "").split(":");
    if (!id) return null;
    if (kind === "video") return { kind, data: state.project.videoClips.find((item) => item.id === id) || null };
    if (kind === "audio") return { kind, data: state.project.audioItems.find((item) => item.id === id) || null };
    if (kind === "overlay") return { kind, data: state.project.overlayItems.find((item) => item.id === id) || null };
    return null;
  }

  function getTimelineItemDuration(kind, item) {
    if (!item) return 0;
    if (kind === "video") return Math.max(0, Number(item.out || 0) - Number(item.in || 0));
    return Math.max(0, Number(item.duration || 0));
  }

  function makeItemId(kind) {
    return `${kind}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  function isFxOverlayType(overlayType) {
    return ALL_FX_TYPES.has(String(overlayType || ""));
  }

  function getOverlayDisplayName(overlay) {
    if (!overlay) return "Overlay";
    if (isFxOverlayType(overlay.overlayType)) return effectDefs?.paletteItems?.[overlay.overlayType]?.name || String(overlay.overlayType || "FX");
    return overlay.text || "설명 텍스트";
  }

  function getOverlayGlyph(overlayType) {
    if (isFxOverlayType(overlayType)) return effectDefs?.paletteItems?.[overlayType]?.glyph || "FX";
    return "T";
  }

  function syncOverlayTiming(overlay) {
    if (!overlay) return;
    overlay.duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC));
    if (overlay.overlayType === "text") {
      syncTextOverlayTransitionSettings(overlay);
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 1)));
      return;
    }
    if (overlay.overlayType === "circle") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.42, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
    } else if (overlay.overlayType === "underline") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.55, drawDuration: 0.9, holdDuration: 0.4, fadeOutDuration: 0.28 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.width = Math.max(0.08, Number(overlay.width || overlay.size || 0.24));
      overlay.size = overlay.width;
      overlay.lineThickness = Math.max(2, Number(overlay.lineThickness || 10));
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 1)));
    } else if (overlay.overlayType === "point_pop_line") {
      overlay.radius = Math.max(0.01, Number(overlay.radius || 0.07));
      overlay.lineLength = Math.max(0.01, Number(overlay.lineLength || 0.045));
      overlay.strokeWidth = Math.max(1, Number(overlay.strokeWidth || 5));
      overlay.lineCount = Math.max(8, Math.min(14, Math.round(Number(overlay.lineCount || 10))));
      overlay.spreadAmount = clamp01(overlay.spreadAmount ?? overlay.jitter ?? 0.18, 0.18);
      overlay.jitter = overlay.spreadAmount;
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96)));
      overlay.durationMs = Math.max(120, Math.round(Number(overlay.duration || 0.52) * 1000));
    } else if (overlay.overlayType === "focus_box_draw") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.42, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.boxWidth = Math.max(0.08, Number(overlay.boxWidth || 0.28));
      overlay.boxHeight = Math.max(0.08, Number(overlay.boxHeight || 0.18));
      overlay.strokeWidth = Math.max(1, Number(overlay.strokeWidth || 6));
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96)));
    } else if (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") {
      overlay.x = clamp01(overlay.x ?? 0.5, 0.5);
      overlay.y = clamp01(overlay.y ?? 0.46, 0.46);
      overlay.boxWidth = Math.max(0.08, Math.min(1, Number(overlay.boxWidth || 0.34)));
      overlay.boxHeight = Math.max(0.08, Math.min(1, Number(overlay.boxHeight || 0.24)));
    } else if (overlay.overlayType === "motion_path_move") {
      overlay.duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.2));
      overlay.strokeWidth = Math.max(2, Number(overlay.strokeWidth || 4));
      overlay.color = normalizeColor(overlay.color, "#38bdf8");
      overlay.deltaX = clampMotionPathDelta(overlay.deltaX, 0);
      overlay.deltaY = clampMotionPathDelta(overlay.deltaY, 0);
      overlay.targetClipId = overlay.targetClipId || null;
      overlay.opacity = 1;
    } else if (overlay.overlayType === "callout_line_draw") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.18, drawDuration: 0.52, holdDuration: 0.42, fadeOutDuration: 0.24 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.lineLength = Math.max(0.04, Number(overlay.lineLength || 0.22));
      overlay.lineAngle = Math.max(-180, Math.min(180, Number(overlay.lineAngle ?? -18)));
      overlay.strokeWidth = Math.max(1, Number(overlay.strokeWidth || 6));
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96)));
    } else if (overlay.overlayType === "soft_spotlight") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.44, drawDuration: 0.28, holdDuration: 0.78, fadeOutDuration: 0.38 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.boxWidth = Math.max(0.08, Number(overlay.boxWidth || 0.26));
      overlay.boxHeight = Math.max(0.08, Number(overlay.boxHeight || 0.16));
      overlay.softness = Math.max(0.05, Math.min(1, Number(overlay.softness || 0.56)));
      overlay.opacity = Math.max(0.05, Math.min(1, Number(overlay.opacity ?? 0.42)));
    } else if (overlay.overlayType === "highlight_bar_sweep") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.18, drawDuration: 0.42, holdDuration: 0.52, fadeOutDuration: 0.24 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.width = Math.max(0.08, Number(overlay.width || 0.34));
      overlay.boxHeight = Math.max(0.05, Number(overlay.boxHeight || 0.12));
      overlay.opacity = Math.max(0.05, Math.min(1, Number(overlay.opacity ?? 0.44)));
    } else if (overlay.overlayType === "checkpoint_pop") {
      overlay.radius = Math.max(0.01, Number(overlay.radius || 0.052));
      overlay.lineLength = Math.max(0.01, Number(overlay.lineLength || 0.032));
      overlay.strokeWidth = Math.max(1, Number(overlay.strokeWidth || 4.5));
      overlay.lineCount = Math.max(6, Math.min(12, Math.round(Number(overlay.lineCount || 8))));
      overlay.spreadAmount = clamp01(overlay.spreadAmount ?? overlay.jitter ?? 0.12, 0.12);
      overlay.jitter = overlay.spreadAmount;
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.98)));
      overlay.durationMs = Math.max(140, Math.round(Number(overlay.duration || 0.68) * 1000));
    } else if (overlay.overlayType === "section_divider_slide") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.22, drawDuration: 0.48, holdDuration: 0.5, fadeOutDuration: 0.24 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.width = Math.max(0.12, Number(overlay.width || 0.78));
      overlay.lineThickness = Math.max(2, Number(overlay.lineThickness || 4));
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96)));
    } else if (overlay.overlayType === "drop_wave") {
      const timed = normalizeTimedFxValues(overlay, { duration: 1.24, drawDuration: 0.18, holdDuration: 0.74, fadeOutDuration: 0.32 });
      overlay.drawDuration = timed.drawDuration;
      overlay.holdDuration = timed.holdDuration;
      overlay.fadeOutDuration = timed.fadeOutDuration;
      overlay.radius = Math.max(0.03, Number(overlay.radius || 0.12));
      overlay.waveCount = Math.max(2, Math.min(8, Math.round(Number(overlay.waveCount || 4))));
      overlay.waveSpacing = Math.max(0.01, Number(overlay.waveSpacing || 0.055));
      overlay.amplitude = Math.max(0, Number(overlay.amplitude || 0.032));
      overlay.speed = Math.max(0.1, Number(overlay.speed || 1.2));
      overlay.softness = Math.max(0.05, Math.min(1, Number(overlay.softness || 0.64)));
      overlay.strokeWidth = Math.max(1, Number(overlay.strokeWidth || 5.5));
      overlay.opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.94)));
    }
  }

  function clampFadeDuration(value, maxDuration) {
    return Math.max(0, Math.min(Math.max(0, maxDuration - 0.01), Number(value || 0)));
  }

  function normalizeTextOverlayTransitionType(type) {
    const value = String(type || "none").toLowerCase();
    return textOverlayTransitionItems.some((item) => item.type === value) ? value : "none";
  }

  function getTextOverlayTransitionDisplayName(type) {
    const normalized = normalizeTextOverlayTransitionType(type);
    const item = textOverlayTransitionItems.find((entry) => entry.type === normalized);
    return item?.nameKey ? t(item.nameKey, item.nameFallback) : (item?.nameFallback || "없음");
  }

  function getTextOverlayTransitionDefaultDuration(type) {
    const normalized = normalizeTextOverlayTransitionType(type);
    return normalized === "none" ? 0 : getTransitionDefaultDuration(normalized);
  }

  function clampTextOverlayTransitionDuration(value, maxDuration) {
    return Math.max(0, Math.min(Math.max(0, Number(maxDuration || 0) - TIMELINE_TIME_STEP_SEC), Number(value || 0)));
  }

  function syncTextOverlayTransitionSettings(overlay) {
    if (!overlay || overlay.overlayType !== "text") return overlay;
    const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 2));
    overlay.transitionInType = normalizeTextOverlayTransitionType(overlay.transitionInType);
    overlay.transitionOutType = normalizeTextOverlayTransitionType(overlay.transitionOutType);
    overlay.transitionStrength = Math.max(0.4, Math.min(1.6, Number(overlay.transitionStrength ?? 1)));
    let introDuration = overlay.transitionInType === "none"
      ? 0
      : clampTextOverlayTransitionDuration(
          snapFadeValueSec(overlay.transitionInDurationSec ?? getTextOverlayTransitionDefaultDuration(overlay.transitionInType)),
          total
        );
    let outroDuration = overlay.transitionOutType === "none"
      ? 0
      : clampTextOverlayTransitionDuration(
          snapFadeValueSec(overlay.transitionOutDurationSec ?? getTextOverlayTransitionDefaultDuration(overlay.transitionOutType)),
          total
        );
    const budget = Math.max(0, total - TIMELINE_TIME_STEP_SEC);
    if ((introDuration + outroDuration) > budget && (introDuration + outroDuration) > 0) {
      const scale = budget / (introDuration + outroDuration);
      introDuration *= scale;
      outroDuration *= scale;
    }
    overlay.transitionInDurationSec = overlay.transitionInType === "none" ? 0 : snapFadeValueSec(introDuration);
    overlay.transitionOutDurationSec = overlay.transitionOutType === "none" ? 0 : snapFadeValueSec(outroDuration);
    return overlay;
  }

  function fillTextOverlayTransitionSelect(selectEl) {
    if (!selectEl) return;
    const previous = String(selectEl.value || "none");
    selectEl.innerHTML = "";
    textOverlayTransitionItems.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.type;
      opt.textContent = getTextOverlayTransitionDisplayName(item.type);
      selectEl.appendChild(opt);
    });
    selectEl.value = normalizeTextOverlayTransitionType(previous);
  }

  function getTransitionDisplayName(type) {
    const value = String(type || "").toLowerCase();
    return getTransitionItems().find((item) => item.type === value)?.name || t("transitionTypeCut", "컷");
  }

  function getTransitionDefaultDuration(type) {
    if (type === "sun_glitter_flash") return 0.7;
    if (type === "focus_pull_in") return 0.65;
    if (type === "cyber_mosaic_burst") return 0.6;
    if (String(type || "").startsWith("blur_slide_")) return 0.55;
    if (type === "fade" || type === "cross") return 0.5;
    return 0;
  }

  function makeTransitionPreset(type, scope = "boundary") {
    const transitionType = String(type || "cut").toLowerCase();
    const normalizedScope = renderGraph?.normalizeTransitionScope
      ? renderGraph.normalizeTransitionScope(scope, "boundary")
      : String(scope || "boundary");
    return {
      type: transitionType,
      label: getTransitionDisplayName(transitionType),
      scope: normalizedScope,
      duration: getTransitionDefaultDuration(transitionType),
      strength: 1,
      intensity: 1,
      tileDensity: transitionMotion?.CYBER_DEFAULTS?.tileDensity ?? 0.68,
      sizeVariance: transitionMotion?.CYBER_DEFAULTS?.sizeVariance ?? 0.72,
      clusterCount: transitionMotion?.CYBER_DEFAULTS?.clusterCount ?? 4,
      clusterSpread: transitionMotion?.CYBER_DEFAULTS?.clusterSpread ?? 0.46,
      jitterSpeed: transitionMotion?.CYBER_DEFAULTS?.jitterSpeed ?? 1.2,
      seed: transitionMotion?.CYBER_DEFAULTS?.seed ?? 17,
      edgeSoftness: transitionMotion?.CYBER_DEFAULTS?.edgeSoftness ?? 0.024,
      anchorX: 0.5,
      anchorY: 0.5,
      easingPreset: "dynamic"
    };
  }

  function parseTransitionKey(rawKey) {
    if (renderGraph?.parseTransitionStorageKey) return renderGraph.parseTransitionStorageKey(rawKey);
    const key = String(rawKey || "");
    const match = /^(intro|outro):(.+)$/.exec(key);
    if (match) return { storageKey: key, kind: "edge", scope: match[1], clipId: match[2] };
    const boundaryIdx = Number(key);
    if (Number.isFinite(boundaryIdx)) return { storageKey: key, kind: "boundary", scope: "boundary", boundaryIdx };
    return { storageKey: key, kind: "unknown", scope: "boundary" };
  }

  function makeEdgeTransitionKey(scope, clipId) {
    if (renderGraph?.makeClipEdgeTransitionKey) return renderGraph.makeClipEdgeTransitionKey(scope, clipId);
    return `${scope}:${clipId}`;
  }

  function getTransitionDurationLimit(target, scope = "boundary") {
    if (scope === "boundary") {
      if (!target) return 10;
      const fromDur = Math.max(TIMELINE_TIME_STEP_SEC, getVideoClipTimelineDuration(target.fromClip));
      const toDur = Math.max(TIMELINE_TIME_STEP_SEC, getVideoClipTimelineDuration(target.toClip));
      return Math.max(TIMELINE_TIME_STEP_SEC, Math.min(10, fromDur, toDur));
    }
    const clip = target;
    if (!clip) return 10;
    const clipDur = getVideoClipTimelineDuration(clip);
    const otherScope = scope === "intro" ? "outro" : "intro";
    const otherKey = makeEdgeTransitionKey(otherScope, clip.id);
    const other = renderGraph?.normalizeTransition
      ? renderGraph.normalizeTransition(state.project.transitions?.[otherKey], { scope: otherScope })
      : state.project.transitions?.[otherKey];
    const otherDuration = other?.type ? Math.max(0, Number(other.duration || 0)) : 0;
    return Math.max(TIMELINE_TIME_STEP_SEC, Math.min(10, clipDur - Math.min(otherDuration, Math.max(0, clipDur - TIMELINE_TIME_STEP_SEC))));
  }

  function clampTransitionDurationSec(value, target, scope = "boundary") {
    const snapped = snapFadeValueSec(Math.max(TIMELINE_TIME_STEP_SEC, Number(value || 0.5)));
    return Math.max(TIMELINE_TIME_STEP_SEC, Math.min(getTransitionDurationLimit(target, scope), snapped));
  }

  function getTransitionRecordByKey(key) {
    return state.project.transitions?.[String(key)] || null;
  }

  function getTransitionForTarget(target) {
    if (!target) return null;
    if (target.kind === "boundary") {
      return getTransitionRecordByKey(target.transitionKey ?? target.boundaryIdx);
    }
    if (target.kind === "edge") {
      return getTransitionRecordByKey(target.transitionKey || makeEdgeTransitionKey(target.scope, target.clipId));
    }
    return null;
  }

  function buildTransitionTargetFromKey(rawKey) {
    const parsed = parseTransitionKey(rawKey);
    if (parsed.kind === "boundary") {
      const boundary = (state.ui.boundaries || []).find((item) => item.idx === parsed.boundaryIdx);
      if (!boundary) return null;
      return {
        kind: "boundary",
        boundaryIdx: boundary.idx,
        section: boundary.section,
        fromClipId: boundary.fromClipId,
        toClipId: boundary.toClipId,
        transitionKey: String(boundary.idx)
      };
    }
    if (parsed.kind === "edge" && parsed.clipId) {
      const clip = state.project.videoClips.find((item) => item.id === parsed.clipId);
      if (!clip) return null;
      return {
        kind: "edge",
        scope: parsed.scope,
        clipId: clip.id,
        section: Math.max(1, Number(clip.section || 1)),
        transitionKey: makeEdgeTransitionKey(parsed.scope, clip.id)
      };
    }
    return null;
  }

  function writeTransitionForTarget(target, transition) {
    if (!target) return false;
    const key = target.kind === "boundary"
      ? String(target.boundaryIdx)
      : (target.transitionKey || makeEdgeTransitionKey(target.scope, target.clipId));
    if (!transition || transition.type === "cut" && target.kind === "edge") {
      delete state.project.transitions[key];
      return true;
    }
    const next = {
      ...makeTransitionPreset(transition.type, target.kind === "boundary" ? "boundary" : target.scope),
      ...(target.kind === "boundary"
        ? {
            section: target.section,
            fromClipId: target.fromClipId,
            toClipId: target.toClipId
          }
        : {
            section: target.section,
            clipId: target.clipId
          }),
      ...transition
    };
    state.project.transitions[key] = next;
    return true;
  }

  function initVideoFadeFields(clip) {
    const clipDur = getVideoClipTimelineDuration(clip);
    const hadLegacyAuto = Array.isArray(clip.autoFades) && clip.autoFades.length
      || Array.isArray(clip.overlapWith) && clip.overlapWith.length;
    if (clip.manualFadeInSec == null) clip.manualFadeInSec = hadLegacyAuto ? 0 : Math.max(0, Number(clip.fadeInSec || 0));
    if (clip.manualFadeOutSec == null) clip.manualFadeOutSec = hadLegacyAuto ? 0 : Math.max(0, Number(clip.fadeOutSec || 0));
    clip.manualFadeInSec = clampFadeDuration(clip.manualFadeInSec, clipDur);
    clip.manualFadeOutSec = clampFadeDuration(clip.manualFadeOutSec, clipDur);
    clip.overlapFadeInSec = clampFadeDuration(clip.overlapFadeInSec, clipDur);
    clip.overlapFadeOutSec = clampFadeDuration(clip.overlapFadeOutSec, clipDur);
    clip.fadeInSec = clampFadeDuration(Math.max(Number(clip.manualFadeInSec || 0), Number(clip.overlapFadeInSec || 0)), clipDur);
    clip.fadeOutSec = clampFadeDuration(Math.max(Number(clip.manualFadeOutSec || 0), Number(clip.overlapFadeOutSec || 0)), clipDur);
  }

  function initAudioFadeFields(audio) {
    const duration = Math.max(MIN_TIMELINE_CLIP_SEC, Number(audio.duration || MIN_TIMELINE_CLIP_SEC));
    if (audio.manualFadeInSec == null) audio.manualFadeInSec = Math.max(0, Number(audio.fadeInSec || 0));
    if (audio.manualFadeOutSec == null) audio.manualFadeOutSec = Math.max(0, Number(audio.fadeOutSec || 0));
    audio.manualFadeInSec = clampFadeDuration(audio.manualFadeInSec, duration);
    audio.manualFadeOutSec = clampFadeDuration(audio.manualFadeOutSec, duration);
    audio.fadeInSec = audio.manualFadeInSec;
    audio.fadeOutSec = audio.manualFadeOutSec;
  }

  function getClipVisualFadeState(item, localTime, opts = {}) {
    if (!item) return { opacity: 1, black: 0, volume: 1 };
    const clipStart = Number(item.in || 0);
    const clipEnd = Number(opts.clipEnd ?? item.out ?? (clipStart + Number(item.duration || 0)));
    const fadeInSec = Math.max(0, Number(opts.fadeInSec ?? item.manualFadeInSec ?? item.fadeInSec ?? 0));
    const fadeOutSec = Math.max(0, Number(opts.fadeOutSec ?? item.manualFadeOutSec ?? item.fadeOutSec ?? 0));
    let multiplier = 1;
    if (fadeInSec > 0.001) {
      const progress = Math.max(0, Math.min(1, (Number(localTime || 0) - clipStart) / fadeInSec));
      multiplier *= progress;
    }
    if (fadeOutSec > 0.001) {
      const remain = clipEnd - Number(localTime || 0);
      const progress = Math.max(0, Math.min(1, remain / fadeOutSec));
      multiplier *= progress;
    }
    return {
      opacity: multiplier,
      black: 0,
      volume: multiplier
    };
  }

  function getLinkedAudioItem(videoClip) {
    if (!videoClip) return null;
    if (videoClip.linkedAudioId) {
      const byId = state.project.audioItems.find((audio) => audio.id === videoClip.linkedAudioId);
      if (byId) return byId;
    }
    if (!videoClip.id) return null;
    return state.project.audioItems.find((audio) => audio.linkedVideoId === videoClip.id) || null;
  }

  function getVideoPreviewFadeState(videoClip, localTime, opts = {}) {
    return getClipVisualFadeState({ in: 0 }, localTime, {
      fadeInSec: opts.ignoreManual ? 0 : videoClip?.manualFadeInSec,
      fadeOutSec: opts.ignoreManual ? 0 : videoClip?.manualFadeOutSec,
      clipEnd: getVideoClipTimelineDuration(videoClip)
    });
  }

  function getAudioPreviewFadeState(videoClip, localTime, opts = {}) {
    if (!getClipAudioEnabled(videoClip)) return { volume: 0 };
    const linkedAudio = getLinkedAudioItem(videoClip);
    if (!linkedAudio) {
      const fade = getClipVisualFadeState({ in: 0 }, Number(localTime || 0), {
        fadeInSec: opts.ignoreManual ? 0 : videoClip?.manualFadeInSec,
        fadeOutSec: opts.ignoreManual ? 0 : videoClip?.manualFadeOutSec,
        clipEnd: getVideoClipTimelineDuration(videoClip)
      });
      return { volume: clamp01(Number(videoClip?.gain ?? 1) * fade.volume, 0) };
    }
    const fade = getClipVisualFadeState({ in: 0 }, Number(localTime || 0), {
      fadeInSec: opts.ignoreManual ? 0 : linkedAudio.manualFadeInSec,
      fadeOutSec: opts.ignoreManual ? 0 : linkedAudio.manualFadeOutSec,
      clipEnd: getAudioItemTimelineDuration(linkedAudio)
    });
    return {
      volume: clamp01(clamp01(linkedAudio.gain, 1) * clamp01(fade.volume, 1), 0)
    };
  }

  function getPreviewTransitionEffectState(transitionType, transitionScope, progress, transition = {}) {
    const type = String(transitionType || "").toLowerCase();
    const scope = String(transitionScope || "boundary").toLowerCase();
    const reducedMotion = prefersReducedMotion();
    if (type === "sun_glitter_flash" && transitionMotion?.computeSunGlitterState) {
      return transitionMotion.computeSunGlitterState(
        progress,
        Number(transition.strength ?? 1),
        {
          mode: scope === "intro" ? "in" : "out",
          reducedMotion
        }
      );
    }
    if (type === "cyber_mosaic_burst" && transitionMotion?.computeCyberMosaicState) {
      const cyber = transitionMotion.computeCyberMosaicState(progress, {
        mode: scope === "intro" ? "in" : "out",
        intensity: Number(transition.intensity ?? 1),
        tileDensity: Number(transition.tileDensity ?? 0.68),
        sizeVariance: Number(transition.sizeVariance ?? 0.72),
        clusterCount: Number(transition.clusterCount ?? 4),
        clusterSpread: Number(transition.clusterSpread ?? 0.46),
        jitterSpeed: Number(transition.jitterSpeed ?? 1.2),
        seed: Number(transition.seed ?? 17),
        edgeSoftness: Number(transition.edgeSoftness ?? 0.024),
        reducedMotion
      });
      return {
        opacity: clamp01(cyber.opacity, 1),
        audioOpacity: clamp01(cyber.opacity, 1),
        videoOpacity: 1,
        usesMask: true,
        blurPx: 0,
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1
      };
    }
    if (type === "focus_pull_in" && transitionMotion?.computeFocusPullTransform) {
      return transitionMotion.computeFocusPullTransform(
        progress,
        Number(transition.anchorX ?? 0.5),
        Number(transition.anchorY ?? 0.5),
        Number(transition.strength ?? 1),
        1,
        1,
        {
          mode: scope === "intro" ? "in" : "out",
          easingPreset: transition.easingPreset || "dynamic",
          reducedMotion
        }
      );
    }
    if (type.startsWith("blur_slide_") && transitionMotion?.computeDirectionalBlurState) {
      const direction = transition.direction || type.replace("blur_slide_", "");
      return transitionMotion.computeDirectionalBlurState(
        progress,
        direction,
        Number(transition.strength ?? 1),
        1,
        1,
        {
          mode: scope === "intro" ? "in" : "out",
          reducedMotion
        }
      );
    }
    const simpleOpacity = scope === "intro" ? clamp01(progress, 0) : clamp01(1 - progress, 1);
    return {
      opacity: simpleOpacity,
      blurPx: 0,
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1
    };
  }

  function isClipLoadedInVideo(videoEl, clip) {
    if (!videoEl || !clip) return false;
    return videoEl.dataset.clipId === clip.id || videoEl.dataset.preloadedClipId === clip.id;
  }

  function getFrameSegmentKey(frame) {
    if (!frame) return "empty";
    if (frame.kind === "single") return `single:${frame.clip?.id || ""}`;
    if (frame.kind === "single_transition") {
      return `single_transition:${frame.transitionScope || ""}:${frame.transitionType || ""}:${frame.clip?.id || ""}`;
    }
    if (frame.kind === "stacked_transition") {
      return `stacked_transition:${frame.transitionScope || ""}:${frame.transitionType || ""}:${frame.boundaryIdx || ""}:${frame.baseClip?.id || ""}:${frame.overlayClip?.id || ""}`;
    }
    if (frame.kind === "cross") return `cross:${frame.reason || ""}:${frame.boundaryIdx || ""}:${frame.baseClip?.id || ""}:${frame.overlayClip?.id || ""}`;
    if (frame.kind === "fade_out_black" || frame.kind === "fade_in_black") return `${frame.kind}:${frame.boundaryIdx || ""}:${frame.clip?.id || ""}`;
    return String(frame.kind || "empty");
  }

  const PREVIEW_PRELOAD_LEAD_SEC = 0.75;
  const PREVIEW_WARM_PLAY_LEAD_SEC = 0.28;

  function clonePreviewClip(clip) {
    if (!clip) return null;
    return Object.freeze({ ...clip });
  }

  function normalizePreviewFrame(videoState, hasAnyVideo) {
    const raw = videoState || { kind: "empty" };

    if (raw.kind === "single" && raw.clip) {
      const clip = clonePreviewClip(raw.clip);
      const localTime = Number(raw.clipLocalTime || 0);
      const videoFade = getVideoPreviewFadeState(clip, localTime);
      const audioFade = getAudioPreviewFadeState(clip, localTime);
      return Object.freeze({
        kind: "single",
        reason: "single",
        clip,
        baseClip: clip,
        overlayClip: null,
        baseLocalTime: localTime,
        overlayLocalTime: 0,
        baseOpacity: clamp01(videoFade.opacity, 1),
        overlayOpacity: 0,
        baseVolume: clamp01(audioFade.volume, 1),
        overlayVolume: 0,
        blackOpacity: 0,
        section: raw.section,
        boundaryIdx: raw.boundaryIdx,
        start: Number(raw.start ?? clip.start ?? 0),
        end: Number(raw.end ?? getVideoClipTimelineEnd(clip)),
        progress: clamp01(raw.progress, 0)
      });
    }

    if (raw.kind === "single_transition" && raw.clip) {
      const clip = clonePreviewClip(raw.clip);
      const localTime = Number(raw.clipLocalTime || 0);
      const effect = getPreviewTransitionEffectState(raw.transitionType, raw.transitionScope, clamp01(raw.progress, 0), raw.transition || {});
      const videoFade = getVideoPreviewFadeState(clip, localTime);
      const audioFade = getAudioPreviewFadeState(clip, localTime);
      const videoOpacity = clamp01(effect.videoOpacity ?? effect.opacity, 1);
      const audioOpacity = clamp01(effect.audioOpacity ?? effect.opacity, 1);
      const visibleOpacity = clamp01(clamp01(videoFade.opacity, 1) * videoOpacity, 0);
      const audibleVolume = clamp01(clamp01(audioFade.volume, 1) * audioOpacity, 0);
      return Object.freeze({
        kind: "single_transition",
        reason: raw.transitionType || "transition",
        transitionType: raw.transitionType || "",
        transitionScope: raw.transitionScope || "outro",
        transition: raw.transition || null,
        clip,
        baseClip: clip,
        overlayClip: null,
        baseLocalTime: localTime,
        overlayLocalTime: 0,
        baseOpacity: visibleOpacity,
        overlayOpacity: 0,
        baseVolume: audibleVolume,
        overlayVolume: 0,
        blackOpacity: 0,
        section: raw.section,
        boundaryIdx: raw.boundaryIdx,
        start: Number(raw.start || 0),
        end: Number(raw.end || 0),
        progress: clamp01(raw.progress, 0)
      });
    }

    if (raw.kind === "stacked_transition" && raw.baseClip && raw.overlayClip) {
      const baseClip = clonePreviewClip(raw.baseClip);
      const overlayClip = clonePreviewClip(raw.overlayClip);
      const progress = clamp01(raw.progress, 0);
      const effect = getPreviewTransitionEffectState(raw.transitionType, raw.transitionScope, progress, raw.transition || {});
      const incomingEffect = getPreviewTransitionEffectState(raw.transitionType, "intro", progress, raw.transition || {});
      const videoOpacity = clamp01(effect.videoOpacity ?? effect.opacity, 1);
      const audioOpacity = clamp01(effect.audioOpacity ?? effect.opacity, 1);
      const incomingVideoOpacity = clamp01(incomingEffect.videoOpacity ?? incomingEffect.opacity, 1);
      const incomingAudioOpacity = clamp01(incomingEffect.audioOpacity ?? incomingEffect.opacity, 1);
      return Object.freeze({
        kind: "stacked_transition",
        reason: raw.transitionType || "transition",
        transitionType: raw.transitionType || "",
        transitionScope: raw.transitionScope || "boundary",
        transition: raw.transition || null,
        clip: null,
        baseClip,
        overlayClip,
        baseLocalTime: Number(raw.baseLocalTime || 0),
        overlayLocalTime: Number(raw.overlayLocalTime || 0),
        baseOpacity: incomingVideoOpacity,
        overlayOpacity: videoOpacity,
        baseVolume: incomingAudioOpacity,
        overlayVolume: audioOpacity,
        blackOpacity: 0,
        section: raw.section,
        boundaryIdx: raw.boundaryIdx,
        start: Number(raw.start || 0),
        end: Number(raw.end || 0),
        progress
      });
    }

    if (raw.kind === "cross" && raw.baseClip && raw.overlayClip) {
      const baseClip = clonePreviewClip(raw.baseClip);
      const overlayClip = clonePreviewClip(raw.overlayClip);
      const progress = clamp01(raw.progress, 0);
      let baseOpacity = clamp01(1 - progress, 1);
      let overlayOpacity = clamp01(progress, 0);
      let baseVolume = clamp01(1 - progress, 1);
      let overlayVolume = clamp01(progress, 0);

      return Object.freeze({
        kind: "cross",
        reason: raw.reason || "overlap",
        transitionType: raw.transitionType || raw.reason || "",
        clip: null,
        baseClip,
        overlayClip,
        baseLocalTime: Number(raw.baseLocalTime || 0),
        overlayLocalTime: Number(raw.overlayLocalTime || 0),
        baseOpacity: clamp01(baseOpacity, 1),
        overlayOpacity: clamp01(overlayOpacity, 0),
        baseVolume: clamp01(baseVolume, 1),
        overlayVolume: clamp01(overlayVolume, 0),
        blackOpacity: 0,
        section: raw.section,
        boundaryIdx: raw.boundaryIdx,
        start: Number(raw.start || 0),
        end: Number(raw.end || 0),
        progress
      });
    }

    if ((raw.kind === "fade_out_black" || raw.kind === "fade_in_black") && raw.clip) {
      const clip = clonePreviewClip(raw.clip);
      const localTime = Number(raw.clipLocalTime || 0);
      const progress = clamp01(raw.progress, raw.kind === "fade_in_black" ? 1 : 0);
      const videoFade = getVideoPreviewFadeState(clip, localTime);
      const audioFade = getAudioPreviewFadeState(clip, localTime);
      const clipMix = raw.kind === "fade_out_black" ? (1 - progress) : progress;
      const visibleOpacity = clamp01(clamp01(videoFade.opacity, 1) * clipMix, 0);
      const audibleVolume = clamp01(clamp01(audioFade.volume, 1) * clipMix, 0);
      return Object.freeze({
        kind: raw.kind,
        reason: raw.transitionType || "fade",
        clip,
        baseClip: raw.kind === "fade_out_black" ? clip : null,
        overlayClip: raw.kind === "fade_in_black" ? clip : null,
        baseLocalTime: raw.kind === "fade_out_black" ? localTime : 0,
        overlayLocalTime: raw.kind === "fade_in_black" ? localTime : 0,
        baseOpacity: raw.kind === "fade_out_black" ? visibleOpacity : 0,
        overlayOpacity: raw.kind === "fade_in_black" ? visibleOpacity : 0,
        baseVolume: raw.kind === "fade_out_black" ? audibleVolume : 0,
        overlayVolume: raw.kind === "fade_in_black" ? audibleVolume : 0,
        blackOpacity: 0,
        section: raw.section,
        boundaryIdx: raw.boundaryIdx,
        start: Number(raw.start || 0),
        end: Number(raw.end || 0),
        progress
      });
    }

    return Object.freeze({
      kind: "empty",
      reason: "empty",
      clip: null,
      baseClip: null,
      overlayClip: null,
      baseLocalTime: 0,
      overlayLocalTime: 0,
      baseOpacity: 0,
      overlayOpacity: 0,
      baseVolume: 0,
      overlayVolume: 0,
      blackOpacity: 0,
      section: raw.section || 1,
      boundaryIdx: raw.boundaryIdx,
      start: Number(raw.start || 0),
      end: Number(raw.end || 0),
      progress: clamp01(raw.progress, 0)
    });
  }

  function normalizePreviewFrames(videoStates, hasAnyVideo) {
    const source = Array.isArray(videoStates) ? videoStates : [];
    if (!source.length) return [normalizePreviewFrame({ kind: "empty", section: 1 }, hasAnyVideo)];
    return source
      .map((item) => normalizePreviewFrame(item, hasAnyVideo))
      .sort((a, b) => Math.max(1, Number(a.section || 1)) - Math.max(1, Number(b.section || 1)));
  }

  function getPreferredSingleVideoElement(clip, expectedLocalTime = null, section = 1) {
    const { base, overlay } = getVideoLayers(section);
    const baseLoaded = isClipLoadedInVideo(base, clip);
    const overlayLoaded = isClipLoadedInVideo(overlay, clip);
    if (overlayLoaded && !baseLoaded) return overlay;
    if (baseLoaded && !overlayLoaded) return base;
    if (baseLoaded && overlayLoaded) {
      const overlayWarmState = String(overlay.dataset.warmState || "");
      const baseWarmState = String(base.dataset.warmState || "");
      if (overlayWarmState === "active" && baseWarmState !== "active") return overlay;
      if (baseWarmState === "active" && overlayWarmState !== "active") return base;
      if (Number.isFinite(expectedLocalTime)) {
        const baseDist = Math.abs(Number(base.currentTime || 0) - Number(expectedLocalTime || 0));
        const overlayDist = Math.abs(Number(overlay.currentTime || 0) - Number(expectedLocalTime || 0));
        return overlayDist <= baseDist ? overlay : base;
      }
      const baseTime = Number(base.currentTime || 0);
      const overlayTime = Number(overlay.currentTime || 0);
      return overlayTime >= baseTime ? overlay : base;
    }
    return base;
  }

  function getUpcomingBlendTarget(currentTime, frame) {
    if (!renderGraph || !frame?.baseClip) return null;
    const analysis = getProjectGraph();
    const now = Number(currentTime || 0);
    let best = null;
    for (const boundary of (analysis.boundaries || [])) {
      if (Math.max(1, Number(boundary?.section || 1)) !== Math.max(1, Number(frame.section || 1))) continue;
      if (!boundary?.toClip || boundary.fromClipId !== frame.baseClip.id) continue;

      let entryTime = Number(boundary.time || 0);
      let entryLocalTime = 0;
      let reason = "overlap";

      if (Number(boundary.overlapDuration || 0) > 0.0001) {
        entryTime = Number(boundary.overlapStart || boundary.time || 0);
        entryLocalTime = 0;
        reason = "overlap";
      } else {
        const transition = renderGraph.resolveBoundaryTransition(analysis, boundary);
        if (!transition || transition.type === "cut") {
          entryTime = Number(boundary.time || 0);
          entryLocalTime = 0;
          reason = "cut";
        } else if (transition.type === "cross") {
          entryTime = Number(transition.windowStart || boundary.time || 0);
          entryLocalTime = 0;
          reason = "transition";
        } else if (transition.type === "fade") {
          entryTime = Number(transition.fadeMid || boundary.time || 0);
          entryLocalTime = 0;
          reason = "transition";
        } else if (renderGraph?.transitionIsOutgoingOnly?.(transition.type)) {
          entryTime = Number(transition.windowStart || boundary.time || 0);
          entryLocalTime = 0;
          reason = "transition";
        } else {
          continue;
        }
      }

      const timeUntilEntry = entryTime - now;
      if (timeUntilEntry < -TIMELINE_TIME_STEP_SEC || timeUntilEntry > PREVIEW_PRELOAD_LEAD_SEC) continue;
      if (!best || entryTime < best.entryTime) {
        best = {
          boundaryIdx: boundary.idx,
          clip: boundary.toClip,
          entryTime,
          entryLocalTime: Math.max(0, Number(entryLocalTime || 0)),
          reason
        };
      }
    }
    return best;
  }

  function preloadUpcomingBlendClip(currentTime, frame, idleVideoEl, session = null, section = 1) {
    if (!state.ui.isPlaying || !frame?.baseClip || !idleVideoEl || !renderGraph) return;
    const previewSession = session || getPreviewSession(section);
    if (!previewSession) return;
    const target = getUpcomingBlendTarget(currentTime, frame);
    if (!target?.clip) return;

    const timeUntilEntry = Math.max(0, Number(target.entryTime || 0) - Number(currentTime || 0));
    const warmLead = Math.min(
      PREVIEW_WARM_PLAY_LEAD_SEC,
      timeUntilEntry,
      Math.max(0, Number(target.entryLocalTime || 0))
    );
    const warmPlayback = warmLead > 0.001;
    const preloadTime = warmPlayback
      ? Math.max(0, Number(target.entryLocalTime || 0) - warmLead)
      : Math.max(0, Number(target.entryLocalTime || 0));

    previewSession.preload(
      target.clip,
      idleVideoEl === getVideoLayers(section).base ? "base" : "overlay",
      preloadTime,
      {
        keepWarm: true,
        warmPlayback,
        keepWarmMs: warmPlayback ? 320 : 220
      }
    );
  }

  function focusOverlayInspector() {
    toolSheetController?.switchTo?.("text");
    requestAnimationFrame(() => {
      els.overlayTextInput?.focus?.();
      els.overlayTextInput?.select?.();
    });
  }

  function normalizeProjectMediaPaths() {
    migrateLegacyOverlayItems();
    let maxVideoSection = 1;
    let maxAudioSection = 1;
    for (const c of state.project.videoClips) {
      c.previewPath = c.previewPath || c.internalPath || c.originalPath || "";
      c.sourcePath = c.sourcePath || c.originalPath || c.internalPath || "";
      c.internalPath = c.previewPath;
      c.isImage = !!(c.isImage || c.meta?.isImage);
      if (c.isImage) {
        c.stillImagePath = c.stillImagePath || c.imageCutoutOriginalPath || c.originalPath || "";
      }
      c.section = Math.max(1, Number(c.section || 1));
      initVideoClipFields(c, {
        defaultSourceIn: getClipSourceIn(c, 0),
        defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(c, Number(c.out || 0)) - getClipSourceIn(c, 0))
      });
      c.audioEnabled = getClipAudioEnabled(c);
      c.mediaRole = c.audioEnabled && c.linkedAudioId && c.linkMode === "linked" ? "linked_av" : "video_only";
      initVideoFadeFields(c);
      if (c.section > maxVideoSection) maxVideoSection = c.section;
    }
    const videoById = new Map(state.project.videoClips.map((clip) => [clip.id, clip]));
    for (const a of state.project.audioItems) {
      a.previewPath = a.previewPath || a.internalPath || a.originalPath || "";
      a.sourcePath = a.sourcePath || a.originalPath || a.internalPath || "";
      a.internalPath = a.previewPath;
      a.section = Math.max(1, Number(a.section || 1));
      syncAudioItemTiming(a, {
        linkedClip: a.linkMode === "linked" && a.linkedVideoId ? (videoById.get(a.linkedVideoId) || null) : null
      });
      initAudioFadeFields(a);
      if (a.section > maxAudioSection) maxAudioSection = a.section;
    }
    state.project.overlayItems = (state.project.overlayItems || []).map((item) => normalizeOverlayItem(item));
    for (const overlay of state.project.overlayItems) {
      overlay.section = Math.max(1, Number(overlay.section || 1));
      if (overlay.section > maxVideoSection) maxVideoSection = overlay.section;
    }
    state.project.videoSections = Math.max(1, Number(state.project.videoSections || 1), maxVideoSection);
    state.project.audioSections = Math.max(1, Number(state.project.audioSections || 1), maxAudioSection);
  }

  function getRenderClipSourcePath(clip) {
    if (clip?.isImage) return clip.internalPath || clip.previewPath || clip.sourcePath || clip.originalPath || "";
    return clip.sourcePath || clip.originalPath || clip.internalPath || clip.previewPath || "";
  }

  function getRenderAudioSourcePath(audio) {
    return audio.sourcePath || audio.originalPath || audio.internalPath || audio.previewPath || "";
  }

  function getProjectGraph() {
    if (!renderGraph) return { project: state.project, boundaries: [], sections: [] };
    if (!projectGraphCache) projectGraphCache = renderGraph.analyzeProject(state.project);
    return projectGraphCache;
  }

  function syncTransitions() {
    if (!renderGraph) return;
    const analysis = getProjectGraph();
    const normalizedProject = renderGraph.normalizeProjectTransitions
      ? renderGraph.normalizeProjectTransitions(state.project)
      : null;
    const normalizedTransitions = Array.isArray(normalizedProject?.transitions) && normalizedProject.transitions.length
      ? normalizedProject.transitions
      : null;
    const transitionSource = normalizedTransitions || state.project.transitions || {};
    if (normalizedProject?.orphanedTransitions?.length) {
      state.project.orphanedTransitions = normalizedProject.orphanedTransitions;
    }
    const next = {};
    for (const [rawKey, rawValue] of Object.entries(transitionSource)) {
      const parsed = parseTransitionKey(rawKey);
      const normalized = renderGraph.normalizeTransition(rawValue, { scope: parsed.scope || rawValue?.scope || "boundary" });
      if (!normalized) continue;
      if (parsed.kind === "edge") {
        const clipId = rawValue?.clipId || parsed.clipId;
        const clip = state.project.videoClips.find((item) => item.id === clipId);
        if (!clip) continue;
        const scope = parsed.scope || normalized.scope || rawValue?.scope || "intro";
        next[makeEdgeTransitionKey(scope, clip.id)] = {
          ...normalized,
          scope,
          clipId: clip.id,
          section: Math.max(1, Number(clip.section || 1)),
          duration: clampTransitionDurationSec(normalized.duration, clip, scope)
        };
        continue;
      }
      let boundary = null;
      if (rawValue?.fromClipId && rawValue?.toClipId) {
        boundary = (analysis.boundaries || []).find((item) => (
          Number(item.section || 1) === Math.max(1, Number(rawValue.section || item.section || 1))
          && item.fromClipId === rawValue.fromClipId
          && item.toClipId === rawValue.toClipId
        ));
      }
      if (!boundary && parsed.kind === "boundary") {
        boundary = (analysis.boundaries || []).find((item) => item.idx === parsed.boundaryIdx);
      }
      if (!boundary) continue;
      const gapDuration = Math.max(0, Number(boundary.gapDuration || 0));
      const overlapDuration = Math.max(0, snapTimelineTimeSec(Number(boundary.overlapDuration || 0)));
      let duration = normalized.type === "cut" ? 0 : clampTransitionDurationSec(normalized.duration, boundary, "boundary");
      let leftDuration = Number(normalized.leftDuration ?? normalized.leftDurationSec);
      let rightDuration = Number(normalized.rightDuration ?? normalized.rightDurationSec);
      const hasCustomSpan = Number.isFinite(leftDuration) || Number.isFinite(rightDuration);
      if (overlapDuration > 0.0001 && normalized.type !== "cut" && overlapDuration >= duration - TIMELINE_TIME_STEP_SEC) {
        duration = overlapDuration;
        leftDuration = 0;
        rightDuration = overlapDuration;
      } else if (!hasCustomSpan) {
        leftDuration = undefined;
        rightDuration = undefined;
      }
      next[boundary.idx] = {
        ...normalized,
        scope: "boundary",
        duration,
        ...(Number.isFinite(leftDuration) ? { leftDuration } : {}),
        ...(Number.isFinite(rightDuration) ? { rightDuration } : {}),
        ...(gapDuration > 0.1 ? { disabledReason: "gap" } : {}),
        ...(overlapDuration > 0.0001 ? { overlapDuration } : {}),
        section: boundary.section,
        fromClipId: boundary.fromClipId,
        toClipId: boundary.toClipId
      };
    }
    state.project.transitions = next;
    (state.project.videoClips || []).forEach((clip) => {
      delete clip.transitionOut;
      delete clip.transitionIn;
      delete clip.transition;
      delete clip.endEffect;
    });
  }

  function queueMissingAudioVisuals() {
    for (const a of state.project.audioItems) {
      const hasWave = Array.isArray(a.waveformPeaks) && a.waveformPeaks.length > 0;
      if (hasWave) continue;
      if (a._analyzeQueued) continue;
      const p = a.previewPath || a.internalPath || a.originalPath;
      if (!p) continue;
      a._analyzeQueued = true;
      enqueueAudioAnalysis(a.id, p, { waveform: true, pitch: false });
    }
  }

  function recalcTimeline() {
    state.project.videoClips.sort((a, b) => (Number(a.section || 1) - Number(b.section || 1)) || (a.start - b.start));
    state.project.audioItems.sort((a, b) => (Number(a.section || 1) - Number(b.section || 1)) || (a.start - b.start));
    state.project.overlayItems.sort((a, b) => (Number(a.section || 1) - Number(b.section || 1)) || (a.start - b.start));
    state.project.overlayItems.forEach((overlay) => syncOverlayTiming(overlay));
    const videoById = new Map(state.project.videoClips.map((clip) => [clip.id, clip]));
    for (const c of state.project.videoClips) {
      c.audioEnabled = getClipAudioEnabled(c);
      c.mediaRole = c.audioEnabled && c.linkedAudioId && c.linkMode === "linked" ? "linked_av" : "video_only";
      if (c.linkedAudioId && c.linkMode === "linked") {
        const linked = state.project.audioItems.find(a => a.id === c.linkedAudioId);
        if (linked) {
          linked.start = c.start;
          linked.duration = getVideoClipTimelineDuration(c);
          linked.section = Math.max(1, Number(c.section || 1));
          linked.sourceIn = Math.max(0, Number(c.in || 0));
          linked.sourceOut = Math.max(linked.sourceIn + MIN_TIMELINE_CLIP_SEC, Number(c.out || linked.sourceIn + MIN_TIMELINE_CLIP_SEC));
        }
      }
    }
    state.project.audioItems.forEach((audio) => {
      syncAudioItemTiming(audio, {
        linkedClip: audio.linkMode === "linked" && audio.linkedVideoId ? (videoById.get(audio.linkedVideoId) || null) : null
      });
    });
    state.project.videoSections = Math.max(
      1,
      Number(state.project.videoSections || 1),
      ...state.project.videoClips.map(c => Number(c.section || 1)),
      ...state.project.overlayItems.map(o => Number(o.section || 1))
    );
    state.project.audioSections = Math.max(1, Number(state.project.audioSections || 1), ...state.project.audioItems.map(a => Number(a.section || 1)));
    const videoEnd = Math.max(0, ...state.project.videoClips.map(c => getVideoClipTimelineEnd(c)));
    const audioEnd = Math.max(0, ...state.project.audioItems.map(a => a.start + a.duration));
    const overlayEnd = Math.max(0, ...state.project.overlayItems.map(o => Number(o.start || 0) + Number(o.duration || 0)));
    state.project.duration = Math.max(videoEnd, audioEnd, overlayEnd, 0);
    // Keep some editable tail room so empty area can be created and edited.
    state.ui.viewDuration = Math.max(getViewportMinViewDurationSec(), state.project.duration + 10);
    updateOverlapAutoTransitions();
    projectGraphCache = renderGraph ? renderGraph.analyzeProject(state.project) : null;
    syncTransitions();
    projectGraphCache = renderGraph ? renderGraph.analyzeProject(state.project) : null;
  }

  function getViewportMinViewDurationSec() {
    const viewportWidth = Math.max(0, Number(els.timelineViewport?.clientWidth || 0) - TIMELINE_LABEL_COLUMN_PX);
    if (viewportWidth <= 0) return MIN_TIMELINE_VIEW_SEC;
    const visibleSeconds = viewportWidth / Math.max(1, Number(state.ui.pxPerSec || 90));
    return Math.max(MIN_TIMELINE_VIEW_SEC, Math.ceil(visibleSeconds * 4) / 4);
  }

  function getMaxTimelineEnd() {
    return Math.max(
      0,
      ...state.project.videoClips.map(c => getVideoClipTimelineEnd(c)),
      ...state.project.audioItems.map(a => a.start + a.duration),
      ...state.project.overlayItems.map(o => Number(o.start || 0) + Number(o.duration || 0))
    );
  }

  function nearestSnapTime(sec, movingItemId = null, options = {}) {
    const snapped = snapTimelineTimeSec(sec);
    const threshold = getTimelineAutoSnapThresholdSec();
    const movingDuration = Math.max(0, Number(options.durationSec ?? options.duration ?? 0));
    const movingSection = options.section == null ? null : Math.max(1, Number(options.section || 1));
    const ignoredIds = new Set([
      movingItemId,
      ...(Array.isArray(options.ignoreIds) ? options.ignoreIds : [])
    ].filter(Boolean).map(String));
    let best = snapped;
    let bestDist = threshold;
    const allItems = [
      ...state.project.videoClips.map((clip) => ({
        id: clip.id,
        section: Math.max(1, Number(clip.section || 1)),
        start: Number(clip.start || 0),
        end: getVideoClipTimelineEnd(clip)
      })),
      ...state.project.audioItems.map((audio) => ({
        id: audio.id,
        section: Math.max(1, Number(audio.section || 1)),
        start: Number(audio.start || 0),
        end: Number(audio.start || 0) + Math.max(0, Number(audio.duration || 0))
      })),
      ...state.project.overlayItems.map((overlay) => ({
        id: overlay.id,
        section: Math.max(1, Number(overlay.section || 1)),
        start: Number(overlay.start || 0),
        end: Number(overlay.start || 0) + Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC))
      }))
    ];
    for (const item of allItems) {
      if (ignoredIds.has(String(item.id || ""))) continue;
      if (movingSection != null && Number(item.section || 1) !== movingSection) continue;
      const s = item.start;
      const e = item.end;
      const ds = Math.abs(sec - s);
      const de = Math.abs(sec - e);
      if (ds < bestDist) { best = s; bestDist = ds; }
      if (de < bestDist) { best = e; bestDist = de; }
      if (movingDuration > 0) {
        const movingEnd = sec + movingDuration;
        const endToStart = Math.abs(movingEnd - s);
        const endToEnd = Math.abs(movingEnd - e);
        if (endToStart < bestDist) {
          best = s - movingDuration;
          bestDist = endToStart;
        }
        if (endToEnd < bestDist) {
          best = e - movingDuration;
          bestDist = endToEnd;
        }
      }
    }
    return bestDist <= threshold ? Math.max(0, best) : Math.max(0, snapped);
  }

  function nearestSnapPointTime(sec, movingItemId = null, options = {}) {
    return nearestSnapTime(sec, movingItemId, {
      ...options,
      durationSec: 0
    });
  }

  function getRegionSnapThresholdSec() {
    return getTimelineAutoSnapThresholdSec();
  }

  function snapRegionTime(sec) {
    let t = snapTimelineTimeSec(Math.max(0, Math.min(state.ui.viewDuration, sec)));
    const threshold = getRegionSnapThresholdSec();

    let best = t;
    let bestDist = threshold;
    const allItems = [
      ...state.project.videoClips.map((clip) => ({
        start: Number(clip.start || 0),
        end: getVideoClipTimelineEnd(clip)
      })),
      ...state.project.audioItems.map((audio) => ({
        start: Number(audio.start || 0),
        end: Number(audio.start || 0) + Math.max(0, Number(audio.duration || 0))
      })),
      ...state.project.overlayItems.map((overlay) => ({
        start: Number(overlay.start || 0),
        end: Number(overlay.start || 0) + Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC))
      }))
    ];
    for (const item of allItems) {
      const ds = Math.abs(t - item.start);
      const de = Math.abs(t - item.end);
      if (ds <= bestDist) { best = item.start; bestDist = ds; }
      if (de <= bestDist) { best = item.end; bestDist = de; }
    }
    return best;
  }

  function updateOverlapAutoTransitions() {
    state.project.videoClips.forEach(c => {
      c.overlapWith = [];
      c.autoFades = [];
      c.overlapFadeInSec = 0;
      c.overlapFadeOutSec = 0;
    });
    const clips = [...state.project.videoClips].sort((a, b) => a.start - b.start);
    for (let i = 0; i < clips.length; i++) {
      for (let j = i + 1; j < clips.length; j++) {
        const a = clips[i];
        const b = clips[j];
        if (Number(a.section || 1) !== Number(b.section || 1)) continue;
        const as = a.start;
        const ae = getVideoClipTimelineEnd(a);
        const bs = b.start;
        const be = getVideoClipTimelineEnd(b);
        const overlap = Math.min(ae, be) - Math.max(as, bs);
        if (overlap <= 0) continue;
        const d = Math.max(TIMELINE_TIME_STEP_SEC, snapTimelineTimeSec(overlap));
        a.overlapWith.push(b.id);
        b.overlapWith.push(a.id);
        a.autoFades.push({ with: b.id, fadeOut: d, fadeIn: d });
        b.autoFades.push({ with: a.id, fadeOut: d, fadeIn: d });
        if (a.start <= b.start) {
          a.overlapFadeOutSec = Math.max(Number(a.overlapFadeOutSec || 0), d);
          b.overlapFadeInSec = Math.max(Number(b.overlapFadeInSec || 0), d);
        } else {
          b.overlapFadeOutSec = Math.max(Number(b.overlapFadeOutSec || 0), d);
          a.overlapFadeInSec = Math.max(Number(a.overlapFadeInSec || 0), d);
        }
      }
    }
    state.project.videoClips.forEach((clip) => initVideoFadeFields(clip));
    state.project.audioItems.forEach((audio) => initAudioFadeFields(audio));
  }

  function renderLeftClipList() {
    const list = els.clipList;
    list.innerHTML = "";
    if (!state.project.videoClips.length && !state.project.audioItems.length) {
      list.classList.add("empty");
      list.textContent = t("emptyClips", "아직 업로드된 파일이 없습니다.");
      return;
    }
    list.classList.remove("empty");

    const addCard = (title, metaLines, actions) => {
      const card = document.createElement("div");
      card.className = "clipCard";
      const t = document.createElement("div");
      t.className = "title";
      t.textContent = title;
      const m = document.createElement("div");
      m.className = "meta";
      metaLines.forEach(x => {
        const s = document.createElement("span");
        s.textContent = x;
        m.appendChild(s);
      });
      card.appendChild(t);
      card.appendChild(m);
      if (actions?.length) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "8px";
        actions.forEach(a => row.appendChild(a));
        card.appendChild(row);
      }
      list.appendChild(card);
    };

    state.project.videoClips.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "smallBtn";
      btn.textContent = t("preview", "미리보기");
      btn.onclick = () => setPreviewToClip(c.id);
      addCard(
        `영상 ${c.name}`,
        [`${formatTimelineSec(getVideoClipTimelineDuration(c))}s`, `${(c.meta?.width||0)}x${(c.meta?.height||0)}`, `${(c.meta?.fps||0).toFixed(2)}fps`],
        [btn]
      );
    });

    state.project.audioItems.forEach((a) => {
      addCard(`음성 ${a.name}`, [`${formatTimelineSec(a.duration)}s`, `start ${formatTimelineSec(a.start)}s`], []);
    });
  }

  function getActiveOverlayItemsAt(timeSec) {
    const t = Number(timeSec || 0);
    return (state.project.overlayItems || [])
      .filter((item) => t >= Number(item.start || 0) - 1e-6 && t <= Number(item.start || 0) + Math.max(MIN_OVERLAY_CLIP_SEC, Number(item.duration || MIN_OVERLAY_CLIP_SEC)) + 1e-6)
      .sort((a, b) => (
        Number(b.section || 1) - Number(a.section || 1)
        || Number(a.start || 0) - Number(b.start || 0)
      ));
  }

  function ensurePreviewInteractionLayer() {
    if (!els.dropZone) return null;
    let layer = document.getElementById("previewOverlayInteractLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "previewOverlayInteractLayer";
      els.dropZone.appendChild(layer);
    }
    return layer;
  }

  function clearPreviewOverlayInteraction() {
    const layer = ensurePreviewInteractionLayer();
    if (!layer) return;
    if (layer.childElementCount) layer.innerHTML = "";
  }

  function getSelectedActiveOverlayAt(timeSec) {
    const selected = getSelectedOverlayItem();
    if (!selected) return null;
    const start = Number(selected.start || 0);
    const end = start + Math.max(MIN_OVERLAY_CLIP_SEC, Number(selected.duration || MIN_OVERLAY_CLIP_SEC));
    return timeSec >= start - 1e-6 && timeSec <= end + 1e-6 ? selected : null;
  }

  function getSelectedActiveVideoAt(timeSec) {
    const selected = getSelectedVideoClip();
    if (!selected) return null;
    const start = Number(selected.start || 0);
    const end = start + Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(selected));
    return timeSec >= start - 1e-6 && timeSec <= end + 1e-6 ? selected : null;
  }

  function getRenderedPreviewTextBox(overlay, frame) {
    if (!overlay?.id || !els.dropZone) return null;
    const layer = document.getElementById("previewTextOverlayLayer");
    if (!layer) return null;
    const textEl = [...layer.querySelectorAll(".previewTextItem")]
      .find((item) => item.dataset.overlayId === String(overlay.id));
    if (!textEl) return null;
    const textRect = textEl.getBoundingClientRect?.();
    const rootRect = els.dropZone.getBoundingClientRect?.();
    if (!textRect || !rootRect || textRect.width <= 0 || textRect.height <= 0) return null;
    const pad = Math.max(4, Math.min(18, (Number(overlay.strokeWidth || 0) * frame.scale) + 6));
    return {
      frame,
      left: (textRect.left - rootRect.left) - pad,
      top: (textRect.top - rootRect.top) - pad,
      width: textRect.width + (pad * 2),
      height: textRect.height + (pad * 2),
      renderedTextBox: true
    };
  }

  function getPreviewVideoBox(clip) {
    const layout = getPreviewClipLayout(clip);
    if (!layout) return null;
    return {
      layout,
      left: layout.displayLeftAbs,
      top: layout.displayTopAbs,
      width: layout.displayWidth,
      height: layout.displayHeight,
      rawLeft: layout.rawLeftAbs,
      rawTop: layout.rawTopAbs,
      rawWidth: layout.rawWidth,
      rawHeight: layout.rawHeight
    };
  }

  function getPreviewVideoCropBox(clip) {
    const previewClip = getVideoCropPreviewClip(clip);
    const layout = previewClip ? getPreviewClipLayout(previewClip) : null;
    if (!layout) return null;
    return {
      layout,
      left: layout.displayLeftAbs,
      top: layout.displayTopAbs,
      width: layout.displayWidth,
      height: layout.displayHeight,
      rawLeft: layout.rawLeftAbs,
      rawTop: layout.rawTopAbs,
      rawWidth: layout.rawWidth,
      rawHeight: layout.rawHeight
    };
  }

  function getActiveZoomOverlayAt(timeSec, overlays = null) {
    const activeItems = Array.isArray(overlays) ? overlays : getActiveOverlayItemsAt(timeSec);
    return activeItems
      .filter((overlay) => overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus")
      .sort((a, b) => (Number(b.section || 1) - Number(a.section || 1)) || (Number(b.start || 0) - Number(a.start || 0)))[0] || null;
  }

  function resetPreviewZoomEffect() {
    resetPreviewZoomHosts();
  }

  function applyPreviewZoomEffect(timeSec, overlays = null, frameStates = []) {
    if (!overlayEngine?.getZoomOverlayState || !els.dropZone) {
      resetPreviewZoomEffect();
      return;
    }
    const zoomOverlay = getActiveZoomOverlayAt(timeSec, overlays);
    const zoomState = overlayEngine.getZoomOverlayState(zoomOverlay, timeSec);
    const frame = overlayEngine.getFrameBox(els.dropZone, state.settings.resolutionName, state.settings.aspectRatio);
    const dropBounds = els.dropZone.getBoundingClientRect();
    const containerWidth = Math.max(1, Math.round(dropBounds.width || els.dropZone.clientWidth || frame.width));
    const containerHeight = Math.max(1, Math.round(dropBounds.height || els.dropZone.clientHeight || frame.height));
    const zoomOpacity = zoomState ? Math.max(0, Math.min(1, Number(zoomState.opacity ?? 1))) : 1;
    const hasZoomTransform = zoomState && (Math.abs(Number(zoomState.scale || 1) - 1) > 0.001 || zoomOpacity < 0.999);
    const globalAnchorX = frame.left + (frame.width * Math.max(0, Math.min(1, Number(zoomState?.x ?? 0.5))));
    const globalAnchorY = frame.top + (frame.height * Math.max(0, Math.min(1, Number(zoomState?.y ?? 0.46))));
    const frameBySection = new Map((frameStates || []).map((frame) => [Math.max(1, Number(frame?.section || 1)), frame]));
    getActivePreviewSections().forEach((section) => {
      const hosts = getVideoHosts(section);
      const frameState = frameBySection.get(section) || null;
      const baseEffect = getPreviewTransitionHostEffect(frameState, "base", containerWidth, containerHeight, section);
      const overlayEffect = getPreviewTransitionHostEffect(frameState, "overlay", containerWidth, containerHeight, section);
      if (hosts.surface) {
        let zoomTransform = "";
        if (hasZoomTransform) {
          const scale = Math.max(0.001, Number(zoomState.scale || 1));
          const translateX = globalAnchorX - (globalAnchorX * scale);
          const translateY = globalAnchorY - (globalAnchorY * scale);
          zoomTransform = `matrix(${scale.toFixed(6)},0,0,${scale.toFixed(6)},${translateX.toFixed(3)},${translateY.toFixed(3)})`;
        }
        hosts.surface.style.transformOrigin = "0 0";
        hosts.surface.style.transform = zoomTransform || "none";
        hosts.surface.style.opacity = String(hasZoomTransform ? zoomOpacity : 1);
      }
      [
        { host: hosts.base, effect: baseEffect },
        { host: hosts.overlay, effect: overlayEffect }
      ].forEach(({ host, effect }) => {
        if (!host) return;
        host.style.transformOrigin = "0 0";
        host.style.transform = effect?.transform || "none";
        host.style.opacity = "1";
        host.style.filter = effect?.filter || "none";
        host.style.maskImage = effect?.maskImage || "none";
        host.style.webkitMaskImage = effect?.maskImage || "none";
        host.style.maskRepeat = "no-repeat";
        host.style.webkitMaskRepeat = "no-repeat";
        host.style.maskPosition = "0 0";
        host.style.webkitMaskPosition = "0 0";
        host.style.maskSize = "100% 100%";
        host.style.webkitMaskSize = "100% 100%";
      });
    });
  }

  function getPreviewOverlayBox(overlay) {
    if (!overlayEngine || !overlay || !els.dropZone) return null;
    const frame = overlayEngine.getFrameBox(els.dropZone, state.settings.resolutionName, state.settings.aspectRatio);
    const cx = frame.left + frame.width * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
    const cy = frame.top + frame.height * Math.max(0, Math.min(1, Number(overlay.y ?? 0.8)));
    if (overlay.overlayType === "circle") {
      const rx = frame.minSize * Number(overlay.radiusX || overlay.radius || overlay.size || 0.11);
      const ry = frame.minSize * Number(overlay.radiusY || overlay.radius || overlay.size || 0.11);
      return { frame, left: cx - rx, top: cy - ry, width: rx * 2, height: ry * 2 };
    }
    if (overlay.overlayType === "underline") {
      const width = frame.width * Number(overlay.width || overlay.size || 0.24);
      const height = Math.max(14, Number(overlay.lineThickness || 10) * frame.scale * 2.6);
      return { frame, left: cx - (width / 2), top: cy - (height / 2), width, height };
    }
    if (overlay.overlayType === "point_pop_line") {
      const reach = frame.minSize * (Math.max(0.01, Number(overlay.radius || 0.07)) + Math.max(0.01, Number(overlay.lineLength || 0.045)));
      const pad = Math.max(12, Number(overlay.strokeWidth || 5) * frame.scale * 2.4);
      return { frame, left: cx - reach - pad, top: cy - reach - pad, width: (reach + pad) * 2, height: (reach + pad) * 2 };
    }
    if (overlay.overlayType === "checkpoint_pop") {
      const reach = frame.minSize * (Math.max(0.01, Number(overlay.radius || 0.052)) + Math.max(0.01, Number(overlay.lineLength || 0.032)));
      const pad = Math.max(12, Number(overlay.strokeWidth || 4.5) * frame.scale * 2.8);
      return { frame, left: cx - reach - pad, top: cy - reach - pad, width: (reach + pad) * 2, height: (reach + pad) * 2 };
    }
    if (overlay.overlayType === "drop_wave") {
      const baseRadius = frame.minSize * Math.max(0.03, Number(overlay.radius || 0.12));
      const spacing = frame.minSize * Math.max(0.01, Number(overlay.waveSpacing || 0.055));
      const waveCount = Math.max(2, Math.min(8, Math.round(Number(overlay.waveCount || 4))));
      const wobble = frame.minSize * Math.max(0, Number(overlay.amplitude || 0.032)) * 0.65;
      const pad = Math.max(12, frame.scale * (8 + (Number(overlay.softness || 0.64) * 12)));
      const reach = baseRadius + (spacing * waveCount) + wobble;
      return { frame, left: cx - reach - pad, top: cy - reach - pad, width: (reach + pad) * 2, height: (reach + pad) * 2 };
    }
    if (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") {
      const width = frame.width * Math.max(0.08, Number(overlay.boxWidth || 0.34));
      const height = frame.height * Math.max(0.08, Number(overlay.boxHeight || 0.24));
      return { frame, left: cx - (width / 2), top: cy - (height / 2), width, height };
    }
    if (overlay.overlayType === "focus_box_draw" || overlay.overlayType === "soft_spotlight") {
      const width = frame.width * Math.max(0.08, Number(overlay.boxWidth || 0.26));
      const height = frame.height * Math.max(0.08, Number(overlay.boxHeight || 0.16));
      return { frame, left: cx - (width / 2), top: cy - (height / 2), width, height };
    }
    if (overlay.overlayType === "highlight_bar_sweep") {
      const width = frame.width * Math.max(0.08, Number(overlay.width || 0.34));
      const height = Math.max(18, frame.height * Math.max(0.05, Number(overlay.boxHeight || 0.12)));
      return { frame, left: cx - (width / 2), top: cy - (height / 2), width, height };
    }
    if (overlay.overlayType === "section_divider_slide") {
      const width = frame.width * Math.max(0.12, Number(overlay.width || 0.78));
      const height = Math.max(14, Number(overlay.lineThickness || 4) * frame.scale * 4);
      return { frame, left: cx - (width / 2), top: cy - (height / 2), width, height };
    }
    if (overlay.overlayType === "callout_line_draw") {
      const length = frame.minSize * Math.max(0.04, Number(overlay.lineLength || 0.22));
      const angle = (Number(overlay.lineAngle ?? -18) * Math.PI) / 180;
      const x2 = cx + (Math.cos(angle) * length);
      const y2 = cy + (Math.sin(angle) * length);
      const pad = Math.max(12, Number(overlay.strokeWidth || 6) * frame.scale * 2.8);
      return {
        frame,
        left: Math.min(cx, x2) - pad,
        top: Math.min(cy, y2) - pad,
        width: Math.abs(x2 - cx) + (pad * 2),
        height: Math.abs(y2 - cy) + (pad * 2)
      };
    }
    if (overlay.overlayType === "text") {
      const renderedBox = getRenderedPreviewTextBox(overlay, frame);
      if (renderedBox) return renderedBox;
    }
    const textAlign = String(overlay.textAlign || "center");
    const width = frame.width * Math.max(0.12, Number(overlay.boxWidth || 0.26));
    const height = Math.max(28, Number(overlay.fontSize || 64) * frame.scale * 1.45);
    const left = textAlign === "left"
      ? cx
      : (textAlign === "right" ? cx - width : cx - (width / 2));
    return { frame, left, top: cy, width, height };
  }

  function findPreviewOverlayAtPoint(clientX, clientY) {
    if (!els.dropZone) return null;
    const bounds = els.dropZone.getBoundingClientRect();
    const x = Number(clientX || 0) - bounds.left;
    const y = Number(clientY || 0) - bounds.top;
    return [...getActiveOverlayItemsAt(state.ui.currentTime)]
      .sort((a, b) => (
        Number(b.section || 1) - Number(a.section || 1)
        || Number(b.start || 0) - Number(a.start || 0)
        || String(b.id || "").localeCompare(String(a.id || ""))
      ))
      .find((overlay) => {
        const box = getPreviewOverlayBox(overlay);
        if (!box) return false;
        return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
      }) || null;
  }

  function handlePreviewBackgroundSelection(e) {
    if (e.button !== 0 || state.ui.internalDragging) return;
    if (e.target?.closest?.(".previewOverlayBox,.previewOverlayHandle,.previewMotionPathHandle,.previewMotionPathLine")) return;
    const overlay = findPreviewOverlayAtPoint(e.clientX, e.clientY);
    if (overlay?.id) {
      selectSingle("overlay", overlay.id, overlay.section || 1);
      renderAll();
      return;
    }
    if (state.ui.selectedKeys.length) {
      clearSelection();
      renderAll();
    }
  }

  function computeAnchoredResizeRect(startRect, handleName, pointer, frame, minWidth = 20, minHeight = 20) {
    const frameLeft = Number(frame?.left || 0);
    const frameTop = Number(frame?.top || 0);
    const frameRight = frameLeft + Math.max(1, Number(frame?.width || 1));
    const frameBottom = frameTop + Math.max(1, Number(frame?.height || 1));
    const startLeft = Number(startRect?.left || 0);
    const startTop = Number(startRect?.top || 0);
    const startRight = startLeft + Math.max(1, Number(startRect?.width || 1));
    const startBottom = startTop + Math.max(1, Number(startRect?.height || 1));
    const minW = Math.min(Math.max(4, Number(minWidth || 20)), Math.max(4, frameRight - frameLeft));
    const minH = Math.min(Math.max(4, Number(minHeight || 20)), Math.max(4, frameBottom - frameTop));
    let left = startLeft;
    let right = startRight;
    let top = startTop;
    let bottom = startBottom;
    const px = Math.max(frameLeft, Math.min(frameRight, Number(pointer?.x || 0)));
    const py = Math.max(frameTop, Math.min(frameBottom, Number(pointer?.y || 0)));

    if (String(handleName).includes("e")) right = Math.max(left + minW, Math.min(frameRight, px));
    if (String(handleName).includes("w")) left = Math.min(right - minW, Math.max(frameLeft, px));
    if (String(handleName).includes("s")) bottom = Math.max(top + minH, Math.min(frameBottom, py));
    if (String(handleName).includes("n")) top = Math.min(bottom - minH, Math.max(frameTop, py));

    return { left, top, width: Math.max(minW, right - left), height: Math.max(minH, bottom - top) };
  }

  function applyOverlayResizeRect(overlay, before, nextRect, startBox, handleName, shiftKey = false) {
    const frame = startBox?.frame;
    if (!overlay || !before || !frame || !nextRect) return;
    const frameWidth = Math.max(1, Number(frame.width || 1));
    const frameHeight = Math.max(1, Number(frame.height || 1));
    const minSize = Math.max(1, Number(frame.minSize || Math.min(frameWidth, frameHeight)));
    const width = Math.max(4, Number(nextRect.width || 4));
    const height = Math.max(4, Number(nextRect.height || 4));
    const centerX = Number(nextRect.left || 0) + (width / 2);
    const centerY = Number(nextRect.top || 0) + (height / 2);
    const setCenter = () => {
      overlay.x = Math.max(0, Math.min(1, (centerX - Number(frame.left || 0)) / frameWidth));
      overlay.y = Math.max(0, Math.min(1, (centerY - Number(frame.top || 0)) / frameHeight));
    };

    if (overlay.overlayType === "text") {
      const align = String(before.textAlign || "center");
      if (align === "left") overlay.x = Math.max(0, Math.min(1, (Number(nextRect.left || 0) - Number(frame.left || 0)) / frameWidth));
      else if (align === "right") overlay.x = Math.max(0, Math.min(1, ((Number(nextRect.left || 0) + width) - Number(frame.left || 0)) / frameWidth));
      else overlay.x = Math.max(0, Math.min(1, (centerX - Number(frame.left || 0)) / frameWidth));
      overlay.y = Math.max(0, Math.min(1, (Number(nextRect.top || 0) - Number(frame.top || 0)) / frameHeight));
      overlay.boxWidth = Math.max(0.08, Math.min(1, width / frameWidth));
      if (String(handleName || "").includes("n") || String(handleName || "").includes("s")) {
        overlay.fontSize = Math.max(18, height / Math.max(0.1, Number(frame.scale || 1) * 1.45));
      }
      return;
    }

    setCenter();
    if (overlay.overlayType === "circle") {
      overlay.radiusX = Math.max(0.03, width / (minSize * 2));
      overlay.radiusY = Math.max(0.03, height / (minSize * 2));
      if (shiftKey) {
        const unified = Math.max(0.03, (overlay.radiusX + overlay.radiusY) / 2);
        overlay.radiusX = unified;
        overlay.radiusY = unified;
      }
      overlay.radius = Math.max(overlay.radiusX, overlay.radiusY);
      overlay.size = overlay.radius;
    } else if (overlay.overlayType === "underline") {
      overlay.width = Math.max(0.08, Math.min(1, width / frameWidth));
      overlay.size = overlay.width;
      overlay.lineThickness = Math.max(2, height / Math.max(0.1, Number(frame.scale || 1) * 2.6));
    } else if (overlay.overlayType === "point_pop_line" || overlay.overlayType === "checkpoint_pop") {
      const previousTotal = Math.max(0.02, Number(before.radius || 0.06) + Number(before.lineLength || 0.04));
      const radiusShare = Math.max(0.22, Math.min(0.78, Number(before.radius || 0.06) / previousTotal));
      const total = Math.max(0.02, Math.min(0.45, (Math.max(width, height) * 0.5) / minSize));
      overlay.radius = Math.max(0.01, total * radiusShare);
      overlay.lineLength = Math.max(0.01, total * (1 - radiusShare));
      overlay.strokeWidth = Math.max(1, Math.min(24, Math.min(width, height) / Math.max(8, Number(frame.scale || 1) * 9)));
      overlay.durationMs = Math.max(120, Math.round(Number(overlay.duration || before.duration || 0.56) * 1000));
      overlay.jitter = overlay.spreadAmount;
    } else if (overlay.overlayType === "drop_wave") {
      overlay.radius = Math.max(0.03, Math.min(0.5, (Math.min(width, height) * 0.28) / minSize));
      overlay.amplitude = Math.max(0, Math.min(0.12, (Math.abs(width - Number(startBox.width || width)) + Math.abs(height - Number(startBox.height || height))) / (minSize * 10)));
    } else if (overlay.overlayType === "focus_box_draw" || overlay.overlayType === "soft_spotlight" || overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") {
      overlay.boxWidth = Math.max(0.08, Math.min(1, width / frameWidth));
      overlay.boxHeight = Math.max(0.08, Math.min(1, height / frameHeight));
      if (overlay.overlayType === "focus_box_draw") overlay.strokeWidth = Math.max(1, Math.min(24, height / Math.max(8, Number(frame.scale || 1) * 12)));
    } else if (overlay.overlayType === "highlight_bar_sweep") {
      overlay.width = Math.max(0.08, Math.min(1, width / frameWidth));
      overlay.boxHeight = Math.max(0.05, Math.min(1, height / frameHeight));
    } else if (overlay.overlayType === "section_divider_slide") {
      overlay.width = Math.max(0.12, Math.min(1, width / frameWidth));
      overlay.lineThickness = Math.max(2, height / Math.max(0.1, Number(frame.scale || 1) * 4));
    } else if (overlay.overlayType === "callout_line_draw") {
      overlay.lineLength = Math.max(0.04, Math.min(0.8, Math.sqrt((width * width) + (height * height)) / minSize));
      overlay.strokeWidth = Math.max(1, Math.min(24, Math.min(width, height) / Math.max(8, Number(frame.scale || 1) * 8)));
    } else {
      overlay.boxWidth = Math.max(0.12, Math.min(1, width / frameWidth));
      overlay.fontSize = Math.max(18, height / Math.max(0.1, Number(frame.scale || 1) * 1.45));
    }
  }

  function bindPreviewOverlayInteraction(boxEl, handleEls, overlay, box) {
    const axisScale = (handleName, frame) => ({
      xScale: handleName.includes("w") ? -1 : (handleName.includes("e") ? 1 : 0),
      yScale: handleName.includes("n") ? -1 : (handleName.includes("s") ? 1 : 0),
      xUnit: Math.max(1, frame.width),
      yUnit: Math.max(1, frame.height),
      minUnit: Math.max(1, frame.minSize)
    });
    const bindDrag = (target, mode, handleName = "") => {
      target.onmousedown = (e) => {
        if (mode === "move" && e.target?.closest?.(".previewOverlayHandle")) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof target.setPointerCapture === "function" && e.pointerId != null) target.setPointerCapture(e.pointerId);
        } catch {}
        state.ui.previewDragMode = mode;
        const startX = e.clientX;
        const startY = e.clientY;
        const historyBefore = snapshotHistoryState();
        const before = JSON.parse(JSON.stringify(overlay));
        let armed = false;
        const onMove = (mv) => {
          if (state.ui.previewDragMode !== mode) return;
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!armed) {
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            armed = true;
          }
          const frame = box.frame;
          const axes = axisScale(handleName, frame);
          if (mode === "resize") {
            const rootRect = els.dropZone?.getBoundingClientRect?.() || { left: 0, top: 0 };
            const nextRect = computeAnchoredResizeRect(
              box,
              handleName,
              {
                x: Number(mv.clientX || 0) - Number(rootRect.left || 0),
                y: Number(mv.clientY || 0) - Number(rootRect.top || 0)
              },
              frame,
              Math.max(18, Number(frame.minSize || 1) * 0.035),
              Math.max(14, Number(frame.minSize || 1) * 0.03)
            );
            applyOverlayResizeRect(overlay, before, nextRect, box, handleName, !!mv.shiftKey);
            recalcTimeline();
            renderAll();
            return;
          }
          let textResizePositionHandled = false;
          if (mode === "move") {
            overlay.x = Math.max(0, Math.min(1, before.x + (dx / Math.max(1, frame.width))));
            overlay.y = Math.max(0, Math.min(1, before.y + (dy / Math.max(1, frame.height))));
          } else if (overlay.overlayType === "circle") {
            if (axes.xScale !== 0) {
              overlay.radiusX = Math.max(0.03, before.radiusX + ((dx * axes.xScale) / axes.minUnit));
            }
            if (axes.yScale !== 0) {
              overlay.radiusY = Math.max(0.03, before.radiusY + ((dy * axes.yScale) / axes.minUnit));
            }
            if (axes.xScale !== 0 && axes.yScale !== 0) {
              const delta = (((dx * axes.xScale) + (dy * axes.yScale)) / 2) / axes.minUnit;
              overlay.radiusX = Math.max(0.03, before.radiusX + delta);
              overlay.radiusY = Math.max(0.03, before.radiusY + delta);
            }
            overlay.radius = Math.max(overlay.radiusX, overlay.radiusY);
            overlay.size = overlay.radius;
          } else if (overlay.overlayType === "underline") {
            if (axes.xScale !== 0) overlay.width = Math.max(0.08, before.width + ((dx * axes.xScale) / axes.xUnit));
            if (axes.yScale !== 0) overlay.lineThickness = Math.max(2, before.lineThickness + (dy * axes.yScale * 0.28));
            overlay.size = overlay.width;
          } else if (overlay.overlayType === "point_pop_line") {
            if (axes.xScale !== 0) {
              overlay.lineLength = Math.max(0.01, before.lineLength + ((dx * axes.xScale) / axes.minUnit));
              overlay.radius = Math.max(0.01, before.radius + (((dx * axes.xScale) * 0.6) / axes.minUnit));
            }
            if (axes.yScale !== 0) {
              overlay.radius = Math.max(0.01, before.radius + ((dy * axes.yScale) / axes.minUnit));
              overlay.strokeWidth = Math.max(1, before.strokeWidth + (dy * axes.yScale * 0.24));
            }
            overlay.durationMs = Math.max(120, Math.round(Number(overlay.duration || 0.52) * 1000));
            overlay.jitter = overlay.spreadAmount;
          } else if (overlay.overlayType === "checkpoint_pop") {
            if (axes.xScale !== 0) {
              overlay.lineLength = Math.max(0.01, before.lineLength + ((dx * axes.xScale) / axes.minUnit));
              overlay.radius = Math.max(0.01, before.radius + (((dx * axes.xScale) * 0.55) / axes.minUnit));
            }
            if (axes.yScale !== 0) {
              overlay.radius = Math.max(0.01, before.radius + ((dy * axes.yScale) / axes.minUnit));
              overlay.strokeWidth = Math.max(1, before.strokeWidth + (dy * axes.yScale * 0.22));
            }
            overlay.durationMs = Math.max(140, Math.round(Number(overlay.duration || 0.68) * 1000));
            overlay.jitter = overlay.spreadAmount;
          } else if (overlay.overlayType === "drop_wave") {
            if (axes.xScale !== 0) {
              overlay.radius = Math.max(0.03, before.radius + ((dx * axes.xScale) / axes.minUnit));
            }
            if (axes.yScale !== 0) {
              overlay.waveSpacing = Math.max(0.01, before.waveSpacing + ((dy * axes.yScale) / axes.minUnit));
            }
            if (axes.xScale !== 0 && axes.yScale !== 0) {
              overlay.amplitude = Math.max(0, before.amplitude + ((((dx * axes.xScale) + (dy * axes.yScale)) / 2) / axes.minUnit) * 0.25);
              overlay.softness = Math.max(0.05, Math.min(1, before.softness + (((dy * axes.yScale) / axes.minUnit) * 0.45)));
            }
          } else if (overlay.overlayType === "focus_box_draw" || overlay.overlayType === "soft_spotlight") {
            if (axes.xScale !== 0) overlay.boxWidth = Math.max(0.08, before.boxWidth + ((dx * axes.xScale) / axes.xUnit));
            if (axes.yScale !== 0) overlay.boxHeight = Math.max(0.08, before.boxHeight + ((dy * axes.yScale) / axes.yUnit));
            if (overlay.overlayType === "focus_box_draw" && axes.yScale !== 0) {
              overlay.strokeWidth = Math.max(1, before.strokeWidth + (dy * axes.yScale * 0.2));
            }
          } else if (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") {
            if (axes.xScale !== 0) overlay.boxWidth = Math.max(0.08, Math.min(1, before.boxWidth + ((dx * axes.xScale) / axes.xUnit)));
            if (axes.yScale !== 0) overlay.boxHeight = Math.max(0.08, Math.min(1, before.boxHeight + ((dy * axes.yScale) / axes.yUnit)));
          } else if (overlay.overlayType === "highlight_bar_sweep") {
            if (axes.xScale !== 0) overlay.width = Math.max(0.08, before.width + ((dx * axes.xScale) / axes.xUnit));
            if (axes.yScale !== 0) overlay.boxHeight = Math.max(0.05, before.boxHeight + ((dy * axes.yScale) / axes.yUnit));
          } else if (overlay.overlayType === "section_divider_slide") {
            if (axes.xScale !== 0) overlay.width = Math.max(0.12, before.width + ((dx * axes.xScale) / axes.xUnit));
            if (axes.yScale !== 0) overlay.lineThickness = Math.max(2, before.lineThickness + (dy * axes.yScale * 0.2));
          } else if (overlay.overlayType === "callout_line_draw") {
            if (axes.xScale !== 0 || axes.yScale !== 0) {
              const delta = (((dx * axes.xScale) + (dy * axes.yScale)) / 2);
              overlay.lineLength = Math.max(0.04, before.lineLength + (delta / axes.minUnit));
            }
            if (axes.yScale !== 0) overlay.strokeWidth = Math.max(1, before.strokeWidth + (dy * axes.yScale * 0.22));
            if (axes.xScale !== 0 && axes.yScale !== 0) {
              overlay.lineAngle = Math.max(-180, Math.min(180, before.lineAngle + ((dy - dx) * 0.12)));
            }
          } else {
            if (axes.xScale !== 0) overlay.boxWidth = Math.max(0.12, before.boxWidth + ((dx * axes.xScale) / axes.xUnit));
            if (axes.yScale !== 0) overlay.fontSize = Math.max(18, before.fontSize + (dy * axes.yScale * 0.42));
            if (axes.xScale !== 0 && axes.yScale === 0) overlay.fontSize = Math.max(18, before.fontSize + (dx * axes.xScale * 0.22));
            if (mode === "resize") {
              const align = String(before.textAlign || "center");
              const beforeX = Number(before.x ?? 0.5);
              const beforeY = Number(before.y ?? 0.82);
              if (axes.xScale !== 0) {
                if (align === "left" && axes.xScale < 0) {
                  overlay.x = beforeX + (dx / axes.xUnit);
                } else if (align === "right" && axes.xScale > 0) {
                  overlay.x = beforeX + (dx / axes.xUnit);
                } else if (align === "center") {
                  overlay.x = beforeX + ((dx * 0.5) / axes.xUnit);
                } else {
                  overlay.x = beforeX;
                }
              }
              overlay.y = axes.yScale < 0 ? beforeY + (dy / axes.yUnit) : beforeY;
              overlay.x = Math.max(0, Math.min(1, overlay.x));
              overlay.y = Math.max(0, Math.min(1, overlay.y));
              textResizePositionHandled = true;
            }
          }
          if (mode === "resize" && !textResizePositionHandled) {
            if (axes.xScale !== 0) overlay.x = Math.max(0, Math.min(1, before.x + ((dx * 0.5) / axes.xUnit)));
            if (axes.yScale !== 0) overlay.y = Math.max(0, Math.min(1, before.y + ((dy * 0.5) / axes.yUnit)));
          }
          recalcTimeline();
          renderAll();
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (state.ui.previewDragMode === mode) state.ui.previewDragMode = null;
          if (armed) commitHistorySnapshot(historyBefore);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    };
    bindDrag(boxEl, "move");
    handleEls.forEach((handle) => bindDrag(handle, "resize", handle.dataset.handle || ""));
  }

  function getMotionPathGuideForOverlay(overlay) {
    if (!overlay || overlay.overlayType !== "motion_path_move" || !overlay.targetClipId) return null;
    const clip = state.project.videoClips.find((item) => item.id === overlay.targetClipId) || null;
    if (!clip) return null;
    const layout = getPreviewClipLayout(clip, { includeMotion: false });
    if (!layout?.frame) return null;
    const startX = Number(layout.rawLeftAbs || 0) + (Number(layout.rawWidth || 0) / 2);
    const startY = Number(layout.rawTopAbs || 0) + (Number(layout.rawHeight || 0) / 2);
    const endX = startX + (layout.frame.width * clampMotionPathDelta(overlay.deltaX, 0));
    const endY = startY + (layout.frame.height * clampMotionPathDelta(overlay.deltaY, 0));
    const dx = endX - startX;
    const dy = endY - startY;
    return {
      clip,
      frame: layout.frame,
      startX,
      startY,
      endX,
      endY,
      dx,
      dy,
      length: Math.max(2, Math.sqrt((dx * dx) + (dy * dy))),
      angleDeg: Math.atan2(dy, dx) * (180 / Math.PI)
    };
  }

  function bindMotionPathOverlayInteraction(lineEl, endHandleEl, overlay, guide) {
    const targets = [lineEl, endHandleEl].filter(Boolean);
    targets.forEach((target) => {
      target.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const historyBefore = snapshotHistoryState();
        let armed = false;
        const onMove = (mv) => {
          const nextDeltaX = clampMotionPathDelta((mv.clientX - guide.startX) / Math.max(1, guide.frame.width), 0);
          const nextDeltaY = clampMotionPathDelta((mv.clientY - guide.startY) / Math.max(1, guide.frame.height), 0);
          if (!armed) {
            const pxDx = (nextDeltaX - clampMotionPathDelta(overlay.deltaX, 0)) * guide.frame.width;
            const pxDy = (nextDeltaY - clampMotionPathDelta(overlay.deltaY, 0)) * guide.frame.height;
            if (Math.abs(pxDx) < 3 && Math.abs(pxDy) < 3) return;
            armed = true;
          }
          overlay.deltaX = nextDeltaX;
          overlay.deltaY = nextDeltaY;
          state.ui.motionPathDrawOverlayId = overlay.id;
          syncOverlayTiming(overlay);
          recalcTimeline();
          renderTimeline();
          renderPreviewAtTime(state.ui.currentTime);
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (armed) {
            state.ui.motionPathDrawOverlayId = null;
            commitHistorySnapshot(historyBefore);
            renderPreviewAtTime(state.ui.currentTime);
          }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    });
  }

  function renderMotionPathOverlayInteraction(layer, overlay) {
    const guide = getMotionPathGuideForOverlay(overlay);
    if (!layer || !guide) return false;
    const isDrawing = state.ui.motionPathDrawOverlayId === overlay.id;
    const lineEl = document.createElement("div");
    lineEl.className = `previewMotionPathLine${isDrawing ? " isDrawing" : ""}`;
    lineEl.style.left = `${guide.startX.toFixed(3)}px`;
    lineEl.style.top = `${guide.startY.toFixed(3)}px`;
    lineEl.style.width = `${guide.length.toFixed(3)}px`;
    lineEl.style.height = `${Math.max(2, Number(overlay.strokeWidth || 4)).toFixed(3)}px`;
    lineEl.style.transform = `translateY(-50%) rotate(${guide.angleDeg.toFixed(3)}deg)`;
    lineEl.style.background = normalizeColor(overlay.color, "#38bdf8");
    layer.appendChild(lineEl);

    const startHandle = document.createElement("div");
    startHandle.className = "previewMotionPathHandle isStart";
    startHandle.style.left = `${guide.startX.toFixed(3)}px`;
    startHandle.style.top = `${guide.startY.toFixed(3)}px`;
    layer.appendChild(startHandle);

    const endHandle = document.createElement("div");
    endHandle.className = `previewMotionPathHandle${isDrawing ? " isDrawing" : ""}`;
    endHandle.style.left = `${guide.endX.toFixed(3)}px`;
    endHandle.style.top = `${guide.endY.toFixed(3)}px`;
    layer.appendChild(endHandle);

    const label = document.createElement("div");
    label.className = "previewMotionPathLabel";
    label.style.left = `${((guide.startX + guide.endX) / 2).toFixed(3)}px`;
    label.style.top = `${(Math.min(guide.startY, guide.endY) - 18).toFixed(3)}px`;
    label.textContent = isDrawing
      ? `경로 그리기 · ${formatTimelineSec(overlay.duration || 1.2)}s`
      : `${formatTimelineSec(overlay.duration || 1.2)}s 이동`;
    layer.appendChild(label);

    bindMotionPathOverlayInteraction(lineEl, endHandle, overlay, guide);
    return true;
  }

  function bindPreviewVideoInteraction(boxEl, handleEls, rotateHandleEl, clip, box) {
    const axisScale = (handleName, frame) => ({
      xScale: handleName.includes("w") ? -1 : (handleName.includes("e") ? 1 : 0),
      yScale: handleName.includes("n") ? -1 : (handleName.includes("s") ? 1 : 0),
      xUnit: Math.max(1, box.width),
      yUnit: Math.max(1, box.height),
      rawXUnit: Math.max(1, box.rawWidth),
      rawYUnit: Math.max(1, box.rawHeight),
      frameXUnit: Math.max(1, frame.width),
      frameYUnit: Math.max(1, frame.height)
    });
    const refreshSectionPreview = () => {
      applyPreviewClipVisualsForSection(Math.max(1, Number(clip?.section || 1)));
      renderPreviewVideoInteraction(transport ? transport.getCurrentTime() : state.ui.currentTime);
      renderVideoInspector();
    };
    const refresh = () => {
      refreshSectionPreview();
    };
    const bindDrag = (target, action, handleName = "") => {
      if (!target) return;
      target.ondragstart = () => false;
      target.style.touchAction = "none";
      target.onmousedown = (e) => {
        if (action === "move" && e.target?.closest?.(".previewVideoHandle,.previewVideoRotateHandle")) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof target.setPointerCapture === "function" && e.pointerId != null) target.setPointerCapture(e.pointerId);
        } catch {}
        state.ui.previewDragMode = action;
        const startX = e.clientX;
        const startY = e.clientY;
        const historyBefore = snapshotHistoryState();
        const before = JSON.parse(JSON.stringify(clip));
        const beforeBox = getPreviewVideoBox(before);
        let armed = false;
        const onMove = (mv) => {
          if (state.ui.previewDragMode !== action) return;
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!armed) {
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
            armed = true;
          }
          const frame = box.layout.frame;
          const axes = axisScale(handleName, frame);
          if (action === "resize" && beforeBox?.layout) {
            const rootRect = els.dropZone?.getBoundingClientRect?.() || { left: 0, top: 0 };
            const nextRect = computeAnchoredResizeRect(
              beforeBox,
              handleName,
              {
                x: Number(mv.clientX || 0) - Number(rootRect.left || 0),
                y: Number(mv.clientY || 0) - Number(rootRect.top || 0)
              },
              frame,
              Math.max(24, Number(frame.minSize || 1) * 0.05),
              Math.max(24, Number(frame.minSize || 1) * 0.05)
            );
            clip.positionX = Math.max(-0.5, Math.min(1.5, ((Number(nextRect.left || 0) + (Number(nextRect.width || 0) / 2)) - Number(frame.left || 0)) / Math.max(1, Number(frame.width || 1))));
            clip.positionY = Math.max(-0.5, Math.min(1.5, ((Number(nextRect.top || 0) + (Number(nextRect.height || 0) / 2)) - Number(frame.top || 0)) / Math.max(1, Number(frame.height || 1))));
            clip.scaleX = Math.max(0.1, Number(before.scaleX || 1) * (Number(nextRect.width || beforeBox.width || 1) / Math.max(1, Number(beforeBox.width || 1))));
            clip.scaleY = Math.max(0.1, Number(before.scaleY || 1) * (Number(nextRect.height || beforeBox.height || 1) / Math.max(1, Number(beforeBox.height || 1))));
            if (mv.shiftKey) {
              const unified = Math.max(0.1, ((Number(clip.scaleX || 1) + Number(clip.scaleY || 1)) * 0.5));
              clip.scaleX = unified;
              clip.scaleY = unified;
            }
            clip.placementPreset = "custom";
          } else if (action === "rotate" && beforeBox?.layout) {
            const pivotX = Number(beforeBox.layout.rawLeftAbs || 0) + Number(beforeBox.layout.transformOriginX || 0);
            const pivotY = Number(beforeBox.layout.rawTopAbs || 0) + Number(beforeBox.layout.transformOriginY || 0);
            const startAngle = Math.atan2(startY - pivotY, startX - pivotX) * (180 / Math.PI);
            const currentAngle = Math.atan2(mv.clientY - pivotY, mv.clientX - pivotX) * (180 / Math.PI);
            clip.rotation = clampVideoRotationDeg(Number(before.rotation || 0) + normalizeAngleDeltaDeg(currentAngle - startAngle));
            clip.placementPreset = "custom";
          } else if (action === "move") {
            clip.positionX = Math.max(-0.5, Math.min(1.5, Number(before.positionX ?? 0.5) + (dx / Math.max(1, frame.width))));
            clip.positionY = Math.max(-0.5, Math.min(1.5, Number(before.positionY ?? 0.5) + (dy / Math.max(1, frame.height))));
            clip.placementPreset = "custom";
          } else if (beforeBox) {
            const xDelta = axes.xScale !== 0 ? ((dx * axes.xScale) / axes.xUnit) : 0;
            const yDelta = axes.yScale !== 0 ? ((dy * axes.yScale) / axes.yUnit) : 0;
            if (axes.xScale !== 0 && axes.yScale !== 0) {
              const next = Math.max(0.1, 1 + ((xDelta + yDelta) * 0.5));
              clip.scaleX = Math.max(0.1, Number(before.scaleX || 1) * next);
              clip.scaleY = Math.max(0.1, Number(before.scaleY || 1) * next);
            } else {
              if (axes.xScale !== 0) clip.scaleX = Math.max(0.1, Number(before.scaleX || 1) * Math.max(0.1, 1 + xDelta));
              if (axes.yScale !== 0) clip.scaleY = Math.max(0.1, Number(before.scaleY || 1) * Math.max(0.1, 1 + yDelta));
            }
            if (mv.shiftKey) {
              const unified = Math.max(0.1, ((Number(clip.scaleX || 1) + Number(clip.scaleY || 1)) * 0.5));
              clip.scaleX = unified;
              clip.scaleY = unified;
            }
            clip.placementPreset = "custom";
          }
          initVideoClipFields(clip, {
            defaultSourceIn: getClipSourceIn(clip, 0),
            defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
          });
          refresh();
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (state.ui.previewDragMode === action) state.ui.previewDragMode = null;
          if (armed) commitHistorySnapshot(historyBefore);
          else refresh();
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    };
    bindDrag(boxEl, "move");
    handleEls.forEach((handle) => bindDrag(handle, "resize", handle.dataset.handle || ""));
    if (rotateHandleEl) bindDrag(rotateHandleEl, "rotate");
  }

  function bindPreviewVideoCropInteraction(boxEl, handleEls, clip, box) {
    const refresh = () => {
      renderPreviewAtTime(state.ui.currentTime);
      renderVideoInspector();
    };
    const bindDrag = (target, mode, handleName = "") => {
      target.onmousedown = (e) => {
        if (mode === "move" && e.target?.closest?.(".previewVideoHandle,.cropPreviewHandle")) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof target.setPointerCapture === "function" && e.pointerId != null) target.setPointerCapture(e.pointerId);
        } catch {}
        state.ui.previewDragMode = mode;
        const startX = e.clientX;
        const startY = e.clientY;
        const before = normalizeVideoCropDraft(getVideoCropDraftForClip(clip) || {
          clipId: clip.id,
          cropLeft: clip.cropLeft,
          cropRight: clip.cropRight,
          cropTop: clip.cropTop,
          cropBottom: clip.cropBottom
        });
        const cropSpanX = Math.max(0, Number(before.cropLeft || 0) + Number(before.cropRight || 0));
        const cropSpanY = Math.max(0, Number(before.cropTop || 0) + Number(before.cropBottom || 0));
        let armed = false;
        const onMove = (mv) => {
          if (state.ui.previewDragMode !== mode) return;
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!armed) {
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
            armed = true;
          }
          const xUnit = Math.max(1, Number(box.rawWidth || box.width || 1));
          const yUnit = Math.max(1, Number(box.rawHeight || box.height || 1));
          const nextDraft = { ...before };
          if (mode === "move") {
            const nextLeft = Math.max(0, Math.min(cropSpanX, Number(before.cropLeft || 0) + (dx / xUnit)));
            const nextTop = Math.max(0, Math.min(cropSpanY, Number(before.cropTop || 0) + (dy / yUnit)));
            nextDraft.cropLeft = nextLeft;
            nextDraft.cropRight = Math.max(0, cropSpanX - nextLeft);
            nextDraft.cropTop = nextTop;
            nextDraft.cropBottom = Math.max(0, cropSpanY - nextTop);
          } else {
            if (handleName.includes("w")) nextDraft.cropLeft = Math.max(0, Math.min(0.92, Number(before.cropLeft || 0) + (dx / xUnit)));
            if (handleName.includes("e")) nextDraft.cropRight = Math.max(0, Math.min(0.92, Number(before.cropRight || 0) - (dx / xUnit)));
            if (handleName.includes("n")) nextDraft.cropTop = Math.max(0, Math.min(0.92, Number(before.cropTop || 0) + (dy / yUnit)));
            if (handleName.includes("s")) nextDraft.cropBottom = Math.max(0, Math.min(0.92, Number(before.cropBottom || 0) - (dy / yUnit)));
          }
          applyVideoCropDraft(nextDraft);
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (state.ui.previewDragMode === mode) state.ui.previewDragMode = null;
          if (!armed) refresh();
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    };
    bindDrag(boxEl, "move");
    handleEls.forEach((handle) => bindDrag(handle, "resize", handle.dataset.handle || ""));
  }

  function renderPreviewVideoInteraction(timeSec) {
    const layer = ensurePreviewInteractionLayer();
    if (!layer) return;
    layer.innerHTML = "";
    const clip = getSelectedActiveVideoAt(timeSec);
    if (!clip) return;
    const cropMode = isVideoCropModeActive(clip);
    const box = cropMode ? getPreviewVideoCropBox(clip) : getPreviewVideoBox(clip);
    if (!box) return;

    const boxEl = document.createElement("div");
    boxEl.className = `previewVideoBox${cropMode ? " cropMode" : ""}`;
    boxEl.style.left = `${Math.round(box.left)}px`;
    boxEl.style.top = `${Math.round(box.top)}px`;
    boxEl.style.width = `${Math.max(20, Math.round(box.width))}px`;
    boxEl.style.height = `${Math.max(20, Math.round(box.height))}px`;

    const label = document.createElement("div");
    label.className = "previewVideoLabel";
    label.textContent = cropMode
      ? `${clip.name || t("genericClip", "Clip")} ${t("videoCrop", "Crop")} / Enter 적용`
      : `${clip.name || t("genericClip", "Clip")} ${t("videoTransform", "Transform")}`;
    boxEl.appendChild(label);

    let rotateHandle = null;
    if (!cropMode) {
      const rotateArm = document.createElement("div");
      rotateArm.className = "previewVideoRotateArm";
      boxEl.appendChild(rotateArm);

      rotateHandle = document.createElement("div");
      rotateHandle.className = "previewVideoRotateHandle";
      rotateHandle.title = "드래그해서 회전";
      rotateHandle.setAttribute("aria-label", "드래그해서 회전");
      rotateHandle.textContent = "↻";
      boxEl.appendChild(rotateHandle);
    }

    const handles = (cropMode ? ["ne", "nw", "se", "sw"] : ["n", "s", "e", "w", "ne", "nw", "se", "sw"]).map((name) => {
      const handle = document.createElement("div");
      handle.className = "previewVideoHandle";
      handle.dataset.handle = name;
      boxEl.appendChild(handle);
      return handle;
    });

    layer.appendChild(boxEl);
    if (cropMode) bindPreviewVideoCropInteraction(boxEl, handles, clip, box);
    else bindPreviewVideoInteraction(boxEl, handles, rotateHandle, clip, box);
  }

  function isVideoCropModalOpen() {
    return !!state.ui.videoCropModalOpen && !!els.videoCropModal && !els.videoCropModal.classList.contains("hidden");
  }

  function getCropModalClip() {
    return getSelectedVideoClip();
  }

  function closeVideoCropModal() {
    exitVideoCropMode();
  }

  function openVideoCropModal() {
    beginVideoCropMode();
  }

  function getCropPreviewMediaBox(clip) {
    if (!clip || !els.videoCropPreviewFrame) return null;
    const frameRect = els.videoCropPreviewFrame.getBoundingClientRect();
    const frameWidth = Math.max(1, Number(frameRect.width || els.videoCropPreviewFrame.clientWidth || 0));
    const frameHeight = Math.max(1, Number(frameRect.height || els.videoCropPreviewFrame.clientHeight || 0));
    if (frameWidth < 2 || frameHeight < 2) return null;
    const mediaWidth = Math.max(2, Number(clip.meta?.width || els.videoCropPreviewVideo?.videoWidth || 1280));
    const mediaHeight = Math.max(2, Number(clip.meta?.height || els.videoCropPreviewVideo?.videoHeight || 720));
    const scale = Math.min(frameWidth / mediaWidth, frameHeight / mediaHeight);
    const width = mediaWidth * scale;
    const height = mediaHeight * scale;
    const left = (frameWidth - width) / 2;
    const top = (frameHeight - height) / 2;
    return {
      frameWidth,
      frameHeight,
      mediaWidth,
      mediaHeight,
      left,
      top,
      width,
      height
    };
  }

  function bindCropPreviewInteraction(boxEl, handleEls, clip, mediaBox) {
    const refresh = () => {
      renderPreviewAtTime(state.ui.currentTime);
      renderVideoInspector();
      renderVideoCropModalPreview(state.ui.currentTime);
    };
    const bindDrag = (target, mode, handleName = "") => {
      target.onmousedown = (e) => {
        if (mode === "move" && e.target?.closest?.(".cropPreviewHandle")) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof target.setPointerCapture === "function" && e.pointerId != null) target.setPointerCapture(e.pointerId);
        } catch {}
        state.ui.previewDragMode = mode;
        const startX = e.clientX;
        const startY = e.clientY;
        const historyBefore = snapshotHistoryState();
        const before = JSON.parse(JSON.stringify(clip));
        const cropSpanX = Math.max(0, Number(before.cropLeft || 0) + Number(before.cropRight || 0));
        const cropSpanY = Math.max(0, Number(before.cropTop || 0) + Number(before.cropBottom || 0));
        let armed = false;
        const onMove = (mv) => {
          if (state.ui.previewDragMode !== mode) return;
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!armed) {
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
            armed = true;
          }
          const xUnit = Math.max(1, mediaBox.width);
          const yUnit = Math.max(1, mediaBox.height);
          if (mode === "move") {
            const nextLeft = Math.max(0, Math.min(cropSpanX, Number(before.cropLeft || 0) + (dx / xUnit)));
            const nextTop = Math.max(0, Math.min(cropSpanY, Number(before.cropTop || 0) + (dy / yUnit)));
            clip.cropLeft = nextLeft;
            clip.cropRight = Math.max(0, cropSpanX - nextLeft);
            clip.cropTop = nextTop;
            clip.cropBottom = Math.max(0, cropSpanY - nextTop);
          } else {
            if (handleName.includes("w")) clip.cropLeft = Math.max(0, Math.min(0.92, Number(before.cropLeft || 0) + (dx / xUnit)));
            if (handleName.includes("e")) clip.cropRight = Math.max(0, Math.min(0.92, Number(before.cropRight || 0) - (dx / xUnit)));
            if (handleName.includes("n")) clip.cropTop = Math.max(0, Math.min(0.92, Number(before.cropTop || 0) + (dy / yUnit)));
            if (handleName.includes("s")) clip.cropBottom = Math.max(0, Math.min(0.92, Number(before.cropBottom || 0) - (dy / yUnit)));
          }
          initVideoClipFields(clip, {
            defaultSourceIn: getClipSourceIn(clip, 0),
            defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
          });
          refresh();
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (state.ui.previewDragMode === mode) state.ui.previewDragMode = null;
          if (armed) commitHistorySnapshot(historyBefore);
          else refresh();
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    };
    bindDrag(boxEl, "move");
    handleEls.forEach((handle) => bindDrag(handle, "resize", handle.dataset.handle || ""));
  }

  function renderVideoCropModalPreview(timeSec = state.ui.currentTime) {
    if (!isVideoCropModalOpen()) return;
    const clip = getCropModalClip();
    if (!clip || !els.videoCropPreviewFrame || !els.videoCropPreviewVideo || !els.videoCropPreviewOverlay) {
      closeVideoCropModal();
      return;
    }
    initVideoClipFields(clip, {
      defaultSourceIn: getClipSourceIn(clip, 0),
      defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
    });
    const sourcePath = clip.previewPath || clip.internalPath || clip.sourcePath || clip.originalPath || "";
    if (sourcePath && els.videoCropPreviewVideo.dataset.sourcePath !== sourcePath) {
      els.videoCropPreviewVideo.dataset.sourcePath = sourcePath;
      els.videoCropPreviewVideo.onloadedmetadata = () => {
        if (isVideoCropModalOpen()) renderVideoCropModalPreview(state.ui.currentTime);
      };
      els.videoCropPreviewVideo.src = fileUrl(sourcePath);
      els.videoCropPreviewVideo.load();
    }
    const mediaBox = getCropPreviewMediaBox(clip);
    if (!mediaBox) return;

    els.videoCropPreviewVideo.style.left = `${mediaBox.left.toFixed(3)}px`;
    els.videoCropPreviewVideo.style.top = `${mediaBox.top.toFixed(3)}px`;
    els.videoCropPreviewVideo.style.width = `${mediaBox.width.toFixed(3)}px`;
    els.videoCropPreviewVideo.style.height = `${mediaBox.height.toFixed(3)}px`;

    const localTime = clampClipLocalTime(clip, Number(clip.in || 0) + (Number(timeSec || 0) - Number(clip.start || 0)));
    setVideoTime(els.videoCropPreviewVideo, localTime, { thresholdWhilePaused: 0.02, thresholdWhilePlaying: 0.02 });
    safePauseVideo(els.videoCropPreviewVideo);

    const visibleLeft = mediaBox.left + (mediaBox.width * Number(clip.cropLeft || 0));
    const visibleTop = mediaBox.top + (mediaBox.height * Number(clip.cropTop || 0));
    const visibleWidth = mediaBox.width * Math.max(0.04, 1 - Number(clip.cropLeft || 0) - Number(clip.cropRight || 0));
    const visibleHeight = mediaBox.height * Math.max(0.04, 1 - Number(clip.cropTop || 0) - Number(clip.cropBottom || 0));

    els.videoCropPreviewOverlay.innerHTML = "";
    const boxEl = document.createElement("div");
    boxEl.className = "cropPreviewBox";
    boxEl.style.left = `${visibleLeft.toFixed(3)}px`;
    boxEl.style.top = `${visibleTop.toFixed(3)}px`;
    boxEl.style.width = `${Math.max(18, visibleWidth).toFixed(3)}px`;
    boxEl.style.height = `${Math.max(18, visibleHeight).toFixed(3)}px`;

    const label = document.createElement("div");
    label.className = "cropPreviewLabel";
    label.textContent = `${clip.name || t("genericClip", "Clip")} ${t("videoCrop", "Crop")}`;
    boxEl.appendChild(label);

    const handles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((name) => {
      const handle = document.createElement("div");
      handle.className = "cropPreviewHandle";
      handle.dataset.handle = name;
      boxEl.appendChild(handle);
      return handle;
    });

    els.videoCropPreviewOverlay.appendChild(boxEl);
    bindCropPreviewInteraction(boxEl, handles, clip, mediaBox);
    if (els.videoCropModalMeta) {
      els.videoCropModalMeta.textContent = [
        clip.name || t("genericClip", "Clip"),
        `${Math.round(mediaBox.mediaWidth)}x${Math.round(mediaBox.mediaHeight)}`,
        `${t("cropPreviewSourceLabel", "Source")} ${formatTimelineSec(localTime)}s`
      ].join(" / ");
    }
  }

  function renderPreviewOverlayInteraction(timeSec) {
    const layer = ensurePreviewInteractionLayer();
    if (!layer) return;
    layer.innerHTML = "";
    const overlay = getSelectedActiveOverlayAt(timeSec);
    if (!overlay) return;
    if (overlay.overlayType === "motion_path_move") {
      renderMotionPathOverlayInteraction(layer, overlay);
      return;
    }
    const box = getPreviewOverlayBox(overlay);
    if (!box) return;
    const boxEl = document.createElement("div");
    boxEl.className = "previewOverlayBox" + (isFxOverlayType(overlay.overlayType) ? " selectedFx" : "");
    boxEl.style.left = `${Math.round(box.left)}px`;
    boxEl.style.top = `${Math.round(box.top)}px`;
    boxEl.style.width = `${Math.max(20, Math.round(box.width))}px`;
    boxEl.style.height = `${Math.max(20, Math.round(box.height))}px`;
    const handles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((name) => {
      const handle = document.createElement("div");
      handle.className = "previewOverlayHandle";
      handle.dataset.handle = name;
      boxEl.appendChild(handle);
      return handle;
    });
    layer.appendChild(boxEl);
    bindPreviewOverlayInteraction(boxEl, handles, overlay, box);
  }

  function renderOverlayInspector() {
    const overlay = getSelectedOverlayItem();
    const hasTextOverlay = !!overlay && overlay.overlayType === "text";
    if (els.overlayInspectorEmpty) {
      if (!overlay) els.overlayInspectorEmpty.textContent = "텍스트 overlay clip을 선택하면 여기서 바로 수정할 수 있습니다.";
      else if (overlay.overlayType !== "text") els.overlayInspectorEmpty.textContent = "FX clip은 타임라인의 gear 버튼으로 옵션을 조절합니다.";
      els.overlayInspectorEmpty.classList.toggle("hidden", hasTextOverlay);
    }
    els.overlayInspectorForm?.classList.toggle("hidden", !hasTextOverlay);
    if (!overlay || overlay.overlayType !== "text") return;

    if (els.overlayTextInput && els.overlayTextInput.value !== overlay.text) els.overlayTextInput.value = overlay.text;
    if (els.overlayFontSizeInput) els.overlayFontSizeInput.value = String(Math.round(Number(overlay.fontSize || 64)));
    if (els.overlayFontSizeValue) els.overlayFontSizeValue.textContent = `${Math.round(Number(overlay.fontSize || 64))}px`;
    if (els.overlayOpacityInput) els.overlayOpacityInput.value = String(Number(overlay.opacity ?? 1));
    if (els.overlayOpacityValue) els.overlayOpacityValue.textContent = `${Math.round(Number(overlay.opacity ?? 1) * 100)}%`;
    const fadeMax = snapTimelineTimeSec(Math.max(0, Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 2)) - MIN_OVERLAY_CLIP_SEC));
    if (els.overlayFadeInInput) {
      els.overlayFadeInInput.max = String(fadeMax);
      els.overlayFadeInInput.value = String(Math.min(fadeMax, Number(overlay.manualFadeInSec || 0)));
    }
    if (els.overlayFadeInValue) els.overlayFadeInValue.textContent = `${formatTimelineSec(Math.min(fadeMax, Number(overlay.manualFadeInSec || 0)))}s`;
    if (els.overlayFadeOutInput) {
      els.overlayFadeOutInput.max = String(fadeMax);
      els.overlayFadeOutInput.value = String(Math.min(fadeMax, Number(overlay.manualFadeOutSec || 0)));
    }
    if (els.overlayFadeOutValue) els.overlayFadeOutValue.textContent = `${formatTimelineSec(Math.min(fadeMax, Number(overlay.manualFadeOutSec || 0)))}s`;
    if (els.overlayTransitionInTypeInput) els.overlayTransitionInTypeInput.value = normalizeTextOverlayTransitionType(overlay.transitionInType);
    if (els.overlayTransitionOutTypeInput) els.overlayTransitionOutTypeInput.value = normalizeTextOverlayTransitionType(overlay.transitionOutType);
    const transitionDurationMax = snapTimelineTimeSec(Math.max(0, Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 2)) - TIMELINE_TIME_STEP_SEC));
    if (els.overlayTransitionInDurationInput) {
      els.overlayTransitionInDurationInput.max = String(Math.max(TIMELINE_TIME_STEP_SEC, transitionDurationMax));
      els.overlayTransitionInDurationInput.value = String(Math.min(transitionDurationMax, Number(overlay.transitionInDurationSec || 0)));
      els.overlayTransitionInDurationInput.disabled = normalizeTextOverlayTransitionType(overlay.transitionInType) === "none";
    }
    if (els.overlayTransitionInDurationValue) els.overlayTransitionInDurationValue.textContent = `${formatTimelineSec(Math.min(transitionDurationMax, Number(overlay.transitionInDurationSec || 0)))}s`;
    if (els.overlayTransitionOutDurationInput) {
      els.overlayTransitionOutDurationInput.max = String(Math.max(TIMELINE_TIME_STEP_SEC, transitionDurationMax));
      els.overlayTransitionOutDurationInput.value = String(Math.min(transitionDurationMax, Number(overlay.transitionOutDurationSec || 0)));
      els.overlayTransitionOutDurationInput.disabled = normalizeTextOverlayTransitionType(overlay.transitionOutType) === "none";
    }
    if (els.overlayTransitionOutDurationValue) els.overlayTransitionOutDurationValue.textContent = `${formatTimelineSec(Math.min(transitionDurationMax, Number(overlay.transitionOutDurationSec || 0)))}s`;
    if (els.overlayTransitionStrengthInput) els.overlayTransitionStrengthInput.value = String(Math.max(0.4, Math.min(1.6, Number(overlay.transitionStrength ?? 1))));
    if (els.overlayTransitionStrengthValue) els.overlayTransitionStrengthValue.textContent = `${Math.max(0.4, Math.min(1.6, Number(overlay.transitionStrength ?? 1))).toFixed(2)}x`;
    if (els.overlayPosXInput) els.overlayPosXInput.value = String(Number(overlay.x ?? 0.5));
    if (els.overlayPosXValue) els.overlayPosXValue.textContent = `${Math.round(Number(overlay.x ?? 0.5) * 100)}%`;
    if (els.overlayPosYInput) els.overlayPosYInput.value = String(Number(overlay.y ?? 0.82));
    if (els.overlayPosYValue) els.overlayPosYValue.textContent = `${Math.round(Number(overlay.y ?? 0.82) * 100)}%`;
    if (els.overlayColorInput) els.overlayColorInput.value = normalizeColor(overlay.color, "#ffffff");
    if (els.overlayNoFillInput) els.overlayNoFillInput.checked = !!overlay.noFill;
    if (els.overlayStrokeColorInput) els.overlayStrokeColorInput.value = normalizeColor(overlay.strokeColor, "#000000");
    if (els.overlayNoStrokeInput) els.overlayNoStrokeInput.checked = !!overlay.noStroke;
    if (els.overlayStrokeWidthInput) els.overlayStrokeWidthInput.value = String(Math.round(Number(overlay.strokeWidth || 0)));
    if (els.overlayStrokeWidthValue) els.overlayStrokeWidthValue.textContent = `${Math.round(Number(overlay.strokeWidth || 0))}px`;
    if (els.overlayFontWeightInput) els.overlayFontWeightInput.value = String(overlay.fontWeight || "700");
    refreshFontFamilySelect(String(overlay.fontFamily || "Malgun Gothic"), String(overlay.fontFile || ""));
    if (els.overlayTextAlignInput) els.overlayTextAlignInput.value = String(overlay.textAlign || "center");
  }

  function focusVideoInspector() {
    toolSheetController?.switchTo?.("clips");
  }

  function ensureVideoChromaKeyDefaults(clip) {
    if (!clip) return;
    const chroma = getVideoChromaKeyState(clip);
    clip.chromaKeyEnabled = !!chroma.enabled;
    clip.chromaKeyColor = chroma.color;
    clip.chromaKeySimilarity = chroma.similarity;
    clip.chromaKeyBlend = chroma.blend;
    clip.chromaKeyReflectionTolerance = chroma.reflectionTolerance;
  }

  function resolveVideoClipDropTarget(clientX, clientY) {
    const directHit = document.elementFromPoint(clientX, clientY)?.closest?.('.videoClip[data-kind="video"]');
    const directClipId = directHit?.dataset?.clipId || "";
    if (directClipId) {
      return state.project.videoClips.find((clip) => clip.id === directClipId) || null;
    }
    const candidates = [...(els.videoLane?.querySelectorAll?.('.videoClip[data-kind="video"]') || [])];
    let matchedClipId = "";
    let matchedArea = Number.POSITIVE_INFINITY;
    candidates.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const hitPaddingX = Math.max(6, Math.min(14, rect.width * 0.12));
      const hitPaddingY = Math.max(6, Math.min(14, rect.height * 0.25));
      const withinX = clientX >= rect.left - hitPaddingX && clientX <= rect.right + hitPaddingX;
      const withinY = clientY >= rect.top - hitPaddingY && clientY <= rect.bottom + hitPaddingY;
      if (!withinX || !withinY) return;
      const area = rect.width * rect.height;
      if (area <= matchedArea) {
        matchedArea = area;
        matchedClipId = String(node.dataset?.clipId || "");
      }
    });
    if (!matchedClipId) return null;
    return state.project.videoClips.find((clip) => clip.id === matchedClipId) || null;
  }

  function getActiveVideoClipAt(timeSec, preferredSection = null) {
    const time = Math.max(0, Number(timeSec || 0));
    const matches = (state.project.videoClips || []).filter((clip) => {
      const start = Math.max(0, Number(clip?.start || 0));
      const end = start + Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(clip));
      return time >= start - 1e-6 && time <= end + 1e-6;
    });
    if (!matches.length) return null;
    const section = Math.max(1, Number(preferredSection || state.ui.activeSection?.video || 1));
    return matches.find((clip) => Math.max(1, Number(clip.section || 1)) === section) || matches[0] || null;
  }

  function getDefaultVideoClipForEditTool() {
    return getSelectedVideoClip()
      || getActiveVideoClipAt(state.ui.currentTime)
      || (state.project.videoClips || [])[0]
      || null;
  }

  async function applyChromaKeyToolToClip(targetClip, options = {}) {
    if (!targetClip?.id) return false;
    const targetId = String(targetClip.id);
    const targetSection = Math.max(1, Number(targetClip.section || options.section || 1));
    const applied = runProjectMutationWithHistory(() => {
      const clip = state.project.videoClips.find((item) => item.id === targetId);
      if (!clip) return false;
      ensureVideoChromaKeyDefaults(clip);
      clip.chromaKeyEnabled = true;
      return true;
    });
    if (applied === false) return false;
    selectSingle("video", targetId, targetSection);
    if (options.reveal !== false) {
      const clip = state.project.videoClips.find((item) => item.id === targetId);
      const start = Math.max(0, Number(clip?.start || 0));
      const end = start + Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(clip));
      const now = Number(state.ui.currentTime || 0);
      if (!Number.isFinite(now) || now < start - 1e-6 || now > end + 1e-6) {
        state.ui.currentTime = snapTimelineTimeSec(start);
      }
    }
    focusVideoInspector();
    renderAll();
    await openVideoChromaEyedropper(targetId);
    return true;
  }

  async function activateEditTool(type) {
    if (type !== "chroma_key") return false;
    const targetClip = getDefaultVideoClipForEditTool();
    if (!targetClip) {
      toast("크로마키를 적용할 영상 클립을 먼저 선택하세요.", 1800);
      return false;
    }
    return applyChromaKeyToolToClip(targetClip, { reveal: true });
  }

  async function openVideoChromaEyedropper(clipId = null) {
    const targetClipId = clipId || getSelectedVideoClip()?.id || "";
    const clip = state.project.videoClips.find((item) => item.id === targetClipId) || null;
    if (!clip) return false;
    focusVideoInspector();
    if (typeof window.EyeDropper !== "function") {
      toast("스포이드가 지원되지 않아 일반 색상 선택으로 조절해 주세요.", 1800);
      return false;
    }
    try {
      const picker = new window.EyeDropper();
      const result = await picker.open();
      const picked = normalizeColor(result?.sRGBHex, getVideoChromaKeyState(clip).color);
      if (!picked) return false;
      runProjectMutationWithHistory(() => {
        const target = state.project.videoClips.find((item) => item.id === targetClipId);
        if (!target) return false;
        ensureVideoChromaKeyDefaults(target);
        target.chromaKeyEnabled = true;
        target.chromaKeyColor = picked;
        return true;
      });
      toast(`크로마키 색상: ${picked.toUpperCase()}`, 1600);
      return true;
    } catch (err) {
      if (err?.name !== "AbortError") {
        toast("스포이드 색상 선택을 열지 못했습니다.", 1800);
      }
      return false;
    }
  }

  function getImageCutoutClipById(clipId) {
    return state.project.videoClips.find((item) => item.id === clipId && item.isImage) || null;
  }

  function getImageCutoutSourcePath(clip) {
    return clip?.imageCutoutOriginalPath
      || clip?.stillImagePath
      || clip?.originalPath
      || clip?.sourcePath
      || clip?.previewPath
      || clip?.internalPath
      || "";
  }

  function resetImageCutoutState() {
    imageCutoutState.open = false;
    imageCutoutState.clipId = "";
    imageCutoutState.baseImagePath = "";
    imageCutoutState.baseImage = null;
    imageCutoutState.sourceWidth = 0;
    imageCutoutState.sourceHeight = 0;
    imageCutoutState.displayRect = null;
    imageCutoutState.mask = null;
    imageCutoutState.dirty = false;
    imageCutoutState.tool = "brush";
    imageCutoutState.pointerActive = false;
    imageCutoutState.lastPoint = null;
    imageCutoutState.rectDraft = null;
    imageCutoutState.compositeDirty = true;
  }

  function normalizeImageCutoutRect(rect) {
    if (!rect) return null;
    const x = Math.max(0, Math.min(rect.x0, rect.x1));
    const y = Math.max(0, Math.min(rect.y0, rect.y1));
    const w = Math.max(0, Math.abs(rect.x1 - rect.x0));
    const h = Math.max(0, Math.abs(rect.y1 - rect.y0));
    if (w < 2 || h < 2) return null;
    return { x, y, w, h };
  }

  function ensureImageCutoutMask() {
    const total = Math.max(0, imageCutoutState.sourceWidth * imageCutoutState.sourceHeight);
    if (!imageCutoutState.mask || imageCutoutState.mask.length !== total) {
      imageCutoutState.mask = new Uint8ClampedArray(total);
      imageCutoutState.compositeDirty = true;
    }
  }

  function setImageCutoutTool(tool) {
    imageCutoutState.tool = tool === "rect" ? "rect" : "brush";
    els.btnImageCutoutBrush?.classList.toggle("active", imageCutoutState.tool === "brush");
    els.btnImageCutoutAutoRect?.classList.toggle("active", imageCutoutState.tool === "rect");
    if (els.imageCutoutViewport) els.imageCutoutViewport.dataset.tool = imageCutoutState.tool;
  }

  function getImageCutoutDisplayRect(canvas) {
    const targetCanvas = canvas || els.imageCutoutCanvas;
    if (!targetCanvas || !imageCutoutState.baseImage) return null;
    const bounds = targetCanvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(bounds.width || targetCanvas.clientWidth || targetCanvas.width || 1));
    const cssHeight = Math.max(1, Math.round(bounds.height || targetCanvas.clientHeight || targetCanvas.height || 1));
    const fit = Math.min(
      cssWidth / Math.max(1, imageCutoutState.sourceWidth),
      cssHeight / Math.max(1, imageCutoutState.sourceHeight)
    );
    const drawW = Math.max(1, Math.round(imageCutoutState.sourceWidth * fit));
    const drawH = Math.max(1, Math.round(imageCutoutState.sourceHeight * fit));
    return {
      x: Math.round((cssWidth - drawW) / 2),
      y: Math.round((cssHeight - drawH) / 2),
      width: drawW,
      height: drawH,
      scale: fit,
      canvasWidth: cssWidth,
      canvasHeight: cssHeight
    };
  }

  function imageCutoutEventToSourcePoint(event) {
    const canvas = els.imageCutoutCanvas;
    const rect = imageCutoutState.displayRect || getImageCutoutDisplayRect(canvas);
    if (!canvas || !rect) return null;
    const bounds = canvas.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const clampedX = Math.max(rect.x, Math.min(rect.x + rect.width, localX));
    const clampedY = Math.max(rect.y, Math.min(rect.y + rect.height, localY));
    const sourceX = Math.max(0, Math.min(imageCutoutState.sourceWidth - 1, Math.round((clampedX - rect.x) / rect.scale)));
    const sourceY = Math.max(0, Math.min(imageCutoutState.sourceHeight - 1, Math.round((clampedY - rect.y) / rect.scale)));
    return {
      x: sourceX,
      y: sourceY,
      localX,
      localY,
      inside: localX >= rect.x && localX <= rect.x + rect.width && localY >= rect.y && localY <= rect.y + rect.height
    };
  }

  function markImageCutoutDirty() {
    imageCutoutState.dirty = true;
    imageCutoutState.compositeDirty = true;
  }

  function paintImageCutoutAt(point, radius = 16) {
    if (!point || !imageCutoutState.mask) return;
    const r = Math.max(2, Math.round(radius));
    const r2 = r * r;
    const minX = Math.max(0, point.x - r);
    const maxX = Math.min(imageCutoutState.sourceWidth - 1, point.x + r);
    const minY = Math.max(0, point.y - r);
    const maxY = Math.min(imageCutoutState.sourceHeight - 1, point.y + r);
    for (let y = minY; y <= maxY; y += 1) {
      const dy = y - point.y;
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - point.x;
        if ((dx * dx) + (dy * dy) > r2) continue;
        imageCutoutState.mask[(y * imageCutoutState.sourceWidth) + x] = 255;
      }
    }
  }

  function paintImageCutoutStroke(fromPoint, toPoint, radius = 16) {
    if (!fromPoint || !toPoint) return;
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, radius * 0.35)));
    for (let i = 0; i <= steps; i += 1) {
      const t0 = i / steps;
      paintImageCutoutAt({
        x: Math.round(fromPoint.x + (dx * t0)),
        y: Math.round(fromPoint.y + (dy * t0))
      }, radius);
    }
    markImageCutoutDirty();
  }

  function applyImageCutoutAutoRect(rect) {
    const normalized = normalizeImageCutoutRect(rect);
    if (!normalized || !imageCutoutState.baseImage) return false;
    ensureImageCutoutMask();
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = imageCutoutState.sourceWidth;
    srcCanvas.height = imageCutoutState.sourceHeight;
    const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
    srcCtx.drawImage(imageCutoutState.baseImage, 0, 0, imageCutoutState.sourceWidth, imageCutoutState.sourceHeight);
    const imageData = srcCtx.getImageData(0, 0, imageCutoutState.sourceWidth, imageCutoutState.sourceHeight).data;

    const borderSamples = [];
    const sampleAt = (x, y) => {
      const ix = Math.max(0, Math.min(imageCutoutState.sourceWidth - 1, x));
      const iy = Math.max(0, Math.min(imageCutoutState.sourceHeight - 1, y));
      const index = ((iy * imageCutoutState.sourceWidth) + ix) * 4;
      borderSamples.push([
        imageData[index],
        imageData[index + 1],
        imageData[index + 2]
      ]);
    };
    for (let x = normalized.x; x < normalized.x + normalized.w; x += Math.max(1, Math.round(normalized.w / 48))) {
      sampleAt(x, normalized.y);
      sampleAt(x, normalized.y + normalized.h - 1);
    }
    for (let y = normalized.y; y < normalized.y + normalized.h; y += Math.max(1, Math.round(normalized.h / 48))) {
      sampleAt(normalized.x, y);
      sampleAt(normalized.x + normalized.w - 1, y);
    }
    if (!borderSamples.length) return false;

    const avg = borderSamples.reduce((acc, rgb) => {
      acc[0] += rgb[0];
      acc[1] += rgb[1];
      acc[2] += rgb[2];
      return acc;
    }, [0, 0, 0]).map((value) => value / borderSamples.length);
    const variance = borderSamples.reduce((acc, rgb) => {
      const dr = rgb[0] - avg[0];
      const dg = rgb[1] - avg[1];
      const db = rgb[2] - avg[2];
      return acc + Math.sqrt((dr * dr) + (dg * dg) + (db * db));
    }, 0) / borderSamples.length;
    const threshold = Math.max(24, Math.min(96, 28 + (variance * 1.15)));

    imageCutoutState.mask.fill(0);
    for (let y = normalized.y; y < normalized.y + normalized.h; y += 1) {
      for (let x = normalized.x; x < normalized.x + normalized.w; x += 1) {
        const index = ((y * imageCutoutState.sourceWidth) + x) * 4;
        const dr = imageData[index] - avg[0];
        const dg = imageData[index + 1] - avg[1];
        const db = imageData[index + 2] - avg[2];
        const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
        const alpha = imageData[index + 3];
        if (alpha > 10 && distance >= threshold) {
          imageCutoutState.mask[(y * imageCutoutState.sourceWidth) + x] = 255;
        }
      }
    }

    const softenRadius = 1;
    const softened = new Uint8ClampedArray(imageCutoutState.mask.length);
    for (let y = 0; y < imageCutoutState.sourceHeight; y += 1) {
      for (let x = 0; x < imageCutoutState.sourceWidth; x += 1) {
        let total = 0;
        let count = 0;
        for (let oy = -softenRadius; oy <= softenRadius; oy += 1) {
          const yy = y + oy;
          if (yy < 0 || yy >= imageCutoutState.sourceHeight) continue;
          for (let ox = -softenRadius; ox <= softenRadius; ox += 1) {
            const xx = x + ox;
            if (xx < 0 || xx >= imageCutoutState.sourceWidth) continue;
            total += imageCutoutState.mask[(yy * imageCutoutState.sourceWidth) + xx];
            count += 1;
          }
        }
        softened[(y * imageCutoutState.sourceWidth) + x] = count ? Math.round(total / count) : 0;
      }
    }
    imageCutoutState.mask = softened;
    markImageCutoutDirty();
    return true;
  }

  function rebuildImageCutoutComposite() {
    if (!imageCutoutState.baseImage || !imageCutoutState.mask) return;
    const width = imageCutoutState.sourceWidth;
    const height = imageCutoutState.sourceHeight;
    const alphaCanvas = imageCutoutState.alphaCanvas;
    const compositeCanvas = imageCutoutState.compositeCanvas;
    alphaCanvas.width = width;
    alphaCanvas.height = height;
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const alphaCtx = alphaCanvas.getContext("2d", { willReadFrequently: true });
    const alphaImage = alphaCtx.createImageData(width, height);
    for (let i = 0; i < imageCutoutState.mask.length; i += 1) {
      const alpha = imageCutoutState.mask[i];
      const offset = i * 4;
      alphaImage.data[offset] = 255;
      alphaImage.data[offset + 1] = 255;
      alphaImage.data[offset + 2] = 255;
      alphaImage.data[offset + 3] = alpha;
    }
    alphaCtx.putImageData(alphaImage, 0, 0);
    const compositeCtx = compositeCanvas.getContext("2d");
    compositeCtx.clearRect(0, 0, width, height);
    compositeCtx.drawImage(imageCutoutState.baseImage, 0, 0, width, height);
    compositeCtx.globalCompositeOperation = "destination-in";
    compositeCtx.drawImage(alphaCanvas, 0, 0, width, height);
    compositeCtx.globalCompositeOperation = "source-over";
    suppressImageCutoutEdgeFringe(compositeCtx, width, height);
    imageCutoutState.compositeDirty = false;
  }

  function suppressImageCutoutEdgeFringe(ctx, width, height) {
    if (!ctx || !(width > 0) || !(height > 0)) return;
    const image = ctx.getImageData(0, 0, width, height);
    const src = image.data;
    const next = new Uint8ClampedArray(src);
    const neighborOffsets = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],            [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = ((y * width) + x) * 4;
        const alpha = src[index + 3];
        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;
        for (const [ox, oy] of neighborOffsets) {
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const neighborIndex = ((yy * width) + xx) * 4;
          const neighborAlpha = src[neighborIndex + 3];
          if (neighborAlpha <= 160) continue;
          const w = neighborAlpha / 255;
          r += src[neighborIndex] * w;
          g += src[neighborIndex + 1] * w;
          b += src[neighborIndex + 2] * w;
          weight += w;
        }

        if (alpha <= 2) {
          if (weight > 0.0001) {
            next[index] = Math.round(r / weight);
            next[index + 1] = Math.round(g / weight);
            next[index + 2] = Math.round(b / weight);
          } else {
            next[index] = 0;
            next[index + 1] = 0;
            next[index + 2] = 0;
          }
          next[index + 3] = 0;
          continue;
        }

        if (alpha < 230 && weight > 0.0001) {
          const edgeMix = Math.max(0, Math.min(1, 1 - (alpha / 230)));
          const neighborR = r / weight;
          const neighborG = g / weight;
          const neighborB = b / weight;
          next[index] = Math.round((src[index] * (1 - edgeMix)) + (neighborR * edgeMix));
          next[index + 1] = Math.round((src[index + 1] * (1 - edgeMix)) + (neighborG * edgeMix));
          next[index + 2] = Math.round((src[index + 2] * (1 - edgeMix)) + (neighborB * edgeMix));
        }
      }
    }

    image.data.set(next);
    ctx.putImageData(image, 0, 0);
  }

  function drawImageCutoutEditor() {
    const canvas = els.imageCutoutCanvas;
    if (!canvas) return;
    const rect = getImageCutoutDisplayRect(canvas);
    if (!rect) return;
    imageCutoutState.displayRect = rect;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.canvasWidth * dpr) || canvas.height !== Math.round(rect.canvasHeight * dpr)) {
      canvas.width = Math.round(rect.canvasWidth * dpr);
      canvas.height = Math.round(rect.canvasHeight * dpr);
      canvas.style.width = `${rect.canvasWidth}px`;
      canvas.style.height = `${rect.canvasHeight}px`;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.canvasWidth, rect.canvasHeight);
    if (!imageCutoutState.baseImage) return;
    if (imageCutoutState.compositeDirty) rebuildImageCutoutComposite();

    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.08)";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(imageCutoutState.baseImage, rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(imageCutoutState.compositeCanvas, rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = "rgba(15,23,42,0.32)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);

    if (imageCutoutState.rectDraft) {
      const draft = normalizeImageCutoutRect(imageCutoutState.rectDraft);
      if (draft) {
        const x = rect.x + (draft.x * rect.scale);
        const y = rect.y + (draft.y * rect.scale);
        const w = draft.w * rect.scale;
        const h = draft.h * rect.scale;
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.96)";
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = "rgba(15,23,42,0.82)";
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function loadImageElementFromPath(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.src = fileUrl(imagePath);
    });
  }

  async function openImageCutoutEditor(clipId) {
    const clip = getImageCutoutClipById(clipId);
    if (!clip) return false;
    const imagePath = getImageCutoutSourcePath(clip);
    if (!imagePath) {
      toast("원본 이미지 경로를 찾지 못했습니다.", 1800);
      return false;
    }
    try {
      const image = await loadImageElementFromPath(imagePath);
      resetImageCutoutState();
      imageCutoutState.open = true;
      imageCutoutState.clipId = clip.id;
      imageCutoutState.baseImagePath = imagePath;
      imageCutoutState.baseImage = image;
      imageCutoutState.sourceWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
      imageCutoutState.sourceHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
      imageCutoutState.mask = new Uint8ClampedArray(imageCutoutState.sourceWidth * imageCutoutState.sourceHeight);
      if (imagePath === clip.imageCutoutOriginalPath) {
        const copyCanvas = document.createElement("canvas");
        copyCanvas.width = imageCutoutState.sourceWidth;
        copyCanvas.height = imageCutoutState.sourceHeight;
        const copyCtx = copyCanvas.getContext("2d", { willReadFrequently: true });
        copyCtx.drawImage(image, 0, 0);
        const alphaData = copyCtx.getImageData(0, 0, imageCutoutState.sourceWidth, imageCutoutState.sourceHeight).data;
        for (let i = 0; i < imageCutoutState.mask.length; i += 1) {
          imageCutoutState.mask[i] = alphaData[(i * 4) + 3];
        }
      }
      imageCutoutState.compositeDirty = true;
      imageCutoutState.dirty = false;
      setImageCutoutTool("brush");
      if (els.imageCutoutMeta) {
        const duration = Math.max(MIN_TIMELINE_CLIP_SEC, Number(clip.sourceOut || 5) - Number(clip.sourceIn || 0));
        els.imageCutoutMeta.textContent = `${clip.name || "Image"} · ${imageCutoutState.sourceWidth}x${imageCutoutState.sourceHeight} · ${formatTimelineSec(duration)}s`;
      }
      els.imageCutoutModal?.classList.remove("hidden");
      requestAnimationFrame(() => drawImageCutoutEditor());
      return true;
    } catch (err) {
      toast(String(err?.message || err || "이미지를 열지 못했습니다."), 2000);
      return false;
    }
  }

  async function requestCloseImageCutoutEditor() {
    if (!imageCutoutState.open) return true;
    if (!imageCutoutState.dirty) {
      els.imageCutoutModal?.classList.add("hidden");
      resetImageCutoutState();
      return true;
    }
    const result = await window.pearl?.showImageCutoutCloseDialog?.();
    const approved = result ? result.action === "close" : window.confirm("진행 내역을 잃습니다. 닫으시겠습니까?");
    if (!approved) return false;
    els.imageCutoutModal?.classList.add("hidden");
    resetImageCutoutState();
    return true;
  }

  async function saveImageCutoutEditor() {
    if (!imageCutoutState.open || !imageCutoutState.baseImage || !window.pearl?.saveImageCutoutAsset) return false;
    if (imageCutoutState.compositeDirty) rebuildImageCutoutComposite();
    const clip = getImageCutoutClipById(imageCutoutState.clipId);
    if (!clip) return false;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = imageCutoutState.sourceWidth;
    exportCanvas.height = imageCutoutState.sourceHeight;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(imageCutoutState.compositeCanvas, 0, 0);
    const durationSec = Math.max(MIN_TIMELINE_CLIP_SEC, Number(clip.sourceOut || 5) - Number(clip.sourceIn || 0));
    const result = await window.pearl.saveImageCutoutAsset({
      clipId: clip.id,
      dataUrl: exportCanvas.toDataURL("image/png"),
      durationSec,
      width: exportCanvas.width,
      height: exportCanvas.height
    });
    if (!result?.ok) {
      toast(result?.error || "누끼 저장에 실패했습니다.", 2200);
      return false;
    }
    runProjectMutationWithHistory(() => {
      const target = getImageCutoutClipById(imageCutoutState.clipId);
      if (!target) return false;
      target.imageCutoutOriginalPath = result.pngPath || "";
      target.imageCutoutPreviewPath = result.previewPath || "";
      target.previewPath = result.previewPath || target.previewPath;
      target.internalPath = result.previewPath || target.internalPath;
      target.meta = {
        ...(target.meta || {}),
        width: Number(result.meta?.width || target.meta?.width || imageCutoutState.sourceWidth),
        height: Number(result.meta?.height || target.meta?.height || imageCutoutState.sourceHeight),
        isImage: true,
        hasAlphaCutout: true
      };
      return true;
    });
    els.imageCutoutModal?.classList.add("hidden");
    resetImageCutoutState();
    renderAll();
    toast("이미지 누끼가 적용되었습니다.", 1700);
    return true;
  }

  function bindImageCutoutCanvas() {
    const canvas = els.imageCutoutCanvas;
    if (!canvas) return;
    const brushRadius = 18;
    const onPointerMove = (event) => {
      if (!imageCutoutState.open || !imageCutoutState.pointerActive) return;
      const point = imageCutoutEventToSourcePoint(event);
      if (!point?.inside) return;
      if (imageCutoutState.tool === "brush") {
        paintImageCutoutStroke(imageCutoutState.lastPoint || point, point, brushRadius);
        imageCutoutState.lastPoint = point;
      } else if (imageCutoutState.tool === "rect") {
        imageCutoutState.rectDraft = {
          ...(imageCutoutState.rectDraft || { x0: point.x, y0: point.y, x1: point.x, y1: point.y }),
          x1: point.x,
          y1: point.y
        };
      }
      drawImageCutoutEditor();
    };
    const stopPointer = () => {
      if (!imageCutoutState.pointerActive) return;
      if (imageCutoutState.tool === "rect" && imageCutoutState.rectDraft) {
        if (applyImageCutoutAutoRect(imageCutoutState.rectDraft)) {
          imageCutoutState.dirty = true;
        }
      }
      imageCutoutState.pointerActive = false;
      imageCutoutState.lastPoint = null;
      imageCutoutState.rectDraft = null;
      drawImageCutoutEditor();
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (!imageCutoutState.open || event.button !== 0) return;
      const point = imageCutoutEventToSourcePoint(event);
      if (!point?.inside) return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      imageCutoutState.pointerActive = true;
      imageCutoutState.lastPoint = point;
      if (imageCutoutState.tool === "brush") {
        paintImageCutoutStroke(point, point, brushRadius);
      } else {
        imageCutoutState.rectDraft = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
      }
      drawImageCutoutEditor();
    });
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", stopPointer);
    canvas.addEventListener("pointercancel", stopPointer);
    window.addEventListener("resize", () => {
      if (!imageCutoutState.open) return;
      drawImageCutoutEditor();
    });
  }

  function renderVideoInspector() {
    const clip = getSelectedVideoClip();
    const hasVideoClip = !!clip;
    els.videoInspectorEmpty?.classList.toggle("hidden", hasVideoClip);
    els.videoInspectorForm?.classList.toggle("hidden", !hasVideoClip);
    const cropMode = isVideoCropModeActive(clip);
    const cropValues = getVideoCropDraftForClip(clip) || clip;
    els.videoEditTransformBtn?.classList.toggle("active", !cropMode);
    els.videoEditCropBtn?.classList.toggle("active", cropMode);
    if (!clip) {
      if (cropMode) closeVideoCropModal();
      return;
    }

    initVideoClipFields(clip, {
      defaultSourceIn: getClipSourceIn(clip, 0),
      defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
    });
    const metaDuration = Math.max(MIN_TIMELINE_CLIP_SEC, Number(clip.meta?.duration || clip.sourceOut || clip.out || MIN_TIMELINE_CLIP_SEC));
    const sourceIn = getClipSourceIn(clip, 0);
    const sourceOut = getClipSourceOut(clip, metaDuration);
    const clipDur = getVideoClipTimelineDuration(clip);

    if (els.videoInspectorTitle) els.videoInspectorTitle.textContent = clip.name || t("genericClip", "Clip");
    if (els.videoInspectorMeta) {
      els.videoInspectorMeta.textContent = [
        `${Math.round(Number(clip.meta?.width || 0))}x${Math.round(Number(clip.meta?.height || 0))}`,
        `${t("videoMetaTimelineDuration", "Timeline")} ${formatTimelineSec(clipDur)}s`,
        `${t("videoMetaSourceWindow", "Source Window")} ${formatTimelineSec(sourceIn)}s - ${formatTimelineSec(sourceOut)}s`
      ].filter(Boolean).join(" / ");
    }

    const uniformScalePct = Math.round((((Number(clip.scaleX || 1) + Number(clip.scaleY || 1)) * 0.5) || 1) * 100);
    if (els.videoScaleInput) els.videoScaleInput.value = String(uniformScalePct);
    if (els.videoScaleValue) els.videoScaleValue.textContent = `${uniformScalePct}%`;
    if (els.videoScaleXInput) els.videoScaleXInput.value = String(Math.round(Number(clip.scaleX || 1) * 100));
    if (els.videoScaleYInput) els.videoScaleYInput.value = String(Math.round(Number(clip.scaleY || 1) * 100));
    if (els.videoPosXInput) els.videoPosXInput.value = String(Math.round(Number(clip.positionX ?? 0.5) * 100));
    if (els.videoPosXValue) els.videoPosXValue.textContent = `${Math.round(Number(clip.positionX ?? 0.5) * 100)}%`;
    if (els.videoPosYInput) els.videoPosYInput.value = String(Math.round(Number(clip.positionY ?? 0.5) * 100));
    if (els.videoPosYValue) els.videoPosYValue.textContent = `${Math.round(Number(clip.positionY ?? 0.5) * 100)}%`;
    if (els.videoAnchorXInput) els.videoAnchorXInput.value = String(Math.round(Number(clip.anchorX ?? 0.5) * 100));
    if (els.videoAnchorXValue) els.videoAnchorXValue.textContent = `${Math.round(Number(clip.anchorX ?? 0.5) * 100)}%`;
    if (els.videoAnchorYInput) els.videoAnchorYInput.value = String(Math.round(Number(clip.anchorY ?? 0.5) * 100));
    if (els.videoAnchorYValue) els.videoAnchorYValue.textContent = `${Math.round(Number(clip.anchorY ?? 0.5) * 100)}%`;
    if (els.videoRotationInput) els.videoRotationInput.value = String(Math.round(Number(clip.rotation || 0)));
    if (els.videoRotationValue) els.videoRotationValue.textContent = `${Math.round(Number(clip.rotation || 0))}°`;
    if (els.videoOpacityInput) els.videoOpacityInput.value = String(Math.round(Number(clip.opacity ?? 1) * 100));
    if (els.videoOpacityValue) els.videoOpacityValue.textContent = `${Math.round(Number(clip.opacity ?? 1) * 100)}%`;
    const chroma = getVideoChromaKeyState(clip);
    if (els.videoChromaEnabledInput) els.videoChromaEnabledInput.checked = chroma.enabled;
    if (els.videoChromaColorInput) els.videoChromaColorInput.value = chroma.color;
    if (els.videoChromaColorHex) els.videoChromaColorHex.value = chroma.color;
    if (els.videoChromaSimilarityInput) els.videoChromaSimilarityInput.value = String(Math.round(chroma.similarity * 100));
    if (els.videoChromaSimilarityValue) els.videoChromaSimilarityValue.textContent = `${Math.round(chroma.similarity * 100)}%`;
    if (els.videoChromaBlendInput) els.videoChromaBlendInput.value = String(Math.round(chroma.blend * 100));
    if (els.videoChromaBlendValue) els.videoChromaBlendValue.textContent = `${Math.round(chroma.blend * 100)}%`;
    if (els.videoChromaReflectionInput) els.videoChromaReflectionInput.value = String(Math.round(chroma.reflectionTolerance * 100));
    if (els.videoChromaReflectionValue) els.videoChromaReflectionValue.textContent = `${Math.round(chroma.reflectionTolerance * 100)}%`;
    [
      els.videoChromaColorInput,
      els.videoChromaColorHex,
      els.videoChromaEyedropperBtn,
      els.videoChromaSimilarityInput,
      els.videoChromaBlendInput,
      els.videoChromaReflectionInput,
      els.btnVideoResetChroma
    ].forEach((el) => {
      if (el) el.disabled = !chroma.enabled;
    });
    if (els.videoFitModeInput) els.videoFitModeInput.value = String(clip.fitMode || "contain");
    if (els.videoCropLeftInput) els.videoCropLeftInput.value = String(Math.round(Number(cropValues?.cropLeft || 0) * 100));
    if (els.videoCropRightInput) els.videoCropRightInput.value = String(Math.round(Number(cropValues?.cropRight || 0) * 100));
    if (els.videoCropTopInput) els.videoCropTopInput.value = String(Math.round(Number(cropValues?.cropTop || 0) * 100));
    if (els.videoCropBottomInput) els.videoCropBottomInput.value = String(Math.round(Number(cropValues?.cropBottom || 0) * 100));
    if (els.videoSourceInInput) {
      els.videoSourceInInput.min = "0";
      els.videoSourceInInput.step = String(TIMELINE_TIME_STEP_SEC);
      els.videoSourceInInput.max = String(metaDuration.toFixed(2));
      els.videoSourceInInput.value = sourceIn.toFixed(2);
    }
    if (els.videoSourceOutInput) {
      els.videoSourceOutInput.step = String(TIMELINE_TIME_STEP_SEC);
      els.videoSourceOutInput.min = String((sourceIn + MIN_TIMELINE_CLIP_SEC).toFixed(2));
      els.videoSourceOutInput.max = String(metaDuration.toFixed(2));
      els.videoSourceOutInput.value = sourceOut.toFixed(2);
    }
    if (els.videoPlaybackWindowHint) {
      els.videoPlaybackWindowHint.textContent = `${t("videoPlaybackWindowTimeline", "Timeline Trim")}: ${formatTimelineSec(clipDur)}s | ${t("videoPlaybackWindowSource", "Source Window")}: ${formatTimelineSec(sourceIn)}s - ${formatTimelineSec(sourceOut)}s`;
    }
    if (isVideoCropModalOpen()) renderVideoCropModalPreview(state.ui.currentTime);
  }

  function bindVideoInspector() {
    const updateSelectedVideo = (mutate, options = {}) => {
      const clip = getSelectedVideoClip();
      if (!clip) return;
      mutate(clip);
      initVideoClipFields(clip, {
        defaultSourceIn: getClipSourceIn(clip, 0),
        defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
      });
      recalcTimeline();
      if (options.previewOnly) {
        renderPreviewAtTime(state.ui.currentTime);
        renderVideoInspector();
      } else {
        renderAll();
      }
    };
    const updateSelectedVideoWithHistory = (mutate, options = {}) => {
      const before = snapshotHistoryState();
      updateSelectedVideo(mutate, options);
      commitHistorySnapshot(before);
    };
    const bindHistoryArm = (el) => {
      if (!el) return;
      let armedSnapshot = null;
      const arm = () => {
        if (!armedSnapshot) armedSnapshot = snapshotHistoryState();
      };
      const commit = () => {
        if (!armedSnapshot) return;
        commitHistorySnapshot(armedSnapshot);
        armedSnapshot = null;
      };
      el.addEventListener("pointerdown", arm);
      el.addEventListener("focus", arm);
      el.addEventListener("change", commit);
      el.addEventListener("blur", commit);
    };

    const markCustomTransform = (clip) => {
      clip.placementPreset = "custom";
    };

    [
      els.videoScaleInput,
      els.videoPosXInput,
      els.videoPosYInput,
      els.videoAnchorXInput,
      els.videoAnchorYInput,
      els.videoRotationInput,
      els.videoOpacityInput,
      els.videoChromaColorInput,
      els.videoChromaSimilarityInput,
      els.videoChromaBlendInput,
      els.videoChromaReflectionInput
    ].forEach(bindHistoryArm);

    els.videoEditTransformBtn?.addEventListener("click", () => {
      if (isVideoCropModeActive()) commitVideoCropMode();
      else {
        state.ui.previewEditMode = "transform";
        renderVideoInspector();
        renderPreviewAtTime(state.ui.currentTime);
      }
    });
    els.videoEditCropBtn?.addEventListener("click", () => {
      openVideoCropModal();
    });

    els.videoScaleInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        const value = Math.max(0.1, Number(els.videoScaleInput.value || 100) / 100);
        clip.scaleX = value;
        clip.scaleY = value;
        markCustomTransform(clip);
      }, { previewOnly: true });
    });
    els.videoScaleXInput?.addEventListener("change", () => {
      updateSelectedVideoWithHistory((clip) => {
        clip.scaleX = Math.max(0.1, Number(els.videoScaleXInput.value || 100) / 100);
        markCustomTransform(clip);
      });
    });
    els.videoScaleYInput?.addEventListener("change", () => {
      updateSelectedVideoWithHistory((clip) => {
        clip.scaleY = Math.max(0.1, Number(els.videoScaleYInput.value || 100) / 100);
        markCustomTransform(clip);
      });
    });
    els.videoPosXInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        clip.positionX = Number(els.videoPosXInput.value || 50) / 100;
        markCustomTransform(clip);
      }, { previewOnly: true });
    });
    els.videoPosYInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        clip.positionY = Number(els.videoPosYInput.value || 50) / 100;
        markCustomTransform(clip);
      }, { previewOnly: true });
    });
    els.videoAnchorXInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        clip.anchorX = Number(els.videoAnchorXInput.value || 50) / 100;
        markCustomTransform(clip);
      }, { previewOnly: true });
    });
    els.videoAnchorYInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        clip.anchorY = Number(els.videoAnchorYInput.value || 50) / 100;
        markCustomTransform(clip);
      }, { previewOnly: true });
    });
    els.videoRotationInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        clip.rotation = clampVideoRotationDeg(els.videoRotationInput.value || 0);
        markCustomTransform(clip);
      }, { previewOnly: true });
    });
    els.videoOpacityInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        clip.opacity = Math.max(0, Math.min(1, Number(els.videoOpacityInput.value || 100) / 100));
      }, { previewOnly: true });
    });
    els.videoChromaEnabledInput?.addEventListener("change", () => {
      updateSelectedVideoWithHistory((clip) => {
        ensureVideoChromaKeyDefaults(clip);
        clip.chromaKeyEnabled = !!els.videoChromaEnabledInput.checked;
      });
    });
    els.videoChromaColorInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        ensureVideoChromaKeyDefaults(clip);
        clip.chromaKeyEnabled = true;
        clip.chromaKeyColor = normalizeColor(els.videoChromaColorInput.value, DEFAULT_CHROMA_KEY_COLOR);
      }, { previewOnly: true });
    });
    els.videoChromaColorHex?.addEventListener("change", () => {
      updateSelectedVideoWithHistory((clip) => {
        ensureVideoChromaKeyDefaults(clip);
        clip.chromaKeyEnabled = true;
        clip.chromaKeyColor = normalizeColor(els.videoChromaColorHex.value, getVideoChromaKeyState(clip).color);
      });
    });
    els.videoChromaEyedropperBtn?.addEventListener("click", async () => {
      await openVideoChromaEyedropper();
    });
    els.videoChromaSimilarityInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        ensureVideoChromaKeyDefaults(clip);
        clip.chromaKeyEnabled = true;
        clip.chromaKeySimilarity = Math.max(0.01, Math.min(0.6, Number(els.videoChromaSimilarityInput.value || 14) / 100));
      }, { previewOnly: true });
    });
    els.videoChromaBlendInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        ensureVideoChromaKeyDefaults(clip);
        clip.chromaKeyEnabled = true;
        clip.chromaKeyBlend = Math.max(0, Math.min(0.4, Number(els.videoChromaBlendInput.value || 8) / 100));
      }, { previewOnly: true });
    });
    els.videoChromaReflectionInput?.addEventListener("input", () => {
      updateSelectedVideo((clip) => {
        ensureVideoChromaKeyDefaults(clip);
        clip.chromaKeyEnabled = true;
        clip.chromaKeyReflectionTolerance = Math.max(0, Math.min(0.5, Number(els.videoChromaReflectionInput.value || 0) / 100));
      }, { previewOnly: true });
    });
    els.videoFitModeInput?.addEventListener("change", () => {
      updateSelectedVideoWithHistory((clip) => {
        clip.fitMode = String(els.videoFitModeInput.value || "contain");
      });
    });

    const bindCropInput = (el, field) => {
      el?.addEventListener("change", () => {
        if (isVideoCropModeActive()) {
          const clip = getSelectedVideoClip();
          if (!clip) return;
          const nextDraft = {
            ...(getVideoCropDraftForClip(clip) || {
              clipId: clip.id,
              cropLeft: clip.cropLeft,
              cropRight: clip.cropRight,
              cropTop: clip.cropTop,
              cropBottom: clip.cropBottom
            }),
            [field]: Math.max(0, Math.min(0.9, Number(el.value || 0) / 100))
          };
          applyVideoCropDraft(nextDraft);
          return;
        }
        updateSelectedVideoWithHistory((clip) => {
          clip[field] = Math.max(0, Math.min(0.9, Number(el.value || 0) / 100));
        });
      });
    };
    bindCropInput(els.videoCropLeftInput, "cropLeft");
    bindCropInput(els.videoCropRightInput, "cropRight");
    bindCropInput(els.videoCropTopInput, "cropTop");
    bindCropInput(els.videoCropBottomInput, "cropBottom");

    const commitSourceRange = () => {
      updateSelectedVideoWithHistory((clip) => {
        const nextIn = snapTimelineTimeSec(Math.max(0, Number(els.videoSourceInInput?.value || 0)));
        const nextOut = Math.max(nextIn + MIN_TIMELINE_CLIP_SEC, snapTimelineTimeSec(Number(els.videoSourceOutInput?.value || (nextIn + MIN_TIMELINE_CLIP_SEC))));
        setVideoClipSourceRange(clip, nextIn, nextOut);
      });
    };
    els.videoSourceInInput?.addEventListener("change", commitSourceRange);
    els.videoSourceOutInput?.addEventListener("change", commitSourceRange);

    const bindPreset = (el, preset) => {
      el?.addEventListener("click", () => {
        updateSelectedVideoWithHistory((clip) => {
          applyVideoPlacementPreset(clip, preset);
        });
      });
    };
    bindPreset(els.videoPresetCenter, "center");
    bindPreset(els.videoPresetTopLeft, "top-left");
    bindPreset(els.videoPresetTopRight, "top-right");
    bindPreset(els.videoPresetBottomLeft, "bottom-left");
    bindPreset(els.videoPresetBottomRight, "bottom-right");

    els.btnVideoResetTransform?.addEventListener("click", () => {
      updateSelectedVideoWithHistory((clip) => {
        clip.scaleX = 1;
        clip.scaleY = 1;
        clip.positionX = 0.5;
        clip.positionY = 0.5;
        clip.anchorX = 0.5;
        clip.anchorY = 0.5;
        clip.rotation = 0;
        clip.opacity = 1;
        clip.placementPreset = "center";
      });
    });
    els.btnVideoResetChroma?.addEventListener("click", () => {
      updateSelectedVideoWithHistory((clip) => {
        clip.chromaKeyEnabled = false;
        clip.chromaKeyColor = DEFAULT_CHROMA_KEY_COLOR;
        clip.chromaKeySimilarity = 0.14;
        clip.chromaKeyBlend = 0.08;
        clip.chromaKeyReflectionTolerance = 0;
      });
    });
    els.btnVideoResetCrop?.addEventListener("click", () => {
      if (isVideoCropModeActive()) {
        const clip = getSelectedVideoClip();
        if (!clip) return;
        applyVideoCropDraft({
          clipId: clip.id,
          cropLeft: 0,
          cropRight: 0,
          cropTop: 0,
          cropBottom: 0
        });
        return;
      }
      updateSelectedVideoWithHistory((clip) => {
        clip.cropLeft = 0;
        clip.cropRight = 0;
        clip.cropTop = 0;
        clip.cropBottom = 0;
        clip.fitMode = "contain";
      });
    });
    els.btnVideoResetAll?.addEventListener("click", () => {
      updateSelectedVideoWithHistory((clip) => {
        const sourceIn = getClipSourceIn(clip, 0);
        const sourceOut = getClipSourceOut(clip, Number(clip.meta?.duration || clip.out || MIN_TIMELINE_CLIP_SEC));
        clip.scaleX = 1;
        clip.scaleY = 1;
        clip.positionX = 0.5;
        clip.positionY = 0.5;
        clip.anchorX = 0.5;
        clip.anchorY = 0.5;
        clip.rotation = 0;
        clip.opacity = 1;
        clip.chromaKeyEnabled = false;
        clip.chromaKeyColor = DEFAULT_CHROMA_KEY_COLOR;
        clip.chromaKeySimilarity = 0.14;
        clip.chromaKeyBlend = 0.08;
        clip.chromaKeyReflectionTolerance = 0;
        clip.cropLeft = 0;
        clip.cropRight = 0;
        clip.cropTop = 0;
        clip.cropBottom = 0;
        clip.fitMode = "contain";
        clip.placementPreset = "center";
        setVideoClipSourceRange(clip, sourceIn, sourceOut);
        clip.in = sourceIn;
        clip.out = sourceOut;
      });
    });
  }

  function bindVideoCropModal() {
    els.videoCropModalClose?.addEventListener("click", () => exitVideoCropMode());
    els.btnVideoCropDone?.addEventListener("click", () => commitVideoCropMode());
    els.videoCropModal?.addEventListener("mousedown", (e) => {
      if (e.target === els.videoCropModal) exitVideoCropMode();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isVideoCropModalOpen()) exitVideoCropMode();
    });
  }

  function bindImageCutoutModal() {
    bindImageCutoutCanvas();
    els.btnImageCutoutBrush?.addEventListener("click", () => {
      if (!imageCutoutState.open) return;
      setImageCutoutTool("brush");
      drawImageCutoutEditor();
    });
    els.btnImageCutoutAutoRect?.addEventListener("click", () => {
      if (!imageCutoutState.open) return;
      setImageCutoutTool("rect");
      drawImageCutoutEditor();
    });
    els.btnImageCutoutSave?.addEventListener("click", () => {
      void saveImageCutoutEditor();
    });
    els.btnImageCutoutCancel?.addEventListener("click", () => {
      els.imageCutoutModal?.classList.add("hidden");
      resetImageCutoutState();
    });
    els.btnImageCutoutClose?.addEventListener("click", () => {
      void requestCloseImageCutoutEditor();
    });
    els.imageCutoutCloseTopBtn?.addEventListener("click", () => {
      void requestCloseImageCutoutEditor();
    });
    els.imageCutoutModal?.addEventListener("mousedown", (e) => {
      if (e.target === els.imageCutoutModal) {
        void requestCloseImageCutoutEditor();
      }
    });
  }

  function bindOverlayInspector() {
    const updateSelectedOverlay = (mutate) => {
      const overlay = getSelectedOverlayItem();
      if (!overlay || overlay.overlayType !== "text") return;
      mutate(overlay);
      syncTextOverlayTransitionSettings(overlay);
      recalcTimeline();
      renderAll();
    };

    els.overlayTextInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.text = els.overlayTextInput.value; });
    });
    els.overlayFontSizeInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.fontSize = Math.max(18, Number(els.overlayFontSizeInput.value || 64)); });
    });
    els.overlayOpacityInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.opacity = Math.max(0.1, Math.min(1, Number(els.overlayOpacityInput.value || 1))); });
    });
    els.overlayFadeInInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.manualFadeInSec = clampFadeDuration(snapFadeValueSec(els.overlayFadeInInput.value), overlay.duration); });
    });
    els.overlayFadeOutInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.manualFadeOutSec = clampFadeDuration(snapFadeValueSec(els.overlayFadeOutInput.value), overlay.duration); });
    });
    els.overlayTransitionInTypeInput?.addEventListener("change", () => {
      updateSelectedOverlay((overlay) => {
        overlay.transitionInType = normalizeTextOverlayTransitionType(els.overlayTransitionInTypeInput.value);
        if (overlay.transitionInType === "none") {
          overlay.transitionInDurationSec = 0;
        } else if (Number(overlay.transitionInDurationSec || 0) <= 0.001) {
          overlay.transitionInDurationSec = getTextOverlayTransitionDefaultDuration(overlay.transitionInType);
        }
      });
    });
    els.overlayTransitionOutTypeInput?.addEventListener("change", () => {
      updateSelectedOverlay((overlay) => {
        overlay.transitionOutType = normalizeTextOverlayTransitionType(els.overlayTransitionOutTypeInput.value);
        if (overlay.transitionOutType === "none") {
          overlay.transitionOutDurationSec = 0;
        } else if (Number(overlay.transitionOutDurationSec || 0) <= 0.001) {
          overlay.transitionOutDurationSec = getTextOverlayTransitionDefaultDuration(overlay.transitionOutType);
        }
      });
    });
    els.overlayTransitionInDurationInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => {
        overlay.transitionInDurationSec = clampTextOverlayTransitionDuration(snapFadeValueSec(els.overlayTransitionInDurationInput.value), overlay.duration);
      });
    });
    els.overlayTransitionOutDurationInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => {
        overlay.transitionOutDurationSec = clampTextOverlayTransitionDuration(snapFadeValueSec(els.overlayTransitionOutDurationInput.value), overlay.duration);
      });
    });
    els.overlayTransitionStrengthInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => {
        overlay.transitionStrength = Math.max(0.4, Math.min(1.6, Number(els.overlayTransitionStrengthInput.value || 1)));
      });
    });
    els.overlayPosXInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.x = clamp01(els.overlayPosXInput.value, 0.5); });
    });
    els.overlayPosYInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.y = clamp01(els.overlayPosYInput.value, 0.82); });
    });
    els.overlayColorInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.color = normalizeColor(els.overlayColorInput.value, "#ffffff"); });
    });
    els.overlayNoFillInput?.addEventListener("change", () => {
      updateSelectedOverlay((overlay) => { overlay.noFill = !!els.overlayNoFillInput.checked; });
    });
    els.overlayStrokeColorInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.strokeColor = normalizeColor(els.overlayStrokeColorInput.value, "#000000"); });
    });
    els.overlayNoStrokeInput?.addEventListener("change", () => {
      updateSelectedOverlay((overlay) => { overlay.noStroke = !!els.overlayNoStrokeInput.checked; });
    });
    els.overlayStrokeWidthInput?.addEventListener("input", () => {
      updateSelectedOverlay((overlay) => { overlay.strokeWidth = Math.max(0, Number(els.overlayStrokeWidthInput.value || 0)); });
    });
    els.overlayFontWeightInput?.addEventListener("change", () => {
      updateSelectedOverlay((overlay) => { overlay.fontWeight = String(els.overlayFontWeightInput.value || "700"); });
    });
    els.overlayFontFamilyInput?.addEventListener("change", () => {
      const selected = String(els.overlayFontFamilyInput.value || "Malgun Gothic");
      if (selected === ADD_CUSTOM_FONT_VALUE) {
        refreshFontFamilySelect(getSelectedTextOverlayFontFamily());
        openCustomFontModal();
        return;
      }
      const customFont = getCustomFontByFamily(selected);
      updateSelectedOverlay((overlay) => {
        overlay.fontFamily = selected;
        if (customFont?.path) overlay.fontFile = customFont.path;
        else overlay.fontFile = "";
      });
    });
    els.overlayTextAlignInput?.addEventListener("change", () => {
      updateSelectedOverlay((overlay) => { overlay.textAlign = String(els.overlayTextAlignInput.value || "center"); });
    });
    els.btnCustomFontClose?.addEventListener("click", closeCustomFontModal);
    els.btnCustomFontCancel?.addEventListener("click", closeCustomFontModal);
    els.customFontModal?.addEventListener("mousedown", (e) => {
      if (e.target === els.customFontModal) closeCustomFontModal();
    });
    els.customFontNameInput?.addEventListener("input", syncCustomFontDialogState);
    els.customFontTermsCheck?.addEventListener("change", syncCustomFontDialogState);
    els.customFontFileInput?.addEventListener("change", () => {
      const file = els.customFontFileInput?.files?.[0] || null;
      const filePath = file && window.pearl?.getPathForFile
        ? String(window.pearl.getPathForFile(file) || "")
        : "";
      const ext = getFileExtension(filePath || file?.name || "");
      if (!file || !filePath || !SUPPORTED_FONT_EXTS.has(ext)) {
        pendingCustomFontFilePath = "";
        if (els.customFontFileHint) els.customFontFileHint.textContent = "ttf, otf, ttc, woff, woff2 파일만 추가할 수 있습니다.";
        syncCustomFontDialogState();
        return;
      }
      pendingCustomFontFilePath = filePath;
      if (els.customFontFileHint) els.customFontFileHint.textContent = filePath;
      if (els.customFontNameInput && !String(els.customFontNameInput.value || "").trim()) {
        els.customFontNameInput.value = getFileBaseName(filePath);
      }
      syncCustomFontDialogState();
    });
    els.btnCustomFontAdd?.addEventListener("click", () => {
      const font = upsertCustomFont({
        name: els.customFontNameInput?.value || "",
        path: pendingCustomFontFilePath
      });
      if (!font) return;
      refreshFontFamilySelect(font.family);
      updateSelectedOverlay((overlay) => {
        overlay.fontFamily = font.family;
        overlay.fontFile = font.path;
      });
      closeCustomFontModal();
      toast("글씨체를 추가했습니다.");
    });
  }

  function ensureFxPopover() {
    let pop = document.getElementById("fxClipPopover");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "fxClipPopover";
      pop.className = "fxClipPopover hidden";
      document.body.appendChild(pop);
    }
    return pop;
  }

  function hideFxPopover() {
    state.ui.fxPopover.overlayId = null;
    const pop = document.getElementById("fxClipPopover");
    pop?.classList.add("hidden");
  }

  function showFxPopover(overlayId, anchorEl) {
    const overlay = state.project.overlayItems.find((item) => item.id === overlayId);
    if (!overlay || !isFxOverlayType(overlay.overlayType)) return;
    const rect = anchorEl?.getBoundingClientRect?.();
    state.ui.fxPopover.overlayId = overlayId;
    state.ui.fxPopover.x = Math.round(rect?.right || 0);
    state.ui.fxPopover.y = Math.round(rect?.bottom || 0);
    renderFxPopover();
  }

  function renderFxPopover() {
    const pop = ensureFxPopover();
    const overlay = state.project.overlayItems.find((item) => item.id === state.ui.fxPopover.overlayId);
    if (!overlay || !isFxOverlayType(overlay.overlayType)) {
      pop.classList.add("hidden");
      return;
    }
    const rangeRow = (label, field, min, max, step, value, readout) => (
      `<label class="fxPopoverRow"><span>${label}</span><input data-fx-field="${field}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><b>${readout}</b></label>`
    );
    const colorRow = (label, field, value) => (
      `<label class="fxPopoverRow"><span>${label}</span><input data-fx-field="${field}" type="color" value="${value}"></label>`
    );
    const actionRow = (...buttons) => (
      `<div class="fxPopoverActions">${buttons.join("")}</div>`
    );
    const rows = [];

    if (overlay.overlayType === "circle") {
      rows.push(
        rangeRow("크기", "radius", 0.01, 1, 0.01, Number(overlay.radius || overlay.size || 0.11), `${Math.round(Number(overlay.radius || overlay.size || 0.11) * 100)}%`),
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.5), `${Math.round(Number(overlay.y || 0.5) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#ffdb4d")),
        rangeRow("머무름", "holdDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.holdDuration || 1.2), `${formatTimelineSec(overlay.holdDuration || 1.2)}s`)
      );
    } else if (overlay.overlayType === "underline") {
      rows.push(
        rangeRow("폭", "width", 0.08, 1, 0.01, Number(overlay.width || overlay.size || 0.24), `${Math.round(Number(overlay.width || overlay.size || 0.24) * 100)}%`),
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.78), `${Math.round(Number(overlay.y || 0.78) * 100)}%`),
        rangeRow("두께", "lineThickness", 2, 24, 0.5, Number(overlay.lineThickness || 10), `${Number(overlay.lineThickness || 10).toFixed(1)}px`),
        rangeRow("그리기", "drawDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.drawDuration || 0.9), `${formatTimelineSec(overlay.drawDuration || 0.9)}s`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#38bdf8"))
      );
    } else if (overlay.overlayType === "focus_box_draw") {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.44), `${Math.round(Number(overlay.y || 0.44) * 100)}%`),
        rangeRow("가로", "boxWidth", 0.08, 0.9, 0.01, Number(overlay.boxWidth || 0.28), `${Math.round(Number(overlay.boxWidth || 0.28) * 100)}%`),
        rangeRow("세로", "boxHeight", 0.08, 0.9, 0.01, Number(overlay.boxHeight || 0.18), `${Math.round(Number(overlay.boxHeight || 0.18) * 100)}%`),
        rangeRow("두께", "strokeWidth", 1, 18, 0.5, Number(overlay.strokeWidth || 6), `${Number(overlay.strokeWidth || 6).toFixed(1)}px`),
        rangeRow("그리기", "drawDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.drawDuration || 0.58), `${formatTimelineSec(overlay.drawDuration || 0.58)}s`),
        rangeRow("머무름", "holdDuration", 0, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.holdDuration || 0.46), `${formatTimelineSec(overlay.holdDuration || 0.46)}s`),
        rangeRow("투명도", "opacity", 0.1, 1, 0.01, Number(overlay.opacity ?? 0.96), `${Math.round(Number(overlay.opacity ?? 0.96) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#38bdf8"))
      );
    } else if (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.46), `${Math.round(Number(overlay.y || 0.46) * 100)}%`),
        rangeRow("가로", "boxWidth", 0.08, 0.95, 0.01, Number(overlay.boxWidth || 0.34), `${Math.round(Number(overlay.boxWidth || 0.34) * 100)}%`),
        rangeRow("세로", "boxHeight", 0.08, 0.95, 0.01, Number(overlay.boxHeight || 0.24), `${Math.round(Number(overlay.boxHeight || 0.24) * 100)}%`)
      );
    } else if (overlay.overlayType === "motion_path_move") {
      rows.push(
        rangeRow("이동 시간", "duration", TIMELINE_TIME_STEP_SEC, 8, TIMELINE_TIME_STEP_SEC, Number(overlay.duration || 1.2), `${formatTimelineSec(overlay.duration || 1.2)}s`),
        rangeRow("가이드 두께", "strokeWidth", 2, 14, 0.5, Number(overlay.strokeWidth || 4), `${Number(overlay.strokeWidth || 4).toFixed(1)}px`),
        colorRow("가이드 색상", "color", normalizeColor(overlay.color, "#38bdf8")),
        actionRow(
          `<button type="button" class="smallBtn fxPopoverBtn" data-fx-action="drawPath">경로 그리기</button>`,
          `<button type="button" class="smallBtn fxPopoverBtn" data-fx-action="resetPath">구역 재설정</button>`
        )
      );
    } else if (overlay.overlayType === "callout_line_draw") {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.38), `${Math.round(Number(overlay.x || 0.38) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.44), `${Math.round(Number(overlay.y || 0.44) * 100)}%`),
        rangeRow("길이", "lineLength", 0.04, 0.45, 0.01, Number(overlay.lineLength || 0.22), `${Math.round(Number(overlay.lineLength || 0.22) * 100)}%`),
        rangeRow("각도", "lineAngle", -180, 180, 1, Number(overlay.lineAngle ?? -18), `${Math.round(Number(overlay.lineAngle ?? -18))}°`),
        rangeRow("두께", "strokeWidth", 1, 18, 0.5, Number(overlay.strokeWidth || 6), `${Number(overlay.strokeWidth || 6).toFixed(1)}px`),
        rangeRow("그리기", "drawDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.drawDuration || 0.52), `${formatTimelineSec(overlay.drawDuration || 0.52)}s`),
        rangeRow("투명도", "opacity", 0.1, 1, 0.01, Number(overlay.opacity ?? 0.96), `${Math.round(Number(overlay.opacity ?? 0.96) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#38bdf8"))
      );
    } else if (overlay.overlayType === "soft_spotlight") {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.48), `${Math.round(Number(overlay.y || 0.48) * 100)}%`),
        rangeRow("가로", "boxWidth", 0.08, 0.9, 0.01, Number(overlay.boxWidth || 0.26), `${Math.round(Number(overlay.boxWidth || 0.26) * 100)}%`),
        rangeRow("세로", "boxHeight", 0.08, 0.9, 0.01, Number(overlay.boxHeight || 0.16), `${Math.round(Number(overlay.boxHeight || 0.16) * 100)}%`),
        rangeRow("부드러움", "softness", 0.05, 1, 0.01, Number(overlay.softness || 0.56), `${Math.round(Number(overlay.softness || 0.56) * 100)}%`),
        rangeRow("머무름", "holdDuration", 0, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.holdDuration || 0.78), `${formatTimelineSec(overlay.holdDuration || 0.78)}s`),
        rangeRow("강도", "opacity", 0.05, 1, 0.01, Number(overlay.opacity ?? 0.42), `${Math.round(Number(overlay.opacity ?? 0.42) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#ffffff"))
      );
    } else if (overlay.overlayType === "highlight_bar_sweep") {
      rows.push(
        rangeRow("폭", "width", 0.08, 1, 0.01, Number(overlay.width || 0.34), `${Math.round(Number(overlay.width || 0.34) * 100)}%`),
        rangeRow("높이", "boxHeight", 0.05, 0.4, 0.01, Number(overlay.boxHeight || 0.12), `${Math.round(Number(overlay.boxHeight || 0.12) * 100)}%`),
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.42), `${Math.round(Number(overlay.y || 0.42) * 100)}%`),
        rangeRow("그리기", "drawDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.drawDuration || 0.42), `${formatTimelineSec(overlay.drawDuration || 0.42)}s`),
        rangeRow("투명도", "opacity", 0.05, 1, 0.01, Number(overlay.opacity ?? 0.44), `${Math.round(Number(overlay.opacity ?? 0.44) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#fde68a"))
      );
    } else if (overlay.overlayType === "checkpoint_pop") {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.48), `${Math.round(Number(overlay.y || 0.48) * 100)}%`),
        rangeRow("라인 수", "lineCount", 6, 12, 1, Math.round(Number(overlay.lineCount || 8)), `${Math.round(Number(overlay.lineCount || 8))}`),
        rangeRow("라인 길이", "lineLength", 0.01, 0.12, 0.005, Number(overlay.lineLength || 0.032), `${Math.round(Number(overlay.lineLength || 0.032) * 100)}%`),
        rangeRow("반경", "radius", 0.01, 0.16, 0.005, Number(overlay.radius || 0.052), `${Math.round(Number(overlay.radius || 0.052) * 100)}%`),
        rangeRow("두께", "strokeWidth", 1, 18, 0.5, Number(overlay.strokeWidth || 4.5), `${Number(overlay.strokeWidth || 4.5).toFixed(1)}px`),
        rangeRow("지속시간", "durationMs", 140, 1400, 10, Math.round(Number(overlay.durationMs || 680)), `${Math.round(Number(overlay.durationMs || 680))}ms`),
        rangeRow("퍼짐", "spreadAmount", 0, 1, 0.01, Number(overlay.spreadAmount ?? overlay.jitter ?? 0.12), `${Math.round(Number(overlay.spreadAmount ?? overlay.jitter ?? 0.12) * 100)}%`),
        rangeRow("투명도", "opacity", 0.1, 1, 0.01, Number(overlay.opacity ?? 0.98), `${Math.round(Number(overlay.opacity ?? 0.98) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#22c55e"))
      );
    } else if (overlay.overlayType === "section_divider_slide") {
      rows.push(
        rangeRow("폭", "width", 0.12, 1, 0.01, Number(overlay.width || 0.78), `${Math.round(Number(overlay.width || 0.78) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.24), `${Math.round(Number(overlay.y || 0.24) * 100)}%`),
        rangeRow("두께", "lineThickness", 2, 24, 0.5, Number(overlay.lineThickness || 4), `${Number(overlay.lineThickness || 4).toFixed(1)}px`),
        rangeRow("그리기", "drawDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.drawDuration || 0.48), `${formatTimelineSec(overlay.drawDuration || 0.48)}s`),
        rangeRow("투명도", "opacity", 0.1, 1, 0.01, Number(overlay.opacity ?? 0.96), `${Math.round(Number(overlay.opacity ?? 0.96) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#cbd5e1"))
      );
    } else if (overlay.overlayType === "drop_wave") {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.46), `${Math.round(Number(overlay.y || 0.46) * 100)}%`),
        rangeRow("영향 반경", "radius", 0.03, 0.4, 0.005, Number(overlay.radius || 0.12), `${Math.round(Number(overlay.radius || 0.12) * 100)}%`),
        rangeRow("파동 수", "waveCount", 2, 8, 1, Math.round(Number(overlay.waveCount || 4)), `${Math.round(Number(overlay.waveCount || 4))}`),
        rangeRow("간격", "waveSpacing", 0.01, 0.16, 0.005, Number(overlay.waveSpacing || 0.055), `${Math.round(Number(overlay.waveSpacing || 0.055) * 100)}%`),
        rangeRow("왜곡 강도", "amplitude", 0, 0.09, 0.002, Number(overlay.amplitude || 0.032), `${Math.round(Number(overlay.amplitude || 0.032) * 100)}%`),
        rangeRow("속도", "speed", 0.2, 3, 0.05, Number(overlay.speed || 1.2), `${Number(overlay.speed || 1.2).toFixed(2)}x`),
        rangeRow("부드러움", "softness", 0.05, 1, 0.01, Number(overlay.softness || 0.64), `${Math.round(Number(overlay.softness || 0.64) * 100)}%`),
        rangeRow("도입 시간", "drawDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.drawDuration || 0.18), `${formatTimelineSec(overlay.drawDuration || 0.18)}s`),
        rangeRow("유지 시간", "holdDuration", 0, 6, TIMELINE_TIME_STEP_SEC, Number(overlay.holdDuration || 0.74), `${formatTimelineSec(overlay.holdDuration || 0.74)}s`),
        rangeRow("사라짐", "fadeOutDuration", TIMELINE_TIME_STEP_SEC, 4, TIMELINE_TIME_STEP_SEC, Number(overlay.fadeOutDuration || 0.32), `${formatTimelineSec(overlay.fadeOutDuration || 0.32)}s`)
      );
    } else {
      rows.push(
        rangeRow("X 위치", "x", 0.01, 1, 0.01, Number(overlay.x || 0.5), `${Math.round(Number(overlay.x || 0.5) * 100)}%`),
        rangeRow("Y 위치", "y", 0.01, 1, 0.01, Number(overlay.y || 0.5), `${Math.round(Number(overlay.y || 0.5) * 100)}%`),
        rangeRow("라인 수", "lineCount", 8, 14, 1, Math.round(Number(overlay.lineCount || 10)), `${Math.round(Number(overlay.lineCount || 10))}`),
        rangeRow("라인 길이", "lineLength", 0.01, 0.16, 0.005, Number(overlay.lineLength || 0.045), `${Math.round(Number(overlay.lineLength || 0.045) * 100)}%`),
        rangeRow("반경", "radius", 0.01, 0.2, 0.005, Number(overlay.radius || 0.07), `${Math.round(Number(overlay.radius || 0.07) * 100)}%`),
        rangeRow("두께", "strokeWidth", 1, 18, 0.5, Number(overlay.strokeWidth || 5), `${Number(overlay.strokeWidth || 5).toFixed(1)}px`),
        rangeRow("지속시간", "durationMs", 120, 1200, 10, Math.round(Number(overlay.durationMs || (Number(overlay.duration || 0.52) * 1000) || 520)), `${Math.round(Number(overlay.durationMs || (Number(overlay.duration || 0.52) * 1000) || 520))}ms`),
        rangeRow("퍼짐", "spreadAmount", 0, 1, 0.01, Number(overlay.spreadAmount ?? overlay.jitter ?? 0.18), `${Math.round(Number(overlay.spreadAmount ?? overlay.jitter ?? 0.18) * 100)}%`),
        rangeRow("투명도", "opacity", 0.1, 1, 0.01, Number(overlay.opacity ?? 0.96), `${Math.round(Number(overlay.opacity ?? 0.96) * 100)}%`),
        colorRow("색상", "color", normalizeColor(overlay.color, "#38bdf8"))
      );
    }

    pop.style.left = `${state.ui.fxPopover.x}px`;
    pop.style.top = `${state.ui.fxPopover.y}px`;
    pop.innerHTML = `<div class="fxPopoverHead">${getOverlayDisplayName(overlay)}</div>${rows.join("")}`;
    pop.classList.remove("hidden");
    hydrateRangeInputs(pop);
    pop.querySelectorAll("[data-fx-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const active = state.project.overlayItems.find((item) => item.id === overlay.id);
        if (!active) return;
        const field = input.dataset.fxField;
        const readout = input.parentElement?.querySelector("b");
        if (field === "color") {
          active.color = normalizeColor(input.value, active.color);
        } else if (field === "x" || field === "y") {
          const defaultY = active.overlayType === "underline"
            ? 0.78
            : (active.overlayType === "section_divider_slide"
                ? 0.24
                : (active.overlayType === "highlight_bar_sweep"
                    ? 0.42
                    : (((active.overlayType === "zoom_focus" || active.overlayType === "zoom_out_focus" || active.overlayType === "drop_wave")) ? 0.46 : 0.5)));
          active[field] = clamp01(input.value, field === "x" ? 0.5 : defaultY);
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "radius") {
          active.radius = Number(input.value || active.radius || 0.11);
          if (active.overlayType === "circle") {
            active.radiusX = active.radius;
            active.radiusY = active.radius;
            active.size = active.radius;
          }
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "waveCount") {
          active.waveCount = Math.max(2, Math.min(8, Math.round(Number(input.value || active.waveCount || 4))));
          if (readout) readout.textContent = `${Math.round(Number(active.waveCount || 0))}`;
        } else if (field === "waveSpacing") {
          active.waveSpacing = Math.max(0.01, Number(input.value || active.waveSpacing || 0.055));
          if (readout) readout.textContent = `${Math.round(Number(active.waveSpacing || 0) * 100)}%`;
        } else if (field === "amplitude") {
          active.amplitude = Math.max(0, Number(input.value || active.amplitude || 0.032));
          if (readout) readout.textContent = `${Math.round(Number(active.amplitude || 0) * 100)}%`;
        } else if (field === "speed") {
          active.speed = Math.max(0.1, Number(input.value || active.speed || 1.2));
          if (readout) readout.textContent = `${Number(active.speed || 0).toFixed(2)}x`;
        } else if (field === "width") {
          active.width = Number(input.value || active.width || 0.24);
          if (active.overlayType === "underline") active.size = active.width;
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "boxWidth") {
          active.boxWidth = Number(input.value || active.boxWidth || 0.26);
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "boxHeight") {
          active.boxHeight = Number(input.value || active.boxHeight || 0.16);
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "lineLength") {
          active.lineLength = Number(input.value || active.lineLength || 0.045);
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "strokeWidth") {
          active.strokeWidth = Number(input.value || active.strokeWidth || 5);
          if (readout) readout.textContent = `${Number(input.value || 0).toFixed(1)}px`;
        } else if (field === "lineThickness") {
          active.lineThickness = Number(input.value || active.lineThickness || 4);
          if (readout) readout.textContent = `${Number(input.value || 0).toFixed(1)}px`;
        } else if (field === "lineCount") {
          active.lineCount = Math.round(Number(input.value || active.lineCount || 10));
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0))}`;
        } else if (field === "lineAngle") {
          active.lineAngle = Math.max(-180, Math.min(180, Number(input.value || active.lineAngle || 0)));
          if (readout) readout.textContent = `${Math.round(Number(active.lineAngle || 0))}°`;
        } else if (field === "holdDuration") {
          active.holdDuration = snapTimelineTimeSec(Number(input.value || active.holdDuration || 0));
          if (readout) readout.textContent = `${formatTimelineSec(active.holdDuration || 0)}s`;
        } else if (field === "drawDuration") {
          active.drawDuration = Math.max(TIMELINE_TIME_STEP_SEC, snapTimelineTimeSec(Number(input.value || active.drawDuration || 1.1)));
          if (readout) readout.textContent = `${formatTimelineSec(active.drawDuration || 0)}s`;
        } else if (field === "fadeOutDuration") {
          active.fadeOutDuration = Math.max(TIMELINE_TIME_STEP_SEC, snapTimelineTimeSec(Number(input.value || active.fadeOutDuration || 0.24)));
          if (readout) readout.textContent = `${formatTimelineSec(active.fadeOutDuration || 0)}s`;
        } else if (field === "duration") {
          active.duration = Math.max(MIN_OVERLAY_CLIP_SEC, snapTimelineTimeSec(Number(input.value || active.duration || 1.2)));
          if (readout) readout.textContent = `${formatTimelineSec(active.duration || 0)}s`;
        } else if (field === "durationMs") {
          const minMs = active.overlayType === "checkpoint_pop" ? 140 : 120;
          active.durationMs = Math.max(minMs, Math.round(Number(input.value || active.durationMs || 520)));
          active.duration = Math.max(MIN_OVERLAY_CLIP_SEC, active.durationMs / 1000);
          if (readout) readout.textContent = `${Math.round(Number(active.durationMs || 0))}ms`;
        } else if (field === "spreadAmount") {
          active.spreadAmount = clamp01(input.value, active.spreadAmount ?? 0.18);
          active.jitter = active.spreadAmount;
          if (readout) readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        } else if (field === "softness") {
          active.softness = Math.max(0.05, Math.min(1, Number(input.value || active.softness || 0.64)));
          if (readout) readout.textContent = `${Math.round(Number(active.softness || 0) * 100)}%`;
        } else if (field === "opacity") {
          const minOpacity = active.overlayType === "soft_spotlight" ? 0.05 : 0.1;
          active.opacity = Math.max(minOpacity, Math.min(1, Number(input.value || active.opacity || 0.96)));
          if (readout) readout.textContent = `${Math.round(Number(active.opacity || 0) * 100)}%`;
        }
        syncOverlayTiming(active);
        recalcTimeline();
        renderTimeline();
        renderPreviewAtTime(state.ui.currentTime);
        renderOverlayInspector();
      });
    });
    pop.querySelectorAll("[data-fx-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const active = state.project.overlayItems.find((item) => item.id === overlay.id);
        if (!active) return;
        const historyBefore = snapshotHistoryState();
        const action = String(button.dataset.fxAction || "");
        if (action === "drawPath") {
          state.ui.motionPathDrawOverlayId = active.id;
          state.ui.currentTime = snapTimelineTimeSec(Number(active.start || state.ui.currentTime || 0));
          renderPreviewAtTime(state.ui.currentTime);
          return;
        }
        if (action === "resetPath") {
          active.deltaX = 0;
          active.deltaY = 0;
          state.ui.motionPathDrawOverlayId = active.id;
          syncOverlayTiming(active);
          recalcTimeline();
          renderTimeline();
          renderPreviewAtTime(state.ui.currentTime);
          renderOverlayInspector();
          commitHistorySnapshot(historyBefore);
        }
      });
    });
  }

  function bindFxPopoverDismiss() {
    document.addEventListener("mousedown", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#fxClipPopover, .overlayGearBtn")) return;
      hideFxPopover();
    });
    window.addEventListener("blur", hideFxPopover);
  }

  function ensureTransitionPopover() {
    let pop = document.getElementById("transitionClipPopover");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "transitionClipPopover";
      pop.className = "fxClipPopover transitionClipPopover hidden";
      document.body.appendChild(pop);
    }
    return pop;
  }

  function hideTransitionPopover() {
    state.ui.transitionPopover.key = null;
    const pop = document.getElementById("transitionClipPopover");
    pop?.classList.add("hidden");
  }

  function showTransitionPopover(targetKey, anchorEl) {
    const target = buildTransitionTargetFromKey(targetKey);
    if (!target) return;
    const rect = anchorEl?.getBoundingClientRect?.();
    state.ui.transitionPopover.key = target.transitionKey || String(target.boundaryIdx);
    state.ui.transitionPopover.anchorX = Math.round(rect?.right || 0);
    state.ui.transitionPopover.anchorY = Math.round(rect?.bottom || 0);
    renderTransitionPopover();
  }

  function updateTransitionFromPopover(field, rawValue) {
    const target = buildTransitionTargetFromKey(state.ui.transitionPopover.key);
    if (!target) return;
    runProjectMutationWithHistory(() => {
      const scope = target.kind === "boundary" ? "boundary" : target.scope;
      const existing = getTransitionForTarget(target) || makeTransitionPreset(target.kind === "boundary" ? "cross" : "fade", scope);
      const clip = target.kind === "edge"
        ? state.project.videoClips.find((item) => item.id === target.clipId)
        : null;
      const boundary = target.kind === "boundary"
        ? (state.ui.boundaries || []).find((item) => item.idx === target.boundaryIdx)
        : null;
      const next = {
        ...existing,
        scope
      };

      if (field === "type") {
        const type = String(rawValue || existing.type || "fade").toLowerCase();
        if (target.kind === "edge" && type === "cut") {
          writeTransitionForTarget(target, null);
          syncTransitions();
          renderAll();
          hideTransitionPopover();
          return true;
        }
        Object.assign(next, makeTransitionPreset(type, scope), {
          ...existing,
          type,
          label: getTransitionDisplayName(type)
        });
      } else if (field === "duration") {
        next.duration = clampTransitionDurationSec(Number(rawValue || next.duration || 0.5), boundary || clip, scope);
      } else if (field === "strength") {
        next.strength = Math.max(0.2, Math.min(1.6, Number(rawValue || next.strength || 1)));
      } else if (field === "intensity") {
        next.intensity = Math.max(0.35, Math.min(1.6, Number(rawValue || next.intensity || 1)));
      } else if (field === "tileDensity") {
        next.tileDensity = Math.max(0.2, Math.min(1, Number(rawValue || next.tileDensity || 0.68)));
      } else if (field === "sizeVariance") {
        next.sizeVariance = Math.max(0, Math.min(1, Number(rawValue || next.sizeVariance || 0.72)));
      } else if (field === "clusterCount") {
        next.clusterCount = Math.max(2, Math.min(8, Math.round(Number(rawValue || next.clusterCount || 4))));
      } else if (field === "clusterSpread") {
        next.clusterSpread = Math.max(0.2, Math.min(1, Number(rawValue || next.clusterSpread || 0.46)));
      } else if (field === "jitterSpeed") {
        next.jitterSpeed = Math.max(0.4, Math.min(2.4, Number(rawValue || next.jitterSpeed || 1.2)));
      } else if (field === "seed") {
        next.seed = Math.max(0, Math.min(999999, Math.round(Number(rawValue || next.seed || 17))));
      } else if (field === "edgeSoftness") {
        next.edgeSoftness = Math.max(0, Math.min(0.12, Number(rawValue || next.edgeSoftness || 0.024)));
      } else if (field === "anchorX" || field === "anchorY") {
        next[field] = Math.max(0, Math.min(1, Number(rawValue || next[field] || 0.5)));
      } else if (field === "easingPreset") {
        next.easingPreset = String(rawValue || "dynamic").toLowerCase() === "gentle" ? "gentle" : "dynamic";
      }

      writeTransitionForTarget(target, next);
      syncTransitions();
      renderAll();
      return true;
    });
    renderTransitionPopover();
  }

  function renderTransitionPopover() {
    const pop = ensureTransitionPopover();
    const target = buildTransitionTargetFromKey(state.ui.transitionPopover.key);
    if (!target) {
      pop.classList.add("hidden");
      return;
    }
    const scope = target.kind === "boundary" ? "boundary" : target.scope;
    const current = getTransitionForTarget(target) || makeTransitionPreset(target.kind === "boundary" ? "cross" : "fade", scope);
    const clip = target.kind === "edge"
      ? state.project.videoClips.find((item) => item.id === target.clipId)
      : null;
    const boundary = target.kind === "boundary"
      ? (state.ui.boundaries || []).find((item) => item.idx === target.boundaryIdx)
      : null;
    const durationMax = getTransitionDurationLimit(boundary || clip, scope);
    const typeOptions = getTransitionItems()
      .filter((item) => target.kind === "boundary" || (item.type !== "cross" && item.type !== "cut"))
      .map((item) => `<option value="${item.type}"${item.type === current.type ? " selected" : ""}>${item.name}</option>`)
      .join("");
    const rows = [
      `<label class="fxPopoverRow"><span>${t("transitionPopoverType", "Type")}</span><select data-transition-field="type">${typeOptions}</select></label>`,
      `<label class="fxPopoverRow"><span>${t("transitionPopoverDuration", "Duration")}</span><input data-transition-field="duration" type="range" min="${TIMELINE_TIME_STEP_SEC.toFixed(2)}" max="${durationMax.toFixed(2)}" step="${TIMELINE_TIME_STEP_SEC.toFixed(2)}" value="${Math.max(TIMELINE_TIME_STEP_SEC, Number(current.duration || 0.5)).toFixed(2)}"><b>${Math.max(TIMELINE_TIME_STEP_SEC, Number(current.duration || 0.5)).toFixed(2)}s</b></label>`
    ];
    if (current.type === "sun_glitter_flash" || current.type === "focus_pull_in" || String(current.type || "").startsWith("blur_slide_")) {
      rows.push(
        `<label class="fxPopoverRow"><span>${t("transitionPopoverStrength", "Strength")}</span><input data-transition-field="strength" type="range" min="0.2" max="1.6" step="0.05" value="${Number(current.strength || 1).toFixed(2)}"><b>${Number(current.strength || 1).toFixed(2)}x</b></label>`
      );
    }
    if (current.type === "cyber_mosaic_burst") {
      rows.push(
        `<label class="fxPopoverRow"><span>${t("transitionPopoverIntensity", "Intensity")}</span><input data-transition-field="intensity" type="range" min="0.35" max="1.6" step="0.05" value="${Number(current.intensity || 1).toFixed(2)}"><b>${Number(current.intensity || 1).toFixed(2)}x</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverTileDensity", "Tile Density")}</span><input data-transition-field="tileDensity" type="range" min="0.2" max="1" step="0.05" value="${Number(current.tileDensity || 0.68).toFixed(2)}"><b>${Math.round(Number(current.tileDensity || 0.68) * 100)}%</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverSizeVariance", "Size Variance")}</span><input data-transition-field="sizeVariance" type="range" min="0" max="1" step="0.05" value="${Number(current.sizeVariance || 0.72).toFixed(2)}"><b>${Math.round(Number(current.sizeVariance || 0.72) * 100)}%</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverClusterCount", "Cluster Count")}</span><input data-transition-field="clusterCount" type="range" min="2" max="8" step="1" value="${Math.max(2, Math.min(8, Math.round(Number(current.clusterCount || 4))))}"><b>${Math.max(2, Math.min(8, Math.round(Number(current.clusterCount || 4))))}</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverClusterSpread", "Cluster Spread")}</span><input data-transition-field="clusterSpread" type="range" min="0.2" max="1" step="0.05" value="${Number(current.clusterSpread || 0.46).toFixed(2)}"><b>${Math.round(Number(current.clusterSpread || 0.46) * 100)}%</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverJitterSpeed", "Jitter Speed")}</span><input data-transition-field="jitterSpeed" type="range" min="0.4" max="2.4" step="0.05" value="${Number(current.jitterSpeed || 1.2).toFixed(2)}"><b>${Number(current.jitterSpeed || 1.2).toFixed(2)}x</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverEdgeSoftness", "Edge Softness")}</span><input data-transition-field="edgeSoftness" type="range" min="0" max="0.12" step="0.005" value="${Number(current.edgeSoftness || 0.024).toFixed(3)}"><b>${Math.round(Number(current.edgeSoftness || 0.024) * 1000) / 10}%</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverSeed", "Seed")}</span><input data-transition-field="seed" type="number" min="0" max="999999" step="1" value="${Math.max(0, Math.min(999999, Math.round(Number(current.seed || 17))))}"><b>${Math.max(0, Math.min(999999, Math.round(Number(current.seed || 17))))}</b></label>`
      );
    }
    if (current.type === "focus_pull_in") {
      rows.push(
        `<label class="fxPopoverRow"><span>${t("transitionPopoverFocusX", "Focus X")}</span><input data-transition-field="anchorX" type="range" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, Number(current.anchorX ?? 0.5))).toFixed(2)}"><b>${Math.round(Math.max(0, Math.min(1, Number(current.anchorX ?? 0.5))) * 100)}%</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverFocusY", "Focus Y")}</span><input data-transition-field="anchorY" type="range" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, Number(current.anchorY ?? 0.5))).toFixed(2)}"><b>${Math.round(Math.max(0, Math.min(1, Number(current.anchorY ?? 0.5))) * 100)}%</b></label>`,
        `<label class="fxPopoverRow"><span>${t("transitionPopoverEasing", "Easing")}</span><select data-transition-field="easingPreset"><option value="dynamic"${current.easingPreset === "dynamic" ? " selected" : ""}>${t("transitionEasingDynamic", "Dynamic")}</option><option value="gentle"${current.easingPreset === "gentle" ? " selected" : ""}>${t("transitionEasingGentle", "Gentle")}</option></select></label>`
      );
    }
    rows.push(`<div class="transitionPopoverActions"><button type="button" class="ctxItem" data-transition-action="remove">${target.kind === "boundary" ? t("transitionPopoverRemoveBoundary", "Change to Cut") : t("transitionPopoverRemoveEdge", "Remove Transition")}</button></div>`);

    const targetLabel = target.kind === "boundary"
      ? t("transitionPopoverBoundaryTitle", "Boundary Transition")
      : (target.scope === "intro" ? t("transitionPopoverIntroTitle", "Clip Intro Transition") : t("transitionPopoverOutroTitle", "Clip Outro Transition"));
    pop.style.left = `${state.ui.transitionPopover.anchorX}px`;
    pop.style.top = `${state.ui.transitionPopover.anchorY}px`;
    pop.innerHTML = `<div class="fxPopoverHead">${targetLabel}</div>${rows.join("")}`;
    pop.classList.remove("hidden");
    hydrateRangeInputs(pop);

    pop.querySelectorAll("[data-transition-field]").forEach((input) => {
      const updateReadout = () => {
        const readout = input.parentElement?.querySelector("b");
        if (!readout) return;
        if (input.dataset.transitionField === "duration") readout.textContent = `${Number(input.value || 0).toFixed(2)}s`;
        if (input.dataset.transitionField === "strength") readout.textContent = `${Number(input.value || 1).toFixed(2)}x`;
        if (input.dataset.transitionField === "intensity") readout.textContent = `${Number(input.value || 1).toFixed(2)}x`;
        if (input.dataset.transitionField === "tileDensity" || input.dataset.transitionField === "sizeVariance" || input.dataset.transitionField === "clusterSpread") readout.textContent = `${Math.round(Number(input.value || 0) * 100)}%`;
        if (input.dataset.transitionField === "clusterCount" || input.dataset.transitionField === "seed") readout.textContent = `${Math.round(Number(input.value || 0))}`;
        if (input.dataset.transitionField === "jitterSpeed") readout.textContent = `${Number(input.value || 1).toFixed(2)}x`;
        if (input.dataset.transitionField === "edgeSoftness") readout.textContent = `${Math.round(Number(input.value || 0) * 1000) / 10}%`;
        if (input.dataset.transitionField === "anchorX" || input.dataset.transitionField === "anchorY") readout.textContent = `${Math.round(Number(input.value || 0.5) * 100)}%`;
      };
      input.addEventListener("input", updateReadout);
      input.addEventListener("change", () => {
        updateTransitionFromPopover(input.dataset.transitionField, input.value);
      });
    });
    pop.querySelector("[data-transition-action='remove']")?.addEventListener("click", () => {
      runProjectMutationWithHistory(() => {
        if (target.kind === "boundary") {
          writeTransitionForTarget(target, makeTransitionPreset("cut", "boundary"));
        } else {
          writeTransitionForTarget(target, null);
        }
        syncTransitions();
        renderAll();
        return true;
      });
      if (target.kind === "boundary") renderTransitionPopover();
      else hideTransitionPopover();
    });
  }

  function bindTransitionPopoverDismiss() {
    document.addEventListener("mousedown", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#transitionClipPopover, .transitionBridge, .transitionChip")) return;
      hideTransitionPopover();
    });
    window.addEventListener("blur", hideTransitionPopover);
  }

  function createDetachedAudioPreviewSession({ fileUrl, debug = false } = {}) {
    const entries = new Map();
    const isDebugEnabled = () => (typeof debug === "function" ? !!debug() : !!debug);
    const log = (label, payload) => {
      if (!isDebugEnabled()) return;
      console.log(`[detached_audio] ${label}`, payload);
    };

    function ensureEntry(audio) {
      let entry = entries.get(audio.id);
      if (entry) return entry;
      const el = document.createElement("audio");
      el.preload = "auto";
      el.playsInline = true;
      entry = {
        id: audio.id,
        el,
        sourcePath: "",
        pendingTime: NaN,
        shouldPlay: false,
        lastSeekAt: 0,
        lastSeekTarget: NaN,
        lastPlayAt: 0,
        lastPauseAt: 0
      };
      el.onloadedmetadata = () => {
        if (Number.isFinite(entry.pendingTime)) {
          try { el.currentTime = Math.max(0, entry.pendingTime); } catch {}
        }
        if (entry.shouldPlay) {
          try {
            const p = el.play?.();
            if (p && typeof p.catch === "function") p.catch(() => {});
          } catch {}
        } else {
          try { el.pause?.(); } catch {}
        }
      };
      entries.set(audio.id, entry);
      return entry;
    }

    function maybePause(entry) {
      const now = performance.now();
      if ((now - entry.lastPauseAt) < 40 || entry.el.paused) return;
      entry.lastPauseAt = now;
      try { entry.el.pause?.(); } catch {}
    }

    function maybePlay(entry) {
      const now = performance.now();
      if ((now - entry.lastPlayAt) < 100 || !entry.el.paused) return;
      entry.lastPlayAt = now;
      try {
        const p = entry.el.play?.();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {}
    }

    function maybeSeek(entry, targetTime, threshold, force = false) {
      const now = performance.now();
      if (!force && Number.isFinite(entry.lastSeekTarget) && (now - entry.lastSeekAt) < DETACHED_AUDIO_RATE_LIMIT_MS && Math.abs(entry.lastSeekTarget - targetTime) <= 0.02) {
        return false;
      }
      const current = Number(entry.el.currentTime);
      const drift = Number.isFinite(current) ? Math.abs(current - targetTime) : Infinity;
      if (!force && drift <= threshold) return false;
      try { entry.el.currentTime = Math.max(0, targetTime); } catch { return false; }
      entry.lastSeekAt = now;
      entry.lastSeekTarget = targetTime;
      return true;
    }

    function applyAudioPlaybackRate(entry, audio) {
      if (!entry?.el) return;
      const rate = audio ? getAudioItemPlaybackRate(audio) : 1;
      try {
        entry.el.playbackRate = Math.max(0.0625, Math.min(16, Number(rate || 1)));
      } catch {
        entry.el.playbackRate = 1;
      }
    }

    function loadSourceIfNeeded(entry, sourcePath) {
      if (!sourcePath || entry.sourcePath === sourcePath) return false;
      entry.sourcePath = sourcePath;
      entry.el.src = fileUrl(sourcePath);
      entry.el.load();
      return true;
    }

    function reset() {
      entries.forEach((entry) => maybePause(entry));
    }

    function render(timelineTime, options = {}) {
      const playing = !!options.playing;
      const explicitSeek = !!options.explicitSeek;
      const detachedItems = (state.project.audioItems || []).filter((audio) => audio.linkMode !== "linked");
      const aliveIds = new Set(detachedItems.map((audio) => audio.id));

      entries.forEach((entry, id) => {
        if (!aliveIds.has(id)) {
          maybePause(entry);
          entries.delete(id);
        }
      });

      detachedItems.forEach((audio) => {
        const clipStart = Number(audio.start || 0);
        const clipEnd = clipStart + Math.max(MIN_TIMELINE_CLIP_SEC, Number(audio.duration || MIN_TIMELINE_CLIP_SEC));
        const active = Number(timelineTime || 0) >= clipStart - 1e-6 && Number(timelineTime || 0) <= clipEnd + 1e-6;
        const entry = ensureEntry(audio);
        const sourcePath = getAudioItemSourcePath(audio);
        const preview = getAudioItemPreviewState(audio, timelineTime);
        const reloaded = loadSourceIfNeeded(entry, sourcePath);
        entry.pendingTime = preview.sourceTime;
        entry.shouldPlay = playing && active;
        applyAudioPlaybackRate(entry, audio);
        entry.el.volume = clamp01(preview.volume, 0);
        entry.el.muted = preview.volume <= 0.0001;

        if (!active) {
          maybePause(entry);
          return;
        }

        const forced = explicitSeek || reloaded || entry.el.ended || (playing && entry.el.paused);
        const threshold = playing ? DETACHED_AUDIO_PLAY_SEEK_SEC : DETACHED_AUDIO_PAUSE_SEEK_SEC;
        maybeSeek(entry, preview.sourceTime, threshold, forced);
        if (playing) maybePlay(entry);
        else maybePause(entry);

        log("render", {
          audioId: audio.id,
          playing,
          sourceTime: preview.sourceTime,
          volume: preview.volume,
          active,
          reloaded
        });
      });
    }

    return { render, reset };
  }

  function setPreviewSource(previewPath, clipId = null) {
    state.ui.previewClipId = clipId;
    els.video.src = fileUrl(previewPath);
    els.dropZone.classList.add("hasVideo");
    els.video.load();
  }

  function ensurePreviewVideoStage() {
    if (!els.dropZone) return null;
    let stage = document.getElementById("previewVideoStage");
    if (!stage) {
      stage = document.createElement("div");
      stage.id = "previewVideoStage";
      els.dropZone.appendChild(stage);
    }
    let backdrop = document.getElementById("previewFrameBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "previewFrameBackdrop";
      stage.prepend(backdrop);
    }
    return stage;
  }

  function applyPreviewFrameLayout() {
    const stage = ensurePreviewVideoStage();
    if (!stage || !overlayEngine?.getFrameBox || !els.dropZone) return null;
    const frame = overlayEngine.getFrameBox(els.dropZone, state.settings.resolutionName, state.settings.aspectRatio);
    if (!frame) return null;
    stage.style.setProperty("--preview-frame-left", `${Math.max(0, frame.left).toFixed(3)}px`);
    stage.style.setProperty("--preview-frame-top", `${Math.max(0, frame.top).toFixed(3)}px`);
    stage.style.setProperty("--preview-frame-width", `${Math.max(1, frame.width).toFixed(3)}px`);
    stage.style.setProperty("--preview-frame-height", `${Math.max(1, frame.height).toFixed(3)}px`);
    stage.dataset.aspectRatio = state.settings.aspectRatio || "16:9";
    return frame;
  }

  function schedulePreviewFrameRefresh() {
    if (previewFrameRefreshRaf) return;
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 0);
    previewFrameRefreshRaf = raf(() => {
      previewFrameRefreshRaf = 0;
      applyPreviewFrameLayout();
      applyPreviewClipVisuals();
      renderPreviewOverlays();
      applyPreviewDropWaveEffect(state.ui.currentTime, getActiveOverlayItemsAt(state.ui.currentTime));
      if (isVideoCropModalOpen()) renderVideoCropModalPreview(state.ui.currentTime);
    });
  }

  function initPreviewResizeObserver() {
    if (previewResizeObserver) return;
    const targets = [
      els.dropZone,
      document.getElementById("projectPreview"),
      document.getElementById("panelRight"),
      document.querySelector(".panelRight")
    ].filter(Boolean);

    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", schedulePreviewFrameRefresh);
      return;
    }

    previewResizeObserver = new ResizeObserver(() => {
      schedulePreviewFrameRefresh();
    });
    targets.forEach((node) => previewResizeObserver.observe(node));
    window.addEventListener("resize", schedulePreviewFrameRefresh);
  }

  function renderPreviewOverlays(timeSec = state.ui.currentTime) {
    const tt = Math.max(0, Math.min(state.ui.viewDuration, Number(timeSec || 0)));
    const activeOverlays = getActiveOverlayItemsAt(tt);
    overlayEngine?.renderOverlays?.(els.dropZone, activeOverlays, {
      resolutionName: state.settings.resolutionName,
      aspectRatio: state.settings.aspectRatio,
      currentTime: tt
    });
    if (transport?.isPlaying?.()) {
      clearPreviewOverlayInteraction();
      return;
    }
    if (getSelectedActiveVideoAt(tt)) renderPreviewVideoInteraction(tt);
    else renderPreviewOverlayInteraction(tt);
  }

  function createManagedPreviewVideo(id = "") {
    const video = id ? (document.getElementById(id) || document.createElement("video")) : document.createElement("video");
    if (id) video.id = id;
    video.preload = "auto";
    video.playsInline = true;
    video.controls = false;
    video.muted = true;
    video.style.pointerEvents = "none";
    video.classList.add("previewSectionVideo");
    return video;
  }

  function createManagedPreviewCanvas() {
    const canvas = document.createElement("canvas");
    canvas.classList.add("previewSectionCanvas");
    canvas.width = 2;
    canvas.height = 2;
    return canvas;
  }

  function ensurePreviewSectionSurface(section = 1) {
    const safeSection = Math.max(1, Number(section || 1));
    const stage = ensurePreviewVideoStage();
    if (!stage) return null;
    let surface = stage.querySelector(`.previewSectionSurface[data-preview-section="${safeSection}"]`);
    if (!surface) {
      surface = document.createElement("div");
      surface.className = "previewSectionSurface";
      surface.dataset.previewSection = String(safeSection);
      stage.appendChild(surface);
    }

    let black = surface.querySelector(".previewSectionBlackLayer");
    if (!black) {
      black = document.createElement("div");
      black.className = "previewSectionBlackLayer";
      if (safeSection === 1) black.id = "previewBlackLayer";
      surface.appendChild(black);
    }

    let baseHost = surface.querySelector(".previewSectionHost.previewSectionBaseHost");
    if (!baseHost) {
      baseHost = document.createElement("div");
      baseHost.className = "previewSectionHost previewSectionBaseHost";
      if (safeSection === 1) baseHost.id = "previewBaseHost";
      surface.appendChild(baseHost);
    }

    let overlayHost = surface.querySelector(".previewSectionHost.previewSectionOverlayHost");
    if (!overlayHost) {
      overlayHost = document.createElement("div");
      overlayHost.className = "previewSectionHost previewSectionOverlayHost";
      if (safeSection === 1) overlayHost.id = "previewOverlayHost";
      surface.appendChild(overlayHost);
    }

    let baseVideo = safeSection === 1
      ? els.video
      : baseHost.querySelector(".previewSectionVideo.previewSectionBaseVideo");
    if (!baseVideo) baseVideo = safeSection === 1 ? els.video : createManagedPreviewVideo();
    baseVideo.classList.add("previewSectionVideo", "previewSectionBaseVideo");
    if (safeSection !== 1) baseVideo.dataset.previewSection = String(safeSection);
    if (baseVideo.parentElement !== baseHost) baseHost.appendChild(baseVideo);

    let baseCanvas = baseHost.querySelector(".previewSectionCanvas.previewSectionBaseCanvas");
    if (!baseCanvas) {
      baseCanvas = createManagedPreviewCanvas();
      baseCanvas.classList.add("previewSectionBaseCanvas");
    }
    if (safeSection !== 1) baseCanvas.dataset.previewSection = String(safeSection);
    if (baseCanvas.parentElement !== baseHost) baseHost.appendChild(baseCanvas);

    let overlayVideo = safeSection === 1
      ? document.getElementById("videoOverlay")
      : overlayHost.querySelector(".previewSectionVideo.previewSectionOverlayVideo");
    if (!overlayVideo) overlayVideo = safeSection === 1 ? createManagedPreviewVideo("videoOverlay") : createManagedPreviewVideo();
    overlayVideo.classList.add("previewSectionVideo", "previewSectionOverlayVideo");
    if (safeSection !== 1) overlayVideo.dataset.previewSection = String(safeSection);
    if (overlayVideo.parentElement !== overlayHost) overlayHost.appendChild(overlayVideo);

    let overlayCanvas = overlayHost.querySelector(".previewSectionCanvas.previewSectionOverlayCanvas");
    if (!overlayCanvas) {
      overlayCanvas = createManagedPreviewCanvas();
      overlayCanvas.classList.add("previewSectionOverlayCanvas");
    }
    if (safeSection !== 1) overlayCanvas.dataset.previewSection = String(safeSection);
    if (overlayCanvas.parentElement !== overlayHost) overlayHost.appendChild(overlayCanvas);

    surface.style.zIndex = String(Math.max(2, 200 - safeSection));
    return {
      section: safeSection,
      surface,
      black,
      baseHost,
      overlayHost,
      base: baseVideo,
      overlay: overlayVideo,
      baseCanvas,
      overlayCanvas
    };
  }

  function getVideoLayers(section = 1) {
    const surface = ensurePreviewSectionSurface(section);
    return surface
      ? { base: surface.base, overlay: surface.overlay, black: surface.black, baseCanvas: surface.baseCanvas, overlayCanvas: surface.overlayCanvas }
      : { base: null, overlay: null, black: null, baseCanvas: null, overlayCanvas: null };
  }

  function getVideoHosts(section = 1) {
    const surface = ensurePreviewSectionSurface(section);
    return surface
      ? { base: surface.baseHost, overlay: surface.overlayHost, surface: surface.surface }
      : { base: null, overlay: null, surface: null };
  }

  const dropWavePreviewRuntime = {
    svg: null,
    filter: null,
    image: null,
    displacement: null,
    canvas: null,
    ctx: null,
    mapWidth: 0,
    mapHeight: 0
  };

  function ensureDropWavePreviewFilterDefs() {
    if (dropWavePreviewRuntime.svg && dropWavePreviewRuntime.filter && dropWavePreviewRuntime.image && dropWavePreviewRuntime.displacement) {
      return dropWavePreviewRuntime;
    }
    const svgNs = "http://www.w3.org/2000/svg";
    const xlinkNs = "http://www.w3.org/1999/xlink";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.pointerEvents = "none";
    svg.style.opacity = "0";
    const defs = document.createElementNS(svgNs, "defs");
    const filter = document.createElementNS(svgNs, "filter");
    filter.setAttribute("id", "previewDropWaveFilter");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "1");
    filter.setAttribute("height", "1");
    filter.setAttribute("filterUnits", "objectBoundingBox");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const feImage = document.createElementNS(svgNs, "feImage");
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    feImage.setAttribute("width", "1");
    feImage.setAttribute("height", "1");
    feImage.setAttribute("preserveAspectRatio", "none");
    feImage.setAttribute("result", "dropWaveMap");
    feImage.setAttributeNS(xlinkNs, "href", "");

    const displace = document.createElementNS(svgNs, "feDisplacementMap");
    displace.setAttribute("in", "SourceGraphic");
    displace.setAttribute("in2", "dropWaveMap");
    displace.setAttribute("xChannelSelector", "R");
    displace.setAttribute("yChannelSelector", "G");
    displace.setAttribute("scale", "0");

    filter.appendChild(feImage);
    filter.appendChild(displace);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    dropWavePreviewRuntime.svg = svg;
    dropWavePreviewRuntime.filter = filter;
    dropWavePreviewRuntime.image = feImage;
    dropWavePreviewRuntime.displacement = displace;
    return dropWavePreviewRuntime;
  }

  function getActiveDropWavePreviewStates(timeSec, overlays = []) {
    if (!overlayEngine?.getDropWaveDistortionState || !els.dropZone) return [];
    const frame = overlayEngine.getFrameBox(els.dropZone, state.settings.resolutionName, state.settings.aspectRatio);
    if (!frame) return [];
    return (overlays || [])
      .filter((overlay) => overlay?.overlayType === "drop_wave")
      .map((overlay) => overlayEngine.getDropWaveDistortionState(frame, overlay, timeSec))
      .filter((entry) => entry && entry.temporal > 0.001 && entry.reachPx > 1 && entry.strengthPx > 0.001);
  }

  function ensureDropWavePreviewMapCanvas(mapWidth, mapHeight) {
    const runtime = ensureDropWavePreviewFilterDefs();
    if (!runtime.canvas) {
      runtime.canvas = document.createElement("canvas");
      runtime.ctx = runtime.canvas.getContext("2d", { willReadFrequently: true });
    }
    if (runtime.mapWidth !== mapWidth || runtime.mapHeight !== mapHeight) {
      runtime.mapWidth = mapWidth;
      runtime.mapHeight = mapHeight;
      runtime.canvas.width = mapWidth;
      runtime.canvas.height = mapHeight;
    }
    return runtime;
  }

  function buildDropWavePreviewMap(stageWidth, stageHeight, states = []) {
    const longestSide = Math.max(stageWidth, stageHeight, 1);
    const scale = Math.min(1, 320 / longestSide);
    const mapWidth = Math.max(96, Math.round(stageWidth * scale));
    const mapHeight = Math.max(54, Math.round(stageHeight * scale));
    const runtime = ensureDropWavePreviewMapCanvas(mapWidth, mapHeight);
    const ctx = runtime.ctx;
    if (!ctx) return null;
    const imageData = ctx.createImageData(mapWidth, mapHeight);
    const pixels = imageData.data;
    const maxStrength = Math.max(
      4,
      ...states.map((entry) => Math.max(0, Number(entry.strengthPx || 0) * Math.max(0.15, Number(entry.temporal || 0))))
    );
    const smoothstep = (v) => {
      const unit = Math.max(0, Math.min(1, Number(v || 0)));
      return unit * unit * (3 - (2 * unit));
    };
    const mix = (a, b, t) => a + ((b - a) * t);
    let ptr = 0;
    for (let py = 0; py < mapHeight; py++) {
      const sampleY = stageHeight <= 1 ? 0 : (py / Math.max(1, mapHeight - 1)) * stageHeight;
      for (let px = 0; px < mapWidth; px++) {
        const sampleX = stageWidth <= 1 ? 0 : (px / Math.max(1, mapWidth - 1)) * stageWidth;
        let offsetX = 0;
        let offsetY = 0;
        states.forEach((entry) => {
          const dx = sampleX - entry.cx;
          const dy = sampleY - entry.cy;
          const dist = Math.sqrt((dx * dx) + (dy * dy));
          if (dist > entry.reachPx || entry.reachPx <= 0.001) return;
          const safeDist = Math.max(dist, 1);
          const dirX = dx / safeDist;
          const dirY = dy / safeDist;
          const baseSpatial = Math.max(0, 1 - (dist / entry.reachPx));
          const shapedSpatial = mix(baseSpatial, smoothstep(baseSpatial), Math.max(0.05, Math.min(1, Number(entry.softness || 0.64))));
          const phase1 = ((dist / Math.max(8, entry.waveLenPx)) * Math.PI * 2) - (entry.localTime * entry.speed * Math.PI * 2);
          const phase2 = ((dist / Math.max(8, entry.waveLenPx * 0.62)) * Math.PI * 2) - (entry.localTime * entry.speed * 1.37 * Math.PI * 2);
          const offset = entry.strengthPx * entry.temporal * shapedSpatial * ((Math.sin(phase1) * 0.74) + (Math.sin(phase2) * 0.26));
          offsetX += dirX * offset;
          offsetY += dirY * offset;
        });
        const encodedX = Math.max(0, Math.min(255, 128 + (Math.max(-1, Math.min(1, offsetX / maxStrength)) * 127)));
        const encodedY = Math.max(0, Math.min(255, 128 + (Math.max(-1, Math.min(1, offsetY / maxStrength)) * 127)));
        pixels[ptr++] = encodedX;
        pixels[ptr++] = encodedY;
        pixels[ptr++] = 128;
        pixels[ptr++] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return {
      dataUrl: runtime.canvas.toDataURL("image/png"),
      scalePx: Math.max(4, maxStrength * 2.2)
    };
  }

  function applyPreviewDropWaveEffect(timeSec, overlays = []) {
    const stage = ensurePreviewVideoStage();
    if (!stage) return;
    const states = getActiveDropWavePreviewStates(timeSec, overlays);
    if (!states.length) {
      stage.style.filter = "none";
      return;
    }
    const bounds = stage.getBoundingClientRect();
    const stageWidth = Math.max(1, Math.round(bounds.width || stage.clientWidth || els.dropZone?.clientWidth || 1));
    const stageHeight = Math.max(1, Math.round(bounds.height || stage.clientHeight || els.dropZone?.clientHeight || 1));
    const runtime = ensureDropWavePreviewFilterDefs();
    const built = buildDropWavePreviewMap(stageWidth, stageHeight, states);
    if (!built?.dataUrl) {
      stage.style.filter = "none";
      return;
    }
    runtime.image.setAttribute("x", "0");
    runtime.image.setAttribute("y", "0");
    runtime.image.setAttribute("width", String(stageWidth));
    runtime.image.setAttribute("height", String(stageHeight));
    runtime.image.setAttribute("href", built.dataUrl);
    runtime.image.setAttributeNS("http://www.w3.org/1999/xlink", "href", built.dataUrl);
    runtime.displacement.setAttribute("scale", Number(built.scalePx || 0).toFixed(2));
    stage.style.filter = `url(#previewDropWaveFilter)`;
  }

  function getActivePreviewSections() {
    const stage = ensurePreviewVideoStage();
    if (!stage) return [];
    return [...stage.querySelectorAll(".previewSectionSurface")]
      .map((el) => Math.max(1, Number(el.dataset.previewSection || 1)))
      .sort((a, b) => a - b);
  }

  function getPreviewSession(section = 1) {
    const safeSection = Math.max(1, Number(section || 1));
    if (!previewSessions.has(safeSection)) {
      const session = previewSessionApi?.createSession?.({
        getLayers: () => getVideoLayers(safeSection),
        fileUrl,
        debug: () => !!getDebugFlags().preview,
        requestRender: () => renderPreviewAtTime(state.ui.currentTime)
      }) || null;
      previewSessions.set(safeSection, session);
    }
    return previewSessions.get(safeSection) || null;
  }

  function resetPreviewSessions() {
    previewSessions.forEach((session) => session?.reset?.());
  }

  function syncPreviewSectionVisibility(activeSections = []) {
    const stage = ensurePreviewVideoStage();
    if (!stage) return;
    const active = new Set((activeSections || []).map((section) => Math.max(1, Number(section || 1))));
    [...stage.querySelectorAll(".previewSectionSurface")].forEach((surfaceEl) => {
      const section = Math.max(1, Number(surfaceEl.dataset.previewSection || 1));
      surfaceEl.classList.toggle("hidden", !active.has(section));
    });
  }

  function getPreviewFrameBox() {
    if (!overlayEngine?.getFrameBox || !els.dropZone) return null;
    return overlayEngine.getFrameBox(els.dropZone, state.settings.resolutionName, state.settings.aspectRatio);
  }

  function getResolvedPreviewClipMediaMeta(clip, options = {}) {
    const mediaWidth = Number(options.mediaWidth || 0);
    const mediaHeight = Number(options.mediaHeight || 0);
    if (mediaWidth > 1 && mediaHeight > 1) {
      return {
        ...(clip?.meta || {}),
        width: mediaWidth,
        height: mediaHeight,
        displayWidth: mediaWidth,
        displayHeight: mediaHeight,
        rotation: 0
      };
    }
    if (clip?.id) {
      const sections = getActivePreviewSections();
      for (const section of sections) {
        const { base, overlay } = getVideoLayers(section);
        for (const mediaEl of [base, overlay]) {
          if (!mediaEl || String(mediaEl.dataset?.clipId || "") !== String(clip.id)) continue;
          const elementWidth = Number(mediaEl.videoWidth || mediaEl.clientWidth || 0);
          const elementHeight = Number(mediaEl.videoHeight || mediaEl.clientHeight || 0);
          if (elementWidth > 1 && elementHeight > 1) {
            return {
              ...(clip?.meta || {}),
              width: elementWidth,
              height: elementHeight,
              displayWidth: elementWidth,
              displayHeight: elementHeight,
              rotation: 0
            };
          }
        }
      }
    }
    return clip?.meta || {};
  }

  function getPreviewClipLayout(clip, options = {}) {
    if (!clip || !clipVisuals?.computeLayout) return null;
    const frame = getPreviewFrameBox();
    if (!frame) return null;
    const includeMotion = options.includeMotion !== false;
    const motionOffset = includeMotion ? getMotionPathOffsetForClip(clip, state.ui.currentTime) : { x: 0, y: 0 };
    const layoutClip = (Math.abs(motionOffset.x) > 1e-6 || Math.abs(motionOffset.y) > 1e-6)
      ? {
          ...clip,
          positionX: Number(clip.positionX ?? 0.5) + motionOffset.x,
          positionY: Number(clip.positionY ?? 0.5) + motionOffset.y,
          placementPreset: "custom"
        }
      : clip;
    const inner = clipVisuals.computeLayout(
      layoutClip,
      getResolvedPreviewClipMediaMeta(clip, options),
      frame.width,
      frame.height
    );
    return {
      ...inner,
      frame,
      frameLeft: frame.left,
      frameTop: frame.top,
      rawLeftAbs: frame.left + inner.rawLeft,
      rawTopAbs: frame.top + inner.rawTop,
      displayLeftAbs: frame.left + inner.displayLeft,
      displayTopAbs: frame.top + inner.displayTop
    };
  }

  function resetPreviewClipVisual(el) {
    if (!el) return;
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.transform = "none";
    el.style.transformOrigin = "50% 50%";
    el.style.clipPath = "none";
    el.style.webkitClipPath = "none";
  }

  function getPreviewChromaCanvasState(canvasEl) {
    if (!canvasEl) return null;
    let stateForCanvas = previewChromaCanvasState.get(canvasEl);
    if (stateForCanvas) return stateForCanvas;
    const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    stateForCanvas = { ctx };
    previewChromaCanvasState.set(canvasEl, stateForCanvas);
    return stateForCanvas;
  }

  function clearPreviewChromaCanvas(canvasEl) {
    if (!canvasEl) return;
    const stateForCanvas = getPreviewChromaCanvasState(canvasEl);
    if (stateForCanvas?.ctx) {
      stateForCanvas.ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
    canvasEl.style.opacity = "0";
  }

  function renderPreviewChromaCanvas(videoEl, canvasEl, clip) {
    if (!videoEl || !canvasEl || !clip) return false;
    if (videoEl.readyState < 2 || !Number.isFinite(videoEl.videoWidth) || !Number.isFinite(videoEl.videoHeight) || videoEl.videoWidth < 2 || videoEl.videoHeight < 2) {
      clearPreviewChromaCanvas(canvasEl);
      return false;
    }
    const layout = getPreviewClipLayout(clip, {
      mediaWidth: Number(videoEl.videoWidth || 0),
      mediaHeight: Number(videoEl.videoHeight || 0)
    });
    if (!layout) {
      clearPreviewChromaCanvas(canvasEl);
      return false;
    }
    const maxProcessEdge = 960;
    const processScale = Math.min(1, maxProcessEdge / Math.max(1, layout.rawWidth, layout.rawHeight));
    const processWidth = Math.max(2, Math.round(layout.rawWidth * processScale));
    const processHeight = Math.max(2, Math.round(layout.rawHeight * processScale));
    if (canvasEl.width !== processWidth) canvasEl.width = processWidth;
    if (canvasEl.height !== processHeight) canvasEl.height = processHeight;
    const canvasState = getPreviewChromaCanvasState(canvasEl);
    if (!canvasState?.ctx) return false;
    const ctx = canvasState.ctx;
    ctx.clearRect(0, 0, processWidth, processHeight);
    try {
      ctx.drawImage(videoEl, 0, 0, processWidth, processHeight);
    } catch {
      clearPreviewChromaCanvas(canvasEl);
      return false;
    }
    let frame = null;
    try {
      frame = ctx.getImageData(0, 0, processWidth, processHeight);
    } catch {
      clearPreviewChromaCanvas(canvasEl);
      return false;
    }
    const chroma = getVideoChromaKeyState(clip);
    const keyRgb = rgbFromHexColor(chroma.color);
    const keyLumaChroma = rgbToLumaChroma(keyRgb.r, keyRgb.g, keyRgb.b);
    const similarity = Math.max(0.01, Math.min(0.6, Number(chroma.similarity || 0.14)));
    const blend = Math.max(0, Math.min(0.4, Number(chroma.blend || 0.08)));
    const reflectionTolerance = Math.max(0, Math.min(0.5, Number(chroma.reflectionTolerance || 0)));
    const px = frame.data;
    const maxDistance = Math.sqrt(255 * 255 * 3);
    const effectiveBlend = Math.max(0, blend + (reflectionTolerance * 0.1));
    for (let i = 0; i < px.length; i += 4) {
      const dr = px[i] - keyRgb.r;
      const dg = px[i + 1] - keyRgb.g;
      const db = px[i + 2] - keyRgb.b;
      const rgbDistance = Math.sqrt((dr * dr) + (dg * dg) + (db * db)) / maxDistance;
      const pxLumaChroma = rgbToLumaChroma(px[i], px[i + 1], px[i + 2]);
      const chromaDistance = Math.sqrt(
        ((pxLumaChroma.cb - keyLumaChroma.cb) * (pxLumaChroma.cb - keyLumaChroma.cb))
        + ((pxLumaChroma.cr - keyLumaChroma.cr) * (pxLumaChroma.cr - keyLumaChroma.cr))
      ) / Math.sqrt(2);
      const lumaDistance = Math.abs(pxLumaChroma.y - keyLumaChroma.y);
      const chromaAffinity = Math.max(0, 1 - (chromaDistance / Math.max(0.06, similarity + reflectionTolerance + 0.06)));
      const adjustedSimilarity = Math.min(0.82, similarity + (reflectionTolerance * 0.42 * chromaAffinity));
      const adjustedDistance = Math.min(
        rgbDistance,
        chromaDistance + (Math.max(0, lumaDistance - reflectionTolerance) * 0.45)
      );
      let alphaFactor = 1;
      if (effectiveBlend > 0.0001) alphaFactor = Math.max(0, Math.min(1, (adjustedDistance - adjustedSimilarity) / effectiveBlend));
      else alphaFactor = adjustedDistance > adjustedSimilarity ? 1 : 0;
      px[i + 3] = Math.round(px[i + 3] * alphaFactor);
    }
    ctx.putImageData(frame, 0, 0);
    return true;
  }

  function applyPreviewChromaKeyLayer(videoEl, canvasEl, clip) {
    if (!videoEl || !canvasEl) return;
    if (!clip) {
      videoEl.style.opacity = String(Math.max(0, Math.min(1, Number(videoEl.dataset.sessionOpacity || videoEl.style.opacity || 0))));
      canvasEl.style.opacity = "0";
      return;
    }
    const sessionOpacity = Math.max(0, Math.min(1, Number(videoEl.dataset.sessionOpacity || videoEl.style.opacity || 0)));
    const clipOpacity = Math.max(0, Math.min(1, Number(clip?.opacity ?? 1)));
    const totalOpacity = sessionOpacity * clipOpacity;
    const chroma = getVideoChromaKeyState(clip);
    if (!clip || !chroma.enabled || totalOpacity <= 0.001 || !renderPreviewChromaCanvas(videoEl, canvasEl, clip)) {
      videoEl.style.opacity = String(totalOpacity);
      canvasEl.style.opacity = "0";
      return;
    }
    videoEl.style.opacity = "0";
    canvasEl.style.opacity = String(totalOpacity);
  }

  function applyPreviewClipVisual(el, clip) {
    if (!el) return;
    if (!clip) {
      resetPreviewClipVisual(el);
      return;
    }
    initVideoClipFields(clip, {
      defaultSourceIn: getClipSourceIn(clip, 0),
      defaultDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getClipSourceOut(clip, Number(clip.out || 0)) - getClipSourceIn(clip, 0))
    });
    const layout = getPreviewClipLayout(clip);
    if (!layout) {
      resetPreviewClipVisual(el);
      return;
    }
    el.style.left = `${layout.rawLeftAbs.toFixed(3)}px`;
    el.style.top = `${layout.rawTopAbs.toFixed(3)}px`;
    el.style.width = `${Math.max(2, layout.rawWidth).toFixed(3)}px`;
    el.style.height = `${Math.max(2, layout.rawHeight).toFixed(3)}px`;
    el.style.transformOrigin = `${layout.transformOriginX.toFixed(3)}px ${layout.transformOriginY.toFixed(3)}px`;
    el.style.transform = `rotate(${Number(layout.visuals.rotation || 0).toFixed(3)}deg)`;
    el.style.clipPath = layout.clipPathInsetCss;
    el.style.webkitClipPath = layout.clipPathInsetCss;
    const sessionOpacity = Math.max(0, Math.min(1, Number(el.dataset.sessionOpacity ?? el.style.opacity ?? 1)));
    el.style.opacity = String(sessionOpacity * Math.max(0, Math.min(1, Number(clip.opacity ?? 1))));
  }

  function applyPreviewClipVisualsForSection(section = 1) {
    const { base, overlay, baseCanvas, overlayCanvas } = getVideoLayers(section);
    const baseClip = state.project.videoClips.find((item) => item.id === base?.dataset?.clipId) || null;
    const overlayClip = state.project.videoClips.find((item) => item.id === overlay?.dataset?.clipId) || null;
    if (baseCanvas) {
      if (baseClip?.id) baseCanvas.dataset.clipId = baseClip.id;
      else delete baseCanvas.dataset.clipId;
    }
    if (overlayCanvas) {
      if (overlayClip?.id) overlayCanvas.dataset.clipId = overlayClip.id;
      else delete overlayCanvas.dataset.clipId;
    }
    applyPreviewClipVisual(base, baseClip);
    applyPreviewClipVisual(overlay, overlayClip);
    applyPreviewClipVisual(baseCanvas, baseClip);
    applyPreviewClipVisual(overlayCanvas, overlayClip);
    applyPreviewChromaKeyLayer(base, baseCanvas, baseClip);
    applyPreviewChromaKeyLayer(overlay, overlayCanvas, overlayClip);
  }

  function applyPreviewClipVisuals(frames = []) {
    const activeSections = new Set((frames || []).map((frame) => Math.max(1, Number(frame?.section || 1))));
    activeSections.forEach((section) => applyPreviewClipVisualsForSection(section));
    getActivePreviewSections()
      .filter((section) => !activeSections.has(section))
      .forEach((section) => applyPreviewClipVisualsForSection(section));
    const cropClip = getSelectedActiveVideoAt(state.ui.currentTime);
    const previewCropClip = getVideoCropPreviewClip(cropClip);
    if (cropClip && previewCropClip && previewCropClip !== cropClip) {
      getActivePreviewSections().forEach((section) => {
        const { base, overlay, baseCanvas, overlayCanvas } = getVideoLayers(section);
        [base, overlay, baseCanvas, overlayCanvas].forEach((el) => {
          if (el?.dataset?.clipId === cropClip.id) applyPreviewClipVisual(el, previewCropClip);
        });
      });
    }
  }

  function buildSunGlitterHostEffect(glitter) {
    if (!glitter) {
      return {
        transform: "none",
        filter: "none"
      };
    }
    const filters = [];
    if (Number(glitter.blurPx || 0) > 0.01) {
      filters.push(`blur(${Number(glitter.blurPx || 0).toFixed(2)}px)`);
    }
    filters.push(`brightness(${(1 + Math.max(0, Number(glitter.brightnessBoost || 0))).toFixed(3)})`);
    filters.push(`saturate(${(1 + Math.max(0, Number(glitter.saturationBoost || 0))).toFixed(3)})`);
    filters.push(`contrast(${(1 + Math.max(0, Number(glitter.contrastBoost || 0))).toFixed(3)})`);
    if (Number(glitter.sepiaAmount || 0) > 0.001) {
      filters.push(`sepia(${Math.max(0, Number(glitter.sepiaAmount || 0)).toFixed(3)})`);
    }
    if (Number(glitter.glowOpacity || 0) > 0.01) {
      const glowPx = Math.max(8, Number(glitter.glowPx || 18));
      const warmAlpha = Math.min(0.9, Number(glitter.glowOpacity || 0) * 0.72);
      const hotAlpha = Math.min(0.72, Number(glitter.flashOpacity || 0) * 0.58);
      filters.push(`drop-shadow(0 0 ${glowPx.toFixed(2)}px rgba(255,213,148,${warmAlpha.toFixed(3)}))`);
      filters.push(`drop-shadow(0 0 ${(glowPx * 0.55).toFixed(2)}px rgba(255,244,219,${hotAlpha.toFixed(3)}))`);
    }
    return {
      transform: "none",
      filter: filters.join(" ") || "none"
    };
  }

  function getPreviewTransitionHostEffect(frameState, layerName, frameW, frameH, section = 1) {
    if (!frameState || !transitionMotion) return null;
    const width = Math.max(1, Number(frameW || 1));
    const height = Math.max(1, Number(frameH || 1));
    const reducedMotion = prefersReducedMotion();
    const transition = frameState.transition || null;
    const videoLayers = getVideoLayers(section);
    const singleClipLayer = videoLayers.overlay?.dataset?.clipId === frameState.baseClip?.id ? "overlay" : "base";
    if (!transition) return null;

    if (frameState.kind === "single_transition" && layerName === singleClipLayer) {
      if (frameState.transitionType === "sun_glitter_flash" && transitionMotion.computeSunGlitterState) {
        const glitter = transitionMotion.computeSunGlitterState(
          frameState.progress,
          Number(transition.strength ?? 1),
          {
            mode: frameState.transitionScope === "intro" ? "in" : "out",
            reducedMotion
          }
        );
        return buildSunGlitterHostEffect(glitter);
      }
      if (frameState.transitionType === "cyber_mosaic_burst" && transitionMotion.renderCyberMosaicMaskDataUrl) {
        const maskUrl = transitionMotion.renderCyberMosaicMaskDataUrl(frameState.progress, width, height, {
          mode: frameState.transitionScope === "intro" ? "in" : "out",
          intensity: Number(transition.intensity ?? 1),
          tileDensity: Number(transition.tileDensity ?? 0.68),
          sizeVariance: Number(transition.sizeVariance ?? 0.72),
          clusterCount: Number(transition.clusterCount ?? 4),
          clusterSpread: Number(transition.clusterSpread ?? 0.46),
          jitterSpeed: Number(transition.jitterSpeed ?? 1.2),
          seed: Number(transition.seed ?? 17),
          edgeSoftness: Number(transition.edgeSoftness ?? 0.024),
          reducedMotion
        });
        return {
          transform: "none",
          filter: "none",
          maskImage: maskUrl ? `url("${maskUrl}")` : "none"
        };
      }
      if (frameState.transitionType === "focus_pull_in" && transitionMotion.computeFocusPullTransform) {
        const focus = transitionMotion.computeFocusPullTransform(
          frameState.progress,
          Number(transition.anchorX ?? 0.5),
          Number(transition.anchorY ?? 0.5),
          Number(transition.strength ?? 1),
          width,
          height,
          {
            mode: frameState.transitionScope === "intro" ? "in" : "out",
            easingPreset: transition.easingPreset || "dynamic",
            reducedMotion
          }
        );
        return {
          transform: `matrix(${Number(focus.matrixA ?? focus.scaleX ?? 1).toFixed(6)},${Number(focus.matrixB || 0).toFixed(6)},${Number(focus.matrixC || 0).toFixed(6)},${Number(focus.matrixD ?? focus.scaleY ?? 1).toFixed(6)},${Number(focus.translateX || 0).toFixed(3)},${Number(focus.translateY || 0).toFixed(3)})`,
          filter: focus.blurPx > 0.01 ? `blur(${Number(focus.blurPx).toFixed(2)}px)` : "none"
        };
      }
      if (String(frameState.transitionType || "").startsWith("blur_slide_") && transitionMotion.computeDirectionalBlurState) {
        const direction = transition.direction || String(frameState.transitionType || "").replace("blur_slide_", "");
        const slide = transitionMotion.computeDirectionalBlurState(
          frameState.progress,
          direction,
          Number(transition.strength ?? 1),
          width,
          height,
          {
            mode: frameState.transitionScope === "intro" ? "in" : "out",
            reducedMotion
          }
        );
        return {
          transform: `translate(${Number(slide.translateX || 0).toFixed(3)}px, ${Number(slide.translateY || 0).toFixed(3)}px)`,
          filter: slide.blurPx > 0.01 ? `blur(${Number(slide.blurPx).toFixed(2)}px)` : "none"
        };
      }
    }

    if (frameState.kind === "stacked_transition" && layerName === "base") {
      if (frameState.transitionType === "sun_glitter_flash" && transitionMotion.computeSunGlitterState) {
        const glitter = transitionMotion.computeSunGlitterState(
          frameState.progress,
          Number(transition.strength ?? 1),
          {
            mode: "in",
            reducedMotion
          }
        );
        return buildSunGlitterHostEffect(glitter);
      }
      if (frameState.transitionType === "cyber_mosaic_burst" && transitionMotion.renderCyberMosaicMaskDataUrl) {
        const maskUrl = transitionMotion.renderCyberMosaicMaskDataUrl(frameState.progress, width, height, {
          mode: "in",
          intensity: Number(transition.intensity ?? 1),
          tileDensity: Number(transition.tileDensity ?? 0.68),
          sizeVariance: Number(transition.sizeVariance ?? 0.72),
          clusterCount: Number(transition.clusterCount ?? 4),
          clusterSpread: Number(transition.clusterSpread ?? 0.46),
          jitterSpeed: Number(transition.jitterSpeed ?? 1.2),
          seed: Number(transition.seed ?? 17),
          edgeSoftness: Number(transition.edgeSoftness ?? 0.024),
          reducedMotion
        });
        return {
          transform: "none",
          filter: "none",
          maskImage: maskUrl ? `url("${maskUrl}")` : "none"
        };
      }
      if (frameState.transitionType === "focus_pull_in" && transitionMotion.computeFocusPullTransform) {
        const focus = transitionMotion.computeFocusPullTransform(
          frameState.progress,
          Number(transition.anchorX ?? 0.5),
          Number(transition.anchorY ?? 0.5),
          Number(transition.strength ?? 1),
          width,
          height,
          {
            mode: "in",
            easingPreset: transition.easingPreset || "dynamic",
            reducedMotion
          }
        );
        return {
          transform: `matrix(${Number(focus.matrixA ?? focus.scaleX ?? 1).toFixed(6)},${Number(focus.matrixB || 0).toFixed(6)},${Number(focus.matrixC || 0).toFixed(6)},${Number(focus.matrixD ?? focus.scaleY ?? 1).toFixed(6)},${Number(focus.translateX || 0).toFixed(3)},${Number(focus.translateY || 0).toFixed(3)})`,
          filter: focus.blurPx > 0.01 ? `blur(${Number(focus.blurPx).toFixed(2)}px)` : "none"
        };
      }
      if (String(frameState.transitionType || "").startsWith("blur_slide_") && transitionMotion.computeDirectionalBlurState) {
        const direction = transition.direction || String(frameState.transitionType || "").replace("blur_slide_", "");
        const slide = transitionMotion.computeDirectionalBlurState(
          frameState.progress,
          direction,
          Number(transition.strength ?? 1),
          width,
          height,
          {
            mode: "in",
            reducedMotion
          }
        );
        return {
          transform: `translate(${Number(slide.translateX || 0).toFixed(3)}px, ${Number(slide.translateY || 0).toFixed(3)}px)`,
          filter: slide.blurPx > 0.01 ? `blur(${Number(slide.blurPx).toFixed(2)}px)` : "none"
        };
      }
    }

    if (frameState.kind === "stacked_transition" && layerName === "overlay") {
      if (frameState.transitionType === "sun_glitter_flash" && transitionMotion.computeSunGlitterState) {
        const glitter = transitionMotion.computeSunGlitterState(
          frameState.progress,
          Number(transition.strength ?? 1),
          {
            mode: "out",
            reducedMotion
          }
        );
        return buildSunGlitterHostEffect(glitter);
      }
      if (frameState.transitionType === "cyber_mosaic_burst" && transitionMotion.renderCyberMosaicMaskDataUrl) {
        const maskUrl = transitionMotion.renderCyberMosaicMaskDataUrl(frameState.progress, width, height, {
          mode: "out",
          intensity: Number(transition.intensity ?? 1),
          tileDensity: Number(transition.tileDensity ?? 0.68),
          sizeVariance: Number(transition.sizeVariance ?? 0.72),
          clusterCount: Number(transition.clusterCount ?? 4),
          clusterSpread: Number(transition.clusterSpread ?? 0.46),
          jitterSpeed: Number(transition.jitterSpeed ?? 1.2),
          seed: Number(transition.seed ?? 17),
          edgeSoftness: Number(transition.edgeSoftness ?? 0.024),
          reducedMotion
        });
        return {
          transform: "none",
          filter: "none",
          maskImage: maskUrl ? `url("${maskUrl}")` : "none"
        };
      }
      if (frameState.transitionType === "focus_pull_in" && transitionMotion.computeFocusPullTransform) {
        const focus = transitionMotion.computeFocusPullTransform(
          frameState.progress,
          Number(transition.anchorX ?? 0.5),
          Number(transition.anchorY ?? 0.5),
          Number(transition.strength ?? 1),
          width,
          height,
          {
            mode: "out",
            easingPreset: transition.easingPreset || "dynamic",
            reducedMotion
          }
        );
        return {
          transform: `matrix(${Number(focus.matrixA ?? focus.scaleX ?? 1).toFixed(6)},${Number(focus.matrixB || 0).toFixed(6)},${Number(focus.matrixC || 0).toFixed(6)},${Number(focus.matrixD ?? focus.scaleY ?? 1).toFixed(6)},${Number(focus.translateX || 0).toFixed(3)},${Number(focus.translateY || 0).toFixed(3)})`,
          filter: focus.blurPx > 0.01 ? `blur(${Number(focus.blurPx).toFixed(2)}px)` : "none"
        };
      }
      if (String(frameState.transitionType || "").startsWith("blur_slide_") && transitionMotion.computeDirectionalBlurState) {
        const direction = transition.direction || String(frameState.transitionType || "").replace("blur_slide_", "");
        const slide = transitionMotion.computeDirectionalBlurState(
          frameState.progress,
          direction,
          Number(transition.strength ?? 1),
          width,
          height,
          {
            mode: "out",
            reducedMotion
          }
        );
        return {
          transform: `translate(${Number(slide.translateX || 0).toFixed(3)}px, ${Number(slide.translateY || 0).toFixed(3)}px)`,
          filter: slide.blurPx > 0.01 ? `blur(${Number(slide.blurPx).toFixed(2)}px)` : "none"
        };
      }
    }
    return null;
  }

  function resetPreviewZoomHosts() {
    getActivePreviewSections().forEach((section) => {
      const hosts = getVideoHosts(section);
      if (hosts.surface) {
        hosts.surface.style.transformOrigin = "0 0";
        hosts.surface.style.transform = "none";
        hosts.surface.style.opacity = "1";
      }
      [hosts.base, hosts.overlay].forEach((host) => {
        if (!host) return;
        host.style.transformOrigin = "0 0";
        host.style.transform = "none";
        host.style.opacity = "1";
        host.style.filter = "none";
        host.style.maskImage = "none";
        host.style.webkitMaskImage = "none";
      });
    });
  }

  function safePauseVideo(v) {
    try { v?.pause?.(); } catch {}
  }
  function safePlayVideo(v) {
    try {
      const p = v?.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }
  function setVideoTime(v, sec, opts = {}) {
    if (!v || !Number.isFinite(sec)) return;
    const t = Math.max(0, sec);
    const threshold = state.ui.isPlaying
      ? (v.readyState >= 2 ? (opts.thresholdWhilePlaying ?? 0.5) : 0.03)
      : (opts.thresholdWhilePaused ?? 0.03);
    try {
      if (!Number.isFinite(v.currentTime) || Math.abs(v.currentTime - t) > threshold) v.currentTime = t;
    } catch {}
  }
  function ensureVideoClipLoaded(v, clip, pendingTime = null, options = {}) {
    if (!v || !clip) return false;
    const srcPath = clip.previewPath || clip.internalPath || clip.originalPath;
    if (!srcPath) return false;
    v.preload = "auto";
    v.playsInline = true;
    if (pendingTime != null) v.dataset.pendingTime = String(pendingTime);
    const next = fileUrl(srcPath);
    const clipChanged = v.dataset.clipId !== clip.id;
    const sameSource = v.dataset.sourcePath === srcPath;
    const preloadOnly = !!options.preloadOnly;
    if (v.dataset.sourcePath === srcPath && v.src === next) {
      if (!preloadOnly) v.dataset.clipId = clip.id;
      else v.dataset.preloadedClipId = clip.id;
      return { reloaded: false, clipChanged, sameSource, preloadOnly };
    }
    if (!preloadOnly) v.dataset.clipId = clip.id;
    else v.dataset.preloadedClipId = clip.id;
    v.dataset.sourcePath = srcPath;
    v.onloadedmetadata = () => {
      const seekTo = Number(v.dataset.pendingTime || clip.in || 0);
      try { v.currentTime = Math.max(0, seekTo); } catch {}
      if (preloadOnly) {
        safePauseVideo(v);
        return;
      }
      if (state.ui.isPlaying) safePlayVideo(v);
    };
    v.src = next;
    v.load();
    return { reloaded: true, clipChanged: true, sameSource: false, preloadOnly };
  }

  function clampClipLocalTime(clip, localTime) {
    const clipIn = Number(clip?.in || 0);
    const clipOut = Math.max(clipIn + 0.02, Number(clip?.out || clipIn + 0.02));
    return Math.max(clipIn, Math.min(clipOut - 0.001, Number(localTime || clipIn)));
  }

  function setBlackLayerOpacity(black, opacity) {
    if (!black) return;
    const alpha = Math.max(0, Math.min(1, Number(opacity || 0)));
    black.style.opacity = String(alpha);
    black.classList.toggle("show", alpha > 0.001);
  }

  function applyPreviewLayer(videoEl, clip, localTime, opacity, volume, opts = {}) {
    if (!videoEl) return;
    const alpha = Math.max(0, Math.min(1, Number(opacity || 0)));
    const gain = Math.max(0, Math.min(1, Number(volume || 0)));
    videoEl.dataset.sessionOpacity = String(alpha);
    if (!clip || alpha <= 0.001) {
      videoEl.style.opacity = "0";
      videoEl.volume = 0;
      videoEl.muted = true;
      safePauseVideo(videoEl);
      return;
    }
    const targetTime = clampClipLocalTime(clip, localTime);
    const loadState = ensureVideoClipLoaded(videoEl, clip, targetTime) || { reloaded: false, clipChanged: false };
    if (!state.ui.isPlaying) {
      setVideoTime(videoEl, targetTime, { thresholdWhilePaused: 0.02 });
    } else if (opts.forceSeekWhilePlaying || loadState.clipChanged || loadState.reloaded) {
      setVideoTime(videoEl, targetTime, { thresholdWhilePlaying: 0.01 });
    }
    videoEl.style.opacity = String(alpha);
    videoEl.volume = gain;
    videoEl.muted = gain <= 0.0001;
    if (state.ui.isPlaying) safePlayVideo(videoEl);
    else safePauseVideo(videoEl);
  }

  function renderPreviewAtTime(t) {
    const tt = Math.max(0, Math.min(state.ui.viewDuration, Number(t || 0)));
    applyPreviewFrameLayout();
    const hasAnyVideo = (state.project.videoClips || []).length > 0;
    const hasAnyOverlay = (state.project.overlayItems || []).length > 0;
    if (hasAnyVideo || hasAnyOverlay) els.dropZone.classList.add("hasVideo");
    else els.dropZone.classList.remove("hasVideo");

    const rawVideoStates = renderGraph
      ? renderGraph.resolveVideoLayersAtTime(getProjectGraph(), tt)
      : [];
    const frames = normalizePreviewFrames(rawVideoStates, hasAnyVideo);
    const primaryFrame = frames[0] || normalizePreviewFrame({ kind: "empty", section: 1 }, hasAnyVideo);
    if (getDebugFlags().overlap) {
      console.log("[overlap]", {
        timelineTime: tt,
        sections: frames.map((frame) => ({
          section: frame.section,
          kind: frame.kind,
          baseClipId: frame.baseClip?.id || frame.clip?.id || "",
          overlayClipId: frame.overlayClip?.id || "",
          baseLocalTime: frame.baseLocalTime || 0,
          overlayLocalTime: frame.overlayLocalTime || 0,
          start: frame.start,
          end: frame.end,
          progress: frame.progress
        }))
      });
    }
    state.ui.previewClipId = primaryFrame.overlayClip?.id || primaryFrame.baseClip?.id || primaryFrame.clip?.id || null;
    const activeOverlays = getActiveOverlayItemsAt(tt);
    const activeSections = frames.map((frame) => Math.max(1, Number(frame.section || 1)));
    const frameBySection = new Map(frames.map((frame) => [Math.max(1, Number(frame.section || 1)), frame]));
    const knownSections = [...new Set([...getActivePreviewSections(), ...activeSections, 1])];
    knownSections.forEach((section) => {
      const sectionFrame = frameBySection.get(section) || normalizePreviewFrame({ kind: "empty", section }, false);
      const session = getPreviewSession(section);
      session?.render?.(sectionFrame, {
        playing: !!transport?.isPlaying?.(),
        timelineTime: tt,
        segmentKey: getFrameSegmentKey(sectionFrame),
        explicitSeek: !transport?.isPlaying?.()
      });
    });
    syncPreviewSectionVisibility(activeSections.length ? activeSections : [1]);
    detachedAudioSession?.render?.(tt, {
      playing: !!transport?.isPlaying?.(),
      explicitSeek: !transport?.isPlaying?.()
    });
    applyPreviewClipVisuals(frames);
    frames.forEach((frame) => {
      if ((frame.kind === "single" || frame.kind === "single_transition") && frame.baseClip) {
        const section = Math.max(1, Number(frame.section || 1));
        const layers = getVideoLayers(section);
        const preferredVideo = getPreferredSingleVideoElement(frame.baseClip, frame.baseLocalTime, section);
        preloadUpcomingBlendClip(
          tt,
          frame,
          preferredVideo === layers.overlay ? layers.base : layers.overlay,
          getPreviewSession(section),
          section
        );
      }
    });
    applyPreviewZoomEffect(tt, activeOverlays, frames);
    applyPreviewDropWaveEffect(tt, activeOverlays);
    if (isVideoCropModalOpen()) renderVideoCropModalPreview(tt);
    renderPreviewOverlays(tt);
  }

  function setPreviewToClip(clipId) {
    const c = state.project.videoClips.find(x => x.id === clipId);
    if (!c) return;
    selectSingle("video", clipId);
    state.ui.currentTime = snapTimelineTimeSec(c.start);
    renderAll();
  }

  function updateTimeReadout() {
    const nextCurrent = formatTimelineSec(state.ui.currentTime);
    const nextDuration = formatTimelineSec(state.ui.viewDuration);
    if (lastTimeReadoutValue !== nextCurrent) {
      lastTimeReadoutValue = nextCurrent;
      els.curTime.textContent = nextCurrent;
    }
    if (lastDurationReadoutValue !== nextDuration) {
      lastDurationReadoutValue = nextDuration;
      els.durTime.textContent = nextDuration;
    }
  }

  function trimVideoClip(id, side, deltaSec) {
    const clip = state.project.videoClips.find(c => c.id === id);
    if (!clip) return;
    const minDur = TIMELINE_TIME_STEP_SEC;
    const baseStart = snapTimelineTimeSec(clip.start);
    const oldDur = Math.max(minDur, snapTimelineTimeSec(getVideoClipTimelineDuration(clip)));
    const snappedDelta = snapTimelineDeltaSec(deltaSec);
    const section = Math.max(1, Number(clip.section || 1));
    const ignoreIds = [clip.linkedAudioId].filter(Boolean);
    if (side === "left") {
      const maxDelta = oldDur - minDur;
      const d = Math.max(-baseStart, Math.min(maxDelta, snappedDelta));
      const fixedEnd = snapTimelineTimeSec(baseStart + oldDur);
      const rawStart = Math.max(0, baseStart + d);
      const snappedStart = Math.min(
        fixedEnd - minDur,
        nearestSnapPointTime(rawStart, clip.id, { section, ignoreIds })
      );
      clip.start = snapTimelineTimeSec(Math.max(0, snappedStart));
      clip.timelineDuration = Math.max(minDur, snapTimelineTimeSec(fixedEnd - clip.start));
    } else {
      const d = Math.max(minDur - oldDur, snappedDelta);
      clip.start = baseStart;
      const rawEnd = Math.max(baseStart + minDur, baseStart + oldDur + d);
      const snappedEnd = Math.max(
        baseStart + minDur,
        nearestSnapPointTime(rawEnd, clip.id, { section, ignoreIds })
      );
      clip.timelineDuration = Math.max(minDur, snapTimelineTimeSec(snappedEnd - baseStart));
    }
    clip.timelineDuration = Math.max(minDur, Number(clip.timelineDuration || minDur));
    if (clip.linkedAudioId && clip.linkMode === "linked") {
      const linked = state.project.audioItems.find(a => a.id === clip.linkedAudioId);
      if (linked) {
        linked.start = clip.start;
        linked.duration = Math.max(minDur, getVideoClipTimelineDuration(clip));
        linked.sourceIn = Math.max(0, Number(clip.in || 0));
        linked.sourceOut = Math.max(linked.sourceIn + minDur, Number(clip.out || linked.sourceIn + minDur));
      }
    }
  }

  function trimAudioClip(id, side, deltaSec) {
    const audio = state.project.audioItems.find(a => a.id === id);
    if (!audio) return;
    if (audio.linkMode === "linked" && audio.linkedVideoId) {
      trimVideoClip(audio.linkedVideoId, side, deltaSec);
      const linkedVideo = state.project.videoClips.find((item) => item.id === audio.linkedVideoId);
      syncAudioItemTiming(audio, { linkedClip: linkedVideo || null });
      return;
    }
    const minDur = TIMELINE_TIME_STEP_SEC;
    const baseStart = snapTimelineTimeSec(audio.start);
    const oldDur = Math.max(minDur, snapTimelineTimeSec(Number(audio.duration || minDur)));
    const sourceIn = snapTimelineTimeSec(getAudioItemSourceIn(audio, 0));
    const sourceOut = Math.max(sourceIn + minDur, snapTimelineTimeSec(getAudioItemSourceOut(audio, oldDur)));
    const snappedDelta = snapTimelineDeltaSec(deltaSec);
    const section = Math.max(1, Number(audio.section || 1));
    if (side === "left") {
      const d = Math.min(oldDur - minDur, Math.max(-baseStart, snappedDelta));
      const fixedEnd = snapTimelineTimeSec(baseStart + oldDur);
      const rawStart = Math.max(0, baseStart + d);
      const snappedStart = Math.min(
        fixedEnd - minDur,
        nearestSnapPointTime(rawStart, audio.id, { section })
      );
      const actualDelta = snapTimelineDeltaSec(snappedStart - baseStart);
      audio.start = snapTimelineTimeSec(Math.max(0, snappedStart));
      audio.duration = Math.max(minDur, snapTimelineTimeSec(fixedEnd - audio.start));
      audio.sourceIn = snapTimelineTimeSec(Math.max(0, Math.min(sourceOut - minDur, sourceIn + actualDelta)));
      audio.sourceOut = Math.max(audio.sourceIn + minDur, snapTimelineTimeSec(audio.sourceIn + audio.duration));
    } else {
      audio.start = baseStart;
      audio.sourceIn = sourceIn;
      const rawEnd = Math.max(baseStart + minDur, baseStart + oldDur + snappedDelta);
      const snappedEnd = Math.max(
        baseStart + minDur,
        nearestSnapPointTime(rawEnd, audio.id, { section })
      );
      audio.duration = Math.max(minDur, snapTimelineTimeSec(snappedEnd - baseStart));
      audio.sourceOut = Math.max(audio.sourceIn + minDur, snapTimelineTimeSec(audio.sourceIn + audio.duration));
    }
    syncAudioItemTiming(audio);
  }

  function trimOverlayClip(id, side, deltaSec) {
    const overlay = state.project.overlayItems.find((item) => item.id === id);
    if (!overlay) return;
    const minDur = MIN_OVERLAY_CLIP_SEC;
    const baseStart = snapTimelineTimeSec(Number(overlay.start || 0));
    const oldDur = Math.max(minDur, snapTimelineTimeSec(Number(overlay.duration || minDur)));
    const snappedDelta = snapTimelineDeltaSec(deltaSec);
    const section = Math.max(1, Number(overlay.section || 1));
    if (side === "left") {
      const d = Math.min(oldDur - minDur, Math.max(-baseStart, snappedDelta));
      const fixedEnd = snapTimelineTimeSec(baseStart + oldDur);
      const rawStart = Math.max(0, baseStart + d);
      const snappedStart = Math.min(
        fixedEnd - minDur,
        nearestSnapPointTime(rawStart, overlay.id, { section })
      );
      overlay.start = snapTimelineTimeSec(Math.max(0, snappedStart));
      overlay.duration = Math.max(minDur, snapTimelineTimeSec(fixedEnd - overlay.start));
    } else {
      overlay.start = baseStart;
      const rawEnd = Math.max(baseStart + minDur, baseStart + oldDur + snappedDelta);
      const snappedEnd = Math.max(
        baseStart + minDur,
        nearestSnapPointTime(rawEnd, overlay.id, { section })
      );
      overlay.duration = Math.max(minDur, snapTimelineTimeSec(snappedEnd - baseStart));
    }
  }

  function setManualFade(kind, id, side, fadeSec) {
    const nextFade = snapFadeValueSec(Math.max(0, Number(fadeSec || 0)));
    if (kind === "video") {
      const clip = state.project.videoClips.find((item) => item.id === id);
      if (!clip) return;
      const clipDur = getVideoClipTimelineDuration(clip);
      if (side === "left") clip.manualFadeInSec = clampFadeDuration(nextFade, clipDur);
      else clip.manualFadeOutSec = clampFadeDuration(nextFade, clipDur);
      if (clip.linkedAudioId && clip.linkMode === "linked") {
        const linkedAudio = state.project.audioItems.find((item) => item.id === clip.linkedAudioId);
        if (linkedAudio) {
          if (side === "left") linkedAudio.manualFadeInSec = clampFadeDuration(nextFade, linkedAudio.duration);
          else linkedAudio.manualFadeOutSec = clampFadeDuration(nextFade, linkedAudio.duration);
        }
      }
      return;
    }
    if (kind === "audio") {
      const audio = state.project.audioItems.find((item) => item.id === id);
      if (!audio) return;
      if (side === "left") audio.manualFadeInSec = clampFadeDuration(nextFade, audio.duration);
      else audio.manualFadeOutSec = clampFadeDuration(nextFade, audio.duration);
      if (audio.linkMode === "linked" && audio.linkedVideoId) {
        const linkedVideo = state.project.videoClips.find((item) => item.id === audio.linkedVideoId);
        if (linkedVideo) {
          if (side === "left") linkedVideo.manualFadeInSec = clampFadeDuration(nextFade, linkedVideo.out - linkedVideo.in);
          else linkedVideo.manualFadeOutSec = clampFadeDuration(nextFade, linkedVideo.out - linkedVideo.in);
        }
      }
      return;
    }
    if (kind === "overlay") {
      const overlay = state.project.overlayItems.find((item) => item.id === id);
      if (!overlay) return;
      if (side === "left") overlay.manualFadeInSec = clampFadeDuration(nextFade, overlay.duration);
      else overlay.manualFadeOutSec = clampFadeDuration(nextFade, overlay.duration);
    }
  }

  function wireTrimHandles() {
    const bindLane = (laneEl) => {
      laneEl.querySelectorAll(".trimHandle").forEach(h => {
        h.onmousedown = (e) => {
          state.ui.internalDragging = true;
          clearDropPreview();
          e.preventDefault();
          e.stopPropagation();
          const kind = h.dataset.kind;
          const id = h.dataset.clipId;
          const section = Math.max(1, Number(h.closest(".clip")?.dataset.section || 1));
          const side = h.dataset.side;
          if (e.shiftKey) selectSectionItems(kind, section, { primaryKind: kind, primaryId: id });
          else if (e.ctrlKey || e.metaKey) toggleSelection(kind, id, section);
          else selectSingle(kind, id, section);
          renderAll();
          const historyBefore = snapshotHistoryState();
          const startX = e.clientX;
          const before = JSON.parse(JSON.stringify(state.project));
          let moved = false;
          const onMove = (mv) => {
            const dx = mv.clientX - startX;
            if (!moved && Math.abs(dx) < 1) return;
            moved = true;
            const deltaSec = window.PearlTimeline.pxToSeconds(dx, state.ui.pxPerSec);
            state.project = JSON.parse(JSON.stringify(before));
            if (kind === "video") trimVideoClip(id, side, deltaSec);
            else if (kind === "audio") trimAudioClip(id, side, deltaSec);
            else if (kind === "overlay") trimOverlayClip(id, side, deltaSec);
            recalcTimeline();
            renderAll();
          };
          const onUp = () => {
            state.ui.internalDragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            if (moved) commitHistorySnapshot(historyBefore);
            else {
              recalcTimeline();
              renderAll();
            }
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        };
      });
    };
    bindLane(els.videoLane);
    bindLane(els.audioLane);
  }

  function wireFadeHandles() {
    const bindLane = (laneEl) => {
      laneEl.querySelectorAll(".fadeHandle").forEach((handle) => {
        handle.onmousedown = (e) => {
          state.ui.internalDragging = true;
          clearDropPreview();
          e.preventDefault();
          e.stopPropagation();
          const kind = handle.dataset.kind;
          const id = handle.dataset.clipId;
          const side = handle.dataset.side;
          const section = Math.max(1, Number(handle.closest(".clip")?.dataset.section || 1));
          if (!id || !kind) return;
          document.body?.classList.add("fade-dragging");
          if (e.shiftKey) selectSectionItems(kind, section, { primaryKind: kind, primaryId: id });
          else if (e.ctrlKey || e.metaKey) toggleSelection(kind, id, section);
          else selectSingle(kind, id, section);
          renderAll();
          const historyBefore = snapshotHistoryState();
          const before = JSON.parse(JSON.stringify(state.project));
          const startX = e.clientX;
          let moved = false;
          const baseFade = kind === "video"
            ? Number(state.project.videoClips.find((item) => item.id === id)?.[side === "left" ? "manualFadeInSec" : "manualFadeOutSec"] || 0)
            : (kind === "audio"
                ? Number(state.project.audioItems.find((item) => item.id === id)?.[side === "left" ? "manualFadeInSec" : "manualFadeOutSec"] || 0)
                : Number(state.project.overlayItems.find((item) => item.id === id)?.[side === "left" ? "manualFadeInSec" : "manualFadeOutSec"] || 0));
          const onMove = (mv) => {
            const dx = mv.clientX - startX;
            if (!moved && Math.abs(dx) < 1) return;
            moved = true;
            const deltaSec = window.PearlTimeline.pxToSeconds(side === "left" ? dx : -dx, state.ui.pxPerSec);
            state.project = JSON.parse(JSON.stringify(before));
            setManualFade(kind, id, side, baseFade + deltaSec);
            if (kind === "video") {
              const clip = state.project.videoClips.find((item) => item.id === id);
              if (clip && clip.linkedAudioId && clip.linkMode === "linked") {
                const linkedAudio = state.project.audioItems.find((item) => item.id === clip.linkedAudioId);
                if (linkedAudio) {
                  if (side === "left") linkedAudio.manualFadeInSec = clampFadeDuration(clip.manualFadeInSec, linkedAudio.duration);
                  else linkedAudio.manualFadeOutSec = clampFadeDuration(clip.manualFadeOutSec, linkedAudio.duration);
                }
              }
            }
            const currentFade = kind === "video"
              ? Number(state.project.videoClips.find((item) => item.id === id)?.[side === "left" ? "manualFadeInSec" : "manualFadeOutSec"] || 0)
              : (kind === "audio"
                  ? Number(state.project.audioItems.find((item) => item.id === id)?.[side === "left" ? "manualFadeInSec" : "manualFadeOutSec"] || 0)
                  : Number(state.project.overlayItems.find((item) => item.id === id)?.[side === "left" ? "manualFadeInSec" : "manualFadeOutSec"] || 0));
            showTimelineValueBubble(`${formatTimelineSec(currentFade)}s`, mv.clientX, mv.clientY - 18);
            recalcTimeline();
            renderAll();
          };
          const onUp = () => {
            hideTimelineValueBubble();
            state.ui.internalDragging = false;
            document.body?.classList.remove("fade-dragging");
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            if (moved) commitHistorySnapshot(historyBefore);
            else {
              recalcTimeline();
              renderAll();
            }
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        };
      });
    };
    bindLane(els.videoLane);
    bindLane(els.audioLane);
  }

  function wireTransitionDurationHandles() {
    els.videoLane.querySelectorAll(".transitionDurationHandle").forEach((handle) => {
      handle.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const parsed = parseTransitionKey(handle.dataset.transitionKey || handle.dataset.boundaryIdx || "");
        const target = buildTransitionTargetFromKey(handle.dataset.transitionKey || handle.dataset.boundaryIdx || "");
        if (!target) return;
        const scope = parsed.scope || handle.dataset.transitionScope || "boundary";
        const boundary = target.kind === "boundary"
          ? state.ui.boundaries.find((item) => item.idx === target.boundaryIdx)
          : null;
        const clip = target.kind === "edge"
          ? state.project.videoClips.find((item) => item.id === target.clipId)
          : null;
        const current = getTransitionForTarget(target) || makeTransitionPreset(handle.dataset.transitionType || "cross", scope);
        if (!current || current.type === "cut") return;
        const historyBefore = snapshotHistoryState();
        const before = JSON.parse(JSON.stringify(state.project));
        const startX = e.clientX;
        const baseDuration = Number(current.duration || 0.5);
        const resizeEdge = handle.dataset.transitionEdge || (scope === "outro" ? "left" : "right");
        const safeNonNegative = (value, fallback) => {
          const n = Number(value);
          return Number.isFinite(n) && n >= 0 ? n : fallback;
        };
        const baseHalf = Math.max(TIMELINE_TIME_STEP_SEC, baseDuration / 2);
        const baseLeftDuration = safeNonNegative(current.leftDuration ?? current.leftDurationSec, baseHalf);
        const baseRightDuration = safeNonNegative(
          current.rightDuration ?? current.rightDurationSec,
          Math.max(TIMELINE_TIME_STEP_SEC, baseDuration - baseLeftDuration)
        );
        const boundaryFromClip = boundary?.fromClip || state.project.videoClips.find((item) => item.id === boundary?.fromClipId);
        const boundaryToClip = boundary?.toClip || state.project.videoClips.find((item) => item.id === boundary?.toClipId);
        const maxLeftDuration = Math.max(TIMELINE_TIME_STEP_SEC, boundaryFromClip ? getVideoClipTimelineDuration(boundaryFromClip) : baseDuration);
        const maxRightDuration = Math.max(TIMELINE_TIME_STEP_SEC, boundaryToClip ? getVideoClipTimelineDuration(boundaryToClip) : baseDuration);
        const clampSpan = (value, maxValue) => Math.max(
          0,
          Math.min(maxValue, snapFadeValueSec(value))
        );
        let moved = false;
        state.ui.internalDragging = true;
        document.body?.classList.add("transition-dragging");
        document.body?.setAttribute("data-transition-drag-edge", resizeEdge);

        const onMove = (mv) => {
          const dx = mv.clientX - startX;
          if (!moved && Math.abs(dx) < 1) return;
          moved = true;
          const deltaSec = window.PearlTimeline.pxToSeconds(dx, state.ui.pxPerSec);
          state.project = JSON.parse(JSON.stringify(before));
          if (target.kind === "boundary") {
            const nextLeftDuration = resizeEdge === "left"
              ? clampSpan(baseLeftDuration - deltaSec, maxLeftDuration)
              : clampSpan(baseLeftDuration, maxLeftDuration);
            const nextRightDuration = resizeEdge === "right"
              ? clampSpan(baseRightDuration + deltaSec, maxRightDuration)
              : clampSpan(baseRightDuration, maxRightDuration);
            const nextDuration = snapFadeValueSec(nextLeftDuration + nextRightDuration);
            writeTransitionForTarget(target, {
              ...current,
              duration: nextDuration,
              leftDuration: nextLeftDuration,
              rightDuration: nextRightDuration,
              alignment: "custom"
            });
            showTimelineValueBubble(`${nextDuration.toFixed(2)}s`, mv.clientX, mv.clientY - 18);
          } else {
            const scopedDeltaSec = window.PearlTimeline.pxToSeconds(scope === "outro" ? -dx : dx, state.ui.pxPerSec);
            const nextDuration = clampTransitionDurationSec(baseDuration + scopedDeltaSec, boundary || clip, scope);
            writeTransitionForTarget(target, {
              ...current,
              duration: nextDuration
            });
            showTimelineValueBubble(`${nextDuration.toFixed(2)}s`, mv.clientX, mv.clientY - 18);
          }
          renderAll();
        };

        const onUp = () => {
          hideTimelineValueBubble();
          state.ui.internalDragging = false;
          document.body?.classList.remove("transition-dragging");
          document.body?.removeAttribute("data-transition-drag-edge");
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (moved) commitHistorySnapshot(historyBefore);
          else renderAll();
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    });
    els.videoLane.querySelectorAll(".transitionBridge").forEach((bridge) => {
      const pickBridgeResizeHandle = (event) => {
        const rect = bridge.getBoundingClientRect();
        if (!rect.width) return null;
        const x = event.clientX - rect.left;
        const band = Math.min(30, Math.max(14, rect.width / 2));
        if (x <= band) return bridge.querySelector(".transitionDurationHandle.left");
        if (x >= rect.width - band) return bridge.querySelector(".transitionDurationHandle.right");
        return null;
      };
      bridge.onmousemove = (event) => {
        bridge.classList.toggle("edgeResizeHover", !!pickBridgeResizeHandle(event));
      };
      bridge.onmouseleave = () => {
        bridge.classList.remove("edgeResizeHover");
      };
      bridge.onmousedown = (event) => {
        if (event.button !== 0) return;
        if (event.target?.closest?.(".transitionDurationHandle")) return;
        const handle = pickBridgeResizeHandle(event);
        if (!handle?.onmousedown) return;
        handle.onmousedown(event);
      };
    });
  }

  function wireTransitionChipActions() {
    els.videoLane.querySelectorAll(".transitionBridge, .transitionChip").forEach((chip) => {
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = chip.dataset.transitionKey || chip.dataset.boundaryIdx;
        if (!key) return;
        const anchorRect = chip.getBoundingClientRect();
        const target = buildTransitionTargetFromKey(key);
        state.ui.transitionPopover.key = null;
        if (target?.kind === "edge" && target.clipId) {
          selectSingle("video", target.clipId, target.section);
        } else if (target?.kind === "boundary" && target.fromClipId) {
          selectSingle("video", target.fromClipId, target.section);
        }
        renderAll();
        showTransitionPopover(key, { getBoundingClientRect: () => anchorRect });
      };
    });
  }

  function wireClipDrag() {
    const getSectionAtPointer = (kind, clientY, fallback = 1) => {
      const lane = kind === "video" ? els.videoLane : els.audioLane;
      if (!lane) return Math.max(1, Number(fallback || 1));
      const rows = [...lane.querySelectorAll(`.trackRowLane[data-kind="${kind}"]`)];
      if (!rows.length) return Math.max(1, Number(fallback || 1));
      const hit = rows.find((row) => {
        const r = row.getBoundingClientRect();
        return clientY >= r.top && clientY <= r.bottom;
      });
      if (hit) return Math.max(1, Number(hit.dataset.section || 1));
      const first = rows[0].getBoundingClientRect();
      const last = rows[rows.length - 1].getBoundingClientRect();
      if (clientY < first.top) return 1;
      if (clientY > last.bottom) return rows.length;
      let nearest = rows[0];
      let best = Infinity;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        const d = Math.abs(clientY - (r.top + r.height / 2));
        if (d < best) {
          best = d;
          nearest = row;
        }
      }
      return Math.max(1, Number(nearest.dataset.section || 1));
    };

    const attach = (laneEl, kind) => {
      laneEl.querySelectorAll(`.clip[data-kind="${kind}"], .clip[data-kind="${kind === "video" ? "overlay" : kind}"]`).forEach(div => {
        div.onmousedown = (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.target.closest(".trimHandle, .fadeHandle, .overlayGearBtn, .videoClipOptionsBtn, .imageCutoutBtn")) return;
          const actualKind = div.dataset.kind || kind;
          const id = actualKind === "video"
            ? div.dataset.clipId
            : (actualKind === "audio" ? div.dataset.audioId : div.dataset.overlayId);
          const section = Math.max(1, Number(div.dataset.section || 1));
          if (!id) return;
          state.ui.activeLane = actualKind === "audio" ? "audio" : "video";
          if (e.shiftKey) {
            selectSectionItems(actualKind, section, { primaryKind: actualKind, primaryId: id });
          } else if (e.ctrlKey || e.metaKey) {
            toggleSelection(actualKind, id, section);
          } else {
            selectSingle(actualKind, id, section);
          }
          renderAll();
          const historyBefore = snapshotHistoryState();

          const startX = e.clientX;
          const before = JSON.parse(JSON.stringify(state.project));
          const base = actualKind === "video"
            ? state.project.videoClips.find(c => c.id === id)?.start
            : (actualKind === "audio"
                ? state.project.audioItems.find(a => a.id === id)?.start
                : state.project.overlayItems.find(o => o.id === id)?.start);
          const baseSection = actualKind === "video"
            ? Math.max(1, Number(state.project.videoClips.find(c => c.id === id)?.section || section || 1))
            : (actualKind === "audio"
                ? Math.max(1, Number(state.project.audioItems.find(a => a.id === id)?.section || section || 1))
                : Math.max(1, Number(state.project.overlayItems.find(o => o.id === id)?.section || section || 1)));
          if (base == null) return;
          let moved = false;

          const onMove = (mv) => {
            const dx = mv.clientX - startX;
            if (!moved && Math.abs(dx) < 3) return;
            moved = true;
            state.ui.internalDragging = true;
            clearDropPreview();
            const deltaSec = window.PearlTimeline.pxToSeconds(dx, state.ui.pxPerSec);
            state.project = JSON.parse(JSON.stringify(before));
            const laneKind = actualKind === "audio" ? "audio" : "video";
            const targetSection = getSectionAtPointer(laneKind, mv.clientY, baseSection);
            if (actualKind === "video") {
              const clip = state.project.videoClips.find(c => c.id === id);
              if (!clip) return;
              clip.start = nearestSnapTime(Math.max(0, base + deltaSec), clip.id, {
                durationSec: getVideoClipTimelineDuration(clip),
                section: targetSection
              });
              clip.section = targetSection;
              if (clip.linkedAudioId && clip.linkMode === "linked") {
                const linked = state.project.audioItems.find(a => a.id === clip.linkedAudioId);
                if (linked) {
                  linked.start = clip.start;
                  linked.duration = getVideoClipTimelineDuration(clip);
                  linked.section = targetSection;
                }
              }
            } else if (actualKind === "audio") {
              const audio = state.project.audioItems.find(a => a.id === id);
              if (!audio) return;
              const nextStart = nearestSnapTime(Math.max(0, base + deltaSec), audio.id, {
                durationSec: getAudioItemTimelineDuration(audio),
                section: targetSection
              });
              if (audio.linkMode === "linked" && audio.linkedVideoId) {
                const linkedVideo = state.project.videoClips.find((item) => item.id === audio.linkedVideoId);
                if (linkedVideo) {
                  linkedVideo.start = nextStart;
                  linkedVideo.section = targetSection;
                }
                audio.start = nextStart;
                audio.section = targetSection;
              } else {
                audio.start = nextStart;
                audio.section = targetSection;
              }
            } else {
              const overlayItem = state.project.overlayItems.find(o => o.id === id);
              if (!overlayItem) return;
              overlayItem.start = nearestSnapTime(Math.max(0, base + deltaSec), overlayItem.id, {
                durationSec: Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlayItem.duration || MIN_OVERLAY_CLIP_SEC)),
                section: targetSection
              });
              overlayItem.section = targetSection;
            }
            recalcTimeline();
            renderAll();
          };
          const onUp = () => {
            state.ui.internalDragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            if (moved) commitHistorySnapshot(historyBefore);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        };
      });
    };
    attach(els.videoLane, "video");
    attach(els.audioLane, "audio");
    // Prevent browser-native drag ghost / not-allowed cursor while using custom timeline drag.
    const blockNativeDragStart = (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".clip, .trackLane, .trackRowLane, .audioWave, .thumbStrip, .thumbCell")) {
        ev.preventDefault();
      }
    };
    document.addEventListener("dragstart", blockNativeDragStart, true);
    window.addEventListener("mouseup", () => { state.ui.internalDragging = false; });
    window.addEventListener("blur", () => { state.ui.internalDragging = false; });
  }

  function wireAudioGainControls() {
    els.audioLane.querySelectorAll(".audioGainControl").forEach(ctrl => {
      ctrl.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.ui.internalDragging = true;
        const id = ctrl.dataset.audioId;
        const section = Math.max(1, Number(ctrl.closest(".clip")?.dataset.section || 1));
        const audio = state.project.audioItems.find(a => a.id === id);
        if (!audio) return;
        if (e.shiftKey) selectSectionItems("audio", section, { primaryKind: "audio", primaryId: id });
        else if (e.ctrlKey || e.metaKey) toggleSelection("audio", id, section);
        else selectSingle("audio", id, section);
        const historyBefore = snapshotHistoryState();
        let changed = false;

        const update = (clientY) => {
          const clipEl = ctrl.closest(".clip");
          if (!clipEl) return;
          const r = clipEl.getBoundingClientRect();
          const controlHeight = Math.max(1, ctrl.offsetHeight || 2);
          const travel = Math.max(1, r.height - controlHeight);
          const y = Math.max(0, Math.min(travel, clientY - r.top - (controlHeight / 2)));
          const prevGain = Number(audio.gain || 0);
          const gain = 1 - (y / travel); // top=100, bottom=0
          audio.gain = Math.max(0, Math.min(1, gain));
          if (Math.abs(audio.gain - prevGain) > 1e-6) changed = true;
          const gainPct = Math.round(audio.gain * 100);
          ctrl.title = `Volume ${gainPct}%`;
          showTimelineValueBubble(`${gainPct}%`, r.left + (r.width / 2), r.top + y);
          ctrl.style.top = `${Math.round(y)}px`;
          renderPreviewAtTime(transport ? transport.getCurrentTime() : state.ui.currentTime);
        };
        update(e.clientY);

        const onMove = (mv) => update(mv.clientY);
        const onUp = () => {
          hideTimelineValueBubble();
          renderAll();
          state.ui.internalDragging = false;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (changed) commitHistorySnapshot(historyBefore);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
    });
  }

  function renderTimeline() {
    recalcTimeline();
    const showDropPreview = (externalDragActive && !state.ui.internalDragging)
      || (state.dragging.item?.kind === "background" && !state.ui.internalDragging);

    window.PearlTimeline.buildRuler(els.ruler, state.ui.viewDuration, state.ui.pxPerSec, state.settings.fps);
    const { boundaries } = window.PearlTimeline.renderTracks(
      { videoLane: els.videoLane, audioLane: els.audioLane, videoLabelCol: els.videoLabelCol, audioLabelCol: els.audioLabelCol },
      state.project,
      state.ui.pxPerSec,
      state.ui.selectedClipId,
      {
        viewDuration: state.ui.viewDuration,
        activeLane: state.ui.activeLane,
        dropPreview: showDropPreview ? state.ui.dropPreview : null,
        selectedKeys: state.ui.selectedKeys,
        videoSections: state.project.videoSections,
        audioSections: state.project.audioSections,
        viewportWidth: els.timelineViewport?.clientWidth || 0,
        transitionHoverTarget: state.dragging.item?.kind === "transition" ? state.dragging.transitionHoverTarget : null,
        transitionHoverBoundaryIdx: state.dragging.item?.kind === "transition" ? state.dragging.boundaryHover : null,
        draggingTransitionType: state.dragging.item?.kind === "transition" ? state.dragging.item.type : null,
        transitionHoverDurationSec: 0.5
      }
    );
    state.ui.boundaries = boundaries;

    const desiredThumbCount = state.ui.pxPerSec >= 140 ? 8 : (state.ui.pxPerSec >= 90 ? 4 : 1);
    state.project.videoClips.forEach((clip) => {
      const ready = Number(clip._thumbReadyCount || (clip.thumbs?.length || 0));
      const requested = Number(clip._thumbRequestCount || 0);
      if (ready === 0 && requested > 0) return;
      if (ready >= desiredThumbCount || requested >= desiredThumbCount) return;
      enqueueThumbBuild(clip.id, desiredThumbCount, desiredThumbCount <= 1 ? "high" : "normal");
    });

    window.PearlTimeline.setPlayhead(els.playhead, state.ui.currentTime, state.ui.pxPerSec);
    window.PearlTimeline.setRegionOverlay(els.regionOverlay, state.ui.region, state.ui.pxPerSec);

    // boundary highlight clear
    els.videoLane.querySelectorAll(".boundary").forEach(b => b.classList.remove("highlight"));
    if (state.dragging.transitionHoverTarget?.kind === "boundary" && state.dragging.transitionHoverTarget.boundaryIdx != null) {
      const target = els.videoLane.querySelector(`.boundary[data-boundary-idx="${state.dragging.transitionHoverTarget.boundaryIdx}"]`);
      target?.classList.add("highlight");
    } else if (state.dragging.boundaryHover != null) {
      const target = els.videoLane.querySelector(`.boundary[data-boundary-idx="${state.dragging.boundaryHover}"]`);
      target?.classList.add("highlight");
    }

    els.videoLane.querySelectorAll(".overlayGearBtn").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const overlayId = btn.dataset.overlayId;
        const overlay = state.project.overlayItems.find((item) => item.id === overlayId);
        if (!overlay) return;
        selectSingle("overlay", overlay.id, overlay.section);
        showFxPopover(overlay.id, btn);
        renderAll();
      };
    });
    els.videoLane.querySelectorAll(".videoClipOptionsBtn").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clipId = btn.dataset.clipId;
        const clip = state.project.videoClips.find((item) => item.id === clipId);
        if (!clip) return;
        selectSingle("video", clip.id, clip.section);
        state.ui.previewEditMode = "transform";
        focusVideoInspector();
        renderAll();
      };
    });
    els.videoLane.querySelectorAll(".imageCutoutBtn").forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clipId = btn.dataset.clipId;
        const clip = state.project.videoClips.find((item) => item.id === clipId && item.isImage);
        if (!clip) return;
        selectSingle("video", clip.id, clip.section);
        renderAll();
        await openImageCutoutEditor(clip.id);
      };
    });

    wireTrimHandles();
    wireFadeHandles();
    wireTransitionDurationHandles();
    wireTransitionChipActions();
    wireClipDrag();
    wireAudioGainControls();
  }

  function renderAll() {
    renderLeftClipList();
    renderTimeline();
    renderPreviewAtTime(state.ui.currentTime);
    renderOverlayInspector();
    renderVideoInspector();
    if (state.ui.transitionPopover.key) renderTransitionPopover();
    updateTimeReadout();
    hydrateRangeInputs();
    updateZoomValue();
  }

  function prefersReducedMotion() {
    return !!palettePreviewMotionQuery?.matches;
  }

  function disposePalettePreviewControllers() {
    palettePreviewDisposers.forEach((dispose) => {
      try {
        dispose?.();
      } catch (_) {
        // Ignore stale preview controller teardown failures.
      }
    });
    palettePreviewDisposers = [];
  }

  function getFxPalettePreviewGlyph(type) {
    return effectDefs?.paletteItems?.[type]?.glyph || "FX";
  }

  function getPalettePreviewTheme() {
    const dark = getActiveThemeName() === "dark";
    return dark
      ? {
          dark,
          stage: "rgba(15,23,42,0.98)",
          matte: "rgba(2,6,23,0.98)",
          frameDetail: "rgba(255,255,255,0.18)",
          before: ["#38bdf8", "#2563eb"],
          after: ["#fb7185", "#f97316"],
          fadeBase: ["#22d3ee", "#2563eb"],
          fadeOverlay: ["rgba(251,191,36,0.74)", "rgba(248,113,113,0.74)"],
          divider: "rgba(255,255,255,0.88)",
          dip: "rgba(2,6,23,0.82)",
          crossLine: "rgba(255,255,255,0.5)",
          primary: "#7dd3fc",
          accent: "#f8fafc",
          warm: "#fcd34d",
          success: "#86efac",
          neutral: "#cbd5e1",
          rose: "#fda4af",
          spotlight: "#fef3c7"
        }
      : {
          dark,
          stage: "rgba(255,255,255,0.98)",
          matte: "rgba(226,232,240,0.96)",
          frameDetail: "rgba(15,23,42,0.12)",
          before: ["#0284c7", "#1d4ed8"],
          after: ["#db2777", "#ea580c"],
          fadeBase: ["#0f766e", "#0369a1"],
          fadeOverlay: ["rgba(234,179,8,0.58)", "rgba(239,68,68,0.56)"],
          divider: "rgba(15,23,42,0.7)",
          dip: "rgba(15,23,42,0.2)",
          crossLine: "rgba(15,23,42,0.34)",
          primary: "#0369a1",
          accent: "#0f172a",
          warm: "#b45309",
          success: "#15803d",
          neutral: "#334155",
          rose: "#be185d",
          spotlight: "#f59e0b"
        };
  }

  function getCssToken(name, fallback) {
    try {
      return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
    } catch {
      return fallback;
    }
  }

  function getPalettePreviewSeed(value) {
    const raw = String(value ?? "city");
    let seed = 0;
    for (let i = 0; i < raw.length; i += 1) seed = (seed + raw.charCodeAt(i) * (i + 3)) % 997;
    return seed;
  }

  function loadPalettePreviewImage() {
    if (palettePreviewImageRequested || typeof Image !== "function") return;
    palettePreviewImageRequested = true;
    const img = new Image();
    img.onload = () => {
      palettePreviewImage = img;
      palettePreviewImageReady = true;
      buildPalettes();
    };
    img.onerror = () => {
      palettePreviewImage = null;
      palettePreviewImageReady = false;
      console.warn("[VideoSmith] Failed to load preview_city_bg.svg. Using canvas fallback.");
      buildPalettes();
    };
    img.src = new URL("./assets/preview_city_bg.svg", window.location.href).href;
  }

  function drawPaletteCityFallback(ctx, x, y, w, h, options = {}) {
    const theme = getPalettePreviewTheme();
    const seed = getPalettePreviewSeed(options.variant ?? options.overlay?.overlayType ?? "fallback");
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    if (theme.dark) {
      sky.addColorStop(0, "#182131");
      sky.addColorStop(0.48, "#263348");
      sky.addColorStop(1, "#0b1119");
    } else {
      sky.addColorStop(0, "#cfd9e7");
      sky.addColorStop(0.5, "#b8c5d6");
      sky.addColorStop(1, "#7c8898");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);

    const glow = ctx.createRadialGradient(x + w * 0.68, y + h * 0.28, 0, x + w * 0.68, y + h * 0.28, w * 0.72);
    glow.addColorStop(0, theme.dark ? "rgba(125,172,203,0.24)" : "rgba(255,245,218,0.36)");
    glow.addColorStop(1, "rgba(125,172,203,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);

    for (let i = 0; i < 10; i += 1) {
      const jitter = (((seed + i * 37) % 23) - 11) / 100;
      const bw = w * (0.075 + (((seed + i * 13) % 24) / 500));
      const bh = h * (0.34 + (((seed + i * 19) % 30) / 100));
      const bx = x + (i / 9) * w - bw * 0.5 + jitter * w;
      const by = y + h * 0.72 - bh;
      const building = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      building.addColorStop(0, theme.dark ? "#243347" : "#7c8998");
      building.addColorStop(0.48, theme.dark ? "#111a25" : "#5f6b7a");
      building.addColorStop(1, theme.dark ? "#303d50" : "#95a2b1");
      ctx.fillStyle = building;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = theme.dark ? "rgba(215,230,245,0.34)" : "rgba(255,255,255,0.45)";
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          if ((seed + i + row + col) % 3 === 0) continue;
          const wx = bx + bw * (0.18 + col * 0.22);
          const wy = by + bh * (0.18 + row * 0.13);
          ctx.fillRect(wx, wy, Math.max(2, bw * 0.1), Math.max(1, h * 0.012));
        }
      }
    }

    ctx.fillStyle = theme.dark ? "rgba(5,8,13,0.72)" : "rgba(48,57,70,0.48)";
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.72);
    ctx.lineTo(x + w, y + h * 0.72);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = theme.dark ? "rgba(203,213,225,0.2)" : "rgba(255,255,255,0.34)";
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.48, y + h * 0.74);
    ctx.lineTo(x + w * 0.38, y + h);
    ctx.moveTo(x + w * 0.54, y + h * 0.74);
    ctx.lineTo(x + w * 0.66, y + h);
    ctx.stroke();

    ctx.strokeStyle = theme.dark ? "rgba(248,196,112,0.26)" : "rgba(245,158,11,0.22)";
    ctx.lineWidth = Math.max(1, w * 0.018);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h * 0.82);
    ctx.lineTo(x + w * 0.34, y + h * 0.79);
    ctx.moveTo(x + w * 0.66, y + h * 0.8);
    ctx.lineTo(x + w * 0.92, y + h * 0.78);
    ctx.stroke();
  }

  function drawPaletteCityBackground(ctx, x, y, w, h, options = {}) {
    if (!ctx || w <= 0 || h <= 0) return;
    const theme = getPalettePreviewTheme();
    const overlay = options.overlay || null;
    const currentTime = Number(options.currentTime || 0);
    let zoom = Math.max(1, Number(options.zoom || 1));
    let panX = Number(options.panX || 0);
    let panY = Number(options.panY || 0);
    if (overlay && (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus")) {
      const total = Math.max(0.2, Number(overlay.duration || 1));
      const local = Math.max(0, Math.min(1, currentTime / total));
      const eased = local * local * (3 - (2 * local));
      const direction = overlay.overlayType === "zoom_out_focus" ? 1 - eased : eased;
      zoom += 0.08 * direction;
      panX += (0.5 - Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)))) * 0.08 * direction;
      panY += (0.5 - Math.max(0, Math.min(1, Number(overlay.y ?? 0.5)))) * 0.08 * direction;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    let drewImage = false;
    if (palettePreviewImageReady && palettePreviewImage?.complete) {
      try {
        const iw = palettePreviewImage.naturalWidth || palettePreviewImage.width || 1600;
        const ih = palettePreviewImage.naturalHeight || palettePreviewImage.height || 900;
        const scale = Math.max(w / iw, h / ih) * zoom;
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = x + (w - dw) * 0.5 + (panX * w);
        const dy = y + (h - dh) * 0.5 + (panY * h);
        ctx.drawImage(palettePreviewImage, dx, dy, dw, dh);
        drewImage = true;
      } catch (_) {
        drewImage = false;
      }
    }
    if (!drewImage) drawPaletteCityFallback(ctx, x, y, w, h, options);

    if (options.tint) {
      ctx.fillStyle = options.tint;
      ctx.fillRect(x, y, w, h);
    }
    if (options.scrim !== false) {
      ctx.fillStyle = getCssToken("--preview-scrim", theme.dark ? "rgba(2,6,12,0.28)" : "rgba(255,255,255,0.16)");
      ctx.fillRect(x, y, w, h);
    }
    const vignette = ctx.createRadialGradient(x + w * 0.5, y + h * 0.48, Math.min(w, h) * 0.08, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.66);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, theme.dark ? "rgba(0,0,0,0.34)" : "rgba(15,23,42,0.16)");
    ctx.fillStyle = vignette;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function createFxPalettePreviewOverlay(type) {
    const base = effectDefs?.makeOverlayDefaults?.(type, { id: `palette_preview_${type}`, start: 0, x: 0.5, y: 0.5 }) || null;
    if (!base) return null;
    const theme = getPalettePreviewTheme();
    if (type === "circle") {
      return {
        ...base,
        color: theme.primary,
        radius: 0.12,
        size: 0.12,
        strokeWidth: 5,
        sparkleCount: 4,
        sparkleDistance: 0.03,
        drawDuration: 0.54,
        holdDuration: 0.22,
        fadeOutDuration: 0.24,
        duration: 1.0,
        opacity: 0.92,
        easing: "easeOutCubic",
        y: 0.46
      };
    }
    if (type === "underline") {
      return {
        ...base,
        color: theme.primary,
        accentColor: theme.accent,
        y: 0.58,
        width: 0.36,
        size: 0.36,
        lineThickness: 11,
        drawDuration: 0.46,
        holdDuration: 0.2,
        fadeOutDuration: 0.24,
        duration: 0.88,
        opacity: 0.96,
        easing: "easeOutQuart"
      };
    }
    if (type === "point_pop_line") {
      return {
        ...base,
        color: theme.primary,
        radius: 0.16,
        lineLength: 0.11,
        strokeWidth: 4.5,
        lineCount: 6,
        spreadAmount: 0.12,
        jitter: 0.12,
        durationMs: 560,
        duration: 0.56,
        opacity: 0.92,
        easing: "easeOutBackSoft"
      };
    }
    if (type === "focus_box_draw") {
      return {
        ...base,
        color: theme.primary,
        accentColor: theme.accent,
        x: 0.5,
        y: 0.46,
        boxWidth: 0.46,
        boxHeight: 0.3,
        strokeWidth: 5,
        drawDuration: 0.54,
        holdDuration: 0.24,
        fadeOutDuration: 0.2,
        duration: 1.0
      };
    }
    if (type === "zoom_focus" || type === "zoom_out_focus") {
      return {
        ...base,
        color: theme.primary,
        accentColor: theme.accent,
        x: 0.56,
        y: 0.44,
        boxWidth: 0.34,
        boxHeight: 0.22,
        duration: 1.0,
        manualFadeInSec: 0.2,
        manualFadeOutSec: 0.2
      };
    }
    if (type === "callout_line_draw") {
      return {
        ...base,
        color: theme.rose,
        accentColor: theme.accent,
        x: 0.34,
        y: 0.6,
        lineLength: 0.28,
        lineAngle: -28,
        strokeWidth: 5,
        drawDuration: 0.5,
        holdDuration: 0.2,
        fadeOutDuration: 0.22,
        duration: 0.92
      };
    }
    if (type === "soft_spotlight") {
      return {
        ...base,
        color: theme.spotlight,
        boxWidth: 0.38,
        boxHeight: 0.24,
        drawDuration: 0.24,
        holdDuration: 0.48,
        fadeOutDuration: 0.26,
        duration: 1.12,
        opacity: theme.dark ? 0.5 : 0.36
      };
    }
    if (type === "highlight_bar_sweep") {
      return {
        ...base,
        color: theme.warm,
        accentColor: theme.accent,
        width: 0.46,
        boxHeight: 0.16,
        drawDuration: 0.42,
        holdDuration: 0.28,
        fadeOutDuration: 0.22,
        duration: 0.92,
        y: 0.54
      };
    }
    if (type === "checkpoint_pop") {
      return {
        ...base,
        color: theme.success,
        accentColor: theme.accent,
        radius: 0.08,
        lineLength: 0.06,
        strokeWidth: 5,
        lineCount: 6,
        spreadAmount: 0.12,
        jitter: 0.12,
        durationMs: 760,
        duration: 0.76,
        easing: "easeOutBackSoft"
      };
    }
    if (type === "section_divider_slide") {
      return {
        ...base,
        color: theme.neutral,
        accentColor: theme.primary,
        y: 0.34,
        width: 0.84,
        lineThickness: 5,
        drawDuration: 0.46,
        holdDuration: 0.3,
        fadeOutDuration: 0.24,
        duration: 1.0
      };
    }
    if (type === "drop_wave") {
      return {
        ...base,
        x: 0.52,
        y: 0.48,
        radius: 0.12,
        waveCount: 4,
        waveSpacing: 0.05,
        amplitude: 0.026,
        speed: 1.15,
        softness: 0.7,
        drawDuration: 0.16,
        holdDuration: 0.68,
        fadeOutDuration: 0.28,
        duration: 1.12,
        opacity: 1
      };
    }
    return null;
  }

  function preparePalettePreviewCanvas(canvas) {
    const bounds = canvas.getBoundingClientRect?.() || { width: canvas.clientWidth || 0, height: canvas.clientHeight || 0 };
    const parentBounds = canvas.parentElement?.getBoundingClientRect?.() || { width: canvas.parentElement?.clientWidth || 0, height: canvas.parentElement?.clientHeight || 0 };
    const cssWidth = Math.max(1, Math.round(parentBounds.width || bounds.width || canvas.clientWidth || 116));
    const cssHeight = Math.max(1, Math.round(parentBounds.height || bounds.height || canvas.clientHeight || Math.round(cssWidth * 9 / 16)));
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { ctx, width: cssWidth, height: cssHeight };
  }

  function drawTransitionPalettePreviewCanvas(canvas, type, progress, options = {}) {
    const prepared = preparePalettePreviewCanvas(canvas);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    const theme = getPalettePreviewTheme();
    const pad = 6;
    const frameRadius = 4;
    const frameWidth = Math.max(1, width - (pad * 2));
    const frameHeight = Math.max(1, height - (pad * 2));
    const p = Math.max(0, Math.min(1, Number(progress || 0)));
    const roundedRectPath = (x, y, w, h, r) => {
      const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    ctx.fillStyle = theme.matte;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = theme.stage;
    ctx.fillRect(pad, pad, frameWidth, frameHeight);

    const drawCardFrame = (x, y, w, h, colors = theme.before, frameOptions = {}) => {
      ctx.save();
      roundedRectPath(x, y, w, h, frameRadius);
      ctx.clip();
      drawPaletteCityBackground(ctx, x, y, w, h, {
        variant: frameOptions.variant || colors?.[0] || type,
        zoom: frameOptions.zoom || 1,
        panX: frameOptions.panX || 0,
        panY: frameOptions.panY || 0,
        scrim: true
      });
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, colors?.[0] || "rgba(56,189,248,0.22)");
      grad.addColorStop(1, colors?.[1] || "rgba(15,23,42,0)");
      ctx.globalAlpha = theme.dark ? 0.2 : 0.15;
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.frameDetail;
      ctx.fillRect(x + Math.max(6, w * 0.07), y + Math.max(6, h * 0.1), w * 0.42, Math.max(2, h * 0.04));
      ctx.fillRect(x + Math.max(6, w * 0.07), y + Math.max(14, h * 0.24), w * 0.26, Math.max(2, h * 0.035));
      ctx.restore();
      ctx.save();
      roundedRectPath(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), frameRadius);
      ctx.strokeStyle = theme.frameDetail;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    if (type === "cut") {
      drawCardFrame(pad, pad, frameWidth * 0.5, frameHeight, theme.before);
      drawCardFrame(pad + (frameWidth * 0.5), pad, frameWidth * 0.5, frameHeight, theme.after);
      ctx.fillStyle = theme.divider;
      ctx.fillRect((width / 2) - 1, pad + 6, 2, frameHeight - 12);
      return;
    }

    if (type === "fade") {
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.fadeBase);
      const dipWidth = frameWidth * (options.animated ? (0.12 + (0.46 * Math.abs(0.5 - p) * 2)) : 0.24);
      ctx.fillStyle = theme.dip;
      ctx.fillRect((width / 2) - (dipWidth / 2), pad, dipWidth, frameHeight);
      drawCardFrame(pad + frameWidth * 0.36, pad + 6, frameWidth * 0.58, frameHeight - 12, theme.fadeOverlay);
      return;
    }

    if (type === "sun_glitter_flash") {
      const glitter = transitionMotion?.computeSunGlitterState?.(p, 1, {
        mode: "out",
        reducedMotion: prefersReducedMotion()
      }) || {
        opacity: 0.72,
        glowOpacity: 0.22,
        flashOpacity: 0.3,
        pulseA: 0.42,
        pulseB: 0.56
      };
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.after);
      ctx.save();
      ctx.globalAlpha = Math.max(0.14, Math.min(1, Number(glitter.opacity || 0.72)));
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.before);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(
        pad + (frameWidth * 0.72),
        pad + (frameHeight * 0.24),
        Math.max(0, Math.min(frameWidth, frameHeight) * 0.04),
        pad + (frameWidth * 0.72),
        pad + (frameHeight * 0.24),
        Math.max(6, frameWidth * 0.7)
      );
      glow.addColorStop(0, `rgba(255,246,226,${Math.min(0.92, 0.16 + (Number(glitter.flashOpacity || 0) * 0.95)).toFixed(3)})`);
      glow.addColorStop(0.3, `rgba(255,214,148,${Math.min(0.74, 0.16 + (Number(glitter.glowOpacity || 0) * 0.84)).toFixed(3)})`);
      glow.addColorStop(1, "rgba(255,214,148,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(pad, pad, frameWidth, frameHeight);

      [
        { alpha: Math.min(0.8, (Number(glitter.pulseA || 0) * 0.64) + 0.14), y: 0.34, rot: -0.2, w: 0.92, h: 0.1 },
        { alpha: Math.min(0.86, (Number(glitter.pulseB || 0) * 0.72) + 0.16), y: 0.58, rot: -0.16, w: 0.84, h: 0.09 }
      ].forEach((streak) => {
        if (streak.alpha <= 0.02) return;
        ctx.save();
        ctx.translate(pad + (frameWidth * 0.52), pad + (frameHeight * streak.y));
        ctx.rotate(streak.rot);
        const grad = ctx.createLinearGradient(-(frameWidth * streak.w * 0.5), 0, frameWidth * streak.w * 0.5, 0);
        grad.addColorStop(0, "rgba(255,214,148,0)");
        grad.addColorStop(0.35, `rgba(255,232,198,${(streak.alpha * 0.54).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(255,250,236,${streak.alpha.toFixed(3)})`);
        grad.addColorStop(0.65, `rgba(255,226,184,${(streak.alpha * 0.48).toFixed(3)})`);
        grad.addColorStop(1, "rgba(255,214,148,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(-(frameWidth * streak.w * 0.5), -(frameHeight * streak.h * 0.5), frameWidth * streak.w, frameHeight * streak.h);
        ctx.restore();
      });
      ctx.restore();
      return;
    }

    if (type === "focus_pull_in") {
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.after);
      const focusX = pad + (frameWidth * 0.68);
      const focusY = pad + (frameHeight * 0.38);
      const scale = options.animated ? (1 - (0.62 * p)) : 0.54;
      const translateX = (focusX - pad) * (1 - scale);
      const translateY = (focusY - pad) * (1 - scale);
      ctx.save();
      ctx.translate(translateX, translateY);
      ctx.scale(scale, Math.max(0.18, scale * 0.94));
      ctx.globalAlpha = options.animated ? (1 - (0.72 * p)) : 0.62;
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.before);
      ctx.restore();
      ctx.strokeStyle = theme.spotlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(focusX, focusY, 6, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (type === "cyber_mosaic_burst") {
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.before);
      const maskCanvas = transitionMotion?.renderCyberMosaicMaskCanvas?.(p, frameWidth, frameHeight, {
        mode: "in",
        intensity: 1,
        tileDensity: 0.68,
        sizeVariance: 0.74,
        clusterCount: 4,
        clusterSpread: 0.46,
        jitterSpeed: 1.2,
        seed: 17,
        edgeSoftness: 0.024,
        reducedMotion: prefersReducedMotion()
      });
      if (maskCanvas) {
        const revealCanvas = document.createElement("canvas");
        revealCanvas.width = Math.max(1, Math.round(frameWidth));
        revealCanvas.height = Math.max(1, Math.round(frameHeight));
        const revealCtx = revealCanvas.getContext("2d");
        if (revealCtx) {
          drawPaletteCityBackground(revealCtx, 0, 0, frameWidth, frameHeight, {
            variant: "cyber-reveal",
            zoom: 1.03,
            panX: 0.03,
            scrim: true
          });
          revealCtx.fillStyle = theme.dark ? "rgba(110, 231, 255, 0.13)" : "rgba(37, 99, 235, 0.12)";
          revealCtx.fillRect(frameWidth * 0.18, frameHeight * 0.12, frameWidth * 0.4, 8);
          revealCtx.fillRect(frameWidth * 0.48, frameHeight * 0.62, frameWidth * 0.28, 6);
          revealCtx.globalCompositeOperation = "destination-in";
          revealCtx.drawImage(maskCanvas, 0, 0, frameWidth, frameHeight);
          revealCtx.globalCompositeOperation = "source-over";
          ctx.drawImage(revealCanvas, pad, pad);
        }
      }
      ctx.save();
      ctx.strokeStyle = "rgba(110, 231, 255, 0.34)";
      ctx.lineWidth = 1;
      const rects = transitionMotion?.buildCyberMosaicRectSet?.({
        tileDensity: 0.68,
        sizeVariance: 0.74,
        clusterCount: 4,
        clusterSpread: 0.46,
        jitterSpeed: 1.2,
        seed: 17,
        edgeSoftness: 0.024
      }) || [];
      rects.slice(0, 10).forEach((rect, index) => {
        const reveal = transitionMotion?.cyberMosaicEase?.(p, {}) ?? p;
        const local = Math.max(0, Math.min(1, (reveal - (rect.revealAt - rect.revealSoftness)) / Math.max(0.001, rect.revealSoftness * 2)));
        if (local <= 0.05 || local >= 0.95 || index % 2 === 1) return;
        ctx.globalAlpha = 0.08 + (local * 0.18);
        ctx.fillStyle = "rgba(110, 231, 255, 0.7)";
        ctx.fillRect(
          pad + (rect.x * frameWidth),
          pad + (rect.y * frameHeight),
          rect.w * frameWidth,
          rect.h * frameHeight
        );
      });
      ctx.restore();
      return;
    }

    if (String(type || "").startsWith("blur_slide_")) {
      const direction = String(type || "").replace("blur_slide_", "");
      drawCardFrame(pad, pad, frameWidth, frameHeight, theme.after);
      const move = options.animated ? p : 0.58;
      let dx = 0;
      let dy = 0;
      if (direction === "left") dx = -frameWidth * 0.28 * move;
      if (direction === "right") dx = frameWidth * 0.28 * move;
      if (direction === "up") dy = -frameHeight * 0.28 * move;
      if (direction === "down") dy = frameHeight * 0.28 * move;
      ctx.save();
      ctx.globalAlpha = options.animated ? (1 - (0.72 * move)) : 0.54;
      for (let i = 0; i < 3; i += 1) {
        const trail = i / 3;
        ctx.globalAlpha *= (1 - (trail * 0.28));
        drawCardFrame(
          pad + dx + (trail * (direction === "left" ? 12 : direction === "right" ? -12 : 0)),
          pad + dy + (trail * (direction === "up" ? 9 : direction === "down" ? -9 : 0)),
          frameWidth,
          frameHeight,
          theme.before
        );
      }
      ctx.restore();
      return;
    }

    drawCardFrame(pad, pad, frameWidth, frameHeight, theme.before);
    ctx.save();
    ctx.globalAlpha = options.animated ? (0.26 + (0.56 * p)) : 0.58;
    drawCardFrame(pad + (frameWidth * 0.14), pad + 6, frameWidth * 0.78, frameHeight - 12, theme.after);
    ctx.restore();
    ctx.strokeStyle = theme.crossLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad + frameWidth * 0.18, pad + 8);
    ctx.lineTo(pad + frameWidth * 0.82, pad + frameHeight - 8);
    ctx.moveTo(pad + frameWidth * 0.32, pad + 8);
    ctx.lineTo(pad + frameWidth * 0.96, pad + frameHeight - 8);
    ctx.stroke();
  }

  function createTransitionCardPreview(item, cardEl) {
    const previewEl = document.createElement("div");
    previewEl.className = "palettePreview";
    previewEl.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    canvas.className = "palettePreviewCanvas";
    previewEl.appendChild(canvas);

    const cycleDurationMs = 780;
    const loopGapMs = 280;
    let rafId = 0;
    let loopTimerId = 0;
    let running = false;
    let disposed = false;
    let cycleStartMs = 0;
    let staticRetryCount = 0;

    function renderStatic() {
      drawTransitionPalettePreviewCanvas(canvas, item.type, item.type === "fade" ? 0.42 : 0.5, { animated: false });
      previewEl.classList.add("hasCanvas");
      previewEl.classList.remove("hasError");
      previewEl.classList.remove("isPreviewing");
      cardEl.classList.remove("isPreviewing");
      cycleStartMs = 0;
    }
    function stopPreview() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (loopTimerId) clearTimeout(loopTimerId);
      rafId = 0;
      loopTimerId = 0;
      renderStatic();
    }
    function scheduleFrame(ts) {
      if (!running || disposed) return;
      if (!cycleStartMs) cycleStartMs = ts;
      const elapsed = Math.max(0, ts - cycleStartMs);
      if (elapsed <= cycleDurationMs) {
        previewEl.classList.add("isPreviewing");
        cardEl.classList.add("isPreviewing");
        drawTransitionPalettePreviewCanvas(canvas, item.type, elapsed / cycleDurationMs, { animated: true });
        rafId = requestAnimationFrame(scheduleFrame);
        return;
      }
      renderStatic();
      if (prefersReducedMotion()) {
        running = false;
        return;
      }
      loopTimerId = window.setTimeout(() => {
        loopTimerId = 0;
        cycleStartMs = 0;
        if (running && !disposed) rafId = requestAnimationFrame(scheduleFrame);
      }, loopGapMs);
    }
    function startPreview() {
      if (disposed || prefersReducedMotion()) {
        renderStatic();
        return;
      }
      stopPreview();
      running = true;
      drawTransitionPalettePreviewCanvas(canvas, item.type, 0, { animated: true });
      rafId = requestAnimationFrame(scheduleFrame);
    }

    renderStatic();
    requestAnimationFrame(() => {
      if (!disposed) renderStatic();
    });
    const handleEnter = () => startPreview();
    const handleLeave = () => stopPreview();
    const handleFocusIn = () => startPreview();
    const handleFocusOut = (event) => {
      if (!cardEl.contains(event.relatedTarget)) stopPreview();
    };
    const handleDragStart = () => stopPreview();
    cardEl.addEventListener("pointerenter", handleEnter);
    cardEl.addEventListener("pointerleave", handleLeave);
    cardEl.addEventListener("focusin", handleFocusIn);
    cardEl.addEventListener("focusout", handleFocusOut);
    cardEl.addEventListener("dragstart", handleDragStart);

    return {
      element: previewEl,
      dispose() {
        if (disposed) return;
        disposed = true;
        stopPreview();
        cardEl.removeEventListener("pointerenter", handleEnter);
        cardEl.removeEventListener("pointerleave", handleLeave);
        cardEl.removeEventListener("focusin", handleFocusIn);
        cardEl.removeEventListener("focusout", handleFocusOut);
        cardEl.removeEventListener("dragstart", handleDragStart);
      }
    };
  }

  function createEffectCardPreview(item, cardEl) {
    if (!overlayEngine?.renderFxPreviewCanvas) return null;
    const overlay = createFxPalettePreviewOverlay(item.type);
    if (!overlay) return null;

    const previewEl = document.createElement("div");
    previewEl.className = "palettePreview";
    previewEl.setAttribute("aria-hidden", "true");

    const canvas = document.createElement("canvas");
    canvas.className = "palettePreviewCanvas";
    previewEl.appendChild(canvas);

    const fallback = document.createElement("div");
    fallback.className = "palettePreviewFallback";
    fallback.textContent = getFxPalettePreviewGlyph(item.type);
    previewEl.appendChild(fallback);

    const cycleDurationMs = Math.max(140, Math.round(Number(overlay.duration || 0.52) * 1000));
    const loopGapMs = 320;
    let rafId = 0;
    let loopTimerId = 0;
    let running = false;
    let disposed = false;
    let cycleStartMs = 0;
    let staticRetryCount = 0;

    function drawFrame(currentTimeSec) {
      const rendered = overlayEngine.renderFxPreviewCanvas(canvas, overlay, {
        currentTime: currentTimeSec,
        resolutionName: "HD",
        aspectRatio: "16:9",
        drawBackground: drawPaletteCityBackground,
        previewMode: "palette",
        hideEditorChrome: true
      });
      previewEl.classList.toggle("hasCanvas", rendered !== false);
      previewEl.classList.toggle("hasError", rendered === false);
      return rendered !== false;
    }

    function renderStatic() {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (loopTimerId) {
        clearTimeout(loopTimerId);
        loopTimerId = 0;
      }
      drawFrame(Math.min(0.35, Number(overlay.duration || 1) * 0.45));
      previewEl.classList.remove("isPreviewing");
      cardEl.classList.remove("isPreviewing");
      cycleStartMs = 0;
      const bounds = canvas.getBoundingClientRect?.() || { width: 0, height: 0 };
      if (!disposed && staticRetryCount < 5 && (bounds.width < 16 || bounds.height < 9)) {
        staticRetryCount += 1;
        requestAnimationFrame(() => {
          if (!disposed && !running) renderStatic();
        });
      } else {
        staticRetryCount = 0;
      }
    }

    function stopPreview() {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (loopTimerId) {
        clearTimeout(loopTimerId);
        loopTimerId = 0;
      }
      renderStatic();
    }

    function scheduleFrame(timestamp) {
      if (!running || disposed) return;
      if (!cycleStartMs) cycleStartMs = timestamp;
      const elapsedMs = Math.max(0, timestamp - cycleStartMs);
      if (elapsedMs <= cycleDurationMs) {
        previewEl.classList.add("isPreviewing");
        cardEl.classList.add("isPreviewing");
        drawFrame(elapsedMs / 1000);
        rafId = requestAnimationFrame(scheduleFrame);
        return;
      }

      renderStatic();
      if (prefersReducedMotion()) {
        running = false;
        return;
      }

      loopTimerId = window.setTimeout(() => {
        loopTimerId = 0;
        if (!running || disposed) return;
        cycleStartMs = 0;
        rafId = requestAnimationFrame(scheduleFrame);
      }, loopGapMs);
    }

    function startPreview() {
      if (disposed) return;
      if (prefersReducedMotion()) {
        renderStatic();
        return;
      }
      stopPreview();
      running = true;
      previewEl.classList.add("isPreviewing");
      cardEl.classList.add("isPreviewing");
      drawFrame(0);
      rafId = requestAnimationFrame(scheduleFrame);
    }

    const handleEnter = () => startPreview();
    const handleLeave = () => stopPreview();
    const handleFocusIn = () => startPreview();
    const handleFocusOut = (event) => {
      if (!cardEl.contains(event.relatedTarget)) stopPreview();
    };
    const handleDragStart = () => stopPreview();

    renderStatic();
    requestAnimationFrame(() => {
      if (!disposed) renderStatic();
    });
    cardEl.addEventListener("pointerenter", handleEnter);
    cardEl.addEventListener("pointerleave", handleLeave);
    cardEl.addEventListener("focusin", handleFocusIn);
    cardEl.addEventListener("focusout", handleFocusOut);
    cardEl.addEventListener("dragstart", handleDragStart);

    return {
      element: previewEl,
      renderStatic,
      dispose() {
        if (disposed) return;
        disposed = true;
        stopPreview();
        cardEl.removeEventListener("pointerenter", handleEnter);
        cardEl.removeEventListener("pointerleave", handleLeave);
        cardEl.removeEventListener("focusin", handleFocusIn);
        cardEl.removeEventListener("focusout", handleFocusOut);
        cardEl.removeEventListener("dragstart", handleDragStart);
      }
    };
  }

  function createPaletteCard(item, options) {
    const div = document.createElement("div");
    div.className = "paletteItem";
    div.draggable = true;
    div.tabIndex = 0;
    div.dataset.dragType = options.dragType;
    Object.entries(options.dataset || {}).forEach(([key, value]) => {
      if (value == null) return;
      div.dataset[key] = String(value);
    });

    if (options.dragType === "fx" || options.dragType === "transition") {
      const previewController = options.dragType === "fx"
        ? createEffectCardPreview(item, div)
        : createTransitionCardPreview(item, div);
      if (previewController?.element) {
        div.classList.add("hasPreview");
        div.appendChild(previewController.element);
        previewController.renderStatic?.();
        requestAnimationFrame(() => previewController.renderStatic?.());
        palettePreviewDisposers.push(() => previewController.dispose());
      }
    }

    const meta = document.createElement("div");
    meta.className = "paletteMeta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.name || "";
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = item.desc || "";
    meta.appendChild(name);
    meta.appendChild(desc);
    div.appendChild(meta);

    const dragGlyph = document.createElement("div");
    dragGlyph.className = "dragGlyph";
    dragGlyph.textContent = "::";
    div.appendChild(dragGlyph);

    let lastDragAt = 0;
    if (typeof options.activate === "function") {
      div.dataset.activatable = "true";
      div.setAttribute("role", "button");
      div.addEventListener("click", (e) => {
        if (Date.now() - lastDragAt < 180) return;
        e.preventDefault();
        e.stopPropagation();
        void options.activate(e);
      });
      div.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        void options.activate(e);
      });
    }

    div.addEventListener("dragstart", (e) => {
      lastDragAt = Date.now();
      state.dragging.item = options.dragItem();
      window.__videosmithInternalDrag = true;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", JSON.stringify(state.dragging.item));
        e.dataTransfer.setData("application/x-videosmith-item", JSON.stringify(state.dragging.item));
        const dragImage = createPaletteDragImage(item, state.dragging.item);
        dragImage.getBoundingClientRect?.();
        if (typeof e.dataTransfer.setDragImage === "function") e.dataTransfer.setDragImage(dragImage, 18, 18);
      }
      div.classList.add("isDragging");
      document.body?.classList.add("palette-dragging");
    });

    div.addEventListener("dragend", () => {
      lastDragAt = Date.now();
      clearPaletteDragImage();
    });

    return div;
  }

  function createBackgroundPalettePreview(color) {
    const preview = document.createElement("div");
    preview.className = "backgroundPalettePreview";
    const swatch = document.createElement("div");
    swatch.className = "backgroundPaletteSwatch";
    swatch.style.background = normalizeBackgroundColor(color || "#ffffff");
    const badge = document.createElement("div");
    badge.className = "backgroundPaletteBadge";
    badge.textContent = `${formatTimelineSec(BACKGROUND_CLIP_DURATION_SEC)}s`;
    const hex = document.createElement("div");
    hex.className = "backgroundPaletteHex";
    hex.textContent = normalizeBackgroundColor(color || "#ffffff").toUpperCase();
    preview.appendChild(swatch);
    preview.appendChild(badge);
    preview.appendChild(hex);
    return preview;
  }

  function fillBackgroundClipColorSelect() {
    if (!els.backgroundClipColorSelect) return;
    const selected = getBackgroundClipColorValue();
    const options = getBackgroundClipColorOptions();
    els.backgroundClipColorSelect.innerHTML = "";
    if (!options.some((item) => item.value === selected)) {
      const customOpt = document.createElement("option");
      customOpt.value = selected;
      customOpt.textContent = `${t("backgroundColorCustom", "커스텀")} (${selected.toUpperCase()})`;
      els.backgroundClipColorSelect.appendChild(customOpt);
    }
    options.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = item.label;
      els.backgroundClipColorSelect.appendChild(opt);
    });
    const hasSelected = options.some((item) => item.value === selected);
    els.backgroundClipColorSelect.value = hasSelected ? selected : selected;
    state.settings.backgroundClipColor = els.backgroundClipColorSelect.value || "#ffffff";
    syncBackgroundClipColorControls();
  }

  function buildBackgroundPalette() {
    if (els.backgroundPalette) els.backgroundPalette.innerHTML = "";
    const color = getBackgroundClipColorValue();
    const label = getBackgroundClipColorLabel(color);
    const item = {
      name: t("backgroundClipCardName", "배경 클립"),
      desc: `${label} · ${t("backgroundClipCardDesc", "드래그하면 5초 배경 클립이 추가됩니다.")}`
    };
    const card = createPaletteCard(item, {
      dragType: "background",
      dataset: { backgroundColor: color },
      dragItem: () => ({
        kind: "background",
        color: getBackgroundClipColorValue(),
        durationSec: BACKGROUND_CLIP_DURATION_SEC
      })
    });
    card.insertBefore(createBackgroundPalettePreview(color), card.firstChild);
    els.backgroundPalette?.appendChild(card);
  }

  function buildPalettes() {
    loadPalettePreviewImage();
    disposePalettePreviewControllers();
    fillBackgroundClipColorSelect();
    if (els.editToolPalette) els.editToolPalette.innerHTML = "";
    buildBackgroundPalette();
    if (els.transitionPalette) els.transitionPalette.innerHTML = "";
    if (els.textPalette) els.textPalette.innerHTML = "";
    if (els.effectsPalette) els.effectsPalette.innerHTML = "";
    editToolItems.forEach((item) => {
      const div = createPaletteCard(item, {
        dragType: "edit-tool",
        dataset: { toolType: item.type },
        dragItem: () => ({ kind: "edit_tool", type: item.type }),
        activate: () => activateEditTool(item.type)
      });
      els.editToolPalette?.appendChild(div);
    });
    getTransitionItems().forEach(item => {
      const div = createPaletteCard(item, {
        dragType: "transition",
        dataset: { transitionType: item.type },
        dragItem: () => ({ kind: "transition", type: item.type })
      });
      els.transitionPalette?.appendChild(div);
    });

    textItems.forEach(item => {
      const div = createPaletteCard(item, {
        dragType: "text",
        dragItem: () => ({ kind: "text" })
      });
      els.textPalette?.appendChild(div);
    });

    fxItems.forEach(item => {
      const div = createPaletteCard(item, {
        dragType: "fx",
        dataset: { fxType: item.type },
        dragItem: () => ({ kind: "fx", type: item.type })
      });
      els.effectsPalette?.appendChild(div);
    });
    hydrateRangeInputs();
  }

  function fillSelects() {
    fpsOptions.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      els.selFps.appendChild(opt);
    });
    els.selFps.value = String(state.settings.fps);

    resOptions.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.name;
      opt.textContent = o.label;
      els.selRes.appendChild(opt);
    });
    els.selRes.value = state.settings.resolutionName;

    fmtOptions.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      els.selFmt.appendChild(opt);
    });
    els.selFmt.value = state.settings.container;
    loadCustomFonts();
    refreshFontFamilySelect();
    fillTextOverlayTransitionSelect(els.overlayTransitionInTypeInput);
    fillTextOverlayTransitionSelect(els.overlayTransitionOutTypeInput);
    applyProjectBackgroundColor();
    buildAspectRatioGrid();
    syncAspectRatioUi();
  }

  els.selFps.onchange = () => state.settings.fps = Number(els.selFps.value);
  els.selRes.onchange = () => {
    state.settings.resolutionName = els.selRes.value;
    syncAspectRatioUi({ render: true });
  };
  els.selFmt.onchange = () => state.settings.container = els.selFmt.value;
  els.btnPreviewAspectRatio?.addEventListener("click", openAspectRatioModal);
  els.btnAspectRatioClose?.addEventListener("click", closeAspectRatioModal);
  els.aspectRatioModal?.addEventListener("mousedown", (e) => {
    if (e.target === els.aspectRatioModal) closeAspectRatioModal();
  });
  els.btnAddVideoSection?.addEventListener("click", () => addTimelineSection("video"));
  els.btnAddAudioSection?.addEventListener("click", () => addTimelineSection("audio"));
  if (els.backgroundClipColorSelect) {
    els.backgroundClipColorSelect.onchange = () => {
      setBackgroundClipColor(els.backgroundClipColorSelect.value || "#ffffff");
    };
  }
  if (els.backgroundClipColorInput) {
    els.backgroundClipColorInput.oninput = () => {
      setBackgroundClipColor(els.backgroundClipColorInput.value || "#ffffff");
    };
  }
  if (els.backgroundClipColorHex) {
    const commitBackgroundClipColorHex = () => {
      setBackgroundClipColor(els.backgroundClipColorHex.value || "#ffffff");
    };
    els.backgroundClipColorHex.onchange = commitBackgroundClipColorHex;
    els.backgroundClipColorHex.onblur = commitBackgroundClipColorHex;
  }
  els.backgroundClipEyedropperBtn?.addEventListener("click", async () => {
    await openBackgroundClipEyedropper();
  });
  if (els.backgroundColorInput) {
    els.backgroundColorInput.oninput = () => {
      state.settings.backgroundColor = normalizeBackgroundColor(els.backgroundColorInput.value);
      applyProjectBackgroundColor();
    };
  }
  if (els.backgroundColorHex) {
    const commitBackgroundColorHex = () => {
      state.settings.backgroundColor = normalizeBackgroundColor(els.backgroundColorHex.value);
      applyProjectBackgroundColor();
    };
    els.backgroundColorHex.onchange = commitBackgroundColorHex;
    els.backgroundColorHex.onblur = commitBackgroundColorHex;
  }

  // Upload/import
  async function importPaths(paths) {
    if (!paths?.length) return;
    setUploadStatus(true);
    try {
      const results = await window.pearl.importMedia(paths);
      applyImportResults(results);
    } finally {
      setUploadStatus(false);
    }
  }

  function applyImportResults(results) {
    const warnings = [];
    const errors = [];
    const importedVideoIds = [];
    const importedAudio = [];
    let firstImportedVideoId = null;

    for (const r of (results || [])) {
      if (!r.ok) {
        const lines = [`${r.originalPath}: ${r.error}`];
        if (r.reason) lines.push(`원인: ${r.reason}`);
        if (r.solution) lines.push(`해결: ${r.solution}`);
        errors.push(lines.join("\n"));
        continue;
      }
      if (r.warnings?.length) warnings.push(...r.warnings);

      if (r.kind === "video") {
        const end = getMaxTimelineEnd();
        const previewPath = r.internalPath || r.originalPath;
        const sourcePath = r.originalPath || r.internalPath;
        const clip = {
          id: r.id,
          kind: "video",
          isImage: !!r.isImage,
          mediaRole: r.meta?.hasAudio ? "linked_av" : "video_only",
          name: fileBase(r.originalPath),
          originalPath: r.originalPath,
          stillImagePath: r.stillImagePath || "",
          internalPath: previewPath,
          previewPath,
          sourcePath,
          sourceIn: 0,
          sourceOut: r.meta.duration || 0,
          in: 0,
          out: r.meta.duration || 0,
          start: end,
          section: 1,
          audioEnabled: !!r.meta?.hasAudio,
          meta: r.meta,
          overlays: []
        };
        initVideoClipFields(clip, { defaultSourceIn: 0, defaultDuration: Number(r.meta?.duration || MIN_TIMELINE_CLIP_SEC) });
        state.project.videoClips.push(clip);
        clip.thumbs = [];
        clip._thumbRequestCount = 0;
        importedVideoIds.push(clip.id);
        if (!firstImportedVideoId) firstImportedVideoId = clip.id;
        if (r.meta?.hasAudio) {
          const audioId = `${r.id}_aud`;
          state.project.audioItems.push(createLinkedAudioItemFromVideoClip(clip, {
            id: audioId,
            linkedVideoId: r.id,
            linkMode: "linked",
            gain: 1,
            sourceIn: 0,
            sourceOut: Number(r.meta?.duration || 0)
          }));
          clip.linkedAudioId = audioId;
          clip.linkMode = "linked";
          importedAudio.push({ id: audioId, path: previewPath });
        }
      } else {
        const previewPath = r.internalPath || r.originalPath;
        const sourcePath = r.originalPath || r.internalPath;
        const audio = {
          id: r.id,
          kind: "audio",
          mediaRole: "audio_only",
          name: fileBase(r.originalPath),
          originalPath: r.originalPath,
          internalPath: previewPath,
          previewPath,
          sourcePath,
          start: getMaxTimelineEnd(),
          duration: r.meta.duration || 0,
          section: 1,
          gain: 1,
          sourceIn: 0,
          sourceOut: Number(r.meta.duration || 0),
          waveformPeaks: [],
          pitchContour: []
        };
        state.project.audioItems.push(syncAudioItemTiming(audio));
        importedAudio.push({ id: audio.id, path: previewPath });
      }
    }

    normalizeProjectMediaPaths();
    recalcTimeline();
    if (firstImportedVideoId && !(state.project.videoClips || []).some((clip) => clip.id === state.ui.previewClipId)) {
      const first = state.project.videoClips.find((clip) => clip.id === firstImportedVideoId);
      if (first) state.ui.currentTime = snapTimelineTimeSec(Number(first.start || 0));
    }
    renderAll();

    window.setTimeout(() => {
      importedVideoIds.forEach((clipId) => enqueueThumbBuild(clipId, 1, "high"));
      importedAudio.forEach((audio) => enqueueAudioAnalysis(audio.id, audio.path, { waveform: true, pitch: false }));
      window.setTimeout(() => {
        importedVideoIds.forEach((clipId) => enqueueThumbBuild(clipId, state.ui.pxPerSec >= 120 ? 8 : 4, "normal"));
      }, 350);
    }, 0);

    if (warnings.length) showAlert([...new Set(warnings)]);
    if (errors.length) showAlert(["일부 파일을 가져오지 못했습니다.", ...errors]);
  }

  async function createBackgroundColorClipAsset(color, durationSec = BACKGROUND_CLIP_DURATION_SEC) {
    const normalizedColor = normalizeBackgroundColor(color || "#ffffff");
    if (!window.pearl?.createBackgroundColorClip) {
      return { ok: false, error: "background clip api unavailable" };
    }
    return await window.pearl.createBackgroundColorClip({
      color: normalizedColor,
      durationSec: Math.max(MIN_TIMELINE_CLIP_SEC, Number(durationSec || BACKGROUND_CLIP_DURATION_SEC)),
      fps: Number(state.settings.fps || 30),
      resolutionName: state.settings.resolutionName || "FHD",
      aspectRatio: state.settings.aspectRatio || "16:9"
    });
  }

  function insertGeneratedBackgroundClip(asset, section, atTimelineTime) {
    if (!asset?.ok || !asset.internalPath) return null;
    const duration = Math.max(MIN_TIMELINE_CLIP_SEC, Number(asset.meta?.duration || BACKGROUND_CLIP_DURATION_SEC));
    const normalizedColor = normalizeBackgroundColor(asset.color || "#ffffff");
    const clip = {
      id: asset.id || `bg_${Date.now()}`,
      kind: "video",
      isImage: false,
      isGeneratedBackground: true,
      backgroundColor: normalizedColor,
      mediaRole: "video_only",
      name: asset.name || `${t("backgroundClipDefaultName", "배경")} ${normalizedColor.toUpperCase()}`,
      originalPath: asset.originalPath || asset.internalPath,
      internalPath: asset.internalPath,
      previewPath: asset.internalPath,
      sourcePath: asset.internalPath,
      sourceIn: 0,
      sourceOut: duration,
      in: 0,
      out: duration,
      start: nearestSnapTime(Math.max(0, Number(atTimelineTime || 0))),
      section: Math.max(1, Number(section || 1)),
      audioEnabled: false,
      meta: {
        ...(asset.meta || {}),
        duration,
        hasAudio: false,
        isBackgroundColor: true
      },
      overlays: []
    };
    initVideoClipFields(clip, { defaultSourceIn: 0, defaultDuration: duration });
    state.project.videoClips.push(clip);
    clip.thumbs = [];
    clip._thumbRequestCount = 0;
    normalizeProjectMediaPaths();
    recalcTimeline();
    selectSingle("video", clip.id, clip.section);
    renderAll();
    enqueueThumbBuild(clip.id, 1, "high");
    toast(t("backgroundClipApplied", "배경 클립이 추가되었습니다."));
    return clip;
  }

  function fileBase(p) {
    const s = p.replace(/\\/g, "/");
    const parts = s.split("/");
    return parts[parts.length - 1];
  }

  function getImportFileExt(fileName) {
    const parts = String(fileName || "").split(".");
    return parts.length > 1 ? String(parts.pop() || "").toLowerCase() : "";
  }

  function isImageLikeImportFile(file) {
    const mime = String(file?.type || "").toLowerCase();
    return mime.startsWith("image/") || IMPORT_IMAGE_EXT.has(getImportFileExt(file?.name || ""));
  }

  function isVideoLikeImportFile(file) {
    const mime = String(file?.type || "").toLowerCase();
    return mime.startsWith("video/") || IMPORT_VIDEO_EXT.has(getImportFileExt(file?.name || ""));
  }

  function isAudioLikeImportFile(file) {
    const mime = String(file?.type || "").toLowerCase();
    return mime.startsWith("audio/") || IMPORT_AUDIO_EXT.has(getImportFileExt(file?.name || ""));
  }

  els.btnUpload.onclick = async () => {
    const paths = await window.pearl.pickMediaFiles();
    await importPaths(paths);
  };

  const btnPickOutputFolder = document.getElementById("btnPickOutputFolder");
  btnPickOutputFolder?.addEventListener("click", async () => {
    const res = await window.pearl.pickOutputFolder?.();
    if (res?.ok) {
      state.settings.outputFolder = res.dirPath || "";
      updateOutputFolderHint();
      toast("출력 폴더가 설정되었습니다.");
    }
  });

  // Drag & drop (program-wide)
  function isExternalFileDrag(e) {
    const dt = e.dataTransfer;
    if (!dt) return false;
    if (window.__videosmithInternalDrag || state.dragging.item) return false;
    const plain = String(dt.getData?.("text/plain") || "");
    if (plain) {
      const parsed = safeParse(plain);
      if (parsed?.kind === "transition" || parsed?.kind === "text" || parsed?.kind === "fx" || parsed?.kind === "background") return false;
    }
    const types = [...(dt.types || [])].map(t => String(t || "").toLowerCase());
    const hasFilesType = types.includes("files");
    const hasUri = types.includes("text/uri-list");
    const hasFileObj = Number(dt.files?.length || 0) > 0 || Number(dt.items?.length || 0) > 0;
    if (!hasFilesType && !hasUri && !hasFileObj) return false;
    if (types.includes("application/x-pearl-internal")) return false;
    // Some Windows drag sources expose unreliable dt.items during dragover/drop.
    // If Files type exists, treat as external file drag.
    return true;
  }

  function normalizeDroppedPath(raw) {
    const s0 = String(raw || "").trim();
    if (!s0) return "";
    let s = s0;
    try {
      if (/^file:\/\//i.test(s)) {
        s = decodeURIComponent(s.replace(/^file:\/\//i, ""));
      }
    } catch {
      // keep raw path
    }
    // file:///C:/... can become /C:/...
    if (/^\/[A-Za-z]:\//.test(s)) s = s.slice(1);
    if (/^\/[A-Za-z]:\\/.test(s)) s = s.slice(1);
    s = s.replace(/\//g, "\\");
    return s;
  }

  async function extractDropPaths(dt) {
    if (!dt) return [];
    const paths = [];
    const files = [...(dt.files || [])];
    for (const f of files) {
      let p = normalizeDroppedPath(f?.path || "");
      if (!p && window.pearl?.getPathForFile) {
        try { p = normalizeDroppedPath(await window.pearl.getPathForFile(f)); } catch {}
      }
      if (p) paths.push(p);
    }
    const items = [...(dt.items || [])];
    for (const it of items) {
      try {
        const ff = it?.getAsFile?.();
        let p = normalizeDroppedPath(ff?.path || "");
        if (!p && ff && window.pearl?.getPathForFile) {
          try { p = normalizeDroppedPath(await window.pearl.getPathForFile(ff)); } catch {}
        }
        if (p) paths.push(p);
      } catch {
        // ignore
      }
    }
    const uriList = String(dt.getData?.("text/uri-list") || "");
    if (uriList) {
      uriList
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(x => x && !x.startsWith("#"))
        .forEach((u) => {
          const p = normalizeDroppedPath(u);
          if (p) paths.push(p);
        });
    }
      const plain = String(dt.getData?.("text/plain") || "");
      if (plain) {
        const parsed = safeParse(plain);
        if (parsed?.kind === "transition" || parsed?.kind === "text" || parsed?.kind === "fx" || parsed?.kind === "background") return [];
        plain
          .split(/\r?\n/)
          .map(x => x.trim())
          .filter(Boolean)
        .forEach((line) => {
          const p = normalizeDroppedPath(line);
          if (p) paths.push(p);
        });
    }
    return [...new Set(paths)];
  }

  function classifyDurationTargets(files) {
    const onlyVideo = [];
    const onlyAudio = [];
    for (const f of (files || [])) {
      if (isVideoLikeImportFile(f) || isImageLikeImportFile(f)) onlyVideo.push(f);
      else if (isAudioLikeImportFile(f)) onlyAudio.push(f);
      else {
        onlyVideo.push(f);
        onlyAudio.push(f);
      }
    }
    return { onlyVideo, onlyAudio };
  }

  async function getFileDuration(file, asVideo = true) {
    if (asVideo && isImageLikeImportFile(file)) return 5;
    const key = `${file.name}|${file.size}|${file.lastModified}|${asVideo ? "v" : "a"}`;
    if (dropMetaCache.has(key)) return dropMetaCache.get(key);

    const d = await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const el = document.createElement(asVideo ? "video" : "audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const sec = Number(el.duration);
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(sec) && sec > 0 ? sec : 0);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      el.src = url;
    });
    dropMetaCache.set(key, d);
    return d;
  }

  async function estimateDropDuration(files, asVideo = true) {
    const pathList = (files || []).map(f => f.path).filter(Boolean);
    if (pathList.length && window.pearl?.probeMediaDurations) {
      try {
        const probed = await window.pearl.probeMediaDurations(pathList);
        const asKind = asVideo ? "video" : "audio";
        const sum = (probed || [])
          .filter(x => x.kind === asKind)
          .reduce((acc, x) => acc + Number(x.duration || 0), 0);
        if (sum > 0) return sum;
      } catch {
        // fallback below
      }
    }
    let total = 0;
    for (const f of (files || [])) {
      total += await getFileDuration(f, asVideo);
    }
    return total;
  }

  function clearDropPreview() {
    state.ui.dropPreview.video = { visible: false, startSec: 0, durationSec: 0, section: 1 };
    state.ui.dropPreview.audio = { visible: false, startSec: 0, durationSec: 0 };
    renderTimeline();
  }

  function dragFilesSignature(files) {
    return (files || [])
      .map(f => `${f.path || ""}|${f.name || ""}|${f.size || 0}|${f.lastModified || 0}`)
      .join("||");
  }

  const dropDurationCache = new Map();
  let dropPreviewReqId = 0;
  let dragDepth = 0;
  let externalDragActive = false;
  let lastDropPointer = { x: 0, y: 0 };
  let lastExternalDragTs = 0;

  function resetExternalDragState() {
    dragDepth = 0;
    externalDragActive = false;
    lastExternalDragTs = 0;
    clearDropPreview();
  }
  function showFallbackDropPreview(clientX, clientY) {
    const vr = els.videoLane.getBoundingClientRect();
    const ar = els.audioLane.getBoundingClientRect();
    const br = els.bottom?.getBoundingClientRect?.();
    let inVideo = clientY >= vr.top && clientY <= vr.bottom;
    let inAudio = clientY >= ar.top && clientY <= ar.bottom;
    const inBottom = !!br && clientX >= br.left && clientX <= br.right && clientY >= br.top && clientY <= br.bottom;
    if (!inVideo && !inAudio && inBottom) inVideo = true;
    if (!inVideo && !inAudio) return;
    const laneRect = inAudio ? ar : vr;
    const laneEl = inAudio ? els.audioLane : els.videoLane;
    const laneX = Math.max(0, clientX - laneRect.left + Number(els.timelineViewport?.scrollLeft || laneEl.scrollLeft || 0));
    const startSec = window.PearlTimeline.pxToSeconds(laneX, state.ui.pxPerSec);
    const section = inVideo ? getVideoSectionAtClientY(clientY) : 1;
    state.ui.dropPreview.video = {
      visible: !!inVideo,
      startSec,
      durationSec: 5,
      section,
      kind: "media",
      label: "Media"
    };
    state.ui.dropPreview.audio = {
      visible: !!inAudio,
      startSec,
      durationSec: 5,
      kind: "audio",
      label: "Audio"
    };
    renderTimeline();
  }

  async function updateDropPreview(e) {
    if (!e?.dataTransfer) return;
    if (state.ui.internalDragging) {
      clearDropPreview();
      return;
    }
    const files = [...(e.dataTransfer.files || [])];
    const hasClientPos = Number.isFinite(e.clientX) && Number.isFinite(e.clientY) && (e.clientX !== 0 || e.clientY !== 0);
    const px = hasClientPos ? e.clientX : (lastDropPointer.x || 0);
    const py = hasClientPos ? e.clientY : (lastDropPointer.y || 0);
    if (hasClientPos) lastDropPointer = { x: px, y: py };
    const vr = els.videoLane.getBoundingClientRect();
    const ar = els.audioLane.getBoundingClientRect();
    const br = els.bottom?.getBoundingClientRect?.();
    let inVideo = py >= vr.top && py <= vr.bottom;
    let inAudio = py >= ar.top && py <= ar.bottom;
    const dz = els.dropZone.getBoundingClientRect();
    const overDropZone = px >= dz.left && px <= dz.right && py >= dz.top && py <= dz.bottom;
    if (!inVideo && !inAudio && overDropZone) inVideo = true;
    // Fallback: if pointer is inside timeline area but row hit-test misses due nested elements,
    // force preview to video lane so dashed guide is always visible during external drag.
    const inBottom = !!br && px >= br.left && px <= br.right && py >= br.top && py <= br.bottom;
    if (!inVideo && !inAudio && inBottom) inVideo = true;
    // External drag events can lose pointer coordinates on Windows/Electron.
    // Keep preview alive and default to video lane while dragging files.
    if (!inVideo && !inAudio && externalDragActive) inVideo = true;
    const overLane = inVideo || inAudio;
    if (!overLane) {
      state.ui.dropPreview.video = { visible: false, startSec: 0, durationSec: 0, section: 1 };
      state.ui.dropPreview.audio.visible = false;
      renderTimeline();
      return;
    }

    let startSec = state.ui.viewDuration;
    const videoSection = inVideo ? getVideoSectionAtClientY(py) : 1;
    if (inAudio || (inVideo && !overDropZone)) {
      const laneRect = inAudio ? ar : vr;
      const laneEl = inAudio ? els.audioLane : els.videoLane;
      const laneX = Math.max(0, px - laneRect.left + Number(els.timelineViewport?.scrollLeft || laneEl.scrollLeft || 0));
      startSec = window.PearlTimeline.pxToSeconds(laneX, state.ui.pxPerSec);
    }

    // Fast fallback preview while OS drag metadata is still unavailable.
    state.ui.dropPreview.video = {
      visible: inVideo,
      startSec,
      durationSec: 5,
      section: videoSection,
      kind: "media",
      label: "Media"
    };
    state.ui.dropPreview.audio = {
      visible: inAudio,
      startSec,
      durationSec: 5,
      kind: "audio",
      label: "Audio"
    };
    renderTimeline();

    let durationInfo = null;
    const reqId = ++dropPreviewReqId;
    const sig = dragFilesSignature(files);
    if (files.length) {
      durationInfo = dropDurationCache.get(sig);
      if (!durationInfo) {
        const { onlyVideo, onlyAudio } = classifyDurationTargets(files);
        const [videoDur, audioDur] = await Promise.all([
          estimateDropDuration(onlyVideo, true),
          estimateDropDuration(onlyAudio, false)
        ]);
        durationInfo = { videoDur, audioDur };
        dropDurationCache.set(sig, durationInfo);
      }
    } else {
      const paths = await extractDropPaths(e.dataTransfer);
      if (paths.length && window.pearl?.probeMediaDurations) {
        try {
          const probed = await window.pearl.probeMediaDurations(paths);
          durationInfo = {
            videoDur: (probed || []).filter(x => x.kind === "video").reduce((a, x) => a + Number(x.duration || 0), 0),
            audioDur: (probed || []).filter(x => x.kind === "audio").reduce((a, x) => a + Number(x.duration || 0), 0)
          };
        } catch {
          durationInfo = null;
        }
      }
    }

    if (reqId !== dropPreviewReqId) return;
    if (!durationInfo) return;

    state.ui.dropPreview.video = {
      visible: inVideo,
      startSec,
      durationSec: Math.max(MIN_TIMELINE_CLIP_SEC, durationInfo.videoDur || 5),
      section: videoSection,
      kind: "media",
      label: "Media"
    };
    state.ui.dropPreview.audio = {
      visible: inAudio,
      startSec,
      durationSec: Math.max(MIN_TIMELINE_CLIP_SEC, durationInfo.audioDur || 5),
      kind: "audio",
      label: "Audio"
    };
    renderTimeline();
  }

  document.addEventListener("dragenter", (e) => {
    if (!e?.dataTransfer) return;
    if (!isExternalFileDrag(e)) return;
    const types = [...(e.dataTransfer.types || [])].map(x => String(x || "").toLowerCase());
    if (types.includes("files")) {
      state.dragging.item = null;
      externalDragActive = true;
      lastExternalDragTs = Date.now();
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    }
    dragDepth += 1;
    if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY) && (e.clientX !== 0 || e.clientY !== 0)) {
      lastDropPointer = { x: e.clientX, y: e.clientY };
    }
    showFallbackDropPreview(lastDropPointer.x || 0, lastDropPointer.y || 0);
  });

  document.addEventListener("dragover", (e) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (externalDragActive) lastExternalDragTs = Date.now();
    updateDropPreview(e);
  });

  document.addEventListener("dragleave", (e) => {
    // Avoid aggressive clear on nested dragleave events (common on Windows/Electron),
    // which makes external drop preview flicker/disappear.
    if (!e?.dataTransfer) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      resetExternalDragState();
    }
  });
  window.addEventListener("dragend", () => {
    state.dragging.item = null;
    window.__videosmithInternalDrag = false;
    clearPaletteDragImage();
    clearTransitionDropState();
    resetExternalDragState();
  });
  window.addEventListener("blur", () => {
    if (state.dragging.item || window.__videosmithInternalDrag) return;
    state.dragging.item = null;
    window.__videosmithInternalDrag = false;
    clearTransitionDropState();
    resetExternalDragState();
  });
  document.addEventListener("mouseleave", (e) => {
    if (!externalDragActive) return;
    if (!e.relatedTarget) resetExternalDragState();
  });

  const onExternalDrop = async (e) => {
    try {
      if (!isExternalFileDrag(e)) return;
      const dt = e.dataTransfer;
      // Always consume drop first to avoid stale highlight UI.
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      resetExternalDragState();
      if (els.renderStatus) els.renderStatus.textContent = "drop detected";
      if (!dt) {
        toast("드롭 데이터에 접근할 수 없습니다.");
        return;
      }

      const paths = await extractDropPaths(dt);
      if (paths.length) {
        await importPaths(paths);
        return;
      }
      const files = [...(dt?.files || [])];
      if (!files.length || !window.pearl?.importDroppedFiles) {
        toast("드롭된 파일 경로를 읽지 못했습니다. 상단 파일 업로드 버튼을 사용해 주세요.");
        return;
      }
      setUploadStatus(true);
      try {
        const payload = [];
        for (const f of files) {
          try {
            const ab = await f.arrayBuffer();
            payload.push({ name: f.name, data: ab });
          } catch {
            // skip bad file
          }
        }
        if (!payload.length) {
          toast("드롭 파일을 읽지 못했습니다.");
          return;
        }
        const results = await window.pearl.importDroppedFiles(payload);
        if (!results?.length) {
          const types = [...(dt.types || [])].join(", ");
          toast(`드롭 처리 결과가 비어있습니다. types=${types}, files=${files.length}`, 3200);
          return;
        }
        applyImportResults(results);
      } finally {
        setUploadStatus(false);
      }
      if (!files.length) {
        const types = [...(dt.types || [])].join(", ");
        const items = Number(dt.items?.length || 0);
        toast(`드롭 데이터가 없습니다. types=${types || "none"}, items=${items}`, 3200);
      }
    } catch (err) {
      toast(`드롭 처리 중 오류: ${String(err?.message || err)}`, 3200);
    }
  };
  document.addEventListener("drop", onExternalDrop, true);
  window.addEventListener("drop", onExternalDrop, true);
  els.dropZone?.addEventListener("drop", onExternalDrop, true);
  els.dropZone?.addEventListener("mousedown", handlePreviewBackgroundSelection);
  els.videoLane?.addEventListener("drop", onExternalDrop, true);
  els.audioLane?.addEventListener("drop", onExternalDrop, true);
  document.addEventListener("__pearl_external_drop__", (ev) => {
    const ne = ev?.detail?.event;
    if (!ne) return;
    void onExternalDrop(ne);
  });
  // Some environments dispatch only property handlers for legacy DnD routes.
  const onDropProp = (ev) => {
    if (!isExternalFileDrag(ev)) return;
    void onExternalDrop(ev);
  };
  const onDragOverProp = (ev) => {
    if (!isExternalFileDrag(ev)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    if (externalDragActive) lastExternalDragTs = Date.now();
  };
  const onDragEnterProp = (ev) => {
    if (!ev?.dataTransfer) return;
    const types = [...(ev.dataTransfer.types || [])].map(x => String(x || "").toLowerCase());
    if (!types.includes("files")) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = "copy";
    externalDragActive = true;
    lastExternalDragTs = Date.now();
    if (Number.isFinite(ev.clientX) && Number.isFinite(ev.clientY) && (ev.clientX !== 0 || ev.clientY !== 0)) {
      lastDropPointer = { x: ev.clientX, y: ev.clientY };
      showFallbackDropPreview(ev.clientX, ev.clientY);
    } else {
      showFallbackDropPreview(lastDropPointer.x || 0, lastDropPointer.y || 0);
    }
  };
  const propTargets = [
    document.documentElement,
    document.body,
    els.layout,
    els.bottom,
    els.timelineViewport,
    els.dropZone,
    els.videoTrack,
    els.audioTrack,
    els.videoLane,
    els.audioLane
  ].filter(Boolean);
  propTargets.forEach((t) => {
    t.ondrop = onDropProp;
    t.ondragenter = onDragEnterProp;
    t.ondragover = onDragOverProp;
    t.addEventListener("dragenter", onDragEnterProp, true);
    t.addEventListener("dragover", onDragOverProp, true);
    t.addEventListener("drop", onDropProp, true);
  });
  const forceExternalDragover = (e) => {
    if (!e?.dataTransfer) return;
    if (state.ui.internalDragging) return;
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    externalDragActive = true;
    lastExternalDragTs = Date.now();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    updateDropPreview(e);
  };
  els.dropZone?.addEventListener("dragover", forceExternalDragover, true);
  els.videoLane?.addEventListener("dragover", forceExternalDragover, true);
  els.audioLane?.addEventListener("dragover", forceExternalDragover, true);
  els.bottom?.addEventListener("dragover", forceExternalDragover, true);
  els.timelineViewport?.addEventListener("dragover", forceExternalDragover, true);
  els.ruler?.addEventListener("dragover", forceExternalDragover, true);
  els.videoTrack?.addEventListener("dragover", forceExternalDragover, true);
  els.audioTrack?.addEventListener("dragover", forceExternalDragover, true);
  els.videoLabelCol?.addEventListener("dragover", forceExternalDragover, true);
  els.audioLabelCol?.addEventListener("dragover", forceExternalDragover, true);
  els.videoTrack?.addEventListener("dragenter", onDragEnterProp, true);
  els.audioTrack?.addEventListener("dragenter", onDragEnterProp, true);
  els.videoLane?.addEventListener("dragenter", onDragEnterProp, true);
  els.audioLane?.addEventListener("dragenter", onDragEnterProp, true);
  els.bottom?.addEventListener("dragenter", onDragEnterProp, true);
  els.timelineViewport?.addEventListener("dragenter", onDragEnterProp, true);
  els.ruler?.addEventListener("dragenter", onDragEnterProp, true);

  setInterval(() => {
    if (!externalDragActive || !lastExternalDragTs) return;
    if (Date.now() - lastExternalDragTs > 260) resetExternalDragState();
  }, 120);

  // Transport controls
  function seekTimeline(t) {
    const nextTime = snapTimelineTimeSec(Math.max(0, Math.min(state.ui.viewDuration, t)));
    if (transport) transport.seek(nextTime);
    else state.ui.currentTime = nextTime;
    resetPreviewSessions();
    detachedAudioSession?.reset?.();
    renderPreviewAtTime(transport ? transport.getCurrentTime() : state.ui.currentTime);
    renderTimeline();
    updateTimeReadout();
  }

  function syncPreviewToTimeline() {
    renderPreviewAtTime(transport ? transport.getCurrentTime() : state.ui.currentTime);
  }

  function playPause() {
    if (state.ui.isPlaying) {
      stopPlayheadLoop();
    } else {
      state.ui.isPlaying = true;
      transport?.seek?.(state.ui.currentTime);
      syncPreviewToTimeline();
      startPlayheadLoop();
    }
  }

  function startPlayheadLoop() {
    if (!transport) return;
    state.ui.isPlaying = true;
    transport.play();
  }

  function stopPlayheadLoop() {
    state.ui.isPlaying = false;
    resetPreviewSessions();
    detachedAudioSession?.reset?.();
    transport?.pause?.();
  }

  els.btnBack10.onclick = () => seekTimeline(state.ui.currentTime - 10);
  els.btnFwd10.onclick = () => seekTimeline(state.ui.currentTime + 10);
  els.btnStop.onclick = () => { stopPlayheadLoop(); seekTimeline(0); };
  els.btnPause.onclick = () => { stopPlayheadLoop(); renderPreviewAtTime(state.ui.currentTime); };
  els.btnPlay.onclick = () => {
    if (state.ui.currentTime >= Math.max(MIN_TIMELINE_CLIP_SEC, Number(state.project.duration || getMaxTimelineEnd() || 0)) - 1e-4) {
      state.ui.currentTime = 0;
    }
    state.ui.isPlaying = true;
    transport?.seek?.(state.ui.currentTime);
    syncPreviewToTimeline();
    startPlayheadLoop();
  };

  // Playhead drag + 0.01s quantize
  function enablePlayheadDrag() {
    let dragging = false;

    function onDown(e) {
      const rect = els.ruler.getBoundingClientRect();
      const x = e.clientX - rect.left - 52;
      const t = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      seekTimeline(snapTimelineTimeSec(t));
      dragging = true;
    }
    function onMove(e) {
      if (!dragging) return;
      const rect = els.ruler.getBoundingClientRect();
      const x = e.clientX - rect.left - 52;
      const t = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      seekTimeline(snapTimelineTimeSec(t));
    }
    function onUp() { dragging = false; }

    els.ruler.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    // also allow clicking lane
    els.videoLane.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("clip") || e.target.closest(".clip")) return;
      state.ui.activeLane = "video";
      const rect = els.videoLane.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      seekTimeline(snapTimelineTimeSec(t));
      dragging = true;
    });
    els.audioLane.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("clip") || e.target.closest(".clip")) return;
      state.ui.activeLane = "audio";
      const rect = els.audioLane.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      seekTimeline(snapTimelineTimeSec(t));
      dragging = true;
    });

    els.videoLane.addEventListener("click", () => {
      state.ui.activeLane = "video";
      renderTimeline();
    });
    els.audioLane.addEventListener("click", () => {
      state.ui.activeLane = "audio";
      renderTimeline();
    });
  }

  // Region selection mode
  function enableRegionSelection() {
    let isDown = false;
    let startT = 0;

    function onDown(e) {
      if (!state.ui.region.enabled) return;
      const rect = els.ruler.getBoundingClientRect();
      const x = e.clientX - rect.left - 52;
      const raw = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      startT = snapRegionTime(raw);
      state.ui.region.start = startT;
      state.ui.region.end = startT;
      isDown = true;
      renderTimeline();
    }
    function onMove(e) {
      if (!isDown || !state.ui.region.enabled) return;
      const rect = els.ruler.getBoundingClientRect();
      const x = e.clientX - rect.left - 52;
      const raw = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      const t = snapRegionTime(raw);
      state.ui.region.end = t;
      renderTimeline();
    }
    function onUp() { isDown = false; }

    els.ruler.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function enableRegionHandleDrag() {
    let dragging = null;
    const toSec = (clientX) => {
      const rect = els.ruler.getBoundingClientRect();
      const x = clientX - rect.left - 52;
      const raw = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      return snapRegionTime(raw);
    };

    const onMove = (e) => {
      if (!dragging || !state.ui.region.enabled) return;
      const t = toSec(e.clientX);
      if (dragging === "start") {
        if (t > state.ui.region.end) {
          const oldEnd = state.ui.region.end;
          state.ui.region.start = oldEnd;
          state.ui.region.end = t;
          dragging = "end";
        } else {
          state.ui.region.start = t;
        }
      } else if (dragging === "end") {
        if (t < state.ui.region.start) {
          const oldStart = state.ui.region.start;
          state.ui.region.end = oldStart;
          state.ui.region.start = t;
          dragging = "start";
        } else {
          state.ui.region.end = t;
        }
      }
      renderTimeline();
    };
    const onUp = () => {
      dragging = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    const bind = (el, which) => {
      el?.addEventListener("mousedown", (e) => {
        if (!state.ui.region.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = which;
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    };
    bind(els.regionStartHandle, "start");
    bind(els.regionEndHandle, "end");
  }

  function setRegionButtonVisual(enabled, animate = false) {
    const nextText = enabled ? t("regionOn", "영역 지정 On") : t("regionOff", "영역 지정 Off");
    const applyState = () => {
      els.btnRegion.classList.toggle("regionOn", enabled);
      els.btnRegion.classList.toggle("regionOff", !enabled);
      els.btnRegion.textContent = nextText;
      els.regionOverlay.classList.toggle("offStyle", !enabled);
    };
    if (!animate) {
      applyState();
      return;
    }
    els.btnRegion.classList.add("swap");
    setTimeout(() => {
      applyState();
      els.btnRegion.classList.remove("swap");
    }, 150);
  }

  els.btnRegion.onclick = () => {
    state.ui.region.enabled = !state.ui.region.enabled;
    setRegionButtonVisual(state.ui.region.enabled, true);
    toast(`영역 지정 ${state.ui.region.enabled ? "On" : "Off"}`);
    renderTimeline();
  };

  // Split/Merge commands
  function splitAtPlayhead() {
    const t = snapTimelineTimeSec(state.ui.currentTime);
    const idx = state.project.videoClips.findIndex(c => t > c.start + 1e-6 && t < getVideoClipTimelineEnd(c) - 1e-6);
    if (idx < 0) return toast("Split 할 클립이 없습니다.");

    const clip = state.project.videoClips[idx];
    const clipStart = snapTimelineTimeSec(clip.start);
    const local = snapTimelineTimeSec(Math.max(0, t - clipStart));
    const totalDur = Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(clip));
    const splitSourceTime = mapVideoClipTimelineOffsetToSourceTime(clip, local);
    const left = {
      ...clip,
      id: clip.id + "_a",
      out: splitSourceTime,
      start: clipStart,
      timelineDuration: Math.max(MIN_TIMELINE_CLIP_SEC, local)
    };
    const right = {
      ...clip,
      id: clip.id + "_b",
      in: splitSourceTime,
      start: t,
      timelineDuration: Math.max(MIN_TIMELINE_CLIP_SEC, snapTimelineTimeSec(totalDur - local))
    };
    left.manualFadeInSec = clampFadeDuration(clip.manualFadeInSec, local);
    left.manualFadeOutSec = clampFadeDuration(Math.max(0, Number(clip.manualFadeOutSec || 0) - (totalDur - local)), local);
    right.manualFadeInSec = clampFadeDuration(Math.max(0, Number(clip.manualFadeInSec || 0) - local), totalDur - local);
    right.manualFadeOutSec = clampFadeDuration(clip.manualFadeOutSec, totalDur - local);

    const before = JSON.parse(JSON.stringify(state.project));
    cmdStack.do({
      do() {
        state.project.videoClips.splice(idx, 1, left, right);
        if (clip.linkedAudioId && clip.linkMode === "linked") {
          const ai = state.project.audioItems.findIndex(a => a.id === clip.linkedAudioId);
          if (ai >= 0) {
            const oldA = state.project.audioItems[ai];
            const splitDur = Math.max(MIN_TIMELINE_CLIP_SEC, snapTimelineTimeSec(t - clipStart));
            const remainDur = Math.max(MIN_TIMELINE_CLIP_SEC, snapTimelineTimeSec((oldA.start + oldA.duration) - t));
              const leftA = {
                ...oldA,
                id: oldA.id + "_a",
                start: clipStart,
                duration: splitDur,
                sourceIn: getAudioItemSourceIn(oldA, Number(clip.in || 0)),
                sourceOut: mapAudioItemTimelineOffsetToSourceTime(oldA, splitDur),
                linkedVideoId: left.id,
                manualFadeInSec: clampFadeDuration(oldA.manualFadeInSec, splitDur),
                manualFadeOutSec: clampFadeDuration(Math.max(0, Number(oldA.manualFadeOutSec || 0) - remainDur), splitDur)
              };
              const rightA = {
                ...oldA,
                id: oldA.id + "_b",
                start: t,
                duration: remainDur,
                sourceIn: mapAudioItemTimelineOffsetToSourceTime(oldA, splitDur),
                sourceOut: getAudioItemSourceOut(oldA, Number(oldA.duration || remainDur)),
                linkedVideoId: right.id,
                manualFadeInSec: clampFadeDuration(Math.max(0, Number(oldA.manualFadeInSec || 0) - splitDur), remainDur),
                manualFadeOutSec: clampFadeDuration(oldA.manualFadeOutSec, remainDur)
              };
            left.linkedAudioId = leftA.id;
            right.linkedAudioId = rightA.id;
            left.linkMode = "linked";
            right.linkMode = "linked";
            state.project.audioItems.splice(ai, 1, leftA, rightA);
          }
        }
        const newTr = {};
        Object.entries(state.project.transitions || {}).forEach(([key, value]) => {
          const parsed = parseTransitionKey(key);
          if (parsed.kind === "edge") {
            if (parsed.clipId === clip.id) {
              if (parsed.scope === "intro") {
                newTr[makeEdgeTransitionKey("intro", left.id)] = {
                  ...value,
                  scope: "intro",
                  clipId: left.id,
                  section: left.section
                };
              } else if (parsed.scope === "outro") {
                newTr[makeEdgeTransitionKey("outro", right.id)] = {
                  ...value,
                  scope: "outro",
                  clipId: right.id,
                  section: right.section
                };
              }
            } else {
              newTr[makeEdgeTransitionKey(parsed.scope, parsed.clipId)] = value;
            }
            return;
          }
          const i = Number(key);
          if (i < idx) newTr[i] = value;
          else newTr[i + 1] = value;
        });
        state.project.transitions = newTr;
        recalcTimeline();
        syncTransitions();
        renderAll();
      },
      undo() {
        state.project = before;
        renderAll();
      }
    });
    toast("Split 완료");
  }

  function mergeAtPlayhead() {
    const t = state.ui.currentTime;
    // boundary if equals end of a clip (within 0.01s)
    const eps = TIMELINE_TIME_STEP_SEC;
    const sorted = [...state.project.videoClips].sort((x, y) => x.start - y.start);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const end = getVideoClipTimelineEnd(a);
      if (Math.abs(t - end) <= eps) {
        const b = sorted[i + 1];

        // basic merge rule: same source file AND no transition at boundary
        const aSrc = a.sourcePath || a.originalPath || a.internalPath;
        const bSrc = b.sourcePath || b.originalPath || b.internalPath;
        if (aSrc !== bSrc) return toast("Merge: 소스가 달라서 병합 불가");
        if (state.project.transitions[i] && state.project.transitions[i].type !== "cut") return toast("Merge: 전환효과가 있어 병합 불가");

        const before = JSON.parse(JSON.stringify(state.project));
        cmdStack.do({
          do() {
            const merged = {
              ...a,
              id: a.id.replace(/_a$/,"") + "_m",
              in: a.in,
              out: b.out,
              start: a.start,
              timelineDuration: getVideoClipTimelineDuration(a) + getVideoClipTimelineDuration(b),
              overlays: [...(a.overlays||[]), ...(b.overlays||[])],
              manualFadeInSec: Number(a.manualFadeInSec || 0),
              manualFadeOutSec: Number(b.manualFadeOutSec || 0)
            };
            state.project.videoClips = state.project.videoClips.filter(c => c.id !== a.id && c.id !== b.id);
            state.project.videoClips.push(merged);

            const newTr = {};
            Object.entries(state.project.transitions || {}).forEach(([key, value]) => {
              const parsed = parseTransitionKey(key);
              if (parsed.kind === "edge") {
                if (parsed.clipId === a.id && parsed.scope === "intro") {
                  newTr[makeEdgeTransitionKey("intro", merged.id)] = {
                    ...value,
                    scope: "intro",
                    clipId: merged.id,
                    section: merged.section
                  };
                } else if (parsed.clipId === b.id && parsed.scope === "outro") {
                  newTr[makeEdgeTransitionKey("outro", merged.id)] = {
                    ...value,
                    scope: "outro",
                    clipId: merged.id,
                    section: merged.section
                  };
                } else if (parsed.clipId !== a.id && parsed.clipId !== b.id) {
                  newTr[makeEdgeTransitionKey(parsed.scope, parsed.clipId)] = value;
                }
                return;
              }
              const idx = Number(key);
              if (idx < i) newTr[idx] = value;
              else if (idx > i) newTr[idx - 1] = value;
            });
            state.project.transitions = newTr;

            recalcTimeline();
            syncTransitions();
            renderAll();
          },
          undo() { state.project = before; renderAll(); }
        });
        toast("Merge 완료");
        return;
      }
    }
    toast("Merge 할 경계가 없습니다.");
  }

  function mergeSelectedVideoClips() {
    const selectedVideoIds = state.ui.selectionOrder
      .filter(k => k.startsWith("video:"))
      .map(k => k.slice("video:".length));
    if (selectedVideoIds.length < 2) return false;

    const selected = state.project.videoClips
      .filter(c => selectedVideoIds.includes(c.id))
      .sort((a, b) => a.start - b.start);
    if (selected.length < 2) return false;

    const src0 = selected[0].sourcePath || selected[0].originalPath || selected[0].internalPath;
    for (let i = 0; i < selected.length; i++) {
      const src = selected[i].sourcePath || selected[i].originalPath || selected[i].internalPath;
      if (src !== src0) {
        toast("Merge: 선택된 영상의 소스가 달라서 병합할 수 없습니다.");
        return true;
      }
    }

    const EPS = TIMELINE_TIME_STEP_SEC;
    for (let i = 0; i < selected.length - 1; i++) {
      const a = selected[i];
      const b = selected[i + 1];
      const ae = getVideoClipTimelineEnd(a);
      if (Math.abs(ae - b.start) > EPS) {
        toast("Merge: 이어진 구간(연속된 조각)만 병합할 수 있습니다.");
        return true;
      }
    }

    const before = JSON.parse(JSON.stringify(state.project));
    cmdStack.do({
      do() {
        const first = selected[0];
        const last = selected[selected.length - 1];
        const merged = {
          ...first,
          id: `${first.id}_m`,
          start: first.start,
          in: first.in,
          out: last.out,
          timelineDuration: selected.reduce((sum, clip) => sum + getVideoClipTimelineDuration(clip), 0),
          manualFadeInSec: Number(first.manualFadeInSec || 0),
          manualFadeOutSec: Number(last.manualFadeOutSec || 0),
          overlays: selected.flatMap((c) => {
            const shift = c.start - first.start;
            return (c.overlays || []).map((o) => ({ ...o, at: Math.max(0, Number(o.at || 0) + shift) }));
          })
        };

        const removeSet = new Set(selected.map(c => c.id));
        state.project.videoClips = state.project.videoClips.filter(c => !removeSet.has(c.id));
        state.project.videoClips.push(merged);
        state.project.transitions = {};
        clearSelection();
        selectSingle("video", merged.id);
        recalcTimeline();
        renderAll();
      },
      undo() {
        state.project = before;
        renderAll();
      }
    });
    toast("선택 영상 병합 완료");
    return true;
  }

  function deleteRegionSelection() {
    const s = snapTimelineTimeSec(Math.min(state.ui.region.start, state.ui.region.end));
    const e = snapTimelineTimeSec(Math.max(state.ui.region.start, state.ui.region.end));
    if (e - s < TIMELINE_TIME_STEP_SEC) return false;

    const newVideo = [];
    for (const clip of state.project.videoClips) {
      const cs = clip.start;
      const ce = getVideoClipTimelineEnd(clip);
      if (e <= cs || s >= ce) {
        newVideo.push({ ...clip });
        continue;
      }
      if (s <= cs && e >= ce) continue;
      if (s <= cs && e < ce) {
        const cutDur = e - cs;
        const nextIn = mapVideoClipTimelineOffsetToSourceTime(clip, cutDur);
        newVideo.push({
          ...clip,
          in: nextIn,
          start: e,
          timelineDuration: Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(clip) - cutDur)
        });
        continue;
      }
      if (s > cs && e >= ce) {
        const keepDur = s - cs;
        const nextOut = mapVideoClipTimelineOffsetToSourceTime(clip, keepDur);
        newVideo.push({
          ...clip,
          out: nextOut,
          timelineDuration: Math.max(MIN_TIMELINE_CLIP_SEC, keepDur)
        });
        continue;
      }
      const leftDur = s - cs;
      const rightStartOffset = e - cs;
      newVideo.push({
        ...clip,
        id: `${clip.id}_l`,
        out: mapVideoClipTimelineOffsetToSourceTime(clip, leftDur),
        timelineDuration: Math.max(MIN_TIMELINE_CLIP_SEC, leftDur)
      });
      newVideo.push({
        ...clip,
        id: `${clip.id}_r`,
        in: mapVideoClipTimelineOffsetToSourceTime(clip, rightStartOffset),
        start: e,
        timelineDuration: Math.max(MIN_TIMELINE_CLIP_SEC, ce - e)
      });
    }
    state.project.videoClips = newVideo.filter(c => getVideoClipTimelineDuration(c) >= MIN_TIMELINE_CLIP_SEC);

    const newAudio = [];
    for (const a of state.project.audioItems) {
      const as = a.start;
      const ae = a.start + a.duration;
      if (e <= as) {
        newAudio.push({ ...a });
        continue;
      }
      if (s >= ae) {
        newAudio.push({ ...a });
        continue;
      }
      if (s <= as && e >= ae) continue;
      if (s <= as && e < ae) {
        const cut = e - as;
        newAudio.push({ ...a, start: s, duration: Math.max(MIN_TIMELINE_CLIP_SEC, a.duration - cut) });
        continue;
      }
      if (s > as && e >= ae) {
        newAudio.push({ ...a, duration: Math.max(MIN_TIMELINE_CLIP_SEC, s - as) });
        continue;
      }
      const left = { ...a, id: `${a.id}_l`, duration: Math.max(MIN_TIMELINE_CLIP_SEC, s - as) };
      const right = { ...a, id: `${a.id}_r`, start: s, duration: Math.max(MIN_TIMELINE_CLIP_SEC, ae - e) };
      newAudio.push(left, right);
    }
    state.project.audioItems = newAudio;

    const newOverlays = [];
    for (const overlay of state.project.overlayItems) {
      const os = Number(overlay.start || 0);
      const oe = os + Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC));
      if (e <= os || s >= oe) {
        newOverlays.push({ ...overlay });
        continue;
      }
      if (s <= os && e >= oe) continue;
      if (s <= os && e < oe) {
        newOverlays.push({ ...overlay, start: e, duration: Math.max(MIN_OVERLAY_CLIP_SEC, oe - e) });
        continue;
      }
      if (s > os && e >= oe) {
        newOverlays.push({ ...overlay, duration: Math.max(MIN_OVERLAY_CLIP_SEC, s - os) });
        continue;
      }
      const left = { ...overlay, id: `${overlay.id}_l`, duration: Math.max(MIN_OVERLAY_CLIP_SEC, s - os) };
      const right = { ...overlay, id: `${overlay.id}_r`, start: e, duration: Math.max(MIN_OVERLAY_CLIP_SEC, oe - e) };
      newOverlays.push(left, right);
    }
    state.project.overlayItems = newOverlays;
    clearSelection();
    recalcTimeline();
    renderAll();
    return true;
  }

  function deleteSelectedItems() {
    if (!state.ui.selectedKeys.length) return false;
    const selected = new Set(state.ui.selectedKeys);
    for (const key of [...selected]) {
      const [kind, id] = key.split(":");
      if (kind === "video") {
        const v = state.project.videoClips.find(c => c.id === id);
        if (v?.linkedAudioId && v.linkMode === "linked") selected.add(clipKey("audio", v.linkedAudioId));
      } else if (kind === "audio") {
        const a = state.project.audioItems.find(x => x.id === id);
        if (a?.linkedVideoId && a.linkMode === "linked") selected.add(clipKey("video", a.linkedVideoId));
      }
    }
    state.project.videoClips = state.project.videoClips.filter(c => !selected.has(clipKey("video", c.id)));
    state.project.audioItems = state.project.audioItems.filter(a => !selected.has(clipKey("audio", a.id)));
    state.project.overlayItems = state.project.overlayItems.filter(o => !selected.has(clipKey("overlay", o.id)));
    const remainingAudioIds = new Set(state.project.audioItems.map((audio) => audio.id));
    const remainingVideoIds = new Set(state.project.videoClips.map((clip) => clip.id));
    state.project.videoClips.forEach((clip) => {
      if (clip.linkedAudioId && !remainingAudioIds.has(clip.linkedAudioId)) {
        clip.linkedAudioId = null;
        clip.linkMode = "detached";
      }
    });
    state.project.audioItems.forEach((audio) => {
      if (audio.linkedVideoId && !remainingVideoIds.has(audio.linkedVideoId)) {
        audio.linkedVideoId = null;
        audio.linkMode = "detached";
      }
    });
    clearSelection();
    recalcTimeline();
    renderAll();
    return true;
  }

  function divideSelectedVideoAudio() {
    const key = state.ui.selectionOrder[state.ui.selectionOrder.length - 1];
    if (!key || !key.startsWith("video:")) return false;
    const id = key.slice("video:".length);
    const clip = state.project.videoClips.find(c => c.id === id);
    if (!clip) return false;
    if (clip.linkedAudioId && state.project.audioItems.some(a => a.id === clip.linkedAudioId)) {
      const linked = state.project.audioItems.find(a => a.id === clip.linkedAudioId);
      if (linked && clip.linkMode === "linked") {
        clip.linkMode = "detached";
        linked.linkMode = "detached";
        clip.audioEnabled = false;
        syncAudioItemTiming(linked);
        toast("영상/음성 분리 완료");
        renderAll();
        return true;
      }
      toast("이미 분리된 오디오 트랙이 있습니다.");
      return true;
    }
    const audioId = `${clip.id}_aud`;
    const audio = createLinkedAudioItemFromVideoClip(clip, {
      id: audioId,
      linkMode: "detached",
      linkedVideoId: clip.id,
      gain: 1,
      sourceIn: Number(clip.in || 0),
      sourceOut: Number(clip.out || 0)
    });
    clip.linkedAudioId = audioId;
    clip.linkMode = "detached";
    clip.audioEnabled = false;
    state.project.audioItems.push(audio);
    renderAll();
    toast("영상/음성 분리 완료");
    return true;
  }

  function mergeSelectedPairByFirstStart() {
    if (state.ui.selectionOrder.length < 2) return false;
    const [k1, k2] = state.ui.selectionOrder.slice(0, 2);
    const [kind1, id1] = k1.split(":");
    const [kind2, id2] = k2.split(":");
    if (kind1 === kind2) return false;
    const videoId = kind1 === "video" ? id1 : id2;
    const audioId = kind1 === "audio" ? id1 : id2;
    const video = state.project.videoClips.find(c => c.id === videoId);
    const audio = state.project.audioItems.find(a => a.id === audioId);
    if (!video || !audio) return false;

    const firstStart = kind1 === "video" ? video.start : audio.start;
    audio.start = Math.max(0, firstStart);
    audio.section = Math.max(1, Number(video.section || 1));
    audio.linkedVideoId = video.id;
    audio.linkMode = "linked";
    audio.sourceIn = Math.max(0, Number(video.in || 0));
    audio.sourceOut = Math.max(audio.sourceIn + MIN_TIMELINE_CLIP_SEC, Number(video.out || audio.sourceIn + MIN_TIMELINE_CLIP_SEC));
    audio.duration = Math.max(MIN_TIMELINE_CLIP_SEC, getVideoClipTimelineDuration(video));
    video.linkedAudioId = audio.id;
    video.linkMode = "linked";
    video.audioEnabled = true;
    syncAudioItemTiming(audio, { linkedClip: video });
    renderAll();
    toast("선택 영역 병합 완료");
    return true;
  }

  function copySelectedItems() {
    const normalizedKeys = new Set(state.ui.selectionOrder);
    for (const key of [...normalizedKeys]) {
      const entry = getItemByKey(key);
      if (entry?.kind === "video" && entry.data?.linkedAudioId && entry.data.linkMode === "linked") {
        normalizedKeys.add(clipKey("audio", entry.data.linkedAudioId));
      }
      if (entry?.kind === "audio" && entry.data?.linkedVideoId && entry.data.linkMode === "linked") {
        normalizedKeys.add(clipKey("video", entry.data.linkedVideoId));
      }
    }
    const selectedEntries = [...normalizedKeys]
      .map((key) => ({ key, entry: getItemByKey(key) }))
      .filter((item) => item.entry?.data);
    if (!selectedEntries.length) return false;

    const selectedKeys = new Set(selectedEntries.map((item) => item.key));
    const cloned = selectedEntries.map(({ entry }) => {
      const copy = JSON.parse(JSON.stringify(entry.data));
      if (entry.kind === "video" && copy.linkedAudioId && !selectedKeys.has(clipKey("audio", copy.linkedAudioId))) {
        copy.linkedAudioId = null;
        copy.linkMode = "detached";
      }
      if (entry.kind === "audio" && copy.linkedVideoId && !selectedKeys.has(clipKey("video", copy.linkedVideoId))) {
        copy.linkedVideoId = null;
        copy.linkMode = "detached";
      }
      return { kind: entry.kind, data: copy };
    });

    const starts = cloned.map((item) => Number(item.data.start || 0));
    const ends = cloned.map((item) => Number(item.data.start || 0) + getTimelineItemDuration(item.kind, item.data));
    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);
    state.ui.itemClipboard = {
      type: "items",
      centerTime: minStart + ((maxEnd - minStart) / 2),
      items: cloned
    };
    return true;
  }

  function pasteClipboard(target = {}) {
    const clipData = state.ui.itemClipboard;
    if (!clipData?.items?.length) return false;
    const targetKind = target.kind === "audio" ? "audio" : "video";
    const targetSection = Math.max(1, Number(target.section || state.ui.activeSection[targetKind] || 1));
    const targetTime = Math.max(0, Number(target.time ?? state.ui.currentTime ?? 0));
    const idMap = new Map();
    const pasted = [];

    clipData.items.forEach((item) => {
      const oldKey = clipKey(item.kind, item.data.id);
      const nextId = makeItemId(item.kind);
      idMap.set(oldKey, nextId);
    });

    clipData.items.forEach((item) => {
      const copy = JSON.parse(JSON.stringify(item.data));
      copy.id = idMap.get(clipKey(item.kind, item.data.id)) || makeItemId(item.kind);
      copy.start = Math.max(0, Number(copy.start || 0) + (targetTime - Number(clipData.centerTime || 0)));
      if (item.kind === "video" || item.kind === "overlay") copy.section = targetSection;
      if (item.kind === "audio" && target.kind === "audio") copy.section = targetSection;
      if (item.kind === "video") {
        copy.linkedAudioId = copy.linkedAudioId ? (idMap.get(clipKey("audio", item.data.linkedAudioId)) || null) : null;
        if (!copy.linkedAudioId) copy.linkMode = "detached";
      }
      if (item.kind === "audio") {
        copy.linkedVideoId = copy.linkedVideoId ? (idMap.get(clipKey("video", item.data.linkedVideoId)) || null) : null;
        if (!copy.linkedVideoId) copy.linkMode = "detached";
      }
      pasted.push({ kind: item.kind, data: copy });
    });

    pasted.forEach((item) => {
      if (item.kind === "video") state.project.videoClips.push(item.data);
      else if (item.kind === "audio") state.project.audioItems.push(item.data);
      else if (item.kind === "overlay") state.project.overlayItems.push(item.data);
    });

    clearSelection();
    recalcTimeline();
    pasted.forEach((item, index) => {
      if (index === 0) selectSingle(item.kind, item.data.id, item.data.section);
      else toggleSelection(item.kind, item.data.id, item.data.section);
    });
    renderAll();
    return true;
  }

  function cutSelectedItems() {
    if (!copySelectedItems()) return false;
    return deleteSelectedItems();
  }

  function shiftSections(kind, fromSection, delta) {
    if (kind === "video") {
      state.project.videoClips.forEach((c) => {
        const s = Math.max(1, Number(c.section || 1));
        if (s >= fromSection) c.section = Math.max(1, s + delta);
      });
      state.project.overlayItems.forEach((o) => {
        const s = Math.max(1, Number(o.section || 1));
        if (s >= fromSection) o.section = Math.max(1, s + delta);
      });
      state.project.videoSections = Math.max(1, Number(state.project.videoSections || 1) + delta);
    } else {
      state.project.audioItems.forEach((a) => {
        const s = Math.max(1, Number(a.section || 1));
        if (s >= fromSection) a.section = Math.max(1, s + delta);
      });
      state.project.audioSections = Math.max(1, Number(state.project.audioSections || 1) + delta);
    }
  }

  function cloneSection(kind, sourceSection, targetSection) {
    const uid = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    if (kind === "video") {
      const src = state.project.videoClips.filter(c => Number(c.section || 1) === sourceSection);
      src.forEach((c) => {
        state.project.videoClips.push({
          ...JSON.parse(JSON.stringify(c)),
          id: `${c.id}_sec_${uid()}`,
          section: targetSection
        });
      });
      const overlays = state.project.overlayItems.filter(o => Number(o.section || 1) === sourceSection);
      overlays.forEach((o) => {
        state.project.overlayItems.push({
          ...JSON.parse(JSON.stringify(o)),
          id: `${o.id}_sec_${uid()}`,
          section: targetSection
        });
      });
    } else {
      const src = state.project.audioItems.filter(a => Number(a.section || 1) === sourceSection);
      src.forEach((a) => {
        state.project.audioItems.push({
          ...JSON.parse(JSON.stringify(a)),
          id: `${a.id}_sec_${uid()}`,
          section: targetSection
        });
      });
    }
  }

  function insertSectionAfter(kind, targetSection, copyFrom = null) {
    const insertAt = Math.max(1, Number(targetSection || 1)) + 1;
    shiftSections(kind, insertAt, +1);
    if (Number.isFinite(copyFrom) && copyFrom >= 1) cloneSection(kind, Number(copyFrom), insertAt);
    recalcTimeline();
    renderAll();
    return true;
  }

  function addTimelineSection(kind) {
    const laneKind = kind === "audio" ? "audio" : "video";
    const sectionCount = laneKind === "audio"
      ? Math.max(1, Number(state.project.audioSections || 1))
      : Math.max(1, Number(state.project.videoSections || 1));
    const ok = runProjectMutationWithHistory(() => insertSectionAfter(laneKind, sectionCount, null));
    if (ok !== false) {
      state.ui.activeLane = laneKind;
      state.ui.activeSection[laneKind] = sectionCount + 1;
      renderAll();
    }
  }

  function deleteSection(kind, section) {
    const sec = Math.max(1, Number(section || 1));
    const max = kind === "video" ? Number(state.project.videoSections || 1) : Number(state.project.audioSections || 1);
    if (max <= 1) {
      toast("최소 1개 섹션은 유지되어야 합니다.");
      return false;
    }
    if (kind === "video") {
      state.project.videoClips = state.project.videoClips.filter(c => Number(c.section || 1) !== sec);
      state.project.overlayItems = state.project.overlayItems.filter(o => Number(o.section || 1) !== sec);
      state.project.videoClips.forEach((c) => {
        const s = Number(c.section || 1);
        if (s > sec) c.section = s - 1;
      });
      state.project.overlayItems.forEach((o) => {
        const s = Number(o.section || 1);
        if (s > sec) o.section = s - 1;
      });
      state.project.videoSections = max - 1;
    } else {
      state.project.audioItems = state.project.audioItems.filter(a => Number(a.section || 1) !== sec);
      state.project.audioItems.forEach((a) => {
        const s = Number(a.section || 1);
        if (s > sec) a.section = s - 1;
      });
      state.project.audioSections = max - 1;
    }
    clearSelection();
    recalcTimeline();
    renderAll();
    return true;
  }

  function setupSectionContextMenu() {
    const menu = els.timelineContextMenu;
    if (!menu) return;

    const hide = () => {
      menu.classList.add("hidden");
      state.ui.sectionMenuTarget = null;
    };

    const show = (x, y, target) => {
      state.ui.sectionMenuTarget = target;
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      if (target?.mode === "section") {
        setContextMenuButtonContent(els.ctxCopySection, { iconType: "copy", label: "섹션 복사" });
        setContextMenuButtonContent(els.ctxPasteSection, { iconType: "paste", label: "섹션 붙여넣기" });
        setContextMenuButtonContent(els.ctxDeleteSection, { iconType: "delete", label: "섹션 삭제" });
      } else {
        setContextMenuButtonContent(els.ctxCopySection, { iconType: "copy", label: "복사" });
        setContextMenuButtonContent(els.ctxPasteSection, { iconType: "paste", label: "붙여넣기" });
        setContextMenuButtonContent(
          els.ctxDeleteSection,
          target?.itemKind === "video"
            ? { iconType: "cut", label: "영역 자르기" }
            : { iconType: "cut", label: "잘라내기" }
        );
      }
      menu.classList.remove("hidden");
    };

    const onLabelContext = (e) => {
      const label = e.target.closest(".sectionLabel");
      if (!label) return;
      e.preventDefault();
      const kind = label.dataset.kind;
      const section = Number(label.dataset.section || 1);
      show(e.clientX, e.clientY, { mode: "section", kind, section });
    };

    const getRowContext = (e) => {
      const row = e.target.closest(".trackRowLane");
      if (!row) return null;
      const kind = row.dataset.kind;
      const section = Number(row.dataset.section || 1);
      const lane = kind === "audio" ? els.audioLane : els.videoLane;
      const rect = lane.getBoundingClientRect();
      const x = e.clientX - rect.left + Number(els.timelineViewport?.scrollLeft || lane.scrollLeft || 0);
      const time = window.PearlTimeline.pxToSeconds(Math.max(0, x), state.ui.pxPerSec);
      return { kind, section, time };
    };

    const onClipContext = (e) => {
      const clipEl = e.target.closest(".clip");
      if (!clipEl) return;
      e.preventDefault();
      const actualKind = clipEl.dataset.kind || "video";
      const id = actualKind === "video" ? clipEl.dataset.clipId : (actualKind === "audio" ? clipEl.dataset.audioId : clipEl.dataset.overlayId);
      const section = Number(clipEl.dataset.section || 1);
      if (!id) return;
      selectSingle(actualKind, id, section);
      const rowCtx = getRowContext(e);
      show(e.clientX, e.clientY, {
        mode: "items",
        kind: rowCtx?.kind || (actualKind === "audio" ? "audio" : "video"),
        itemKind: actualKind,
        section,
        time: rowCtx?.time ?? state.ui.currentTime
      });
      renderAll();
    };

    const onRowContext = (e) => {
      if (e.target.closest(".clip, .sectionLabel")) return;
      const ctx = getRowContext(e);
      if (!ctx) return;
      e.preventDefault();
      show(e.clientX, e.clientY, { mode: "items", kind: ctx.kind, section: ctx.section, time: ctx.time });
    };

    els.videoLabelCol?.addEventListener("contextmenu", onLabelContext);
    els.audioLabelCol?.addEventListener("contextmenu", onLabelContext);
    els.videoLane?.addEventListener("contextmenu", onClipContext);
    els.audioLane?.addEventListener("contextmenu", onClipContext);
    els.videoLane?.addEventListener("contextmenu", onRowContext);
    els.audioLane?.addEventListener("contextmenu", onRowContext);

    els.ctxCopySection?.addEventListener("click", async () => {
      const t = state.ui.sectionMenuTarget;
      if (!t) return;
      if (t.mode === "section") {
        state.ui.sectionClipboard = { kind: t.kind, section: t.section };
        const text = `${t.kind === "video" ? "영상" : "음성"} ${t.section}`;
        try { await navigator.clipboard.writeText(text); } catch {}
        hide();
        toast("섹션 복사됨");
        return;
      }
      if (copySelectedItems()) toast("클립 복사됨");
      hide();
    });

    els.ctxPasteSection?.addEventListener("click", () => {
      const t = state.ui.sectionMenuTarget;
      if (!t) return;
      const changed = t.mode === "section"
        ? runProjectMutationWithHistory(() => insertSectionAfter(t.kind, t.section, null))
        : runProjectMutationWithHistory(() => pasteClipboard({ kind: t.kind, section: t.section, time: t.time }));
      hide();
      if (changed !== false) toast("붙여넣기 완료");
    });

    els.ctxDeleteSection?.addEventListener("click", () => {
      const t = state.ui.sectionMenuTarget;
      if (!t) return;
      if (t.mode === "section") runProjectMutationWithHistory(() => deleteSection(t.kind, t.section));
      else if (t.itemKind === "video") beginVideoCropMode();
      else runProjectMutationWithHistory(() => cutSelectedItems());
      hide();
    });

    document.addEventListener("click", hide);
    document.addEventListener("contextmenu", (e) => {
      if (!e.target.closest(".sectionLabel, .clip, .trackRowLane")) hide();
    });
    window.addEventListener("blur", hide);
  }

  function addTextOverlay(section, atTimelineTime) {
    const overlayItem = normalizeOverlayItem({
      ...(effectDefs?.makeOverlayDefaults?.("text") || {}),
      section: Math.max(1, Number(section || 1)),
      start: nearestSnapTime(Math.max(0, Number(atTimelineTime || 0)))
    });
    state.project.overlayItems.push(overlayItem);
    selectSingle("overlay", overlayItem.id, overlayItem.section);
    recalcTimeline();
    renderAll();
    focusOverlayInspector();
    toast("텍스트 overlay clip 생성 완료");
    return overlayItem;
  }

  function addFxOverlay(type, section, atTimelineTime, overrides = {}) {
    const overlayItem = normalizeOverlayItem({
      ...(effectDefs?.makeOverlayDefaults?.(type) || { overlayType: type }),
      section: Math.max(1, Number(section || 1)),
      start: nearestSnapTime(Math.max(0, Number(atTimelineTime || 0))),
      ...overrides
    });
    state.project.overlayItems.push(overlayItem);
    selectSingle("overlay", overlayItem.id, overlayItem.section);
    recalcTimeline();
    renderAll();
    const gear = els.videoLane.querySelector(`.overlayGearBtn[data-overlay-id="${overlayItem.id}"]`);
    if (gear) showFxPopover(overlayItem.id, gear);
    toast(`${getOverlayDisplayName(overlayItem)} FX clip 생성 완료`);
    return overlayItem;
  }

  // Transition drop snapping
  function setupTransitionDrop() {
    const internalVideoDropTargets = [els.videoLane, els.videoTrack, els.timelineViewport].filter(Boolean);

    const handleInternalVideoDragEnter = (e) => {
      if (isExternalFileDrag(e)) return;
      if (!state.dragging.item) return;
      e.preventDefault();
      e.stopPropagation();
      if (state.dragging.item.kind !== "transition") {
        e.dataTransfer.dropEffect = "copy";
        return;
      }
      const resolved = resolveTransitionDropTarget(e.clientX, e.clientY);
      const dropEffect = resolved.target ? "copy" : "none";
      e.dataTransfer.dropEffect = dropEffect;
      setTransitionDropState(resolved.target, dropEffect);
    };

    const handleInternalVideoDragOver = (e) => {
      if (isExternalFileDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        updateDropPreview(e);
        return;
      }
      if (!state.dragging.item) return;
      e.preventDefault();
      e.stopPropagation();
      if (state.dragging.item.kind !== "transition") {
        if (state.dragging.item.kind === "background") {
          updateInternalBackgroundDropPreview(e.clientX, e.clientY, state.dragging.item.durationSec);
        } else {
          clearDropPreview();
        }
        clearTransitionDropState();
        e.dataTransfer.dropEffect = "copy";
        return;
      }
      state.dragging.transitionLastOverTs = Date.now();
      if (state.dragging.transitionLeaveTimer) {
        clearTimeout(state.dragging.transitionLeaveTimer);
        state.dragging.transitionLeaveTimer = 0;
      }
      const resolved = resolveTransitionDropTarget(e.clientX, e.clientY);
      const dropEffect = resolved.target ? "copy" : "none";
      e.dataTransfer.dropEffect = dropEffect;
      setTransitionDropState(resolved.target, dropEffect);
    };

    const handleInternalVideoDragLeave = () => {
      if (state.dragging.item?.kind === "background") {
        return;
      }
      if (state.dragging.item?.kind !== "transition") return;
      if (state.dragging.transitionLeaveTimer) clearTimeout(state.dragging.transitionLeaveTimer);
      state.dragging.transitionLeaveTimer = window.setTimeout(() => {
        state.dragging.transitionLeaveTimer = 0;
        if (Date.now() - state.dragging.transitionLastOverTs < 40) return;
        clearTransitionDropState();
      }, 48);
    };

    const handleInternalVideoDrop = async (e) => {
      if (isExternalFileDrag(e)) return;
      if (!state.dragging.item) return;
      e.preventDefault();
      e.stopPropagation();
      const data = safeParse(e.dataTransfer.getData("text/plain")) || state.dragging.item;
      const resolved = resolveTransitionDropTarget(e.clientX, e.clientY);
      state.dragging.item = null;
      clearPaletteDragImage();
      const dropTime = window.PearlTimeline.pxToSeconds(Math.max(0, resolved.x), state.ui.pxPerSec);
      const section = resolved.section;

      if (data?.kind === "edit_tool" && data.type === "chroma_key") {
        const targetClip = resolveVideoClipDropTarget(e.clientX, e.clientY);
        if (!targetClip) {
          window.__videosmithInternalDrag = false;
          clearTransitionDropState();
          toast("크로마키는 영상 클립에만 드롭할 수 있습니다.", 1800);
          return;
        }
        window.__videosmithInternalDrag = false;
        clearTransitionDropState();
        await applyChromaKeyToolToClip(targetClip, { section, reveal: true });
        return;
      }

      if (data?.kind === "text") {
        runProjectMutationWithHistory(() => !!addTextOverlay(section, dropTime));
        window.__videosmithInternalDrag = false;
        clearTransitionDropState();
        return;
      }

      if (data?.kind === "fx") {
        if (data.type === "motion_path_move") {
          const targetClip = resolveVideoClipDropTarget(e.clientX, e.clientY);
          if (!targetClip) {
            window.__videosmithInternalDrag = false;
            clearTransitionDropState();
            toast("이동 경로 FX는 영상 클립 위에 드롭해야 합니다.", 1800);
            return;
          }
          let createdOverlay = null;
          runProjectMutationWithHistory(() => {
            createdOverlay = addFxOverlay(data.type, targetClip.section || section || 1, dropTime, {
              targetClipId: targetClip.id,
              color: "#38bdf8",
              strokeWidth: 4,
              deltaX: 0,
              deltaY: 0,
              duration: 1.2
            });
            return !!createdOverlay;
          });
          if (createdOverlay) {
            state.ui.currentTime = snapTimelineTimeSec(Number(createdOverlay.start || dropTime || state.ui.currentTime || 0));
            state.ui.motionPathDrawOverlayId = createdOverlay.id;
            renderAll();
          }
        } else {
          runProjectMutationWithHistory(() => !!addFxOverlay(data.type, section, dropTime));
        }
        window.__videosmithInternalDrag = false;
        clearTransitionDropState();
        return;
      }

      if (data?.kind === "background") {
        setUploadStatus(true);
        try {
          const asset = await createBackgroundColorClipAsset(data.color, data.durationSec);
          if (!asset?.ok) {
            toast(`${t("backgroundClipCreateFailed", "배경 클립 생성 실패")}: ${asset?.error || "unknown error"}`, 2200);
            return;
          }
          runProjectMutationWithHistory(() => !!insertGeneratedBackgroundClip(asset, section, dropTime));
        } finally {
          setUploadStatus(false);
          window.__videosmithInternalDrag = false;
          clearTransitionDropState();
        }
        return;
      }

      if (data?.kind === "transition") {
        const target = resolved.target;
        if (!target) {
          window.__videosmithInternalDrag = false;
          toast(t("transitionDropInvalid", "Transitions can be dropped only on clip boundaries or clip start/end edges."));
          clearTransitionDropState();
          return;
        }
        runProjectMutationWithHistory(() => {
          if (target.kind === "edge" && data.type === "cut") {
            writeTransitionForTarget(target, null);
          } else {
            writeTransitionForTarget(target, makeTransitionPreset(data.type, target.kind === "boundary" ? "boundary" : target.scope));
          }
          syncTransitions();
          renderAll();
          return true;
        });
        toast(t("transitionApplied", "Transition applied"));
        window.__videosmithInternalDrag = false;
        clearTransitionDropState();
      }
      renderTimeline();
    };

    internalVideoDropTargets.forEach((target) => {
      target.addEventListener("dragenter", handleInternalVideoDragEnter);
      target.addEventListener("dragover", handleInternalVideoDragOver);
      target.addEventListener("dragleave", handleInternalVideoDragLeave);
      target.addEventListener("drop", handleInternalVideoDrop);
    });
  }

  function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function setTransitionDropState(target, dropEffect) {
    const nextTarget = target || null;
    const nextIdx = nextTarget?.kind === "boundary" ? Number(nextTarget.boundaryIdx) : null;
    const nextEffect = dropEffect || "none";
    const changed = state.dragging.boundaryHover !== nextIdx
      || JSON.stringify(state.dragging.transitionHoverTarget || null) !== JSON.stringify(nextTarget)
      || state.dragging.transitionDropEffect !== nextEffect;
    state.dragging.boundaryHover = nextIdx;
    state.dragging.transitionHoverTarget = nextTarget;
    state.dragging.transitionDropEffect = nextEffect;
    document.body.classList.toggle("transition-drop-valid", nextEffect === "copy");
    document.body.classList.toggle("transition-drop-invalid", nextEffect === "none" && state.dragging.item?.kind === "transition");
    if (changed) renderTimeline();
  }

  function clearTransitionDropState() {
    if (state.dragging.transitionLeaveTimer) {
      clearTimeout(state.dragging.transitionLeaveTimer);
      state.dragging.transitionLeaveTimer = 0;
    }
    setTransitionDropState(null, "none");
  }

  function getVideoSectionAtClientY(clientY) {
    const rows = [...els.videoLane.querySelectorAll('.trackRowLane[data-kind="video"]')];
    if (!rows.length) return 1;
    const hit = rows.find((row) => {
      const r = row.getBoundingClientRect();
      return clientY >= r.top && clientY <= r.bottom;
    });
    if (hit) return Math.max(1, Number(hit.dataset.section || 1));
    const first = rows[0].getBoundingClientRect();
    const last = rows[rows.length - 1].getBoundingClientRect();
    if (clientY < first.top) return 1;
    if (clientY > last.bottom) return rows.length;
    return Math.max(1, Number(rows[0].dataset.section || 1));
  }

  function updateInternalBackgroundDropPreview(clientX, clientY, durationSec = BACKGROUND_CLIP_DURATION_SEC) {
    const rect = els.videoLane.getBoundingClientRect();
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!inside) {
      clearDropPreview();
      return false;
    }
    const startSec = window.PearlTimeline.pxToSeconds(
      Math.max(0, clientX - rect.left + Number(els.timelineViewport?.scrollLeft || 0)),
      state.ui.pxPerSec
    );
    const previewDurationSec = Math.max(MIN_TIMELINE_CLIP_SEC, Number(durationSec || BACKGROUND_CLIP_DURATION_SEC));
    const previewColor = normalizeBackgroundColor(state.dragging.item?.color || state.settings.backgroundClipColor || "#ffffff");
    state.ui.dropPreview.video = {
      visible: true,
      startSec,
      durationSec: previewDurationSec,
      section: getVideoSectionAtClientY(clientY),
      kind: "background",
      color: previewColor,
      label: `${t("backgroundClipCardName", "배경 클립")} · ${formatTimelineSec(previewDurationSec)}s`
    };
    state.ui.dropPreview.audio = { visible: false, startSec: 0, durationSec: 0 };
    renderTimeline();
    return true;
  }

  function resolveTransitionEdgeFromGeometry(row, clientX, section, canApply) {
    if (!row) return null;
    let best = null;
    row.querySelectorAll('.videoClip[data-kind="video"]').forEach((clipEl) => {
      const clipId = clipEl.dataset.clipId;
      const clipSection = Math.max(1, Number(clipEl.dataset.section || section || 1));
      if (!clipId || clipSection !== section) return;
      const clipRect = clipEl.getBoundingClientRect();
      const edgeThreshold = Math.min(42, Math.max(18, clipRect.width * 0.26));
      const introDistance = Math.abs(clientX - clipRect.left);
      const outroDistance = Math.abs(clientX - clipRect.right);
      if (canApply("intro") && introDistance <= edgeThreshold && (!best || introDistance < best.distance)) {
        best = {
          distance: introDistance,
          target: {
            kind: "edge",
            scope: "intro",
            clipId,
            section,
            transitionKey: makeEdgeTransitionKey("intro", clipId)
          }
        };
      }
      if (canApply("outro") && outroDistance <= edgeThreshold && (!best || outroDistance < best.distance)) {
        best = {
          distance: outroDistance,
          target: {
            kind: "edge",
            scope: "outro",
            clipId,
            section,
            transitionKey: makeEdgeTransitionKey("outro", clipId)
          }
        };
      }
    });
    return best?.target || null;
  }

  function resolveTransitionDropTarget(clientX, clientY) {
    const rect = els.videoLane.getBoundingClientRect();
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!inside) return { target: null, x: 0, section: 1 };
    const x = Math.max(0, clientX - rect.left + Number(els.timelineViewport?.scrollLeft || 0));
    const section = getVideoSectionAtClientY(clientY);
    const draggingType = String(state.dragging.item?.type || "");
    const canApply = (scope) => {
      if (scope !== "boundary" && draggingType === "cut") return true;
      return renderGraph?.transitionSupportsScope
        ? renderGraph.transitionSupportsScope(draggingType, scope)
        : (scope === "boundary" || draggingType !== "cross");
    };

    const row = [...els.videoLane.querySelectorAll('.trackRowLane[data-kind="video"]')]
      .find((item) => Number(item.dataset.section || 1) === section);
    const rowRect = row?.getBoundingClientRect?.() || rect;
    const boundary = window.PearlTimeline.snapBoundary(state.ui.boundaries, x, { section });
    const isBoundaryBand = clientY <= (rowRect.top + 38);
    if (boundary && isBoundaryBand && canApply("boundary")) {
      return {
        target: {
          kind: "boundary",
          boundaryIdx: boundary.idx,
          section: boundary.section,
          fromClipId: boundary.fromClipId,
          toClipId: boundary.toClipId,
          transitionKey: String(boundary.idx)
        },
        x,
        section
      };
    }

    const hitStack = typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
    const edgeChip = hitStack.find((node) => node instanceof Element && node.closest(".clipEdgeTransition"))?.closest?.(".clipEdgeTransition") || null;
    if (edgeChip) {
      const clipId = edgeChip.dataset.clipId;
      const scope = edgeChip.dataset.transitionScope;
      if (clipId && (scope === "intro" || scope === "outro") && canApply(scope)) {
        return {
          target: {
            kind: "edge",
            scope,
            clipId,
            section,
            transitionKey: makeEdgeTransitionKey(scope, clipId)
          },
          x,
          section
        };
      }
    }
    const clipEl = hitStack.find((node) => node instanceof Element && node.closest(".videoClip"))?.closest?.(".videoClip") || null;
    if (clipEl) {
      const clipId = clipEl.dataset.clipId;
      const clipSection = Math.max(1, Number(clipEl.dataset.section || section || 1));
      const clipRect = clipEl.getBoundingClientRect();
      const localX = clientX - clipRect.left;
      const edgeThreshold = Math.min(42, Math.max(18, clipRect.width * 0.26));
      if (clipId && clipSection === section && localX <= edgeThreshold && canApply("intro")) {
        return {
          target: {
            kind: "edge",
            scope: "intro",
            clipId,
            section,
            transitionKey: makeEdgeTransitionKey("intro", clipId)
          },
          x,
          section
        };
      }
      if (clipId && clipSection === section && localX >= clipRect.width - edgeThreshold && canApply("outro")) {
        return {
          target: {
            kind: "edge",
            scope: "outro",
            clipId,
            section,
            transitionKey: makeEdgeTransitionKey("outro", clipId)
          },
          x,
          section
        };
      }
    }

    const geometricEdgeTarget = resolveTransitionEdgeFromGeometry(row, clientX, section, canApply);
    if (geometricEdgeTarget) {
      return {
        target: geometricEdgeTarget,
        x,
        section
      };
    }

    if (boundary && canApply("boundary")) {
      return {
        target: {
          kind: "boundary",
          boundaryIdx: boundary.idx,
          section: boundary.section,
          fromClipId: boundary.fromClipId,
          toClipId: boundary.toClipId,
          transitionKey: String(boundary.idx)
        },
        x,
        section
      };
    }
    return { target: null, x, section };
  }

  function createSerializableProject(project) {
    const clone = JSON.parse(JSON.stringify(project || {}));
    const normalizedProject = renderGraph?.normalizeProjectTransitions
      ? renderGraph.normalizeProjectTransitions(clone)
      : null;
    if (normalizedProject) {
      clone.transitions = normalizedProject.transitions || [];
      if (normalizedProject.orphanedTransitions?.length) {
        clone.orphanedTransitions = normalizedProject.orphanedTransitions;
      }
    }
    (clone.videoClips || []).forEach((clip) => {
      delete clip.thumbs;
      delete clip._thumbRequestCount;
      delete clip._thumbReadyCount;
      delete clip.transitionOut;
      delete clip.transitionIn;
      delete clip.transition;
      delete clip.endEffect;
    });
    (clone.audioItems || []).forEach((audio) => {
      delete audio._analyzeQueued;
    });
    return clone;
  }

  function createPersistenceDocument() {
    return {
      settings: { ...state.settings },
      project: createSerializableProject(state.project)
    };
  }

  function serializePersistenceDocument(pretty = false) {
    return JSON.stringify(createPersistenceDocument(), null, pretty ? 2 : 0);
  }

  function computePersistenceSignature() {
    return serializePersistenceDocument(false);
  }

  function hasUnsavedProjectChanges() {
    return computePersistenceSignature() !== String(persistenceState.manualSaveSignature || "");
  }

  function applyLoadedProjectDocument(obj, options = {}) {
    state.settings = {
      ...state.settings,
      ...(obj.settings || {}),
      renderMode: (obj.settings?.renderMode === "audio") ? "audio" : "video",
      audioContainer: obj.settings?.audioContainer || state.settings.audioContainer || "MP3",
      aspectRatio: normalizeAspectRatio(obj.settings?.aspectRatio || state.settings.aspectRatio)
    };
    state.settings.backgroundColor = normalizeBackgroundColor(state.settings.backgroundColor);
    state.settings.backgroundClipColor = normalizeBackgroundColor(state.settings.backgroundClipColor || "#ffffff");
    state.project = obj.project || state.project;
    state.project.videoSections = Math.max(1, Number(state.project.videoSections || 1));
    state.project.audioSections = Math.max(1, Number(state.project.audioSections || 1));
    cmdStack.clear();

    els.selFps.value = String(state.settings.fps);
    els.selRes.value = state.settings.resolutionName;
    els.selFmt.value = state.settings.container;
    syncAspectRatioUi();
    applyProjectBackgroundColor();
    setBackgroundClipColor(state.settings.backgroundClipColor, { rebuild: true });
    updateOutputFolderHint();

    normalizeProjectMediaPaths();
    queueMissingAudioVisuals();
    recalcTimeline();
    renderAll();

    persistenceState.projectFilePath = String(options.filePath || "");
    if (typeof options.manualSaveSignature === "string") {
      persistenceState.manualSaveSignature = options.manualSaveSignature;
    } else if (options.markSaved !== false) {
      persistenceState.manualSaveSignature = computePersistenceSignature();
    }
    if (options.lastAutoSaveSignature) {
      persistenceState.lastAutoSaveSignature = String(options.lastAutoSaveSignature || "");
    }
    if (options.lastAutoSaveAt) {
      persistenceState.lastAutoSaveAt = Number(options.lastAutoSaveAt || 0);
    }
    updateAutoSaveIndicator();
  }

  async function clearAutosaveCache() {
    persistenceState.lastAutoSaveSignature = "";
    persistenceState.lastAutoSaveAt = 0;
    updateAutoSaveIndicator();
    try {
      await window.pearl.clearAutosaveCache?.();
    } catch {
      // ignore cache cleanup failure
    }
  }

  async function persistAutosaveCache(options = {}) {
    if (autoSaveInFlight) return autoSaveInFlight;
    autoSaveInFlight = (async () => {
      const signature = computePersistenceSignature();
      const dirty = signature !== String(persistenceState.manualSaveSignature || "");
      if (!dirty) {
        await clearAutosaveCache();
        return { ok: true, skipped: true, reason: "clean" };
      }
      if (signature === String(persistenceState.lastAutoSaveSignature || "")) {
        return { ok: true, skipped: true, reason: "unchanged" };
      }
      if (!window.pearl.saveAutosaveCache) {
        return { ok: false, error: "autosave-unavailable" };
      }
      persistenceState.autoSaveBusy = true;
      updateAutoSaveIndicator();
      try {
        const res = await window.pearl.saveAutosaveCache({
          projectJson: serializePersistenceDocument(true),
          manualSaveSignature: String(persistenceState.manualSaveSignature || ""),
          projectFilePath: String(persistenceState.projectFilePath || "")
        });
        if (!res?.ok) return { ok: false, error: "autosave-failed" };
        persistenceState.lastAutoSaveSignature = signature;
        persistenceState.lastAutoSaveAt = Number(res.savedAtMs || Date.now());
        updateAutoSaveIndicator();
        return { ok: true, savedAtMs: persistenceState.lastAutoSaveAt };
      } catch (error) {
        return { ok: false, error: String(error?.message || error || "autosave-error") };
      } finally {
        persistenceState.autoSaveBusy = false;
        updateAutoSaveIndicator();
      }
    })();
    try {
      return await autoSaveInFlight;
    } finally {
      autoSaveInFlight = null;
    }
  }

  async function saveProjectInteractive(options = {}) {
    const json = serializePersistenceDocument(true);
    const res = await window.pearl.saveProject(json, persistenceState.projectFilePath || "");
    if (!res?.ok) return false;
    persistenceState.projectFilePath = String(res.filePath || persistenceState.projectFilePath || "");
    persistenceState.manualSaveSignature = computePersistenceSignature();
    await clearAutosaveCache();
    if (options.toast !== false) toast("프로젝트 저장 완료");
    return true;
  }

  async function restoreAutosaveCacheIfNeeded() {
    try {
      const res = await window.pearl.loadAutosaveCache?.();
      if (!res?.ok || !res.projectJson) return false;
      const restoreDecision = window.pearl.showAutosaveRestoreDialog
        ? await window.pearl.showAutosaveRestoreDialog()
        : { action: window.confirm("자동 저장된 항목이 있습니다. 불러오시겠습니까?") ? "restore" : "discard" };
      if (String(restoreDecision?.action || "discard") !== "restore") {
        await clearAutosaveCache();
        return false;
      }
      const obj = JSON.parse(res.projectJson);
      applyLoadedProjectDocument(obj, {
        markSaved: false,
        filePath: res.projectFilePath || "",
        manualSaveSignature: String(res.manualSaveSignature || ""),
        lastAutoSaveAt: Number(res.savedAtMs || Date.now())
      });
      persistenceState.lastAutoSaveSignature = computePersistenceSignature();
      persistenceState.lastAutoSaveAt = Number(res.savedAtMs || Date.now());
      updateAutoSaveIndicator();
      toast("임시 저장된 작업을 복구했습니다.");
      return true;
    } catch {
      await clearAutosaveCache();
      return false;
    }
  }

  function startAutoSaveTimer() {
    if (persistenceState.autoSaveTimer) clearInterval(persistenceState.autoSaveTimer);
    persistenceState.autoSaveTimer = setInterval(() => {
      void persistAutosaveCache();
    }, AUTO_SAVE_INTERVAL_MS);
  }

  async function handleAppCloseRequest() {
    if (!hasUnsavedProjectChanges()) {
      await clearAutosaveCache();
      return true;
    }
    const closeDecision = window.pearl.showUnsavedCloseDialog
      ? await window.pearl.showUnsavedCloseDialog()
      : { action: window.confirm("진행과정이 저장되지 않았습니다. 저장하시겠습니까?") ? "save" : "discard" };
    const action = String(closeDecision?.action || "discard");
    if (action === "save") {
      return await saveProjectInteractive({ toast: false });
    }
    const cached = await persistAutosaveCache({ reason: "close" });
    if (!cached?.ok) {
      showAlert(["자동 임시 저장에 실패했습니다.", "저장 후 다시 종료해 주세요.", String(cached.error || "")]);
      return false;
    }
    return true;
  }

  window.__VIDEOSMITH_APP__ = {
    handleAppCloseRequest
  };

  // Save/Load project
  els.btnSave.onclick = async () => {
    await saveProjectInteractive();
  };

  els.btnLoad.onclick = async () => {
    const res = await window.pearl.loadProject();
    if (!res?.ok) {
      if (res?.error) showAlert(["프로젝트 파일을 불러오지 못했습니다.", res.error]);
      return;
    }
    try {
      const obj = JSON.parse(res.json);
      applyLoadedProjectDocument(obj, { filePath: res.filePath || "" });
      await clearAutosaveCache();
      toast("프로젝트를 불러왔습니다.");
    } catch (error) {
      showAlert(["프로젝트 파일을 해석하지 못했습니다.", String(error?.message || error)]);
    }
  };

  // Render
  els.btnRender.onclick = async () => {
    if (!state.project.videoClips.length && !state.project.audioItems.length) return toast("렌더할 클립이 없습니다.");

    const renderOverlayItems = (state.project.overlayItems || []).map((item) => {
      const normalized = normalizeOverlayItem(item);
      syncOverlayTiming(normalized);
      return normalized;
    });

    const renderProjectPayload = {
      ...state.project,
      videoClips: state.project.videoClips.map((c) => ({
        ...c,
        internalPath: getRenderClipSourcePath(c)
      })),
      overlayItems: renderOverlayItems,
      audioItems: state.project.audioItems.map((a) => ({
        ...a,
        internalPath: getRenderAudioSourcePath(a)
      }))
    };
    const renderHints = {
      hasNonAsciiText: renderOverlayItems.some((item) => String(item.overlayType || "text") === "text" && /[^\x00-\x7F]/.test(String(item.text || ""))),
      hasCustomFont: renderOverlayItems.some((item) => String(item.overlayType || "text") === "text" && !!String(item.fontFile || "").trim()),
      canvasTextFallbackLikely: renderOverlayItems.some((item) => String(item.overlayType || "text") === "text" && (/[\u2600-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDFFF]/.test(String(item.text || "")) || !!String(item.fontFile || "").trim())),
      hasSpecialFx: renderOverlayItems.some((item) => String(item.overlayType || "text") !== "text")
    };

    const payload = {
      project: renderProjectPayload,
      settings: {
        fps: Number(state.settings.fps),
        resolutionName: state.settings.resolutionName,
        aspectRatio: state.settings.aspectRatio || "16:9",
        container: state.settings.container,
        renderMode: state.settings.renderMode || "video",
        audioContainer: state.settings.audioContainer || "MP3",
        backgroundColor: normalizeBackgroundColor(state.settings.backgroundColor)
      },
      region: state.ui.region,
      renderHints
    };
    const res = await window.pearl.openRenderWindow?.({
      payload,
      outputFolder: state.settings.outputFolder || "",
      openFolderAfter: false
    });
    if (!res?.ok) return showAlert(["렌더 창 열기 실패", res?.error || "unknown error"]);
    toast("렌더 창이 열렸습니다. Start 버튼으로 진행하세요.");
  };

  window.pearl.onRenderState?.((s) => {
    if (!s) return;
    if (s.status === "running" && s.message === "finalizing_output") {
      els.renderStatus.textContent = `저장 마무리중... ${Number(s.percent || 0).toFixed(1)}%`;
    } else if (s.status === "running" && s.message === "wrapping_up_render") {
      els.renderStatus.textContent = `마무리중... ${Number(s.percent || 0).toFixed(1)}%`;
    } else if (s.status === "running") els.renderStatus.textContent = `렌더중... ${Number(s.percent || 0).toFixed(1)}%`;
    else if (s.status === "paused") els.renderStatus.textContent = `일시정지 ${Number(s.percent || 0).toFixed(1)}%`;
    else if (s.status === "done") els.renderStatus.textContent = "완료";
    else if (s.status === "error") {
      const debugPath = String(s.debugLogPath || "");
      const errorDetail = String(s.errorDetail || s.message || "");
      els.renderStatus.textContent = debugPath
        ? `${errorDetail || "오류"} · 로그: ${debugPath}`
        : `오류: ${errorDetail}`;
    }
    else els.renderStatus.textContent = "";
  });

  // Pitch graph
  async function drawPitchForAudio(a) {
    try {
      if (!els.pitchCanvas) {
        toast("음성 트랙에서 파형/피치가 함께 표시됩니다.");
        return;
      }
      let buf;
      try {
        buf = await window.pearl.readFileBuffer(a.originalPath);
      } catch {
        buf = await window.pearl.readFileBuffer(a.previewPath || a.internalPath);
      }
      const arrayBuffer = normalizeToArrayBuffer(buf);
      const { series, duration } = await window.PearlPitch.computePitchSeriesFromArrayBuffer(arrayBuffer, { winSize: 2048, hop: 512 });
      window.PearlPitch.drawPitch(els.pitchCanvas, series, duration);
      toast("Pitch graph 생성 완료");
    } catch (e) {
      showAlert(["Pitch graph 생성 실패", String(e?.message || e)]);
    }
  }

  function setTimelinePanVisual(active) {
    timelinePanState.active = !!active;
    els.timelineViewport?.classList.toggle("timelinePanning", !!active);
    document.body.classList.toggle("timeline-pan-active", !!active);
  }

  function clampTimelineViewportScroll(left, top = null) {
    const viewport = els.timelineViewport;
    if (!viewport) return;
    const maxLeft = Math.max(0, Number(viewport.scrollWidth || 0) - Number(viewport.clientWidth || 0));
    const maxTop = Math.max(0, Number(viewport.scrollHeight || 0) - Number(viewport.clientHeight || 0));
    const nextLeft = Math.max(0, Math.min(maxLeft, Number(left || 0)));
    viewport.scrollLeft = nextLeft;
    if (top != null) {
      const nextTop = Math.max(0, Math.min(maxTop, Number(top || 0)));
      viewport.scrollTop = nextTop;
    }
  }

  function getTimelineZoomAnchor(anchorClientX = null) {
    const viewport = els.timelineViewport;
    if (!viewport) {
      return { pointerX: TIMELINE_LABEL_COLUMN_PX, timeSec: 0 };
    }
    const rect = viewport.getBoundingClientRect();
    const pointerX = anchorClientX == null
      ? Math.max(0, Math.min(rect.width || viewport.clientWidth || 0, (viewport.clientWidth || 0) / 2))
      : Math.max(0, Math.min(rect.width || viewport.clientWidth || 0, anchorClientX - rect.left));
    const contentX = Number(viewport.scrollLeft || 0) + pointerX;
    const timePx = Math.max(0, contentX - TIMELINE_LABEL_COLUMN_PX);
    return {
      pointerX,
      timeSec: window.PearlTimeline.pxToSeconds(timePx, Math.max(1, Number(state.ui.pxPerSec || 90)))
    };
  }

  function applyTimelineZoom(nextPxPerSec, anchorClientX = null) {
    const currentPxPerSec = Math.max(20, Math.min(200, Number(state.ui.pxPerSec || 90)));
    const next = Math.max(20, Math.min(200, Number(nextPxPerSec || currentPxPerSec)));
    const syncZoomControls = () => {
      if (els.zoom) {
        els.zoom.value = String(next);
        updateRangeVisual(els.zoom);
      }
      updateZoomValue();
    };
    if (Math.abs(next - currentPxPerSec) < 1e-6) {
      syncZoomControls();
      return;
    }
    const viewport = els.timelineViewport;
    const anchor = getTimelineZoomAnchor(anchorClientX);
    const preservedScrollTop = Number(viewport?.scrollTop || 0);
    state.ui.pxPerSec = next;
    syncZoomControls();
    renderTimeline();
    if (!viewport) return;
    const targetLeft = TIMELINE_LABEL_COLUMN_PX + window.PearlTimeline.secondsToPx(anchor.timeSec, next) - anchor.pointerX;
    clampTimelineViewportScroll(targetLeft, preservedScrollTop);
  }

  // Zoom
  if (els.zoom) {
    els.zoom.oninput = () => {
      applyTimelineZoom(Number(els.zoom.value));
    };
  }
  els.btnZoomOut?.addEventListener("click", () => {
    applyTimelineZoom(Number(els.zoom?.value || state.ui.pxPerSec || 90) - 10);
  });
  els.btnZoomIn?.addEventListener("click", () => {
    applyTimelineZoom(Number(els.zoom?.value || state.ui.pxPerSec || 90) + 10);
  });

  function enableWheelZoom() {
    const onWheel = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("#ruler, #videoLane, #audioLane, #videoTrack, #audioTrack")) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const next = Math.max(20, Math.min(200, state.ui.pxPerSec + dir * 10));
      applyTimelineZoom(next, e.clientX);
    };
    [els.ruler, els.videoLane, els.audioLane].filter(Boolean).forEach((el) => {
      el.addEventListener("wheel", onWheel, { passive: false });
    });
  }

  function enableTimelineMiddlePan() {
    const isPanBlockedTarget = (target) => {
      if (!(target instanceof Element)) return true;
      if (!target.closest("#timelineViewport")) return true;
      return !!target.closest("input, select, textarea, button, a, .trimHandle, .fadeHandle, .transitionDurationHandle, .audioGainControl, .overlayGearBtn, .videoClipOptionsBtn, .imageCutoutBtn, .regionHandle");
    };

    const onMove = (e) => {
      if (!timelinePanState.active) return;
      e.preventDefault();
      const dx = e.clientX - timelinePanState.startX;
      const dy = e.clientY - timelinePanState.startY;
      clampTimelineViewportScroll(
        timelinePanState.scrollLeft - dx,
        timelinePanState.scrollTop - dy
      );
    };

    const stopPan = () => {
      if (!timelinePanState.active) return;
      setTimelinePanVisual(false);
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", stopPan, true);
      window.removeEventListener("blur", stopPan, true);
    };

    const onDown = (e) => {
      if (e.button !== 1) return;
      if (isPanBlockedTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      timelinePanState.startX = e.clientX;
      timelinePanState.startY = e.clientY;
      timelinePanState.scrollLeft = Number(els.timelineViewport?.scrollLeft || 0);
      timelinePanState.scrollTop = Number(els.timelineViewport?.scrollTop || 0);
      setTimelinePanVisual(true);
      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("mouseup", stopPan, true);
      window.addEventListener("blur", stopPan, true);
    };

    const onAuxClick = (e) => {
      if (e.button !== 1) return;
      if (isPanBlockedTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    els.timelineViewport?.addEventListener("mousedown", onDown, true);
    els.timelineViewport?.addEventListener("auxclick", onAuxClick, true);
  }

  function enableLayoutSplitters() {
    const minLeft = 220;
    const maxLeft = 560;
    const minTop = 180;
    const maxTop = 640;

    let dragV = false;
    let dragH = false;

    const onMove = (e) => {
      if (!dragV && !dragH) return;
      const rect = els.layout.getBoundingClientRect();
      if (dragV) {
        const w = Math.max(minLeft, Math.min(maxLeft, e.clientX - rect.left));
        els.layout.style.setProperty("--left-panel-w", `${w}px`);
      }
      if (dragH) {
        const h = Math.max(minTop, Math.min(maxTop, e.clientY - rect.top));
        els.layout.style.setProperty("--top-row-h", `${h}px`);
      }
      schedulePreviewFrameRefresh();
    };
    const onUp = () => {
      dragV = false;
      dragH = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    els.splitterV?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      dragV = true;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
    els.splitterH?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      dragH = true;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  function applyAdaptiveLayout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const topH = Math.max(220, Math.min(420, Math.round(vh * 0.42)));
    const leftW = Math.max(320, Math.min(680, Math.round(vw * 0.4)));
    els.layout?.style.setProperty("--top-row-h", `${topH}px`);
    els.layout?.style.setProperty("--left-panel-w", `${leftW}px`);

    // full screen-ish detection
    const fullW = Math.abs(window.screen.availWidth - vw) <= 2;
    const fullH = Math.abs(window.screen.availHeight - vh) <= 2;
    document.body.classList.toggle("fullscreen-mode", fullW && fullH);
    schedulePreviewFrameRefresh();
  }

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (imageCutoutState.open) {
      if (e.key === "Enter") {
        e.preventDefault();
        void saveImageCutoutEditor();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        void requestCloseImageCutoutEditor();
        return;
      }
      if (!isEditableShortcutTarget(e.target)) return;
    }
    if (isVideoCropModeActive()) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitVideoCropMode();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        exitVideoCropMode();
        return;
      }
      if (!isEditableShortcutTarget(e.target)) return;
    }
    if (isEditableShortcutTarget(e.target)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === "KeyZ") { e.preventDefault(); cmdStack.undo(); return; }
    if (ctrl && e.code === "KeyY") { e.preventDefault(); cmdStack.redo(); return; }
    if (ctrl && e.code === "KeyS") { e.preventDefault(); els.btnSave.click(); return; }
    if (ctrl && e.code === "KeyR") { e.preventDefault(); els.btnRender.click(); return; }
    if (ctrl && e.code === "KeyC") { e.preventDefault(); copySelectedItems(); return; }
    if (ctrl && e.code === "KeyX") { e.preventDefault(); runProjectMutationWithHistory(() => cutSelectedItems()); return; }
    if (ctrl && e.code === "KeyV") {
      e.preventDefault();
      runProjectMutationWithHistory(() => pasteClipboard({
        kind: state.ui.activeLane === "audio" ? "audio" : "video",
        section: state.ui.activeLane === "audio" ? state.ui.activeSection.audio : state.ui.activeSection.video,
        time: state.ui.currentTime
      }));
      return;
    }
    if (ctrl && e.code === "KeyA") {
      e.preventDefault();
      state.ui.region.enabled = true;
      state.ui.region.start = 0;
      state.ui.region.end = state.ui.viewDuration;
      setRegionButtonVisual(true, true);
      renderTimeline();
      return;
    }
    if (ctrl && e.code === "KeyM") {
      e.preventDefault();
      if (runProjectMutationWithHistory(() => mergeSelectedPairByFirstStart())) return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      clearSelection();
      renderAll();
      return;
    }
    if (e.key === " " ) { e.preventDefault(); playPause(); return; }
    if (e.key.toLowerCase() === "s" && !ctrl) { e.preventDefault(); splitAtPlayhead(); return; }
    if (e.key.toLowerCase() === "m" && !ctrl) {
      e.preventDefault();
      if (!mergeSelectedVideoClips()) mergeAtPlayhead();
      return;
    }
    if (e.key.toLowerCase() === "d" && !ctrl) { e.preventDefault(); runProjectMutationWithHistory(() => divideSelectedVideoAudio()); return; }
    if (e.key === "Delete") {
      e.preventDefault();
      const runDelete = () => {
        if (state.ui.selectedKeys.length) return deleteSelectedItems();
        if (state.ui.region.enabled && Math.abs(state.ui.region.end - state.ui.region.start) >= TIMELINE_TIME_STEP_SEC) {
          return deleteRegionSelection();
        }
        return false;
      };
      runProjectMutationWithHistory(runDelete);
      return;
    }
  });

  // Init
  async function init() {
    applyTheme();
    setupRangeVisuals();
    loadPalettePreviewImage();
    updateZoomValue();
    const ok = await ensureTermsAccepted();
    if (!ok) return;
    try {
      const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
      mq?.addEventListener?.("change", () => {
        if (getStoredThemePreference() === "system") applyTheme("system");
      });
    } catch {}
    els.btnTheme?.addEventListener("click", cycleThemePreference);
    window.PearlSettings?.init?.();
    detachedAudioSession = createDetachedAudioPreviewSession({
      fileUrl,
      debug: () => !!getDebugFlags().preview
    });
    transport = timelineTransportApi?.createTransport?.({
      getDuration: () => Math.max(MIN_TIMELINE_CLIP_SEC, Number(state.project.duration || getMaxTimelineEnd() || 0)),
      onTime: (nextTime) => {
        const snappedTime = snapTimelineTimeSec(nextTime);
        state.ui.currentTime = snappedTime;
        renderPreviewAtTime(snappedTime);
        window.PearlTimeline.setPlayhead(els.playhead, snappedTime, state.ui.pxPerSec);
        updateTimeReadout();
      },
      debug: () => !!getDebugFlags().transport
    }) || null;
    applyAdaptiveLayout();
    initPreviewResizeObserver();
    window.addEventListener("resize", () => {
      applyAdaptiveLayout();
      renderTimeline();
      renderPreviewAtTime(state.ui.currentTime);
    });
    updateAutoSaveIndicator();
    try {
      const outputFolderRes = await window.pearl.getOutputFolder?.();
      if (outputFolderRes?.ok) {
        state.settings.outputFolder = outputFolderRes.dirPath || "";
        updateOutputFolderHint();
      }
    } catch {
      // ignore output folder bootstrap failure
    }
    window.addEventListener("pearl-languagechange", () => {
      buildPalettes();
      fillTextOverlayTransitionSelect(els.overlayTransitionInTypeInput);
      fillTextOverlayTransitionSelect(els.overlayTransitionOutTypeInput);
      renderAll();
    });
    buildPalettes();
    fillSelects();
    bindVideoInspector();
    bindVideoCropModal();
    bindImageCutoutModal();
    bindOverlayInspector();
    bindFxPopoverDismiss();
    bindTransitionPopoverDismiss();
    toolSheetController = toolTabs?.init?.(els.toolSheetTabs, { defaultTab: "edit" }) || null;
    enablePlayheadDrag();
    enableRegionSelection();
    enableRegionHandleDrag();
    setupTransitionDrop();
    setupSectionContextMenu();
    enableWheelZoom();
    enableTimelineMiddlePan();
    enableLayoutSplitters();
    setRegionButtonVisual(false, false);
    startAutoSaveTimer();
    const restoredAutosave = await restoreAutosaveCacheIfNeeded();
    if (!restoredAutosave) {
      persistenceState.manualSaveSignature = computePersistenceSignature();
      persistenceState.projectFilePath = "";
      normalizeProjectMediaPaths();
      queueMissingAudioVisuals();
      recalcTimeline();
      renderAll();
      updateAutoSaveIndicator();
      toast("드래그&드롭으로 파일을 추가해보세요.");
    }
  }

  void init();
})();

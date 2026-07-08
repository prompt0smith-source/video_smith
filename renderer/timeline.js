/*
  Timeline rendering / snapping / region selection
*/
(() => {
  const effectDefs = window.VideoSmithEffectDefs || null;
  const FX_TYPES = new Set(effectDefs?.allFxTypes || ["circle", "underline", "point_pop_line"]);
  const LABEL_COLUMN_PX = 52;
  const VIDEO_ROW_HEIGHT = 104;
  const AUDIO_ROW_HEIGHT = 84;
  const MIN_TIMELINE_SURFACE_PX = 980;
  const TIMELINE_TAIL_PX = 280;
  const TIMELINE_TIME_STEP_SEC = 0.01;
  const clipOptionsIcon = `
    <svg class="clipOptionsIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h9" />
      <path d="M17 7h3" />
      <circle cx="15" cy="7" r="2" />
      <path d="M4 17h3" />
      <path d="M11 17h9" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  `;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function localeText(key, fallback) {
    const lang = localStorage.getItem("pearl.lang") || "ko";
    const dict = window.PearlSettings?.getDict?.(lang) || {};
    return dict[key] || fallback;
  }
  function secondsToPx(sec, pxPerSec) { return sec * pxPerSec; }
  function pxToSeconds(px, pxPerSec) { return px / pxPerSec; }
  function format1(sec) {
    const safe = Math.max(0, Number(sec || 0));
    return (Math.round(safe / TIMELINE_TIME_STEP_SEC) * TIMELINE_TIME_STEP_SEC).toFixed(2);
  }
  function getRenderedClipWidthPx(durationSec, pxPerSec, minWidthPx = 12) {
    const rawWidth = Math.max(0, secondsToPx(Math.max(0, Number(durationSec || 0)), pxPerSec));
    return {
      rawWidth,
      widthPx: Math.max(minWidthPx, rawWidth)
    };
  }
  function chooseRulerDensity(pxPerSec, fps = 30) {
    const frameStep = 1 / Math.max(1, fps || 30);
    if (pxPerSec >= 420) return { micro: TIMELINE_TIME_STEP_SEC, minor: 0.1, major: 0.5, label: 0.5 };
    if (pxPerSec >= 180) return { micro: Math.max(TIMELINE_TIME_STEP_SEC, Math.min(frameStep, 0.05)), minor: 0.25, major: 1, label: 1 };
    if (pxPerSec >= 140) return { micro: 0.05, minor: 0.25, major: 1, label: 1 };
    if (pxPerSec >= 100) return { micro: 0.125, minor: 0.5, major: 1, label: 1 };
    if (pxPerSec >= 70) return { micro: 0.25, minor: 0.5, major: 1, label: 2 };
    if (pxPerSec >= 40) return { micro: 0.5, minor: 1, major: 2, label: 2 };
    return { micro: 1, minor: 2, major: 5, label: 5 };
  }

  function isInternalPaletteDrag(dt) {
    if (window.__videosmithInternalDrag) return true;
    if (!dt) return false;
    const types = [...(dt.types || [])].map((item) => String(item || "").toLowerCase());
    if (types.includes("application/x-videosmith-item")) return true;
    try {
      const plain = String(dt.getData?.("text/plain") || "");
      if (!plain) return false;
      const parsed = JSON.parse(plain);
      return parsed?.kind === "transition"
        || parsed?.kind === "text"
        || parsed?.kind === "fx"
        || parsed?.kind === "background"
        || parsed?.kind === "edit_tool";
    } catch {
      return false;
    }
  }

  function overlayGlyph(type) {
    return effectDefs?.paletteItems?.[type]?.glyph || (type === "text" ? "T" : "FX");
  }

  function overlayLabel(overlay) {
    if (!overlay) return "Overlay";
    if (String(overlay.overlayType || "text") === "text") {
      return overlay.text === "" ? "Text" : (overlay.text || "Text Overlay");
    }
    return effectDefs?.paletteItems?.[overlay.overlayType]?.name || "FX Overlay";
  }

  function overlayBadgeLabel(overlay) {
    return String(overlay?.overlayType || "text") === "text" ? "TXT" : "FX";
  }

  function getThumbSectorSec(pxPerSec) {
    const t = clamp((pxPerSec - 20) / 180, 0, 1);
    return Math.round((10 - t * 9) * 10) / 10;
  }

  function buildRuler(el, duration, pxPerSec, fps = 30) {
    el.innerHTML = "";
    const contentWidth = Math.max(MIN_TIMELINE_SURFACE_PX - LABEL_COLUMN_PX, secondsToPx(duration, pxPerSec) + TIMELINE_TAIL_PX);
    const fullWidth = LABEL_COLUMN_PX + contentWidth;
    el.style.width = `${fullWidth}px`;
    el.style.minWidth = `${fullWidth}px`;
    el.style.setProperty("--ruler-width", `${contentWidth}px`);

    const density = chooseRulerDensity(pxPerSec, fps);
    const maxTime = Math.ceil(duration / density.micro) * density.micro;
    let lastLabelX = -Infinity;

    for (let t = 0; t <= maxTime + 1e-6; t += density.micro) {
      const rt = Math.round(t * 1000) / 1000;
      const x = secondsToPx(t, pxPerSec);
      const isMajor = Math.abs((rt / density.major) - Math.round(rt / density.major)) < 1e-6;
      const isMinor = !isMajor && Math.abs((rt / density.minor) - Math.round(rt / density.minor)) < 1e-6;
      const tick = document.createElement("div");
      tick.className = `tick ${isMajor ? "major" : (isMinor ? "minor" : "micro")}`;
      tick.style.left = `${LABEL_COLUMN_PX + x}px`;
      el.appendChild(tick);

      const shouldLabel = isMajor && Math.abs((rt / density.label) - Math.round(rt / density.label)) < 1e-6;
      if (shouldLabel && (LABEL_COLUMN_PX + x - lastLabelX) >= 44) {
        const lab = document.createElement("div");
        lab.className = "tickLabel";
        lab.style.left = `${LABEL_COLUMN_PX + x}px`;
        lab.textContent = rt >= 1 ? `${Number(rt.toFixed(rt % 1 === 0 ? 0 : 1))}s` : `${Number(rt.toFixed(2))}s`;
        el.appendChild(lab);
        lastLabelX = LABEL_COLUMN_PX + x;
      }
    }
  }

  function drawWaveform(canvas, peaks = [], pitchContour = [], gain = 1) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const hasPeaks = peaks.length > 0;
    const hasPitch = pitchContour.length > 0;
    if (!hasPeaks && !hasPitch) return;

    const mid = h / 2;
    if (hasPeaks) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.82)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const idx = Math.floor((x / Math.max(1, w - 1)) * (peaks.length - 1));
        const amp = clamp((peaks[idx] || 0) * Math.max(0, Math.min(1, gain)), 0, 1);
        const yTop = mid - amp * (h * 0.45);
        const yBottom = mid + amp * (h * 0.45);
        ctx.moveTo(x + 0.5, yTop);
        ctx.lineTo(x + 0.5, yBottom);
      }
      ctx.stroke();
    }

    if (hasPitch) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.92)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      const g = Math.max(0, Math.min(1, gain));
      for (let x = 0; x < w; x++) {
        const idx = Math.floor((x / Math.max(1, w - 1)) * (pitchContour.length - 1));
        const pv = clamp(pitchContour[idx] || 0, 0, 1);
        const y = h - ((pv * g) * (h * 0.9) + h * 0.05);
        if (!started) {
          ctx.moveTo(x + 0.5, y);
          started = true;
        } else {
          ctx.lineTo(x + 0.5, y);
        }
      }
      ctx.stroke();
    }
  }

  function renderDropPreview(laneEl, preview, pxPerSec) {
    if (!preview || !preview.visible || preview.durationSec <= 0) return;
    const div = document.createElement("div");
    div.className = "dropTargetHighlight";
    const kind = String(preview.kind || "media").replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "media";
    const label = String(preview.label || "").trim().slice(0, 48);
    div.dataset.dropKind = kind;
    if (label) div.dataset.label = label;
    if (preview.color) div.style.setProperty("--drop-preview-color", String(preview.color));
    div.style.left = `${secondsToPx(preview.startSec, pxPerSec)}px`;
    div.style.width = `${Math.max(28, secondsToPx(preview.durationSec, pxPerSec))}px`;
    div.setAttribute("aria-hidden", "true");
    laneEl.appendChild(div);
  }

  function createClipMeta(nameText, durationText) {
    const meta = document.createElement("div");
    meta.className = "clipMeta";

    const name = document.createElement("div");
    name.className = "clipName";
    name.textContent = nameText;

    const dur = document.createElement("div");
    dur.className = "clipDur";
    dur.textContent = durationText;

    meta.appendChild(name);
    meta.appendChild(dur);
    return meta;
  }

  function createFadeHandle(kind, id, side, widthPx, clipWidthPx, title, durationSec = 0) {
    const handle = document.createElement("div");
    handle.className = `fadeHandle ${side}`;
    handle.dataset.kind = kind;
    handle.dataset.clipId = id;
    handle.dataset.side = side;
    handle.dataset.label = side === "left" ? "Fade In" : "Fade Out";
    handle.dataset.duration = format1(durationSec);
    handle.setAttribute("aria-label", `${title} ${format1(durationSec)}s`);
    handle.title = `${title} ${format1(durationSec)}s`;
    const maxRailWidth = Math.max(6, clipWidthPx * 0.44);
    const hasFade = Number(widthPx || 0) > 0.5;
    const zeroWidth = Math.min(16, Math.max(8, maxRailWidth));
    const minActiveWidth = Math.min(22, Math.max(12, maxRailWidth));
    const railWidth = hasFade ? clamp(widthPx, minActiveWidth, Math.max(minActiveWidth, maxRailWidth)) : zeroWidth;
    handle.classList.toggle("isZeroFade", !hasFade);
    handle.style.width = `${railWidth}px`;
    handle.style.setProperty("--fade-region-width", `${railWidth}px`);

    const topRail = document.createElement("span");
    topRail.className = "fadeRail fadeRailTop";
    const bottomRail = document.createElement("span");
    bottomRail.className = "fadeRail fadeRailBottom";
    const grip = document.createElement("span");
    grip.className = "fadeGrip";
    const label = document.createElement("span");
    label.className = "fadeLabel";
    label.textContent = `${side === "left" ? "Fade In" : "Fade Out"} ${format1(durationSec)}s`;
    handle.append(topRail, bottomRail, grip, label);
    return handle;
  }

  function createTrimHandle(kind, id, side) {
    const handle = document.createElement("div");
    handle.className = `trimHandle ${side}`;
    handle.dataset.kind = kind;
    handle.dataset.clipId = id;
    handle.dataset.side = side;
    return handle;
  }

  function createTrackRow(kind, section, labelCol) {
    const row = document.createElement("div");
    row.className = "trackRowLane";
    row.dataset.kind = kind;
    row.dataset.section = String(section);
    row.addEventListener("dragover", (e) => {
      if (isInternalPaletteDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    row.addEventListener("drop", (e) => {
      if (isInternalPaletteDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent("__pearl_external_drop__", { detail: { event: e } }));
    });

    if (kind === "video") {
      const overlayRail = document.createElement("div");
      overlayRail.className = "trackOverlayRail";
      overlayRail.setAttribute("aria-hidden", "true");
      row.appendChild(overlayRail);

      const mediaRail = document.createElement("div");
      mediaRail.className = "trackMediaRail";
      mediaRail.setAttribute("aria-hidden", "true");
      row.appendChild(mediaRail);
    }

    if (labelCol) {
      const label = document.createElement("div");
      label.className = "sectionLabel";
      label.dataset.kind = kind;
      label.dataset.section = String(section);
      label.textContent = `${kind === "video" ? "Video" : "Audio"} ${section}`;
      labelCol.appendChild(label);
    }

    return row;
  }

  function renderTracks({ videoLane, audioLane, videoLabelCol, audioLabelCol }, project, pxPerSec, selectedClipId, opts = {}) {
    videoLane.innerHTML = "";
    audioLane.innerHTML = "";
    if (videoLabelCol) videoLabelCol.innerHTML = "";
    if (audioLabelCol) audioLabelCol.innerHTML = "";

    const total = Math.max(opts.viewDuration || 0, project.duration || 0);
    const activeLane = opts.activeLane || null;
    const selectedKeys = new Set(opts.selectedKeys || []);
    const videoSections = Math.max(1, Number(opts.videoSections || 1));
    const audioSections = Math.max(1, Number(opts.audioSections || 1));
    videoLane.classList.toggle("activeEdit", activeLane === "video");
    audioLane.classList.toggle("activeEdit", activeLane === "audio");

    const renderGraph = window.VideoSmithRenderGraph || null;
    const analysis = renderGraph ? renderGraph.analyzeProject(project) : { boundaries: [], project };
    const hoverTarget = opts.transitionHoverTarget || (
      opts.transitionHoverBoundaryIdx != null
        ? {
            kind: "boundary",
            boundaryIdx: Number(opts.transitionHoverBoundaryIdx),
            type: opts.draggingTransitionType || "cross",
            duration: opts.transitionHoverDurationSec || 0.5
          }
        : null
    );
    const videoRows = new Map();
    const audioRows = new Map();

    for (let s = 1; s <= videoSections; s++) {
      const row = createTrackRow("video", s, videoLabelCol);
      videoLane.appendChild(row);
      videoRows.set(s, row);
    }
    for (let s = 1; s <= audioSections; s++) {
      const row = createTrackRow("audio", s, audioLabelCol);
      audioLane.appendChild(row);
      audioRows.set(s, row);
    }

    const videoClips = [...(analysis.project?.videoClips || project.videoClips || [])];
    const overlayItems = [...(project.overlayItems || [])].sort((a, b) => {
      const sa = Number(a.section || 1);
      const sb = Number(b.section || 1);
      if (sa !== sb) return sa - sb;
      return Number(a.start || 0) - Number(b.start || 0);
    });
    const boundaries = (analysis.boundaries || []).map((boundary) => ({
      ...boundary,
      x: secondsToPx(boundary.time, pxPerSec),
      transition: renderGraph ? renderGraph.resolveBoundaryTransition(analysis, boundary) : null
    }));
    const transitionName = (type) => {
      const value = String(type || "").toLowerCase();
      if (value === "fade") return localeText("transitionTypeFade", "Fade In/Out");
      if (value === "cross") return localeText("transitionTypeCross", "Cross Dissolve");
      if (value === "focus_pull_in") return localeText("transitionTypeFocusPullIn", "Focus Pull-In");
      if (value === "cyber_mosaic_burst") return localeText("transitionTypeCyberMosaicBurst", "Cyber Mosaic Burst");
      if (value === "blur_slide_left") return localeText("transitionTypeBlurSlideLeft", "Blur Slide Left");
      if (value === "blur_slide_right") return localeText("transitionTypeBlurSlideRight", "Blur Slide Right");
      if (value === "blur_slide_up") return localeText("transitionTypeBlurSlideUp", "Blur Slide Up");
      if (value === "blur_slide_down") return localeText("transitionTypeBlurSlideDown", "Blur Slide Down");
      return localeText("transitionTypeCut", "Cut");
    };
    const createTransitionLabel = (type, durationSec, hover = false) => (
      hover ? transitionName(type) : `${transitionName(type)} ${format1(durationSec)}s`
    );
    const createTransitionSurface = (config) => {
      const {
        type,
        durationSec,
        leftPx,
        widthPx,
        section,
        isPlaceholder,
        boundaryIdx,
        clipId,
        scope,
        storageKey
      } = config;
      if (!type) return null;
      if (type === "cut" && scope && scope !== "boundary") return null;
      if (type === "cut" && scope === "boundary") {
        const chip = document.createElement("div");
        chip.className = `transitionChip cutChip${isPlaceholder ? " isPlaceholder" : ""}`;
        chip.style.left = `${leftPx}px`;
        chip.dataset.transitionTargetKind = "boundary";
        chip.dataset.boundaryIdx = String(boundaryIdx);
        chip.dataset.section = String(section);
        chip.dataset.transitionType = type;
        chip.dataset.transitionScope = "boundary";
        chip.dataset.transitionKey = storageKey || String(boundaryIdx);
        chip.textContent = transitionName(type);
        return chip;
      }

      const surface = document.createElement("div");
      surface.className = `transitionBridge${scope && scope !== "boundary" ? ` clipEdgeTransition ${scope}` : ""}${isPlaceholder ? " isPlaceholder" : ""}`;
      surface.style.left = `${Math.max(0, leftPx)}px`;
      surface.style.width = `${Math.max(24, widthPx)}px`;
      surface.dataset.transitionType = type;
      surface.dataset.transitionScope = scope || "boundary";
      surface.dataset.transitionKey = storageKey || (scope && scope !== "boundary" ? `${scope}:${clipId || ""}` : String(boundaryIdx));
      surface.dataset.section = String(section);
      surface.dataset.transitionTargetKind = scope && scope !== "boundary" ? "edge" : "boundary";
      if (boundaryIdx != null) surface.dataset.boundaryIdx = String(boundaryIdx);
      if (clipId) surface.dataset.clipId = String(clipId);

      const rail = document.createElement("div");
      rail.className = "transitionDurationHandle";
      rail.dataset.transitionType = type;
      rail.dataset.transitionScope = scope || "boundary";
      rail.dataset.transitionKey = surface.dataset.transitionKey;
      rail.dataset.section = String(section);
      if (boundaryIdx != null) rail.dataset.boundaryIdx = String(boundaryIdx);
      if (clipId) rail.dataset.clipId = String(clipId);

      const sig = document.createElement("div");
      sig.className = "transitionSignature";
      sig.setAttribute("aria-hidden", "true");

      const label = document.createElement("div");
      label.className = "transitionLabel";
      label.textContent = createTransitionLabel(type, durationSec, !!isPlaceholder);

      surface.appendChild(rail);
      surface.appendChild(sig);
      surface.appendChild(label);
      return surface;
    };

    for (const clip of videoClips) {
      const section = Math.max(1, Number(clip.section || 1));
      const row = videoRows.get(section) || videoRows.get(1);
      if (!row) continue;

      const clipDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(clip.timelineDuration || 0) || (Number(clip.out || 0) - Number(clip.in || 0)));
      const { rawWidth: rawClipWidth, widthPx: clipWidth } = getRenderedClipWidthPx(clipDuration, pxPerSec, 12);
      const div = document.createElement("div");
      const isSelected = selectedKeys.has(`video:${clip.id}`) || clip.id === selectedClipId;
      div.className = `clip videoClip${isSelected ? " selected" : ""}${clip.overlapWith?.length ? " overlap" : ""}`;
      if (clipWidth < 72) div.classList.add("compactClip");
      if (clipWidth < 28) div.classList.add("microClip");
      div.style.left = `${secondsToPx(clip.start, pxPerSec)}px`;
      div.style.width = `${clipWidth}px`;
      div.dataset.clipId = clip.id;
      div.dataset.kind = "video";
      div.dataset.section = String(section);

      const fadeInWidth = secondsToPx(Math.max(0, Number(clip.manualFadeInSec || 0)), pxPerSec);
      const fadeOutWidth = secondsToPx(Math.max(0, Number(clip.manualFadeOutSec || 0)), pxPerSec);
      div.appendChild(createFadeHandle("video", clip.id, "left", fadeInWidth, clipWidth, "Fade In", Number(clip.manualFadeInSec || 0)));
      div.appendChild(createFadeHandle("video", clip.id, "right", fadeOutWidth, clipWidth, "Fade Out", Number(clip.manualFadeOutSec || 0)));
      div.appendChild(createTrimHandle("video", clip.id, "left"));
      div.appendChild(createTrimHandle("video", clip.id, "right"));

      if (clip.thumbs?.length && clipWidth >= 44 && rawClipWidth >= 22) {
        const strip = document.createElement("div");
        strip.className = "thumbStrip";
        const aspect = (Number(clip.meta?.width || 0) > 0 && Number(clip.meta?.height || 0) > 0)
          ? (Number(clip.meta.width) / Number(clip.meta.height))
          : (16 / 9);
        const cellWidth = Math.max(36, Math.round(40 * aspect));
        strip.style.setProperty("--thumb-cell-w", `${cellWidth}px`);
        const sectorSec = getThumbSectorSec(pxPerSec);
        const clipDur = clipDuration;
        const sectors = Math.max(3, Math.ceil(clipDur / Math.max(0.05, sectorSec)) + 1);
        for (let i = 0; i < sectors; i++) {
          const ratio = sectors <= 1 ? 0 : (i / (sectors - 1));
          const idx = Math.max(0, Math.min(clip.thumbs.length - 1, Math.round(ratio * (clip.thumbs.length - 1))));
          const src = clip.thumbs[idx] || "";
          const cell = document.createElement("div");
          cell.className = "thumbCell";
          if (!src) {
            cell.classList.add("empty");
            strip.appendChild(cell);
            continue;
          }
          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.draggable = false;
          img.onerror = () => {
            cell.classList.add("empty");
            img.remove();
          };
          cell.appendChild(img);
          strip.appendChild(cell);
        }
        div.appendChild(strip);
      }

      div.appendChild(createClipMeta(clip.name || "Clip", `${format1(clipDuration)}s`));
      if (clip.isImage) {
        const cutoutBtn = document.createElement("button");
        cutoutBtn.className = "imageCutoutBtn";
        cutoutBtn.type = "button";
        cutoutBtn.dataset.clipId = clip.id;
        cutoutBtn.setAttribute("aria-label", `${clip.name || localeText("genericClip", "Clip")} image cutout`);
        cutoutBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6" r="2.5" stroke-dasharray="2 2"></circle><path d="M7.5 18.5c.9-3.6 2.4-5.4 4.5-5.4s3.6 1.8 4.5 5.4" stroke-dasharray="2.2 2.2"></path><path d="M8.7 10.8l-2.3 1.8" stroke-dasharray="2 2"></path><path d="M15.3 10.8l2.3 1.8" stroke-dasharray="2 2"></path></svg>';
        div.appendChild(cutoutBtn);
      }
      const visualOptionsBtn = document.createElement("button");
      visualOptionsBtn.className = "videoClipOptionsBtn";
      visualOptionsBtn.type = "button";
      visualOptionsBtn.innerHTML = clipOptionsIcon;
      visualOptionsBtn.setAttribute("aria-label", `${clip.name || localeText("genericClip", "Clip")} ${localeText("videoClipOptionsAria", "visual settings")}`);
      visualOptionsBtn.dataset.clipId = clip.id;
      div.appendChild(visualOptionsBtn);
      row.appendChild(div);

      const introTransition = renderGraph?.resolveClipEdgeTransition?.(analysis, clip, "intro") || null;
      const outroTransition = renderGraph?.resolveClipEdgeTransition?.(analysis, clip, "outro") || null;
      const clipLeft = secondsToPx(clip.start, pxPerSec);
      const hoverIntro = hoverTarget?.kind === "edge" && hoverTarget.scope === "intro" && hoverTarget.clipId === clip.id
        ? hoverTarget
        : null;
      const hoverOutro = hoverTarget?.kind === "edge" && hoverTarget.scope === "outro" && hoverTarget.clipId === clip.id
        ? hoverTarget
        : null;

      const introType = hoverIntro?.type || introTransition?.type;
      if (introType && introType !== "cut") {
        const introDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(introTransition?.duration ?? hoverIntro?.duration ?? opts.transitionHoverDurationSec ?? 0.5));
        const introWidth = Math.min(clipWidth, Math.max(34, secondsToPx(introDuration, pxPerSec)));
        const introSurface = createTransitionSurface({
          type: introType,
          durationSec: introDuration,
          leftPx: clipLeft,
          widthPx: introWidth,
          section,
          isPlaceholder: !!hoverIntro,
          clipId: clip.id,
          scope: "intro",
          storageKey: renderGraph?.makeClipEdgeTransitionKey
            ? renderGraph.makeClipEdgeTransitionKey("intro", clip.id)
            : `intro:${clip.id}`
        });
        if (introSurface) row.appendChild(introSurface);
      }

      const outroType = hoverOutro?.type || outroTransition?.type;
      if (outroType && outroType !== "cut") {
        const outroDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(outroTransition?.duration ?? hoverOutro?.duration ?? opts.transitionHoverDurationSec ?? 0.5));
        const outroWidth = Math.min(clipWidth, Math.max(34, secondsToPx(outroDuration, pxPerSec)));
        const outroSurface = createTransitionSurface({
          type: outroType,
          durationSec: outroDuration,
          leftPx: Math.max(clipLeft, clipLeft + clipWidth - outroWidth),
          widthPx: outroWidth,
          section,
          isPlaceholder: !!hoverOutro,
          clipId: clip.id,
          scope: "outro",
          storageKey: renderGraph?.makeClipEdgeTransitionKey
            ? renderGraph.makeClipEdgeTransitionKey("outro", clip.id)
            : `outro:${clip.id}`
        });
        if (outroSurface) row.appendChild(outroSurface);
      }
    }

    for (const overlay of overlayItems) {
      const section = Math.max(1, Number(overlay.section || 1));
      const row = videoRows.get(section) || videoRows.get(1);
      if (!row) continue;

      const overlayDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(overlay.duration || 0));
      const { widthPx: clipWidth } = getRenderedClipWidthPx(overlayDuration, pxPerSec, 12);
      const isSelected = selectedKeys.has(`overlay:${overlay.id}`);
      const isFx = FX_TYPES.has(String(overlay.overlayType || ""));
      const div = document.createElement("div");
      div.className = `clip overlayClip${isFx ? " fxClip" : ""}${isSelected ? " selected" : ""}`;
      if (clipWidth < 64) div.classList.add("compactClip");
      if (clipWidth < 30) div.classList.add("microClip");
      div.style.left = `${secondsToPx(Number(overlay.start || 0), pxPerSec)}px`;
      div.style.width = `${clipWidth}px`;
      div.dataset.kind = "overlay";
      div.dataset.overlayId = overlay.id;
      div.dataset.section = String(section);

      const fadeInWidth = secondsToPx(Math.max(0, Number(overlay.manualFadeInSec || 0)), pxPerSec);
      const fadeOutWidth = secondsToPx(Math.max(0, Number(overlay.manualFadeOutSec || 0)), pxPerSec);
      div.appendChild(createFadeHandle("overlay", overlay.id, "left", fadeInWidth, clipWidth, "Fade In", Number(overlay.manualFadeInSec || 0)));
      div.appendChild(createFadeHandle("overlay", overlay.id, "right", fadeOutWidth, clipWidth, "Fade Out", Number(overlay.manualFadeOutSec || 0)));
      div.appendChild(createTrimHandle("overlay", overlay.id, "left"));
      div.appendChild(createTrimHandle("overlay", overlay.id, "right"));

      const body = document.createElement("div");
      body.className = "clipBody";

      const badge = document.createElement("div");
      badge.className = "clipBadge";
      badge.textContent = overlayBadgeLabel(overlay);

      const meta = createClipMeta(overlayLabel(overlay), `${format1(overlayDuration)}s`);
      body.appendChild(badge);
      body.appendChild(meta);
      div.appendChild(body);

      if (isFx) {
        const gear = document.createElement("button");
        gear.className = "overlayGearBtn";
        gear.type = "button";
        gear.innerHTML = clipOptionsIcon;
        gear.setAttribute("aria-label", `${overlayLabel(overlay)} ${localeText("overlaySettingsAria", "settings")}`);
        gear.dataset.overlayId = overlay.id;
        gear.dataset.overlayType = overlay.overlayType;
        div.appendChild(gear);
      }

      row.appendChild(div);
    }

    const dropPreviewRow = videoRows.get(Math.max(1, Number(opts.dropPreview?.video?.section || 1))) || videoRows.get(1) || videoLane;
    renderDropPreview(dropPreviewRow, opts.dropPreview?.video, pxPerSec);

    boundaries.forEach((boundary) => {
      const row = videoRows.get(Math.max(1, Number(boundary.section || 1))) || videoRows.get(1) || videoLane;
      if (boundary.overlapDuration > 0.0001) {
        const ov = document.createElement("div");
        ov.className = "overlapBadge";
        ov.style.left = `${secondsToPx(boundary.overlapStart, pxPerSec)}px`;
        ov.style.width = `${Math.max(12, secondsToPx(boundary.overlapDuration, pxPerSec))}px`;
        row.appendChild(ov);
      }

      const marker = document.createElement("div");
      marker.className = "boundary";
      marker.style.left = `${boundary.x}px`;
      marker.dataset.boundaryIdx = String(boundary.idx);
      marker.dataset.section = String(boundary.section);
      row.appendChild(marker);

      const transition = boundary.transition;
      const hoverTransition = hoverTarget?.kind === "boundary" && hoverTarget.boundaryIdx === boundary.idx
        ? hoverTarget.type || "cross"
        : null;
      if ((transition && transition.type) || hoverTransition) {
        const type = hoverTransition || transition.type;
        const durationSec = Math.max(TIMELINE_TIME_STEP_SEC, Number((transition?.duration ?? hoverTarget?.duration ?? opts.transitionHoverDurationSec ?? 0.5)));
        const durationPx = Math.max(34, secondsToPx(durationSec, pxPerSec));
        const bridge = createTransitionSurface({
          type,
          durationSec,
          leftPx: type === "cut" ? boundary.x : Math.max(0, boundary.x - (durationPx / 2)),
          widthPx: type === "cut" ? 0 : durationPx,
          section: boundary.section,
          isPlaceholder: !!hoverTransition,
          boundaryIdx: boundary.idx,
          scope: "boundary",
          storageKey: String(boundary.idx)
        });
        if (bridge) row.appendChild(bridge);
      }
    });

    const audioItems = [...(project.audioItems || [])].sort((a, b) => {
      const sa = Number(a.section || 1);
      const sb = Number(b.section || 1);
      if (sa !== sb) return sa - sb;
      return Number(a.start || 0) - Number(b.start || 0);
    });

    for (const audio of audioItems) {
      const section = Math.max(1, Number(audio.section || 1));
      const row = audioRows.get(section) || audioRows.get(1);
      if (!row) continue;

      const audioDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(audio.duration || 0));
      const { rawWidth: rawClipWidth, widthPx: clipWidth } = getRenderedClipWidthPx(audioDuration, pxPerSec, 12);
      const isSelected = selectedKeys.has(`audio:${audio.id}`);
      const div = document.createElement("div");
      div.className = `clip audioClip${isSelected ? " selected" : ""}`;
      if (clipWidth < 72) div.classList.add("compactClip");
      if (clipWidth < 28) div.classList.add("microClip");
      div.style.left = `${secondsToPx(audio.start, pxPerSec)}px`;
      div.style.width = `${clipWidth}px`;
      div.dataset.audioId = audio.id;
      div.dataset.kind = "audio";
      div.dataset.section = String(section);

      const fadeInWidth = secondsToPx(Math.max(0, Number(audio.manualFadeInSec || 0)), pxPerSec);
      const fadeOutWidth = secondsToPx(Math.max(0, Number(audio.manualFadeOutSec || 0)), pxPerSec);
      div.appendChild(createFadeHandle("audio", audio.id, "left", fadeInWidth, clipWidth, "Fade In", Number(audio.manualFadeInSec || 0)));
      div.appendChild(createFadeHandle("audio", audio.id, "right", fadeOutWidth, clipWidth, "Fade Out", Number(audio.manualFadeOutSec || 0)));
      div.appendChild(createTrimHandle("audio", audio.id, "left"));
      div.appendChild(createTrimHandle("audio", audio.id, "right"));

      if ((audio.waveformPeaks?.length || audio.pitchContour?.length) && clipWidth >= 36 && rawClipWidth >= 20) {
        const wave = document.createElement("canvas");
        wave.className = "audioWave";
        wave.width = Math.max(40, Math.round(clipWidth));
        wave.height = 34;
        drawWaveform(wave, audio.waveformPeaks, audio.pitchContour, Number(audio.gain ?? 1));
        div.appendChild(wave);
      }

      const gainControl = document.createElement("div");
      gainControl.className = "audioGainControl";
      gainControl.dataset.audioId = audio.id;
      const gainTrack = document.createElement("div");
      gainTrack.className = "audioGainTrack";
      const gainNeedle = document.createElement("div");
      gainNeedle.className = "audioGainNeedle";
      const gainVal = Math.max(0, Math.min(1, Number(audio.gain ?? 1)));
      const gainTravel = 40;
      gainControl.style.top = `${Math.round((1 - gainVal) * gainTravel)}px`;
      gainControl.title = `Volume ${Math.round(gainVal * 100)}%`;
      gainTrack.appendChild(gainNeedle);
      gainControl.appendChild(gainTrack);
      div.appendChild(gainControl);

      div.appendChild(createClipMeta(audio.name || "Audio", `${format1(audioDuration)}s`));
      row.appendChild(div);
    }

    renderDropPreview(audioRows.get(1) || audioLane, opts.dropPreview?.audio, pxPerSec);

    const viewportWidth = Math.max(0, Number(opts.viewportWidth || 0));
    const contentWidth = Math.max(
      MIN_TIMELINE_SURFACE_PX - LABEL_COLUMN_PX,
      Math.max(0, viewportWidth - LABEL_COLUMN_PX + 160),
      secondsToPx(total, pxPerSec) + TIMELINE_TAIL_PX
    );
    const fullWidth = LABEL_COLUMN_PX + contentWidth;
    videoRows.forEach((row) => { row.style.width = `${contentWidth}px`; row.style.minWidth = `${contentWidth}px`; });
    audioRows.forEach((row) => { row.style.width = `${contentWidth}px`; row.style.minWidth = `${contentWidth}px`; });
    videoLane.style.width = `${contentWidth}px`;
    videoLane.style.minWidth = `${contentWidth}px`;
    audioLane.style.width = `${contentWidth}px`;
    audioLane.style.minWidth = `${contentWidth}px`;
    videoLane.style.minHeight = `${videoSections * VIDEO_ROW_HEIGHT}px`;
    audioLane.style.minHeight = `${audioSections * AUDIO_ROW_HEIGHT}px`;
    if (videoLane.parentElement) {
      videoLane.parentElement.style.minWidth = `${fullWidth}px`;
    }
    if (audioLane.parentElement) {
      audioLane.parentElement.style.minWidth = `${fullWidth}px`;
    }
    if (videoLabelCol) {
      videoLabelCol.style.minHeight = `${videoSections * VIDEO_ROW_HEIGHT}px`;
      videoLabelCol.style.width = `${LABEL_COLUMN_PX}px`;
      videoLabelCol.style.minWidth = `${LABEL_COLUMN_PX}px`;
    }
    if (audioLabelCol) {
      audioLabelCol.style.minHeight = `${audioSections * AUDIO_ROW_HEIGHT}px`;
      audioLabelCol.style.width = `${LABEL_COLUMN_PX}px`;
      audioLabelCol.style.minWidth = `${LABEL_COLUMN_PX}px`;
    }

    return { boundaries };
  }

  function setPlayhead(el, time, pxPerSec) {
    const x = LABEL_COLUMN_PX + secondsToPx(time, pxPerSec);
    el.style.left = `${x}px`;
  }

  function setRegionOverlay(el, region, pxPerSec) {
    const hStart = document.getElementById("regionStartHandle");
    const hEnd = document.getElementById("regionEndHandle");
    if (!region.enabled) {
      el.classList.add("hidden");
      hStart?.classList.add("hidden");
      hEnd?.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    const s = Math.min(region.start, region.end);
    const e = Math.max(region.start, region.end);
    const left = LABEL_COLUMN_PX + secondsToPx(s, pxPerSec);
    const width = Math.max(2, secondsToPx(e - s, pxPerSec));
    const startX = LABEL_COLUMN_PX + secondsToPx(region.start, pxPerSec);
    const endX = LABEL_COLUMN_PX + secondsToPx(region.end, pxPerSec);
    el.style.left = `${left}px`;
    el.style.width = `${width}px`;
    if (hStart && hEnd) {
      hStart.classList.remove("hidden");
      hEnd.classList.remove("hidden");
      hStart.style.left = `${startX - 7}px`;
      hEnd.style.left = `${endX - 7}px`;
    }
  }

  function snapBoundary(boundaries, xPx, opts = {}) {
    const thresholdPx = Number(opts.thresholdPx || 14);
    const section = opts.section == null ? null : Number(opts.section);
    const requireEligible = opts.requireEligible !== false;
    let best = null;
    for (const boundary of boundaries) {
      if (section != null && Number(boundary.section || 1) !== section) continue;
      if (requireEligible && !boundary.transitionEligible) continue;
      const d = Math.abs(boundary.x - xPx);
      if (d <= thresholdPx && (!best || d < best.d)) best = { ...boundary, d };
    }
    return best;
  }

  window.PearlTimeline = {
    clamp,
    secondsToPx,
    pxToSeconds,
    format1,
    buildRuler,
    renderTracks,
    setPlayhead,
    setRegionOverlay,
    snapBoundary,
    overlayGlyph
  };
})();

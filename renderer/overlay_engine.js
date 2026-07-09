(() => {
  const MIN_OVERLAY_CLIP_SEC = 0.01;
  const zoomMotion = window.VideoSmithZoomMotion || null;
  const transitionMotion = window.VideoSmithTransitionMotion || null;

  function clamp(v, a, b, fallback = a) {
    const safe = Number.isFinite(Number(v)) ? Number(v) : fallback;
    return Math.max(a, Math.min(b, safe));
  }
  function baseResToWH(resKey) {
    switch (resKey) {
      case "SD": return { w: 854, h: 480 };
      case "HD": return { w: 1280, h: 720 };
      case "FHD": return { w: 1920, h: 1080 };
      case "QHD": return { w: 2560, h: 1440 };
      case "UHD / 4K": return { w: 3840, h: 2160 };
      default: return { w: 1920, h: 1080 };
    }
  }
  function evenize(value, min = 2) {
    const safe = Math.max(min, Math.round(Number(value) || min));
    return safe % 2 === 0 ? safe : safe + 1;
  }
  function parseAspectRatio(value) {
    const raw = String(value || "16:9").trim();
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (!match) return { value: "16:9", w: 16, h: 9 };
    const w = Math.max(1, Number(match[1] || 16));
    const h = Math.max(1, Number(match[2] || 9));
    if (!Number.isFinite(w) || !Number.isFinite(h)) return { value: "16:9", w: 16, h: 9 };
    return { value: raw, w, h };
  }
  function resToWH(resKey, aspectRatio = "16:9") {
    const base = baseResToWH(resKey);
    const aspect = parseAspectRatio(aspectRatio);
    if (Math.abs((aspect.w / aspect.h) - (16 / 9)) < 0.0001) return base;
    const shortEdge = Math.max(2, Math.min(base.w, base.h));
    if (Math.abs(aspect.w - aspect.h) < 0.0001) return { w: evenize(shortEdge), h: evenize(shortEdge) };
    if (aspect.w > aspect.h) return { w: evenize(shortEdge * (aspect.w / aspect.h)), h: evenize(shortEdge) };
    return { w: evenize(shortEdge), h: evenize(shortEdge * (aspect.h / aspect.w)) };
  }
  function ensureTextLayer(rootEl) {
    if (!rootEl) return null;
    let layer = document.getElementById("previewTextOverlayLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "previewTextOverlayLayer";
      rootEl.appendChild(layer);
    }
    return layer;
  }
  function ensureFxCanvas(rootEl) {
    if (!rootEl) return null;
    let canvas = document.getElementById("previewFxCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "previewFxCanvas";
      rootEl.appendChild(canvas);
    }
    return canvas;
  }
  function getFrameBox(rootEl, resolutionName, aspectRatio = "16:9") {
    const bounds = rootEl?.getBoundingClientRect?.();
    const width = Math.max(1, Math.round(bounds?.width || rootEl?.clientWidth || 1));
    const height = Math.max(1, Math.round(bounds?.height || rootEl?.clientHeight || 1));
    const target = resToWH(resolutionName, aspectRatio);
    const scale = Math.min(width / target.w, height / target.h);
    const frameWidth = Math.max(1, Math.round(target.w * scale));
    const frameHeight = Math.max(1, Math.round(target.h * scale));
    return { left: Math.round((width - frameWidth) / 2), top: Math.round((height - frameHeight) / 2), width: frameWidth, height: frameHeight, scale, target, minSize: Math.min(frameWidth, frameHeight) };
  }
  function getCanvasFrameBox(canvas, resolutionName, aspectRatio = "16:9") {
    const width = Math.max(1, Math.round(canvas?.clientWidth || canvas?.getBoundingClientRect?.().width || 1));
    const height = Math.max(1, Math.round(canvas?.clientHeight || canvas?.getBoundingClientRect?.().height || 1));
    const target = resToWH(resolutionName, aspectRatio);
    const scale = Math.min(width / target.w, height / target.h);
    const frameWidth = Math.max(1, Math.round(target.w * scale));
    const frameHeight = Math.max(1, Math.round(target.h * scale));
    return { left: Math.round((width - frameWidth) / 2), top: Math.round((height - frameHeight) / 2), width: frameWidth, height: frameHeight, scale, target, minSize: Math.min(frameWidth, frameHeight) };
  }
  function getExplicitFrameBox(width, height, resolutionName, aspectRatio = "16:9") {
    const safeWidth = Math.max(1, Math.round(Number(width || 1)));
    const safeHeight = Math.max(1, Math.round(Number(height || 1)));
    const target = resToWH(resolutionName, aspectRatio);
    const scale = Math.min(safeWidth / target.w, safeHeight / target.h);
    const frameWidth = Math.max(1, Math.round(target.w * scale));
    const frameHeight = Math.max(1, Math.round(target.h * scale));
    return {
      left: Math.round((safeWidth - frameWidth) / 2),
      top: Math.round((safeHeight - frameHeight) / 2),
      width: frameWidth,
      height: frameHeight,
      scale,
      target,
      minSize: Math.min(frameWidth, frameHeight)
    };
  }
  function applyStrokeStyle(el, overlay) {
    const strokeWidth = Math.max(0, Number(overlay.strokeWidth || 0));
    const strokeColor = overlay.strokeColor || "#000000";
    el.style.webkitTextStroke = strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : "0px transparent";
    el.style.textShadow = strokeWidth > 0 ? `0 1px ${Math.max(1, Math.round(strokeWidth * 1.25))}px rgba(0,0,0,0.35)` : "none";
  }
  function normalizeRichTextRunsForRender(overlay, textLength) {
    return (Array.isArray(overlay?.richTextRuns) ? overlay.richTextRuns : [])
      .map((run) => {
        const start = Math.max(0, Math.min(textLength, Math.floor(Number(run?.start || 0))));
        const end = Math.max(start, Math.min(textLength, Math.ceil(Number(run?.end || start))));
        return {
          start,
          end,
          color: String(run?.color || "").trim(),
          fontFamily: String(run?.fontFamily || "").trim(),
          fontWeight: String(run?.fontWeight || "").trim()
        };
      })
      .filter((run) => run.end > run.start && (run.color || run.fontFamily || run.fontWeight))
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }
  function renderRichTextContent(el, overlay) {
    const text = String(overlay.text || "Text");
    const runs = normalizeRichTextRunsForRender(overlay, text.length);
    const renderKey = JSON.stringify({ text, runs });
    if (el.dataset.richTextKey === renderKey) return;
    el.dataset.richTextKey = renderKey;
    el.textContent = "";
    if (!runs.length) {
      el.appendChild(document.createTextNode(text));
      return;
    }
    let cursor = 0;
    const appendText = (value, run = null) => {
      if (!value) return;
      if (!run) {
        el.appendChild(document.createTextNode(value));
        return;
      }
      const span = document.createElement("span");
      span.textContent = value;
      if (run.color) span.style.color = run.color;
      if (run.fontFamily) span.style.fontFamily = run.fontFamily;
      if (run.fontWeight) span.style.fontWeight = run.fontWeight;
      el.appendChild(span);
    };
    runs.forEach((run) => {
      const start = Math.max(cursor, run.start);
      const end = Math.max(start, run.end);
      if (start > cursor) appendText(text.slice(cursor, start));
      appendText(text.slice(start, end), run);
      cursor = end;
    });
    if (cursor < text.length) appendText(text.slice(cursor));
  }
  function getTextBaseTransform(textAlign) {
    return textAlign === "left"
      ? "translate(0, 0)"
      : (textAlign === "right" ? "translate(-100%, 0)" : "translate(-50%, 0)");
  }
  function updatePreviewTextElementLayout(el, overlay, frame) {
    const textAlign = String(overlay.textAlign || "center");
    const xNorm = clamp(Number(overlay.x ?? 0.5), 0, 1);
    const yNorm = clamp(Number(overlay.y ?? 0.82), 0, 1);
    const boxWidth = Math.max(0.12, Number(overlay.boxWidth || 0.26));
    const scaledFontSize = Math.max(10, Math.round(Number(overlay.fontSize || 64) * Number(frame.scale || 1)));

    el.dataset.overlayId = String(overlay.id || "");
    renderRichTextContent(el, overlay);
    el.style.left = `${Number(frame.left || 0) + Math.round(Number(frame.width || 0) * xNorm)}px`;
    el.style.top = `${Number(frame.top || 0) + Math.round(Number(frame.height || 0) * yNorm)}px`;
    el.style.maxWidth = `${Math.max(80, Number(frame.width || 0) * boxWidth)}px`;
    el.style.fontSize = `${scaledFontSize}px`;
    el.style.fontFamily = overlay.fontFamily || "Malgun Gothic";
    el.style.fontWeight = String(overlay.fontWeight || 700);
    el.style.color = overlay.noFill ? "transparent" : (overlay.color || "#ffffff");
    el.style.textAlign = textAlign;
    el.style.transformOrigin = textAlign === "left" ? "0% 50%" : (textAlign === "right" ? "100% 50%" : "50% 50%");
    el.style.transform = getTextBaseTransform(textAlign);
    applyStrokeStyle(el, overlay.noStroke ? { ...overlay, strokeWidth: 0 } : overlay);
  }
  function hashString(input) {
    let hash = 0;
    const text = String(input || "");
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
  function seededUnit(seed, index, salt = 0) {
    const raw = Math.sin(((seed + 1) * 12.9898) + ((index + 1) * 78.233) + (salt * 37.719)) * 43758.5453;
    return raw - Math.floor(raw);
  }
  function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }
  function lerp(a, b, t) {
    return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * clamp01(t));
  }
  function easeOutCubic(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOutCubic(t) {
    t = clamp01(t);
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutQuart(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 4);
  }
  function fastOutSlowIn(t) {
    t = clamp01(t);
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutBackSoft(t) {
    t = clamp01(t);
    const c1 = 1.12;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easePulse(t) {
    t = clamp01(t);
    return t < 0.5 ? easeOutCubic(t * 2) : 1 - easeOutCubic((t - 0.5) * 2);
  }
  function getEased(progress, easing = "linear") {
    const p = clamp01(progress);
    if (easing === "easeOutCubic") return easeOutCubic(p);
    if (easing === "easeInOutCubic") return easeInOutCubic(p);
    if (easing === "easeOutQuart") return easeOutQuart(p);
    if (easing === "easeOutBackSoft") return easeOutBackSoft(p);
    if (easing === "easePulse") return easePulse(p);
    if (easing === "easeInOutQuad") return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    if (easing === "fastFocusZoom" && zoomMotion?.fastFocusZoomEase) return zoomMotion.fastFocusZoomEase(p);
    return p;
  }
  function withAlpha(color, alpha) {
    const normalized = String(color || "#ffffff").trim();
    if (/^rgba?\(/i.test(normalized)) return normalized;
    let hex = normalized.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    const safe = /^[0-9a-f]{6}$/i.test(hex) ? hex : "ffffff";
    return `rgba(${parseInt(safe.slice(0, 2), 16)}, ${parseInt(safe.slice(2, 4), 16)}, ${parseInt(safe.slice(4, 6), 16)}, ${clamp(alpha, 0, 1)})`;
  }
  function parseRgbColor(color, fallback = { r: 97, g: 199, b: 255 }) {
    const raw = String(color || "").trim();
    const rgba = raw.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (rgba) {
      return {
        r: clamp(Number(rgba[1]), 0, 255),
        g: clamp(Number(rgba[2]), 0, 255),
        b: clamp(Number(rgba[3]), 0, 255)
      };
    }
    let hex = raw.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    return fallback;
  }
  function getFxBaseRgb(overlay = {}, options = {}) {
    const fallback = options.lightTheme ? { r: 37, g: 99, b: 235 } : { r: 97, g: 199, b: 255 };
    const legacyDecorColors = new Set(["#fde68a", "#22c55e", "#cbd5e1", "#ffffff", "#ffdb4d"]);
    const raw = String(overlay.color || "").trim().toLowerCase();
    if (!raw || legacyDecorColors.has(raw)) return fallback;
    return parseRgbColor(raw, fallback);
  }
  function getFxMonoColor(overlay = {}, alpha = 1, options = {}) {
    const rgb = getFxBaseRgb(overlay, options);
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${clamp(alpha, 0, 1)})`;
  }
  function createLineFadeGradient(ctx, x1, y1, x2, y2, color, options = {}) {
    const rgb = parseRgbColor(color, getFxBaseRgb(options.overlay || {}, options));
    const coreAlpha = clamp(Number(options.coreAlpha ?? 0.82), 0, 1);
    const midAlpha = clamp(Number(options.midAlpha ?? 0.42), 0, 1);
    const edgeAlpha = clamp(Number(options.edgeAlpha ?? 0.12), 0, 1);
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${edgeAlpha})`);
    gradient.addColorStop(0.12, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midAlpha})`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${coreAlpha})`);
    gradient.addColorStop(0.88, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midAlpha})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${edgeAlpha})`);
    return gradient;
  }
  function drawFeatheredLine(ctx, x1, y1, x2, y2, options = {}) {
    const overlay = options.overlay || {};
    const alpha = clamp(Number(options.alpha ?? 1), 0, 1);
    if (alpha <= 0.001) return;
    const width = Math.max(0.75, Number(options.width || 2));
    const color = getFxMonoColor(overlay, 1, options);
    const gradient = createLineFadeGradient(ctx, x1, y1, x2, y2, color, {
      ...options,
      overlay,
      coreAlpha: Number(options.coreAlpha ?? 0.82) * alpha,
      midAlpha: Number(options.midAlpha ?? 0.42) * alpha,
      edgeAlpha: Number(options.edgeAlpha ?? 0.12) * alpha
    });
    ctx.save();
    ctx.lineCap = options.lineCap || "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getFxMonoColor(overlay, clamp(Number(options.glowAlpha ?? 0.12) * alpha, 0, 1), options);
    ctx.lineWidth = Math.max(width * 2.8, width + 6);
    ctx.shadowColor = getFxMonoColor(overlay, clamp(Number(options.glowAlpha ?? 0.12) * alpha, 0, 1), options);
    ctx.shadowBlur = Math.max(4, width * 2.6);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
  function drawSoftCoreLine(ctx, x1, y1, x2, y2, options = {}) {
    drawFeatheredLine(ctx, x1, y1, x2, y2, {
      ...options,
      width: Math.max(1.2, Number(options.width || 2)),
      coreAlpha: Number(options.coreAlpha ?? 0.78),
      midAlpha: Number(options.midAlpha ?? 0.34),
      edgeAlpha: Number(options.edgeAlpha ?? 0.1),
      glowAlpha: Number(options.glowAlpha ?? 0.08)
    });
  }
  function drawFeatheredRing(ctx, cx, cy, radius, options = {}) {
    const overlay = options.overlay || {};
    const alpha = clamp(Number(options.alpha ?? 1), 0, 1);
    const progress = clamp(Number(options.progress ?? 1), 0, 1);
    if (alpha <= 0.001 || radius <= 0 || progress <= 0) return;
    const width = Math.max(1, Number(options.width || 2));
    const start = Number(options.startAngle ?? -Math.PI / 2);
    const end = start + (Math.PI * 2 * progress);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = getFxMonoColor(overlay, clamp(Number(options.glowAlpha ?? 0.12) * alpha, 0, 1), options);
    ctx.lineWidth = Math.max(width * 2.6, width + 5);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = Math.max(5, width * 2.8);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = getFxMonoColor(overlay, clamp(Number(options.coreAlpha ?? 0.82) * alpha, 0, 1), options);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();
    ctx.restore();
  }
  function getManualAlpha(localTime, total, overlay) {
    let alpha = 1;
    const fadeInSec = Math.max(0, Number(overlay.manualFadeInSec || 0));
    const fadeOutSec = Math.max(0, Number(overlay.manualFadeOutSec || 0));
    if (fadeInSec > 0.001) alpha *= clamp(localTime / fadeInSec, 0, 1);
    if (fadeOutSec > 0.001) alpha *= clamp((total - localTime) / fadeOutSec, 0, 1);
    return alpha;
  }
  function normalizeTextOverlayTransitionType(type) {
    const value = String(type || "none").toLowerCase();
    return [
      "none",
      "fade",
      "cross",
      "sun_glitter_flash",
      "focus_pull_in",
      "cyber_mosaic_burst",
      "blur_slide_left",
      "blur_slide_right",
      "blur_slide_up",
      "blur_slide_down"
    ].includes(value)
      ? value
      : "none";
  }
  function getTextOverlayTransitionDefaultDuration(type) {
    if (type === "fade" || type === "cross") return 0.5;
    if (type === "sun_glitter_flash") return 0.7;
    if (type === "focus_pull_in") return 0.65;
    if (type === "cyber_mosaic_burst") return 0.6;
    if (String(type || "").startsWith("blur_slide_")) return 0.55;
    return 0;
  }
  function getTextOverlayTransitionSettings(overlay) {
    const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay?.duration || 2));
    const introType = normalizeTextOverlayTransitionType(overlay?.transitionInType);
    const outroType = normalizeTextOverlayTransitionType(overlay?.transitionOutType);
    let introDuration = introType === "none" ? 0 : clamp(Number(overlay?.transitionInDurationSec ?? getTextOverlayTransitionDefaultDuration(introType)), 0, total - MIN_OVERLAY_CLIP_SEC, 0);
    let outroDuration = outroType === "none" ? 0 : clamp(Number(overlay?.transitionOutDurationSec ?? getTextOverlayTransitionDefaultDuration(outroType)), 0, total - MIN_OVERLAY_CLIP_SEC, 0);
    const budget = Math.max(0, total - MIN_OVERLAY_CLIP_SEC);
    if ((introDuration + outroDuration) > budget && (introDuration + outroDuration) > 1e-6) {
      const scale = budget / (introDuration + outroDuration);
      introDuration *= scale;
      outroDuration *= scale;
    }
    return {
      totalDuration: total,
      intro: { type: introType, duration: introDuration },
      outro: { type: outroType, duration: outroDuration },
      strength: clamp(Number(overlay?.transitionStrength ?? 1), 0.4, 1.6, 1),
      seed: hashString(`${overlay?.id || "overlay"}:${overlay?.text || ""}`)
    };
  }
  function getTextOverlayTransitionStyle(overlay, currentTime, metrics = {}) {
    if (!transitionMotion || !overlay) return { opacityMultiplier: 1, transform: "", filter: "", maskImage: "" };
    const cfg = getTextOverlayTransitionSettings(overlay);
    const localTime = Number(currentTime || 0) - Number(overlay.start || 0);
    if (localTime < 0 || localTime > cfg.totalDuration) return { opacityMultiplier: 1, transform: "", filter: "", maskImage: "" };
    const width = Math.max(18, Number(metrics.width || 18));
    const height = Math.max(18, Number(metrics.height || 18));
    const align = String(overlay.textAlign || "center");
    const anchorX = align === "left" ? 0 : (align === "right" ? 1 : 0.5);
    const stages = [];
    if (cfg.intro.type !== "none" && cfg.intro.duration > 0 && localTime <= cfg.intro.duration + 1e-6) {
      stages.push({ type: cfg.intro.type, progress: clamp(localTime / cfg.intro.duration, 0, 1), mode: "in" });
    }
    if (cfg.outro.type !== "none" && cfg.outro.duration > 0 && localTime >= cfg.totalDuration - cfg.outro.duration - 1e-6) {
      stages.push({ type: cfg.outro.type, progress: clamp((localTime - (cfg.totalDuration - cfg.outro.duration)) / cfg.outro.duration, 0, 1), mode: "out" });
    }
    let opacityMultiplier = 1;
    const transformParts = [];
    const filterParts = [];
    let maskImage = "";
    stages.forEach((stage) => {
      if (stage.type === "fade" || stage.type === "cross") {
        opacityMultiplier *= clamp(stage.mode === "in" ? stage.progress : (1 - stage.progress), 0, 1);
      } else if (stage.type === "sun_glitter_flash" && transitionMotion.computeSunGlitterState) {
        const motion = transitionMotion.computeSunGlitterState(stage.progress, cfg.strength, { mode: stage.mode });
        opacityMultiplier *= clamp(motion.opacity, 0, 1);
        if (Number(motion.blurPx || 0) > 0.05) filterParts.push(`blur(${Number(motion.blurPx || 0).toFixed(3)}px)`);
        filterParts.push(`brightness(${(1 + Math.max(0, Number(motion.brightnessBoost || 0))).toFixed(3)})`);
        filterParts.push(`saturate(${(1 + Math.max(0, Number(motion.saturationBoost || 0))).toFixed(3)})`);
        filterParts.push(`contrast(${(1 + Math.max(0, Number(motion.contrastBoost || 0))).toFixed(3)})`);
        if (Number(motion.sepiaAmount || 0) > 0.001) {
          filterParts.push(`sepia(${Math.max(0, Number(motion.sepiaAmount || 0)).toFixed(3)})`);
        }
        if (Number(motion.glowOpacity || 0) > 0.01) {
          const glowPx = Math.max(8, Number(motion.glowPx || 18));
          const warmAlpha = Math.min(0.9, Number(motion.glowOpacity || 0) * 0.72);
          const hotAlpha = Math.min(0.72, Number(motion.flashOpacity || 0) * 0.58);
          filterParts.push(`drop-shadow(0 0 ${glowPx.toFixed(2)}px rgba(255,213,148,${warmAlpha.toFixed(3)}))`);
          filterParts.push(`drop-shadow(0 0 ${(glowPx * 0.55).toFixed(2)}px rgba(255,244,219,${hotAlpha.toFixed(3)}))`);
        }
      } else if (stage.type === "focus_pull_in" && transitionMotion.computeFocusPullTransform) {
        const motion = transitionMotion.computeFocusPullTransform(stage.progress, anchorX, 0.5, cfg.strength, width, height, { mode: stage.mode });
        opacityMultiplier *= clamp(motion.opacity, 0, 1);
        transformParts.push(`matrix(${Number(motion.matrixA ?? motion.scaleX ?? 1).toFixed(6)}, ${Number(motion.matrixB || 0).toFixed(6)}, ${Number(motion.matrixC || 0).toFixed(6)}, ${Number(motion.matrixD ?? motion.scaleY ?? 1).toFixed(6)}, ${Number(motion.translateX || 0).toFixed(3)}, ${Number(motion.translateY || 0).toFixed(3)})`);
        if (Number(motion.blurPx || 0) > 0.05) filterParts.push(`blur(${Number(motion.blurPx || 0).toFixed(3)}px)`);
      } else if (String(stage.type).startsWith("blur_slide_") && transitionMotion.computeDirectionalBlurState) {
        const motion = transitionMotion.computeDirectionalBlurState(stage.progress, String(stage.type).replace("blur_slide_", ""), cfg.strength, width, height, { mode: stage.mode });
        opacityMultiplier *= clamp(motion.opacity, 0, 1);
        transformParts.push(`translate(${Number(motion.translateX || 0).toFixed(3)}px, ${Number(motion.translateY || 0).toFixed(3)}px)`);
        if (Number(motion.blurPx || 0) > 0.05) filterParts.push(`blur(${Number(motion.blurPx || 0).toFixed(3)}px)`);
      } else if (stage.type === "cyber_mosaic_burst" && transitionMotion.renderCyberMosaicMaskDataUrl && transitionMotion.computeCyberMosaicState) {
        const options = {
          mode: stage.mode,
          intensity: cfg.strength,
          tileDensity: 0.68,
          sizeVariance: 0.72,
          clusterCount: 4,
          clusterSpread: 0.46,
          jitterSpeed: 1.2 + ((cfg.strength - 1) * 0.25),
          seed: cfg.seed,
          edgeSoftness: 0.024,
          qualityMode: options.previewMode === "palette" ? "palette" : "preview"
        };
        const state = transitionMotion.computeCyberMosaicState(stage.progress, options);
        opacityMultiplier *= clamp(state?.opacity ?? 1, 0, 1);
        maskImage = transitionMotion.renderCyberMosaicMaskDataUrl(stage.progress, width, height, options) || maskImage;
      }
    });
    return {
      opacityMultiplier,
      transform: transformParts.join(" "),
      filter: filterParts.join(" "),
      maskImage
    };
  }
  function getZoomFocusScale(overlay) {
    const boxWidth = clamp(Number(overlay?.boxWidth || overlay?.width || 0.34), 0.08, 1);
    const boxHeight = clamp(Number(overlay?.boxHeight || overlay?.height || 0.24), 0.08, 1);
    return clamp(1 / Math.max(boxWidth, boxHeight), 1, 8);
  }
  function getZoomOverlayState(overlay, currentTime) {
    if (!overlay || (overlay.overlayType !== "zoom_focus" && overlay.overlayType !== "zoom_out_focus")) return null;
    const localTime = Number(currentTime || 0) - Number(overlay.start || 0);
    const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.8));
    if (localTime < 0 || localTime > total) return null;
    const fadeInSec = Math.max(0, Math.min(total, Number(overlay.manualFadeInSec || 0)));
    const fadeOutSec = Math.max(0, Math.min(total, Number(overlay.manualFadeOutSec || 0)));
    let fadeStrength = 1;
    if (fadeInSec > 0.001) fadeStrength = Math.min(fadeStrength, clamp(localTime / fadeInSec, 0, 1));
    if (fadeOutSec > 0.001) fadeStrength = Math.min(fadeStrength, clamp((total - localTime) / fadeOutSec, 0, 1));
    const focusScale = getZoomFocusScale(overlay);
    const isZoomOut = overlay.overlayType === "zoom_out_focus";
    const zoomOutEndScale = Math.max(0.125, 1 / focusScale);
    const startScale = 1;
    const endScale = isZoomOut ? zoomOutEndScale : focusScale;
    const transformStrength = isZoomOut ? 1 : fadeStrength;
    const strengthBaseScale = startScale;
    const motionProgress = clamp(localTime / total, 0, 1);
    const transform = zoomMotion?.computeAnchorZoomTransform
      ? zoomMotion.computeAnchorZoomTransform(
          motionProgress,
          clamp(Number(overlay.x ?? 0.5), 0, 1),
          clamp(Number(overlay.y ?? 0.46), 0, 1),
          startScale,
          endScale,
          1,
          1,
          { strength: transformStrength, strengthBaseScale }
        )
      : {
          progress: motionProgress,
          easedProgress: getEased(motionProgress, overlay.easing || "fastFocusZoom"),
          strength: transformStrength,
          motionScale: startScale + ((endScale - startScale) * getEased(motionProgress, overlay.easing || "fastFocusZoom")),
          scale: startScale + (((endScale - startScale) * getEased(motionProgress, overlay.easing || "fastFocusZoom")) * transformStrength),
          translateX: 0,
          translateY: 0
        };
    return {
      localTime,
      totalDuration: total,
      progress: transform.progress,
      easedProgress: transform.easedProgress,
      strength: transform.strength,
      opacity: isZoomOut ? clamp((1 - motionProgress) * fadeStrength, 0, 1) : 1,
      transformStrength,
      startScale,
      endScale,
      motionScale: transform.motionScale,
      scale: transform.scale,
      translateX: transform.translateX,
      translateY: transform.translateY,
      x: clamp(Number(overlay.x ?? 0.5), 0, 1),
      y: clamp(Number(overlay.y ?? 0.46), 0, 1),
      boxWidth: clamp(Number(overlay.boxWidth || 0.34), 0.08, 1),
      boxHeight: clamp(Number(overlay.boxHeight || 0.24), 0.08, 1)
    };
  }
  function getTimedFxPhase(overlay, currentTime, defaults = {}) {
    const localTime = Number(currentTime || 0) - Number(overlay.start || 0);
    const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || defaults.total || MIN_OVERLAY_CLIP_SEC));
    if (localTime < 0 || localTime > total) return null;
    const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(total, Number(overlay.drawDuration ?? defaults.draw ?? Math.max(MIN_OVERLAY_CLIP_SEC, total * 0.42))));
    const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(total, Number(overlay.fadeOutDuration ?? defaults.fade ?? Math.max(MIN_OVERLAY_CLIP_SEC / 2, total * 0.22))));
    const holdDuration = clamp(Number(overlay.holdDuration ?? defaults.hold ?? Math.max(0, total - drawDuration - fadeDuration)), 0, Math.max(0, total - drawDuration - fadeDuration));
    const opacity = clamp(Number(overlay.opacity ?? defaults.opacity ?? 1), 0, 1) * getManualAlpha(localTime, total, overlay);
    if (localTime <= drawDuration) return { localTime, alpha: opacity, drawProgress: getEased(localTime / drawDuration, overlay.easing || defaults.easing || "easeOutCubic"), visibleProgress: getEased(localTime / drawDuration, overlay.easing || defaults.easing || "easeOutCubic"), fadeProgress: 0, phase: "draw", totalDuration: total };
    if (localTime <= drawDuration + holdDuration) return { localTime, alpha: opacity, drawProgress: 1, visibleProgress: 1, fadeProgress: 0, phase: "hold", totalDuration: total };
    const fadeProgress = clamp((localTime - drawDuration - holdDuration) / Math.max(0.01, fadeDuration), 0, 1);
    const fadeEase = easeInOutCubic(fadeProgress);
    return { localTime, alpha: opacity * (1 - fadeEase), drawProgress: 1, visibleProgress: 1 - fadeEase, fadeProgress: fadeEase, phase: "fade", totalDuration: total };
  }
  function getOverlayPhase(overlay, currentTime) {
    if (!overlay) return null;
    if (overlay.overlayType === "point_pop_line") {
      const localTime = Number(currentTime || 0) - Number(overlay.start || 0);
      const durationSec = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || (Number(overlay.durationMs || 520) / 1000) || 0.52));
      if (localTime < 0 || localTime > durationSec) return null;
      return { localTime, alpha: clamp(Number(overlay.opacity ?? 0.96), 0, 1) * getManualAlpha(localTime, durationSec, overlay), durationSec, phase: "burst" };
    }
    if (overlay.overlayType === "checkpoint_pop") {
      const phase = getTimedFxPhase(overlay, currentTime, { draw: 0.22, hold: 0.18, fade: 0.22, total: Number(overlay.duration || (Number(overlay.durationMs || 680) / 1000) || 0.68), opacity: 0.98 });
      if (!phase) return null;
      phase.durationSec = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || (Number(overlay.durationMs || 680) / 1000) || 0.68));
      return phase;
    }
    if (overlay.overlayType === "circle") return getTimedFxPhase(overlay, currentTime, { draw: 0.58, hold: 0.46, fade: 0.28, total: Number(overlay.duration || 1.42), opacity: 0.96 });
    if (overlay.overlayType === "underline") return getTimedFxPhase(overlay, currentTime, { draw: 0.9, hold: 0.4, fade: 0.28, total: Number(overlay.duration || 1.55), opacity: 1 });
    if (overlay.overlayType === "focus_box_draw") return getTimedFxPhase(overlay, currentTime, { draw: 0.58, hold: 0.46, fade: 0.28, total: Number(overlay.duration || 1.42), opacity: 0.96 });
    if (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") return getTimedFxPhase(overlay, currentTime, { draw: 0.22, hold: 0.68, fade: 0.24, total: Number(overlay.duration || 1.8), opacity: 0.96, easing: "fastFocusZoom" });
    if (overlay.overlayType === "callout_line_draw") return getTimedFxPhase(overlay, currentTime, { draw: 0.52, hold: 0.42, fade: 0.24, total: Number(overlay.duration || 1.18), opacity: 0.96 });
    if (overlay.overlayType === "soft_spotlight") return getTimedFxPhase(overlay, currentTime, { draw: 0.28, hold: 0.78, fade: 0.38, total: Number(overlay.duration || 1.44), opacity: 0.42 });
    if (overlay.overlayType === "highlight_bar_sweep") return getTimedFxPhase(overlay, currentTime, { draw: 0.42, hold: 0.52, fade: 0.24, total: Number(overlay.duration || 1.18), opacity: 0.44 });
    if (overlay.overlayType === "section_divider_slide") return getTimedFxPhase(overlay, currentTime, { draw: 0.48, hold: 0.5, fade: 0.24, total: Number(overlay.duration || 1.22), opacity: 0.96 });
    if (overlay.overlayType === "drop_wave") {
      return getTimedFxPhase({ ...overlay, opacity: 1 }, currentTime, {
        draw: 0.18,
        hold: 0.74,
        fade: 0.32,
        total: Number(overlay.duration || 1.24),
        opacity: 1
      });
    }
    return getTimedFxPhase(overlay, currentTime, { draw: 0.35, hold: 0.5, fade: 0.22, total: Number(overlay.duration || 1), opacity: 1 });
  }
  function getDropWaveDistortionState(frame, overlay, currentTimeOrPhase) {
    if (!frame || !overlay) return null;
    const phase = currentTimeOrPhase && typeof currentTimeOrPhase === "object" && currentTimeOrPhase.phase
      ? currentTimeOrPhase
      : getOverlayPhase(overlay, currentTimeOrPhase);
    if (!phase) return null;
    const minSize = Math.max(2, Number(frame.minSize || Math.min(frame.width || 0, frame.height || 0) || 2));
    const waveSpacing = Math.max(0.01, Number(overlay.waveSpacing || 0.055));
    const waveCount = Math.max(1, Math.min(10, Math.round(Number(overlay.waveCount || 4))));
    const reachPx = (minSize * Math.max(0.03, Number(overlay.radius || 0.12))) + (minSize * waveSpacing * waveCount);
    return {
      cx: Number(frame.left || 0) + (Number(frame.width || 0) * clamp(Number(overlay.x ?? 0.5), 0, 1)),
      cy: Number(frame.top || 0) + (Number(frame.height || 0) * clamp(Number(overlay.y ?? 0.46), 0, 1)),
      reachPx,
      waveLenPx: Math.max(8, minSize * waveSpacing),
      strengthPx: Math.max(0, minSize * Math.max(0, Number(overlay.amplitude || 0.032)) * 0.65),
      softness: clamp(Number(overlay.softness ?? 0.64), 0.05, 1),
      speed: Math.max(0.1, Number(overlay.speed || 1.2)),
      localTime: Math.max(0, Number(phase.localTime || 0)),
      temporal: clamp(Number(phase.alpha || 0), 0, 1),
      phase
    };
  }
  function renderTextLayer(rootEl, overlays, options) {
    const layer = ensureTextLayer(rootEl);
    if (!layer) return;
    const textOverlays = (overlays || []).filter((overlay) => overlay.overlayType === "text");
    if (!textOverlays.length) {
      if (layer.dataset.renderKey || layer.childElementCount) {
        layer.innerHTML = "";
        delete layer.dataset.renderKey;
      }
      return;
    }
    const frame = getFrameBox(rootEl, options.resolutionName, options.aspectRatio);
    const renderKey = JSON.stringify({
      resolutionName: options.resolutionName || "",
      aspectRatio: options.aspectRatio || "16:9",
      frameWidth: frame.width,
      frameHeight: frame.height,
      overlays: textOverlays.map((overlay) => ({
        id: overlay.id || "",
        text: overlay.text || "",
        x: Number(overlay.x ?? 0.5),
        y: Number(overlay.y ?? 0.82),
        boxWidth: Number(overlay.boxWidth || 0.26),
        fontSize: Number(overlay.fontSize || 64),
        fontFamily: overlay.fontFamily || "Malgun Gothic",
        fontWeight: String(overlay.fontWeight || 700),
        color: overlay.color || "#ffffff",
        richTextRuns: Array.isArray(overlay.richTextRuns) ? overlay.richTextRuns : [],
        opacity: Number(overlay.opacity ?? 1),
        strokeColor: overlay.strokeColor || "#000000",
        strokeWidth: Number(overlay.strokeWidth || 0),
        noFill: !!overlay.noFill,
        noStroke: !!overlay.noStroke,
        textAlign: overlay.textAlign || "center"
      }))
    });
    const needsRebuild = layer.dataset.renderKey !== renderKey || layer.childElementCount !== textOverlays.length;
    if (needsRebuild) {
      layer.innerHTML = "";
      layer.dataset.renderKey = renderKey;
      textOverlays.forEach((overlay) => {
        const el = document.createElement("div");
        el.className = "previewTextItem";
        layer.appendChild(el);
      });
    }
    const currentTime = Number(options.currentTime || 0);
    textOverlays.forEach((overlay, index) => {
      const el = layer.children[index];
      if (!el) return;
      updatePreviewTextElementLayout(el, overlay, frame);
      const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 2));
      const localTime = Math.max(0, currentTime - Number(overlay.start || 0));
      const textAlign = String(overlay.textAlign || "center");
      const baseTransform = getTextBaseTransform(textAlign);
      const transitionStyle = getTextOverlayTransitionStyle(overlay, currentTime, {
        width: el.offsetWidth || el.getBoundingClientRect?.().width || 0,
        height: el.offsetHeight || el.getBoundingClientRect?.().height || 0
      });
      const alpha = clamp(Number(overlay.opacity ?? 1) * getManualAlpha(localTime, total, overlay) * clamp(Number(transitionStyle.opacityMultiplier ?? 1), 0, 1), 0, 1);
      el.style.opacity = String(alpha);
      el.style.transform = [baseTransform, transitionStyle.transform].filter(Boolean).join(" ") || baseTransform;
      el.style.filter = transitionStyle.filter || "none";
      el.style.maskImage = transitionStyle.maskImage ? `url("${transitionStyle.maskImage}")` : "none";
      el.style.webkitMaskImage = transitionStyle.maskImage ? `url("${transitionStyle.maskImage}")` : "none";
      el.style.maskRepeat = "no-repeat";
      el.style.webkitMaskRepeat = "no-repeat";
      el.style.maskPosition = "0 0";
      el.style.webkitMaskPosition = "0 0";
      el.style.maskSize = "100% 100%";
      el.style.webkitMaskSize = "100% 100%";
    });
  }
  function prepareCanvas(rootEl, resolutionName, aspectRatio = "16:9") {
    const canvas = ensureFxCanvas(rootEl);
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const bounds = rootEl.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(bounds.width));
    const cssHeight = Math.max(1, Math.round(bounds.height));
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { canvas, ctx, frame: getFrameBox(rootEl, resolutionName, aspectRatio) };
  }
  function clearCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
  }
  function prepareStandaloneCanvas(canvas, resolutionName, aspectRatio = "16:9") {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect?.() || { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
    const parentBounds = canvas.parentElement?.getBoundingClientRect?.() || { width: canvas.parentElement?.clientWidth || 0, height: canvas.parentElement?.clientHeight || 0 };
    const cssWidth = Math.max(1, Math.round(parentBounds.width || bounds.width || canvas.clientWidth || 116));
    const cssHeight = Math.max(1, Math.round(parentBounds.height || bounds.height || canvas.clientHeight || Math.round(cssWidth * 9 / 16)));
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { canvas, ctx, frame: getCanvasFrameBox(canvas, resolutionName, aspectRatio) };
  }
  function roundedRectPath(ctx, x, y, w, h, r) {
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
  }
  function drawProgressiveRectStroke(ctx, x, y, w, h, progress) {
    const total = (w * 2) + (h * 2);
    let remain = clamp(progress, 0, 1) * total;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let segment = Math.min(w, remain); if (segment > 0) ctx.lineTo(x + segment, y); remain -= segment;
    if (remain > 0) { segment = Math.min(h, remain); if (segment > 0) ctx.lineTo(x + w, y + segment); remain -= segment; }
    if (remain > 0) { segment = Math.min(w, remain); if (segment > 0) ctx.lineTo(x + w - segment, y + h); remain -= segment; }
    if (remain > 0) { segment = Math.min(h, remain); if (segment > 0) ctx.lineTo(x, y + h - segment); }
    ctx.stroke();
  }
  function drawLineSegment(ctx, x1, y1, x2, y2, progress) {
    const p = clamp(progress, 0, 1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ((x2 - x1) * p), y1 + ((y2 - y1) * p));
    ctx.stroke();
  }
  function getPointPopLineBursts(durationSec) {
    const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(durationSec || 0.52));
    const echoOffset = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(total * 0.34, Math.max(MIN_OVERLAY_CLIP_SEC, total - MIN_OVERLAY_CLIP_SEC)));
    return [{ startOffset: 0, durationSec: Math.max(MIN_OVERLAY_CLIP_SEC, total * 0.48), color: null, opacityMultiplier: 1 }, { startOffset: echoOffset, durationSec: Math.max(MIN_OVERLAY_CLIP_SEC, total - echoOffset), color: null, opacityMultiplier: 0.34 }];
  }
  function drawPointPopLineBurst(ctx, frame, overlay, phase, burst, seed) {
    const cx = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1);
    const cy = frame.top + frame.height * clamp(Number(overlay.y ?? 0.5), 0, 1);
    const count = Math.max(5, Math.min(10, Math.round(Number(overlay.lineCount || 6))));
    const baseRadius = Math.max(2, frame.minSize * Math.max(0.01, Number(overlay.radius || 0.07)));
    const baseLength = Math.max(4, frame.minSize * Math.max(0.01, Number(overlay.lineLength || 0.045)));
    const strokeWidth = Math.max(1.1, Number(overlay.strokeWidth || 2.2) * frame.scale);
    const spread = clamp(Number(overlay.spreadAmount ?? overlay.jitter ?? 0.18), 0, 1);
    const burstLocalTime = Number(phase.localTime || 0) - Number(burst.startOffset || 0);
    const burstDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(burst.durationSec || 0.2));
    if (burstLocalTime < 0 || burstLocalTime > burstDuration) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = burst.color || overlay.color || "#38bdf8";
    ctx.lineJoin = "round";
    for (let i = 0; i < count; i++) {
      const delay = burstDuration * 0.12 * spread * seededUnit(seed, i, 17);
      const lineDuration = Math.max(0.06, burstDuration - delay);
      const local = burstLocalTime - delay;
      if (local < 0 || local > lineDuration) continue;
      const attack = Math.max(0.04, Math.min(lineDuration * 0.34, lineDuration * 0.78));
      const reveal = getEased(local / attack, overlay.easing || "easeOutCubic");
      const fadeProgress = local <= attack ? 0 : clamp((local - attack) / Math.max(0.01, lineDuration - attack), 0, 1);
      const lengthFactor = Math.max(0, reveal * (1 - (0.6 * fadeProgress)));
      const alphaFactor = local <= attack ? reveal : Math.max(0, (1 - fadeProgress) * (1 - (0.08 * fadeProgress)));
      if (lengthFactor <= 0.001 || alphaFactor <= 0.001) continue;
      const jitterAngle = ((seededUnit(seed, i, 3) - 0.5) * 2) * ((Math.PI / Math.max(count, 1)) * 0.75 * spread);
      const angle = (((Math.PI * 2) / count) * i) + jitterAngle;
      const length = baseLength * (0.72 + (seededUnit(seed, i, 29) * 0.42)) * lengthFactor;
      const inner = (baseRadius * (0.88 + (seededUnit(seed, i, 53) * 0.12))) + (baseLength * 0.14 * reveal * (1 - (0.24 * fadeProgress)));
      const x1 = cx + (Math.cos(angle) * inner);
      const y1 = cy + (Math.sin(angle) * inner);
      const x2 = cx + (Math.cos(angle) * (inner + length));
      const y2 = cy + (Math.sin(angle) * (inner + length));
      const burstAlpha = clamp(Number(phase.alpha || 1) * Number(burst.opacityMultiplier || 1) * alphaFactor, 0, 1);
      drawFeatheredLine(ctx, x1, y1, x2, y2, {
        overlay,
        alpha: burstAlpha,
        width: strokeWidth,
        coreAlpha: 0.78,
        midAlpha: 0.34,
        edgeAlpha: 0.1,
        glowAlpha: 0.08
      });
    }
    ctx.restore();
  }
  function drawPointPopLineEffect(ctx, frame, overlay, phase) {
    const durationSec = Math.max(MIN_OVERLAY_CLIP_SEC, Number(phase.durationSec || overlay.duration || 0.52));
    const seed = hashString(`${overlay.id || "point_pop_line"}:${Math.max(8, Math.min(14, Math.round(Number(overlay.lineCount || 10))))}`);
    getPointPopLineBursts(durationSec).forEach((burst) => drawPointPopLineBurst(ctx, frame, overlay, phase, burst, seed));
  }
  function drawCircleEffect(ctx, frame, overlay, phase) {
    const cx = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1);
    const cy = frame.top + frame.height * clamp(Number(overlay.y ?? 0.5), 0, 1);
    const radiusX = Math.max(8, frame.minSize * Number(overlay.radiusX || overlay.radius || overlay.size || 0.11));
    const radiusY = Math.max(8, frame.minSize * Number(overlay.radiusY || overlay.radius || overlay.size || 0.11));
    const ringRadius = Math.max(8, (radiusX + radiusY) / 2);
    const strokeWidth = Math.max(1.15, Number(overlay.strokeWidth || 2.2) * frame.scale);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawFeatheredRing(ctx, cx, cy, ringRadius, {
      overlay,
      alpha: phase.alpha,
      progress: easeOutCubic(phase.drawProgress),
      width: strokeWidth,
      coreAlpha: 0.78,
      glowAlpha: 0.12
    });
    ctx.restore();
  }
  function drawUnderlineEffect(ctx, frame, overlay, phase) {
    const totalWidth = Math.max(24, frame.width * Number(overlay.width || overlay.size || 0.24));
    const thickness = Math.max(1.25, Number(overlay.lineThickness || 2.2) * frame.scale);
    const centerX = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1);
    const baseY = frame.top + frame.height * clamp(Number(overlay.y ?? 0.8), 0, 1);
    const lineStart = centerX - (totalWidth / 2);
    const reveal = easeOutQuart(phase.drawProgress);
    const lineEnd = lineStart + Math.max(1, totalWidth * reveal);
    drawSoftCoreLine(ctx, lineStart, baseY, lineEnd, baseY, {
      overlay,
      alpha: phase.alpha,
      width: thickness,
      lineCap: "round",
      coreAlpha: 0.82,
      midAlpha: 0.38,
      edgeAlpha: 0.1,
      glowAlpha: 0.08
    });
  }
  function drawFocusBoxEffect(ctx, frame, overlay, phase, options = {}) {
    const boxWidth = Math.max(36, frame.width * Math.max(0.08, Number(overlay.boxWidth || 0.28)));
    const boxHeight = Math.max(24, frame.height * Math.max(0.06, Number(overlay.boxHeight || 0.18)));
    const x = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1) - (boxWidth / 2);
    const y = frame.top + frame.height * clamp(Number(overlay.y ?? 0.44), 0, 1) - (boxHeight / 2);
    const strokeWidth = Math.max(2, Number(overlay.strokeWidth || 6) * frame.scale);
    ctx.save();
    ctx.globalAlpha = clamp(phase.alpha, 0, 1);
    if (options.previewMode === "palette" || options.hideEditorChrome) {
      const corner = Math.min(boxWidth, boxHeight) * 0.22;
      const progress = clamp(phase.drawProgress, 0, 1);
      [
        [x, y, 1, 1],
        [x + boxWidth, y, -1, 1],
        [x + boxWidth, y + boxHeight, -1, -1],
        [x, y + boxHeight, 1, -1]
      ].forEach(([px, py, sx, sy], index) => {
        const local = clamp((progress - (index * 0.045)) / 0.82, 0, 1);
        if (local <= 0) return;
        drawSoftCoreLine(ctx, px, py + (sy * corner * local), px, py, {
          overlay,
          alpha: phase.alpha,
          width: Math.max(1.2, strokeWidth * 0.34)
        });
        drawSoftCoreLine(ctx, px, py, px + (sx * corner * local), py, {
          overlay,
          alpha: phase.alpha,
          width: Math.max(1.2, strokeWidth * 0.34)
        });
      });
      ctx.restore();
      return;
    }
    ctx.strokeStyle = overlay.color || "#38bdf8";
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    drawProgressiveRectStroke(ctx, x, y, boxWidth, boxHeight, phase.drawProgress);
    ctx.globalAlpha = clamp(phase.alpha * 0.88, 0, 1);
    ctx.strokeStyle = overlay.accentColor || "#ffffff";
    ctx.lineWidth = Math.max(1.25, strokeWidth * 0.38);
    drawProgressiveRectStroke(ctx, x + strokeWidth * 0.45, y + strokeWidth * 0.45, boxWidth - strokeWidth * 0.9, boxHeight - strokeWidth * 0.9, Math.min(1, phase.drawProgress * 1.08));
    ctx.restore();
  }
  function drawCalloutLineEffect(ctx, frame, overlay, phase) {
    const startX = frame.left + frame.width * clamp(Number(overlay.x ?? 0.38), 0, 1);
    const startY = frame.top + frame.height * clamp(Number(overlay.y ?? 0.44), 0, 1);
    const totalLength = Math.max(24, frame.minSize * Math.max(0.04, Number(overlay.lineLength || 0.22)));
    const angle = Number(overlay.lineAngle ?? -18) * (Math.PI / 180);
    const endX = startX + Math.cos(angle) * totalLength;
    const endY = startY + Math.sin(angle) * totalLength;
    const strokeWidth = Math.max(2, Number(overlay.strokeWidth || 6) * frame.scale);
    ctx.save();
    const reveal = easeOutQuart(phase.drawProgress);
    drawSoftCoreLine(
      ctx,
      startX,
      startY,
      startX + ((endX - startX) * reveal),
      startY + ((endY - startY) * reveal),
      {
        overlay,
        alpha: phase.alpha,
        width: Math.max(1.2, strokeWidth * 0.42)
      }
    );
    ctx.restore();
  }
  function drawSoftSpotlightEffect(ctx, frame, overlay, phase) {
    const cx = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1);
    const cy = frame.top + frame.height * clamp(Number(overlay.y ?? 0.48), 0, 1);
    const boxWidth = Math.max(48, frame.width * Math.max(0.08, Number(overlay.boxWidth || 0.26)));
    const boxHeight = Math.max(30, frame.height * Math.max(0.05, Number(overlay.boxHeight || 0.16)));
    const scale = 0.78 + (0.22 * easeOutCubic(phase.drawProgress));
    const rx = (boxWidth / 2) * scale;
    const ry = (boxHeight / 2) * scale;
    const gradient = ctx.createRadialGradient(cx, cy, Math.max(2, Math.min(rx, ry) * 0.08), cx, cy, Math.max(rx, ry));
    gradient.addColorStop(0, withAlpha(overlay.color || "#ffffff", clamp(phase.alpha * 0.86, 0, 1)));
    gradient.addColorStop(0.55, withAlpha(overlay.color || "#ffffff", clamp(phase.alpha * 0.24, 0, 1)));
    gradient.addColorStop(1, withAlpha(overlay.color || "#ffffff", 0));
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawHighlightBarSweepEffect(ctx, frame, overlay, phase) {
    const totalWidth = Math.max(48, frame.width * Math.max(0.08, Number(overlay.width || 0.34)));
    const barHeight = Math.max(2, Math.min(12, frame.height * Math.max(0.01, Number(overlay.boxHeight || 0.035))));
    const x = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1) - (totalWidth / 2);
    const y = frame.top + frame.height * clamp(Number(overlay.y ?? 0.42), 0, 1);
    const reveal = easeOutQuart(phase.drawProgress);
    drawFeatheredLine(ctx, x, y, x + (totalWidth * reveal), y, {
      overlay,
      alpha: phase.alpha,
      width: barHeight,
      coreAlpha: 0.34,
      midAlpha: 0.2,
      edgeAlpha: 0.06,
      glowAlpha: 0.1,
      lineCap: "round"
    });
  }
  function drawCheckpointPopEffect(ctx, frame, overlay, phase) {
    drawPointPopLineEffect(ctx, frame, { ...overlay, lineCount: overlay.lineCount || 6, radius: overlay.radius || 0.04, lineLength: overlay.lineLength || 0.026, strokeWidth: overlay.strokeWidth || 2.2, duration: phase.durationSec || overlay.duration || 0.68, opacity: Math.min(1, Number(overlay.opacity ?? 0.86)) }, { ...phase, durationSec: phase.durationSec || overlay.duration || 0.68 });
    const cx = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1);
    const cy = frame.top + frame.height * clamp(Number(overlay.y ?? 0.48), 0, 1);
    const radius = Math.max(4, frame.minSize * Math.max(0.008, Number(overlay.radius || 0.035)) * (0.75 + (0.25 * fastOutSlowIn(phase.drawProgress))));
    drawFeatheredRing(ctx, cx, cy, radius, {
      overlay,
      alpha: phase.alpha,
      progress: 1,
      width: Math.max(1.1, Number(overlay.strokeWidth || 2.1) * frame.scale),
      coreAlpha: 0.74,
      glowAlpha: 0.1
    });
    drawSoftCoreLine(ctx, cx - radius * 1.8, cy + radius * 1.45, cx + radius * 1.8, cy + radius * 1.45, {
      overlay,
      alpha: phase.alpha * 0.76,
      width: Math.max(1, Number(overlay.strokeWidth || 2) * frame.scale * 0.72)
    });
  }
  function drawSectionDividerSlideEffect(ctx, frame, overlay, phase) {
    const totalWidth = Math.max(80, frame.width * Math.max(0.16, Number(overlay.width || 0.78)));
    const thickness = Math.max(1.25, Number(overlay.lineThickness || 2.2) * frame.scale);
    const targetCenterX = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1);
    const y = frame.top + frame.height * clamp(Number(overlay.y ?? 0.24), 0, 1);
    const slideTravel = Math.min(80, totalWidth * 0.18);
    const progress = easeOutQuart(phase.drawProgress);
    const currentX = (targetCenterX - (totalWidth / 2)) - ((1 - progress) * slideTravel);
    const visibleWidth = Math.max(2, totalWidth * (0.34 + (0.66 * progress)));
    drawSoftCoreLine(ctx, currentX, y, currentX + visibleWidth, y, {
      overlay,
      alpha: phase.alpha,
      width: thickness,
      coreAlpha: 0.82,
      midAlpha: 0.38,
      edgeAlpha: 0.1,
      glowAlpha: 0.08
    });
  }
  function drawDropWaveThumbnailEffect(ctx, frame, overlay, phase) {
    const state = getDropWaveDistortionState(frame, overlay, phase);
    if (!state) return;
    const previewRadius = Math.max(12, state.reachPx * 0.64);
    const innerRadius = Math.max(4, previewRadius * 0.22);
    const outerRadius = Math.max(innerRadius + 2, previewRadius);
    const waveRadius = Math.max(innerRadius + 6, innerRadius + (outerRadius - innerRadius) * easeOutCubic(Math.min(1, state.localTime * state.speed * 0.75)));
    ctx.save();
    ctx.globalAlpha = Math.max(0.04, state.temporal * 0.58);
    const core = ctx.createRadialGradient(state.cx, state.cy, innerRadius * 0.1, state.cx, state.cy, outerRadius);
    const rgb = getFxBaseRgb(overlay);
    core.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
    core.addColorStop(0.32, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.11)`);
    core.addColorStop(0.68, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(state.cx, state.cy, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    drawFeatheredRing(ctx, state.cx, state.cy, waveRadius, {
      overlay,
      alpha: Math.max(0.08, state.temporal * 0.44),
      width: Math.max(1, frame.scale * 1.4),
      coreAlpha: 0.56,
      midAlpha: 0.24,
      glowAlpha: 0.06
    });
    ctx.restore();
  }
  function drawZoomFocusEffect(ctx, frame, overlay, phase, options = {}) {
    const boxWidth = Math.max(40, frame.width * Math.max(0.08, Number(overlay.boxWidth || 0.34)));
    const boxHeight = Math.max(28, frame.height * Math.max(0.08, Number(overlay.boxHeight || 0.24)));
    const x = frame.left + frame.width * clamp(Number(overlay.x ?? 0.5), 0, 1) - (boxWidth / 2);
    const y = frame.top + frame.height * clamp(Number(overlay.y ?? 0.46), 0, 1) - (boxHeight / 2);
    const guideColor = overlay.color || "#60a5fa";
    const accentColor = overlay.accentColor || "#ffffff";
    const lineWidth = Math.max(2, 4 * frame.scale);
    if (options.previewMode === "palette" || options.hideEditorChrome) {
      const cx = x + (boxWidth / 2);
      const cy = y + (boxHeight / 2);
      const focus = easeOutCubic(phase.drawProgress || phase.visibleProgress || 0);
      const rx = boxWidth * (0.38 + (0.12 * focus));
      const ry = boxHeight * (0.42 + (0.1 * focus));
      ctx.save();
      ctx.globalAlpha = clamp(phase.alpha, 0, 1);
      ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(cx, cy, Math.max(2, Math.min(rx, ry) * 0.08), cx, cy, Math.max(rx, ry));
      glow.addColorStop(0, withAlpha(accentColor, 0.32));
      glow.addColorStop(0.42, withAlpha(guideColor, 0.18));
      glow.addColorStop(1, withAlpha(guideColor, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(frame.left, frame.top, frame.width, frame.height);
      ctx.restore();
      return;
    }
    const loupeRadius = Math.max(12, frame.minSize * 0.045);
    const loupeX = x + boxWidth - loupeRadius * 0.3;
    const loupeY = y + boxHeight - loupeRadius * 0.3;
    ctx.save();
    ctx.globalAlpha = clamp(phase.alpha, 0, 1);
    ctx.fillStyle = withAlpha(guideColor, 0.16);
    roundedRectPath(ctx, x, y, boxWidth, boxHeight, Math.max(8, boxHeight * 0.08));
    ctx.fill();
    ctx.setLineDash([Math.max(8, boxWidth * 0.04), Math.max(6, boxWidth * 0.025)]);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = guideColor;
    roundedRectPath(ctx, x, y, boxWidth, boxHeight, Math.max(8, boxHeight * 0.08));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1.5, lineWidth * 0.55);
    ctx.strokeStyle = accentColor;
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(loupeX + loupeRadius * 0.72, loupeY + loupeRadius * 0.72);
    ctx.lineTo(loupeX + loupeRadius * 1.32, loupeY + loupeRadius * 1.32);
    ctx.stroke();
    ctx.restore();
  }
  function drawFxOverlay(ctx, frame, overlay, phase, options = {}) {
    if (overlay.overlayType === "circle") return drawCircleEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "underline") return drawUnderlineEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "point_pop_line") return drawPointPopLineEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "focus_box_draw") return drawFocusBoxEffect(ctx, frame, overlay, phase, options);
    if (overlay.overlayType === "zoom_focus" || overlay.overlayType === "zoom_out_focus") return drawZoomFocusEffect(ctx, frame, overlay, phase, options);
    if (overlay.overlayType === "callout_line_draw") return drawCalloutLineEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "soft_spotlight") return drawSoftSpotlightEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "highlight_bar_sweep") return drawHighlightBarSweepEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "checkpoint_pop") return drawCheckpointPopEffect(ctx, frame, overlay, phase);
    if (overlay.overlayType === "section_divider_slide") return drawSectionDividerSlideEffect(ctx, frame, overlay, phase);
    return null;
  }
  function renderFxCanvas(rootEl, overlays, options) {
    const fxOverlays = (overlays || []).filter((overlay) => overlay.overlayType !== "text" && overlay.overlayType !== "zoom_focus" && overlay.overlayType !== "zoom_out_focus" && overlay.overlayType !== "drop_wave");
    const canvas = document.getElementById("previewFxCanvas");
    if (!fxOverlays.length) {
      if (canvas?.dataset?.active === "1") {
        clearCanvas(canvas);
        canvas.dataset.active = "0";
      }
      return;
    }
    const prepared = prepareCanvas(rootEl, options.resolutionName, options.aspectRatio);
    if (!prepared) return;
    prepared.canvas.dataset.active = "1";
    const { ctx, frame } = prepared;
    fxOverlays.forEach((overlay) => {
      const phase = getOverlayPhase(overlay, options.currentTime || 0);
      if (phase) drawFxOverlay(ctx, frame, overlay, phase, options);
    });
  }
  function renderFxPreviewCanvas(canvas, overlay, options = {}) {
    const prepared = prepareStandaloneCanvas(canvas, options.resolutionName || "HD", options.aspectRatio);
    if (!prepared || !overlay || overlay.overlayType === "text") return false;
    const { ctx, frame } = prepared;
    const currentTime = Number(options.currentTime || 0);
    const drawBackground = typeof options.drawBackground === "function" ? options.drawBackground : null;
    let drewBackground = false;
    if (drawBackground) {
      try {
        drawBackground(ctx, frame.left, frame.top, frame.width, frame.height, {
          ...options,
          canvas,
          frame,
          overlay,
          currentTime,
          resolutionName: options.resolutionName || "HD",
          aspectRatio: options.aspectRatio || "16:9"
        });
        drewBackground = true;
      } catch (_) {
        // Preview background hooks are decorative; keep effect rendering alive if they fail.
        drewBackground = false;
      }
    }
    if (!drewBackground) {
      ctx.fillStyle = "#0b0f14";
      ctx.fillRect(frame.left, frame.top, frame.width, frame.height);
    }
    const phase = getOverlayPhase(overlay, currentTime);
    if (!phase) return true;
    if (overlay.overlayType === "drop_wave") {
      drawDropWaveThumbnailEffect(ctx, frame, overlay, phase);
      return true;
    }
    drawFxOverlay(ctx, frame, overlay, phase, {
      previewMode: options.previewMode || "",
      hideEditorChrome: !!options.hideEditorChrome
    });
    return true;
  }
  function renderFxFrameToDataUrl(options = {}) {
    if (typeof document === "undefined") return "";
    const resolutionName = options.resolutionName || "FHD";
    const target = resToWH(resolutionName, options.aspectRatio);
    const width = Math.max(1, Math.round(Number(options.width || target.w)));
    const height = Math.max(1, Math.round(Number(options.height || target.h)));
    const overlays = Array.isArray(options.overlays) ? options.overlays : [];
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const frame = getExplicitFrameBox(width, height, resolutionName, options.aspectRatio);
    overlays
      .filter((overlay) => overlay && overlay.overlayType !== "text" && overlay.overlayType !== "zoom_focus" && overlay.overlayType !== "zoom_out_focus" && overlay.overlayType !== "drop_wave")
      .forEach((overlay) => {
        const phase = getOverlayPhase(overlay, Number(options.currentTime || 0));
        if (phase) drawFxOverlay(ctx, frame, overlay, phase, { hideEditorChrome: true });
      });
    return canvas.toDataURL("image/png");
  }
  function quoteCanvasFontFamily(name) {
    const family = String(name || "Malgun Gothic").trim() || "Malgun Gothic";
    if (/^["'].*["']$/.test(family)) return family;
    return `"${family.replace(/["\\]/g, "")}"`;
  }
  function getCanvasFontStack(fontFamily) {
    return [
      quoteCanvasFontFamily(fontFamily || "Malgun Gothic"),
      "\"Apple SD Gothic Neo\"",
      "\"Malgun Gothic\"",
      "\"Noto Sans CJK KR\"",
      "\"NanumGothic\"",
      "sans-serif"
    ].join(", ");
  }
  function makeCanvasTextStyle(overlay, run, fontSize) {
    const fontWeight = String(run?.fontWeight || overlay.fontWeight || 700);
    const fontFamily = getCanvasFontStack(run?.fontFamily || overlay.fontFamily || "Malgun Gothic");
    return {
      color: run?.color || overlay.color || "#ffffff",
      fontWeight,
      fontFamily,
      font: `${fontWeight} ${fontSize}px ${fontFamily}`
    };
  }
  function sameCanvasTextStyle(a, b) {
    return !!a && !!b && a.color === b.color && a.font === b.font;
  }
  function findTextRunAtIndex(runs, index) {
    return runs.find((run) => index >= run.start && index < run.end) || null;
  }
  function appendCanvasSegment(line, text, style, width) {
    if (!text) return;
    const last = line.segments[line.segments.length - 1];
    if (last && sameCanvasTextStyle(last.style, style)) {
      last.text += text;
      last.width += width;
    } else {
      line.segments.push({ text, style, width });
    }
    line.width += width;
  }
  function buildRichCanvasLines(ctx, overlay, maxWidth, fontSize) {
    const text = String(overlay.text || "Text");
    const runs = normalizeRichTextRunsForRender(overlay, text.length);
    const lines = [];
    let line = { segments: [], width: 0 };
    const pushLine = () => {
      lines.push(line);
      line = { segments: [], width: 0 };
    };
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (ch === "\r") continue;
      if (ch === "\n") {
        pushLine();
        continue;
      }
      const style = makeCanvasTextStyle(overlay, findTextRunAtIndex(runs, index), fontSize);
      ctx.font = style.font;
      const charWidth = ctx.measureText(ch).width;
      if (line.segments.length && line.width + charWidth > maxWidth) pushLine();
      appendCanvasSegment(line, ch, style, charWidth);
    }
    if (line.segments.length || !lines.length) lines.push(line);
    return lines;
  }
  function wrapCanvasText(ctx, text, maxWidth) {
    const paragraphs = String(text || "").split(/\r?\n/);
    const lines = [];
    paragraphs.forEach((paragraph) => {
      if (!paragraph) {
        lines.push("");
        return;
      }
      const hasWordBreaks = /\s/.test(paragraph);
      const units = hasWordBreaks ? paragraph.split(/(\s+)/).filter((unit) => unit !== "") : [...paragraph];
      let line = "";
      units.forEach((unit) => {
        const candidate = line ? `${line}${unit}` : unit;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line.trimEnd());
          line = unit.trimStart();
        } else {
          line = candidate;
        }
      });
      if (line || !lines.length) lines.push(line.trimEnd());
    });
    return lines.length ? lines : [""];
  }
  function renderTextFrameToDataUrl(options = {}) {
    if (typeof document === "undefined") return "";
    const resolutionName = options.resolutionName || "FHD";
    const target = resToWH(resolutionName, options.aspectRatio);
    const width = Math.max(1, Math.round(Number(options.width || target.w)));
    const height = Math.max(1, Math.round(Number(options.height || target.h)));
    const overlays = Array.isArray(options.overlays) ? options.overlays : [];
    const currentTime = Number(options.currentTime || 0);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.textBaseline = "top";
    const frame = getExplicitFrameBox(width, height, resolutionName, options.aspectRatio);
    overlays
      .filter((overlay) => overlay && String(overlay.overlayType || "text") === "text")
      .forEach((overlay) => {
        const start = Number(overlay.start || 0);
        const total = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 2));
        if (currentTime < start - 1e-6 || currentTime > start + total + 1e-6) return;
        const localTime = Math.max(0, currentTime - start);
        const transitionStyle = getTextOverlayTransitionStyle(overlay, currentTime, {
          width: Math.max(1, frame.width * Number(overlay.boxWidth || 0.26)),
          height: Math.max(1, Number(overlay.fontSize || 64) * frame.scale)
        });
        const alpha = clamp(
          Number(overlay.opacity ?? 1)
            * getManualAlpha(localTime, total, overlay)
            * clamp(Number(transitionStyle.opacityMultiplier ?? 1), 0, 1),
          0,
          1
        );
        if (alpha <= 0.001) return;
        const fontSize = Math.max(10, Math.round(Number(overlay.fontSize || 64) * Number(frame.scale || 1)));
        const lineHeight = Math.max(fontSize, fontSize * Math.max(0.75, Number(overlay.lineHeight || 1.18)));
        const fontWeight = String(overlay.fontWeight || 700);
        const fontFamily = getCanvasFontStack(overlay.fontFamily || "Malgun Gothic");
        const maxWidth = Math.max(32, Number(frame.width || width) * Math.max(0.08, Number(overlay.boxWidth || 0.26)));
        const anchorX = Number(frame.left || 0) + (Number(frame.width || width) * clamp(Number(overlay.x ?? 0.5), 0, 1));
        const y = Number(frame.top || 0) + (Number(frame.height || height) * clamp(Number(overlay.y ?? 0.82), 0, 1));
        const align = String(overlay.textAlign || "center");
        const x = align === "left" ? anchorX : (align === "right" ? anchorX - maxWidth : anchorX - (maxWidth / 2));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = align === "right" ? "right" : (align === "left" ? "left" : "center");
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        const drawX = align === "left" ? x : (align === "right" ? x + maxWidth : x + (maxWidth / 2));
        const strokeWidth = overlay.noStroke ? 0 : Math.max(0, Number(overlay.strokeWidth || 0) * Number(frame.scale || 1));
        const richRuns = normalizeRichTextRunsForRender(overlay, String(overlay.text || "Text").length);
        if (richRuns.length) {
          ctx.textAlign = "left";
          const lines = buildRichCanvasLines(ctx, overlay, maxWidth, fontSize);
          lines.forEach((line, lineIndex) => {
            const lineY = y + (lineIndex * lineHeight);
            let cursorX = align === "right"
              ? x + maxWidth - line.width
              : (align === "center" ? x + ((maxWidth - line.width) / 2) : x);
            line.segments.forEach((segment) => {
              ctx.font = segment.style.font;
              if (strokeWidth > 0) {
                ctx.lineWidth = strokeWidth * 2;
                ctx.strokeStyle = overlay.strokeColor || "#000000";
                ctx.strokeText(segment.text, cursorX, lineY);
              }
              if (!overlay.noFill) {
                ctx.fillStyle = segment.style.color || overlay.color || "#ffffff";
                ctx.fillText(segment.text, cursorX, lineY);
              }
              cursorX += segment.width;
            });
          });
        } else {
          const lines = wrapCanvasText(ctx, overlay.text || "Text", maxWidth);
          lines.forEach((line, lineIndex) => {
            const lineY = y + (lineIndex * lineHeight);
            if (strokeWidth > 0) {
              ctx.lineWidth = strokeWidth * 2;
              ctx.strokeStyle = overlay.strokeColor || "#000000";
              ctx.strokeText(line, drawX, lineY, maxWidth);
            }
            if (!overlay.noFill) {
              ctx.fillStyle = overlay.color || "#ffffff";
              ctx.fillText(line, drawX, lineY, maxWidth);
            }
          });
        }
        ctx.restore();
      });
    return canvas.toDataURL("image/png");
  }
  function renderOverlays(rootEl, overlays, options = {}) {
    renderTextLayer(rootEl, overlays, options);
    renderFxCanvas(rootEl, overlays, options);
  }
  window.VideoSmithOverlayEngine = {
    ensureTextLayer,
    ensureFxCanvas,
    clearCanvas,
    getFrameBox,
    getOverlayPhase,
    getEased,
    easeOutCubic,
    easeInOutCubic,
    easeOutQuart,
    easeOutBackSoft,
    easePulse,
    getZoomFocusScale,
    getZoomOverlayState,
    getDropWaveDistortionState,
    renderFxPreviewCanvas,
    renderFxFrameToDataUrl,
    renderTextFrameToDataUrl,
    renderOverlays,
    renderTextOverlays: renderTextLayer,
    resToWH
  };
})();

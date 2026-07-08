(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VideoSmithClipVisuals = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MIN_SOURCE_DURATION = 0.01;
  const MAX_POSITION = 1.5;
  const MIN_POSITION = -0.5;
  const MAX_CROP_SUM = 0.96;
  const DEFAULT_CHROMA_COLOR = "#00ff00";
  const FIT_MODES = new Set(["contain", "fill", "stretch"]);
  const PLACEMENT_PRESETS = new Set(["custom", "center", "top-left", "top-right", "bottom-left", "bottom-right"]);

  const DEFAULT_VISUALS = Object.freeze({
    scaleX: 1,
    scaleY: 1,
    positionX: 0.5,
    positionY: 0.5,
    anchorX: 0.5,
    anchorY: 0.5,
    rotation: 0,
    opacity: 1,
    chromaKeyEnabled: false,
    chromaKeyColor: DEFAULT_CHROMA_COLOR,
    chromaKeySimilarity: 0.14,
    chromaKeyBlend: 0.08,
    chromaKeyReflectionTolerance: 0,
    cropLeft: 0,
    cropRight: 0,
    cropTop: 0,
    cropBottom: 0,
    fitMode: "contain",
    placementPreset: "center"
  });

  function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clamp01(value, fallback = 0) {
    return clamp(toNumber(value, fallback), 0, 1);
  }

  function normalizeHexColor(value, fallback = DEFAULT_CHROMA_COLOR) {
    const raw = String(value || "").trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
    return fallback;
  }

  function evenize(value, min = 2) {
    const safe = Math.max(min, Math.round(Number(value) || min));
    return safe % 2 === 0 ? safe : (safe + 1);
  }

  function normalizeFitMode(value) {
    const mode = String(value || DEFAULT_VISUALS.fitMode).toLowerCase();
    return FIT_MODES.has(mode) ? mode : DEFAULT_VISUALS.fitMode;
  }

  function normalizePlacementPreset(value) {
    const preset = String(value || DEFAULT_VISUALS.placementPreset).toLowerCase();
    return PLACEMENT_PRESETS.has(preset) ? preset : DEFAULT_VISUALS.placementPreset;
  }

  function normalizeRotationDegrees(value, fallback = 0) {
    const num = toNumber(value, fallback);
    return Number.isFinite(num) ? num : fallback;
  }

  function extractMediaRotation(meta = {}) {
    if (!meta || typeof meta !== "object") return 0;
    const directCandidates = [
      meta.rotation,
      meta.rotate,
      meta?.tags?.rotate,
      meta?.stream?.rotation,
      meta?.stream?.rotate,
      meta?.stream?.tags?.rotate
    ];
    for (const candidate of directCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value)) return normalizeRotationDegrees(value, 0);
    }
    const sideData = Array.isArray(meta.side_data_list)
      ? meta.side_data_list
      : (Array.isArray(meta?.stream?.side_data_list) ? meta.stream.side_data_list : []);
    for (const entry of sideData) {
      const value = Number(entry?.rotation);
      if (Number.isFinite(value)) return normalizeRotationDegrees(value, 0);
    }
    return 0;
  }

  function shouldSwapMediaAxes(rotationDegrees = 0) {
    const normalized = ((normalizeRotationDegrees(rotationDegrees, 0) % 360) + 360) % 360;
    return (normalized >= 45 && normalized < 135) || (normalized >= 225 && normalized < 315);
  }

  function normalizeCropPair(aValue, bValue) {
    let a = clamp01(aValue, 0);
    let b = clamp01(bValue, 0);
    const sum = a + b;
    if (sum > MAX_CROP_SUM) {
      const scale = MAX_CROP_SUM / Math.max(sum, 0.0001);
      a *= scale;
      b *= scale;
    }
    return [a, b];
  }

  function normalizeVisualState(raw = {}) {
    raw = raw || {};
    const [cropLeft, cropRight] = normalizeCropPair(raw.cropLeft, raw.cropRight);
    const [cropTop, cropBottom] = normalizeCropPair(raw.cropTop, raw.cropBottom);
    const baseScale = Math.max(0.05, toNumber(raw.scale, 1));
    return {
      scaleX: clamp(toNumber(raw.scaleX, baseScale), 0.05, 12),
      scaleY: clamp(toNumber(raw.scaleY, baseScale), 0.05, 12),
      positionX: clamp(toNumber(raw.positionX, DEFAULT_VISUALS.positionX), MIN_POSITION, MAX_POSITION),
      positionY: clamp(toNumber(raw.positionY, DEFAULT_VISUALS.positionY), MIN_POSITION, MAX_POSITION),
      anchorX: clamp01(raw.anchorX, DEFAULT_VISUALS.anchorX),
      anchorY: clamp01(raw.anchorY, DEFAULT_VISUALS.anchorY),
      rotation: clamp(toNumber(raw.rotation, DEFAULT_VISUALS.rotation), -360, 360),
      opacity: clamp(toNumber(raw.opacity, DEFAULT_VISUALS.opacity), 0, 1),
      chromaKeyEnabled: !!raw.chromaKeyEnabled,
      chromaKeyColor: normalizeHexColor(raw.chromaKeyColor, DEFAULT_VISUALS.chromaKeyColor),
      chromaKeySimilarity: clamp(toNumber(raw.chromaKeySimilarity, DEFAULT_VISUALS.chromaKeySimilarity), 0.01, 0.6),
      chromaKeyBlend: clamp(toNumber(raw.chromaKeyBlend, DEFAULT_VISUALS.chromaKeyBlend), 0, 0.4),
      chromaKeyReflectionTolerance: clamp(toNumber(raw.chromaKeyReflectionTolerance, DEFAULT_VISUALS.chromaKeyReflectionTolerance), 0, 0.5),
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      fitMode: normalizeFitMode(raw.fitMode),
      placementPreset: normalizePlacementPreset(raw.placementPreset)
    };
  }

  function getClipSourceIn(clip, fallback = 0) {
    const explicit = Number(clip?.sourceIn);
    if (Number.isFinite(explicit)) return Math.max(0, explicit);
    return Math.max(0, toNumber(clip?.in, fallback));
  }

  function getClipSourceOut(clip, fallback = null) {
    const sourceIn = getClipSourceIn(clip, 0);
    const explicit = Number(clip?.sourceOut);
    if (Number.isFinite(explicit) && explicit > sourceIn) return explicit;
    const legacy = Number(clip?.out);
    if (Number.isFinite(legacy) && legacy > sourceIn) return legacy;
    const durationFallback = Number.isFinite(Number(fallback))
      ? Number(fallback)
      : Math.max(MIN_SOURCE_DURATION, toNumber(clip?.out, 0) - toNumber(clip?.in, 0));
    return Math.max(sourceIn + MIN_SOURCE_DURATION, sourceIn + durationFallback);
  }

  function getClipPlaybackIn(clip) {
    return Math.max(getClipSourceIn(clip, 0), toNumber(clip?.in, getClipSourceIn(clip, 0)));
  }

  function getClipPlaybackOut(clip) {
    const playbackIn = getClipPlaybackIn(clip);
    return Math.max(
      playbackIn + MIN_SOURCE_DURATION,
      Math.min(getClipSourceOut(clip, playbackIn + MIN_SOURCE_DURATION), toNumber(clip?.out, getClipSourceOut(clip, playbackIn + MIN_SOURCE_DURATION)))
    );
  }

  function getClipPlaybackDuration(clip) {
    return Math.max(MIN_SOURCE_DURATION, getClipPlaybackOut(clip) - getClipPlaybackIn(clip));
  }

  function getClipTimelineDuration(clip) {
    const raw = Number(clip?.timelineDuration);
    if (Number.isFinite(raw) && raw >= MIN_SOURCE_DURATION) return raw;
    return getClipPlaybackDuration(clip);
  }

  function getClipPlaybackRate(clip) {
    const timelineDuration = Math.max(MIN_SOURCE_DURATION, getClipTimelineDuration(clip));
    return Math.max(MIN_SOURCE_DURATION / timelineDuration, getClipPlaybackDuration(clip) / timelineDuration);
  }

  function mapClipTimelineOffsetToSourceTime(clip, timelineOffset) {
    const playbackIn = getClipPlaybackIn(clip);
    const playbackOut = getClipPlaybackOut(clip);
    const timelineDuration = getClipTimelineDuration(clip);
    const clampedOffset = clamp(toNumber(timelineOffset, 0), 0, timelineDuration);
    if (clampedOffset >= timelineDuration - 1e-6) return playbackOut;
    return clamp(
      playbackIn + (clampedOffset * getClipPlaybackRate(clip)),
      playbackIn,
      Math.max(playbackIn, playbackOut - 0.001)
    );
  }

  function initVideoClipFields(target = {}, options = {}) {
    const defaultSourceIn = Math.max(0, toNumber(options.defaultSourceIn, 0));
    const defaultDuration = Math.max(
      MIN_SOURCE_DURATION,
      toNumber(options.defaultDuration, toNumber(target?.out, 0) - toNumber(target?.in, 0))
    );
    const sourceIn = getClipSourceIn(target, defaultSourceIn);
    const sourceOut = getClipSourceOut(target, sourceIn + defaultDuration);
    const playbackIn = clamp(toNumber(target?.in, sourceIn), sourceIn, sourceOut - MIN_SOURCE_DURATION);
    const playbackOut = clamp(
      Math.max(playbackIn + MIN_SOURCE_DURATION, toNumber(target?.out, sourceOut)),
      playbackIn + MIN_SOURCE_DURATION,
      sourceOut
    );
    target.sourceIn = sourceIn;
    target.sourceOut = sourceOut;
    target.in = playbackIn;
    target.out = playbackOut;
    target.timelineDuration = Math.max(
      MIN_SOURCE_DURATION,
      toNumber(target?.timelineDuration, Math.max(MIN_SOURCE_DURATION, playbackOut - playbackIn))
    );
    Object.assign(target, normalizeVisualState(target));
    return target;
  }

  function applyPlacementPreset(target = {}, preset = "center") {
    const normalized = normalizePlacementPreset(preset);
    if (normalized === "top-left") {
      target.positionX = 0;
      target.positionY = 0;
      target.anchorX = 0;
      target.anchorY = 0;
    } else if (normalized === "top-right") {
      target.positionX = 1;
      target.positionY = 0;
      target.anchorX = 1;
      target.anchorY = 0;
    } else if (normalized === "bottom-left") {
      target.positionX = 0;
      target.positionY = 1;
      target.anchorX = 0;
      target.anchorY = 1;
    } else if (normalized === "bottom-right") {
      target.positionX = 1;
      target.positionY = 1;
      target.anchorX = 1;
      target.anchorY = 1;
    } else {
      target.positionX = 0.5;
      target.positionY = 0.5;
      target.anchorX = 0.5;
      target.anchorY = 0.5;
    }
    target.placementPreset = normalized;
    return initVideoClipFields(target);
  }

  function setClipSourceRange(target = {}, nextSourceIn, nextSourceOut, options = {}) {
    const oldSourceIn = getClipSourceIn(target, 0);
    const oldSourceOut = getClipSourceOut(target, oldSourceIn + MIN_SOURCE_DURATION);
    const trimStart = Math.max(0, getClipPlaybackIn(target) - oldSourceIn);
    const trimEnd = Math.max(0, oldSourceOut - getClipPlaybackOut(target));
    const maxDuration = Math.max(
      MIN_SOURCE_DURATION,
      toNumber(options.maxDuration, Number.POSITIVE_INFINITY)
    );
    const sourceIn = Math.max(0, toNumber(nextSourceIn, oldSourceIn));
    let sourceOut = Math.max(sourceIn + MIN_SOURCE_DURATION, toNumber(nextSourceOut, oldSourceOut));
    if (Number.isFinite(maxDuration)) {
      sourceOut = Math.min(sourceOut, maxDuration);
      if (sourceOut <= sourceIn + MIN_SOURCE_DURATION) {
        sourceOut = Math.min(maxDuration, sourceIn + MIN_SOURCE_DURATION);
      }
    }
    const nextDuration = Math.max(MIN_SOURCE_DURATION, sourceOut - sourceIn);
    const nextTrimStart = Math.min(trimStart, Math.max(0, nextDuration - MIN_SOURCE_DURATION));
    const nextTrimEnd = Math.min(trimEnd, Math.max(0, nextDuration - nextTrimStart - MIN_SOURCE_DURATION));
    target.sourceIn = sourceIn;
    target.sourceOut = sourceOut;
    target.in = clamp(sourceIn + nextTrimStart, sourceIn, sourceOut - MIN_SOURCE_DURATION);
    target.out = clamp(sourceOut - nextTrimEnd, target.in + MIN_SOURCE_DURATION, sourceOut);
    return initVideoClipFields(target);
  }

  function getMediaDimensions(meta = {}, frameW = 1920, frameH = 1080) {
    const explicitDisplayWidth = toNumber(meta?.displayWidth, 0);
    const explicitDisplayHeight = toNumber(meta?.displayHeight, 0);
    let width = Math.max(2, explicitDisplayWidth || toNumber(meta?.width, frameW));
    let height = Math.max(2, explicitDisplayHeight || toNumber(meta?.height, frameH));
    const rotation = extractMediaRotation(meta);
    if (!(explicitDisplayWidth > 1 && explicitDisplayHeight > 1) && shouldSwapMediaAxes(rotation)) {
      [width, height] = [height, width];
    }
    return { width, height, rotation };
  }

  function getClipChromaKeyState(clip = {}) {
    clip = clip || {};
    const visuals = normalizeVisualState(clip);
    return {
      enabled: !!visuals.chromaKeyEnabled,
      color: visuals.chromaKeyColor,
      similarity: visuals.chromaKeySimilarity,
      blend: visuals.chromaKeyBlend,
      reflectionTolerance: visuals.chromaKeyReflectionTolerance
    };
  }

  function computeLayout(clip = {}, meta = {}, frameW = 1920, frameH = 1080) {
    const visuals = normalizeVisualState(clip);
    const dims = getMediaDimensions(meta, frameW, frameH);
    const visibleRatioX = Math.max(0.04, 1 - visuals.cropLeft - visuals.cropRight);
    const visibleRatioY = Math.max(0.04, 1 - visuals.cropTop - visuals.cropBottom);
    const croppedW = dims.width * visibleRatioX;
    const croppedH = dims.height * visibleRatioY;

    let baseScaleX = frameW / Math.max(1, croppedW);
    let baseScaleY = frameH / Math.max(1, croppedH);
    if (visuals.fitMode === "contain") {
      const base = Math.min(baseScaleX, baseScaleY);
      baseScaleX = base;
      baseScaleY = base;
    } else if (visuals.fitMode === "fill") {
      const base = Math.max(baseScaleX, baseScaleY);
      baseScaleX = base;
      baseScaleY = base;
    }

    const rawWidth = dims.width * baseScaleX * visuals.scaleX;
    const rawHeight = dims.height * baseScaleY * visuals.scaleY;
    const displayWidth = croppedW * baseScaleX * visuals.scaleX;
    const displayHeight = croppedH * baseScaleY * visuals.scaleY;
    const positionPxX = frameW * visuals.positionX;
    const positionPxY = frameH * visuals.positionY;
    const displayLeft = positionPxX - (displayWidth * visuals.anchorX);
    const displayTop = positionPxY - (displayHeight * visuals.anchorY);
    const rawLeft = displayLeft - (visuals.cropLeft * rawWidth);
    const rawTop = displayTop - (visuals.cropTop * rawHeight);
    const transformOriginX = (visuals.cropLeft * rawWidth) + (displayWidth * visuals.anchorX);
    const transformOriginY = (visuals.cropTop * rawHeight) + (displayHeight * visuals.anchorY);

    return {
      visuals,
      frameW,
      frameH,
      mediaW: dims.width,
      mediaH: dims.height,
      visibleRatioX,
      visibleRatioY,
      sourceCropX: dims.width * visuals.cropLeft,
      sourceCropY: dims.height * visuals.cropTop,
      sourceCropW: croppedW,
      sourceCropH: croppedH,
      baseScaleX,
      baseScaleY,
      rawWidth,
      rawHeight,
      displayWidth,
      displayHeight,
      positionPxX,
      positionPxY,
      displayLeft,
      displayTop,
      rawLeft,
      rawTop,
      transformOriginX,
      transformOriginY,
      clipPathInsetCss: `inset(${(visuals.cropTop * 100).toFixed(4)}% ${(visuals.cropRight * 100).toFixed(4)}% ${(visuals.cropBottom * 100).toFixed(4)}% ${(visuals.cropLeft * 100).toFixed(4)}%)`
    };
  }

  return {
    MIN_SOURCE_DURATION,
    DEFAULT_VISUALS,
    clamp,
    clamp01,
    evenize,
    extractMediaRotation,
    getMediaDimensions,
    normalizeVisualState,
    initVideoClipFields,
    getClipSourceIn,
    getClipSourceOut,
    getClipPlaybackIn,
    getClipPlaybackOut,
    getClipPlaybackDuration,
    getClipTimelineDuration,
    getClipPlaybackRate,
    mapClipTimelineOffsetToSourceTime,
    setClipSourceRange,
    getClipChromaKeyState,
    applyPlacementPreset,
    computeLayout
  };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VideoSmithTransitionMotion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const INTRO_END = 0.15;
  const BURST_END = 0.7;
  const DEFAULT_EASING = "dynamic";
  const CYBER_MASK_CACHE_LIMIT = 72;

  const FOCUS_PROFILE = [
    { t: 0.0, value: 0.0, slope: 0.0 },
    { t: INTRO_END, value: 0.06, slope: 0.22 },
    { t: BURST_END, value: 0.9, slope: 0.2 },
    { t: 1.0, value: 1.0, slope: 0.0 }
  ];

  const GENTLE_PROFILE = [
    { t: 0.0, value: 0.0, slope: 0.0 },
    { t: INTRO_END, value: 0.08, slope: 0.16 },
    { t: BURST_END, value: 0.84, slope: 0.16 },
    { t: 1.0, value: 1.0, slope: 0.0 }
  ];

  const CYBER_PROFILE = [
    { t: 0.0, value: 0.0, slope: 0.0 },
    { t: 0.12, value: 0.05, slope: 0.16 },
    { t: 0.56, value: 0.82, slope: 0.38 },
    { t: 0.84, value: 0.97, slope: 0.08 },
    { t: 1.0, value: 1.0, slope: 0.0 }
  ];

  const CYBER_DEFAULTS = Object.freeze({
    intensity: 1,
    tileDensity: 0.68,
    sizeVariance: 0.72,
    clusterCount: 4,
    clusterSpread: 0.46,
    jitterSpeed: 1.2,
    seed: 17,
    edgeSoftness: 0.024
  });

  const cyberRectCache = new Map();
  const cyberMaskCache = new Map();

  function clamp(value, min, max, fallback = min) {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? numeric : fallback;
    return Math.max(min, Math.min(max, safe));
  }

  function lerp(start, end, amount) {
    return start + ((end - start) * amount);
  }

  function smoothstep(edge0, edge1, value) {
    if (Math.abs(edge1 - edge0) < 1e-6) return value >= edge1 ? 1 : 0;
    const u = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return u * u * (3 - (2 * u));
  }

  function smoothstepExpr(valueExpr, edge0, edge1) {
    const span = Math.max(1e-6, edge1 - edge0);
    const edge0Expr = `(${formatNumber(edge0)})`;
    const spanExpr = `(${formatNumber(span)})`;
    const u = `max(0,min(1,(((${valueExpr})-${edge0Expr})/${spanExpr})))`;
    return `((${u})*(${u})*(3-(2*(${u}))))`;
  }

  function formatNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    return num.toFixed(6).replace(/\.?0+$/, "");
  }

  function cubicHermite(u, y0, y1, tangent0, tangent1) {
    const uu = u * u;
    const uuu = uu * u;
    const h00 = (2 * uuu) - (3 * uu) + 1;
    const h10 = uuu - (2 * uu) + u;
    const h01 = (-2 * uuu) + (3 * uu);
    const h11 = uuu - uu;
    return (h00 * y0) + (h10 * tangent0) + (h01 * y1) + (h11 * tangent1);
  }

  function cubicHermiteExpr(localExpr, y0, y1, tangent0, tangent1) {
    const u = `(${localExpr})`;
    const uu = `(${u}*${u})`;
    const uuu = `(${uu}*${u})`;
    const h00 = `((2*${uuu})-(3*${uu})+1)`;
    const h10 = `(${uuu}-(2*${uu})+${u})`;
    const h01 = `((-2*${uuu})+(3*${uu}))`;
    const h11 = `(${uuu}-${uu})`;
    return `(${h00}*${formatNumber(y0)}+${h10}*${formatNumber(tangent0)}+${h01}*${formatNumber(y1)}+${h11}*${formatNumber(tangent1)})`;
  }

  function getProfile(options = {}) {
    return options.easingPreset === "gentle" || options.reducedMotion ? GENTLE_PROFILE : FOCUS_PROFILE;
  }

  function findSegment(progress, profile) {
    for (let i = 0; i < profile.length - 1; i += 1) {
      if (progress <= profile[i + 1].t + 1e-6) return i;
    }
    return profile.length - 2;
  }

  function evaluateProfile(progress, profile) {
    const p = clamp(progress, 0, 1);
    const index = findSegment(p, profile);
    const start = profile[index];
    const end = profile[index + 1];
    const span = Math.max(1e-6, end.t - start.t);
    const local = clamp((p - start.t) / span, 0, 1);
    return clamp(
      cubicHermite(local, start.value, end.value, start.slope * span, end.slope * span),
      0,
      1
    );
  }

  function evaluateProfileExpr(progressExpr, profile) {
    const p = `max(0,min(1,${progressExpr}))`;
    const segments = [];
    for (let i = 0; i < profile.length - 1; i += 1) {
      const start = profile[i];
      const end = profile[i + 1];
      const span = Math.max(1e-6, end.t - start.t);
      const local = `max(0,min(1,(${p}-${formatNumber(start.t)})/${formatNumber(span)}))`;
      segments.push({
        limit: end.t,
        expr: cubicHermiteExpr(local, start.value, end.value, start.slope * span, end.slope * span)
      });
    }
    let expr = segments[segments.length - 1]?.expr || "0";
    for (let i = segments.length - 2; i >= 0; i -= 1) {
      expr = `if(lt(${p},${formatNumber(segments[i].limit)}),${segments[i].expr},${expr})`;
    }
    return `max(0,min(1,${expr}))`;
  }

  function evaluateProfileSmooth(progress, profile) {
    const p = clamp(progress, 0, 1);
    const index = findSegment(p, profile);
    const start = profile[index];
    const end = profile[index + 1];
    const span = Math.max(1e-6, end.t - start.t);
    const local = clamp((p - start.t) / span, 0, 1);
    const easedLocal = smoothstep(0, 1, local);
    return clamp(lerp(start.value, end.value, easedLocal), 0, 1);
  }

  function evaluateProfileSmoothExpr(progressExpr, profile) {
    const p = `max(0,min(1,${progressExpr}))`;
    const segments = [];
    for (let i = 0; i < profile.length - 1; i += 1) {
      const start = profile[i];
      const end = profile[i + 1];
      const span = Math.max(1e-6, end.t - start.t);
      const local = `(((${p})-${formatNumber(start.t)})/(${formatNumber(span)}))`;
      const easedLocal = smoothstepExpr(local, 0, 1);
      segments.push({
        limit: end.t,
        expr: `(${formatNumber(start.value)}+(${formatNumber(end.value - start.value)}*(${easedLocal})))`
      });
    }
    let expr = segments[segments.length - 1]?.expr || "0";
    for (let i = segments.length - 2; i >= 0; i -= 1) {
      expr = `if(lt(${p},${formatNumber(segments[i].limit)}),${segments[i].expr},${expr})`;
    }
    return `max(0,min(1,${expr}))`;
  }

  function focusPullEase(progress, options = {}) {
    const p = clamp(progress, 0, 1);
    const intro = smoothstep(0, INTRO_END, p);
    const burst = smoothstep(INTRO_END, BURST_END, p);
    const settle = smoothstep(BURST_END, 1, p);
    if (options.easingPreset === "gentle" || options.reducedMotion) {
      return clamp((0.08 * intro) + (0.76 * burst) + (0.16 * settle), 0, 1);
    }
    return clamp((0.06 * intro) + (0.84 * burst) + (0.10 * settle), 0, 1);
  }

  function focusPullEaseExpr(progressExpr, options = {}) {
    // Keep the FFmpeg filter graph compact here. The previous fully-inlined
    // smoothstep chain became large enough to break pad/overlay expression parsing.
    const p = `st(0,max(0,min(1,${progressExpr})))`;
    const introLocal = `st(1,max(0,min(1,((ld(0)-${formatNumber(0)})/${formatNumber(INTRO_END)}))))`;
    const burstLocal = `st(2,max(0,min(1,((ld(0)-${formatNumber(INTRO_END)})/${formatNumber(BURST_END - INTRO_END)}))))`;
    const settleLocal = `st(3,max(0,min(1,((ld(0)-${formatNumber(BURST_END)})/${formatNumber(1 - BURST_END)}))))`;
    const intro = `((${introLocal})*ld(1)*(3-(2*ld(1))))`;
    const burst = `((${burstLocal})*ld(2)*(3-(2*ld(2))))`;
    const settle = `((${settleLocal})*ld(3)*(3-(2*ld(3))))`;
    if (options.easingPreset === "gentle" || options.reducedMotion) {
      return `max(0,min(1,(((${p})*0)+(0.08*(${intro}))+(0.76*(${burst}))+(0.16*(${settle})))))`;
    }
    return `max(0,min(1,(((${p})*0)+(0.06*(${intro}))+(0.84*(${burst}))+(0.1*(${settle})))))`;
  }

  function slideBlurEase(progress, options = {}) {
    return focusPullEase(progress, options);
  }

  function slideBlurEaseExpr(progressExpr, options = {}) {
    return focusPullEaseExpr(progressExpr, options);
  }

  function directionVector(direction) {
    const value = String(direction || "").toLowerCase();
    if (value === "left") return { x: -1, y: 0 };
    if (value === "right") return { x: 1, y: 0 };
    if (value === "up") return { x: 0, y: -1 };
    if (value === "down") return { x: 0, y: 1 };
    return { x: -1, y: 0 };
  }

  function effectAmount(progress, options = {}) {
    const eased = focusPullEase(progress, options);
    return options.mode === "in" ? (1 - eased) : eased;
  }

  function effectAmountExpr(progressExpr, options = {}) {
    const eased = focusPullEaseExpr(progressExpr, options);
    return options.mode === "in" ? `(1-(${eased}))` : `(${eased})`;
  }

  function computeFocusPullTransform(progress, anchorX, anchorY, strength, frameW, frameH, options = {}) {
    const width = Math.max(1, Number(frameW || 1));
    const height = Math.max(1, Number(frameH || 1));
    const x = clamp(Number(anchorX ?? 0.5), 0, 1);
    const y = clamp(Number(anchorY ?? 0.5), 0, 1);
    const power = clamp(Number(strength ?? 1), 0.2, 1.6);
    const amount = effectAmount(progress, options);
    const isIntro = options.mode === "in";
    const scaleX = isIntro
      ? clamp(1 + (0.42 * power * amount), 1, 1.9)
      : clamp(1 - (0.76 * power * amount), 0.12, 1);
    const squeeze = isIntro
      ? 1 - (0.035 * power * amount)
      : 1 - (0.08 * power * amount);
    const scaleY = isIntro
      ? clamp(scaleX * squeeze, 1, 1.9)
      : clamp(scaleX * squeeze, 0.12, 1);
    const maxRotationDeg = options.reducedMotion ? 24 : 45;
    const rotationDeg = (isIntro ? 1 : -1) * maxRotationDeg * amount;
    const angleRad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const anchorPx = width * x;
    const anchorPy = height * y;
    const matrixA = cos * scaleX;
    const matrixB = sin * scaleX;
    const matrixC = -sin * scaleY;
    const matrixD = cos * scaleY;
    const translateX = anchorPx - (matrixA * anchorPx) - (matrixC * anchorPy);
    const translateY = anchorPy - (matrixB * anchorPx) - (matrixD * anchorPy);
    const blurPx = Math.max(
      0,
      (options.reducedMotion ? (isIntro ? 6 : 8) : (isIntro ? 13 : 16)) * power * Math.pow(amount, isIntro ? 1.02 : 1.15)
    );
    const opacity = clamp(1 - Math.pow(amount, 0.86), 0, 1);
    return {
      progress: clamp(Number(progress || 0), 0, 1),
      effectAmount: amount,
      scaleX,
      scaleY,
      rotationDeg,
      angleRad,
      matrixA,
      matrixB,
      matrixC,
      matrixD,
      translateX,
      translateY,
      blurPx,
      opacity,
      anchorX: x,
      anchorY: y
    };
  }

  function computeFocusPullTransformExpr(progressExpr, anchorX, anchorY, strengthExpr, frameWExpr, frameHExpr, options = {}) {
    const x = clamp(Number(anchorX ?? 0.5), 0, 1);
    const y = clamp(Number(anchorY ?? 0.5), 0, 1);
    const safeStrength = `max(0.2,min(1.6,${strengthExpr || "1"}))`;
    const amountExpr = effectAmountExpr(progressExpr, options);
    const isIntro = options.mode === "in";
    const scaleXExpr = isIntro
      ? `max(1,min(1.9,(1+(0.42*${safeStrength}*(${amountExpr})))))`
      : `max(0.12,min(1,(1-(0.76*${safeStrength}*(${amountExpr})))))`;
    const squeezeExpr = isIntro
      ? `(1-(0.035*${safeStrength}*(${amountExpr})))`
      : `(1-(0.08*${safeStrength}*(${amountExpr})))`;
    const scaleYExpr = isIntro
      ? `max(1,min(1.9,((${scaleXExpr})*${squeezeExpr})))`
      : `max(0.12,min(1,((${scaleXExpr})*${squeezeExpr})))`;
    const rotationDegExpr = `(${formatNumber(isIntro ? 1 : -1)}*${formatNumber(options.reducedMotion ? 24 : 45)}*(${amountExpr}))`;
    const angleRadExpr = `((${rotationDegExpr})*${formatNumber(Math.PI / 180)})`;
    const cosExpr = `cos(${angleRadExpr})`;
    const sinExpr = `sin(${angleRadExpr})`;
    const anchorPxExpr = `((${frameWExpr})*${formatNumber(x)})`;
    const anchorPyExpr = `((${frameHExpr})*${formatNumber(y)})`;
    const matrixAExpr = `((${cosExpr})*(${scaleXExpr}))`;
    const matrixBExpr = `((${sinExpr})*(${scaleXExpr}))`;
    const matrixCExpr = `((-1*(${sinExpr}))*(${scaleYExpr}))`;
    const matrixDExpr = `((${cosExpr})*(${scaleYExpr}))`;
    const translateXExpr = `(${anchorPxExpr}-((${matrixAExpr})*(${anchorPxExpr}))-((${matrixCExpr})*(${anchorPyExpr})))`;
    const translateYExpr = `(${anchorPyExpr}-((${matrixBExpr})*(${anchorPxExpr}))-((${matrixDExpr})*(${anchorPyExpr})))`;
    const blurExpr = `max(0,${formatNumber(options.reducedMotion ? (isIntro ? 6 : 8) : (isIntro ? 13 : 16))}*${safeStrength}*pow(${amountExpr},${formatNumber(isIntro ? 1.02 : 1.15)}))`;
    const opacityExpr = `max(0,min(1,(1-pow(${amountExpr},0.86))))`;
    return {
      effectAmountExpr: amountExpr,
      scaleXExpr,
      scaleYExpr,
      rotationDegExpr,
      angleRadExpr,
      matrixAExpr,
      matrixBExpr,
      matrixCExpr,
      matrixDExpr,
      translateXExpr,
      translateYExpr,
      blurExpr,
      opacityExpr
    };
  }

  function computeDirectionalBlurState(progress, direction, strength, frameW, frameH, options = {}) {
    const width = Math.max(1, Number(frameW || 1));
    const height = Math.max(1, Number(frameH || 1));
    const vector = directionVector(direction);
    const power = clamp(Number(strength ?? 1), 0.2, 1.6);
    const eased = slideBlurEase(progress, options);
    const amount = options.mode === "in" ? (1 - eased) : eased;
    const travel = (Math.abs(vector.x) > 0 ? width : height) * (0.16 + (0.28 * power));
    const translateX = vector.x * travel * amount;
    const translateY = vector.y * travel * amount;
    const blurPx = Math.max(0, (options.reducedMotion ? 7 : 18) * power * Math.pow(amount, 1.05));
    const opacity = clamp(1 - Math.pow(amount, 0.92), 0, 1);
    return {
      progress: clamp(Number(progress || 0), 0, 1),
      effectAmount: amount,
      translateX,
      translateY,
      blurPx,
      opacity,
      direction: String(direction || "left").toLowerCase()
    };
  }

  function computeDirectionalBlurStateExpr(progressExpr, direction, strengthExpr, frameWExpr, frameHExpr, options = {}) {
    const vector = directionVector(direction);
    const safeStrength = `max(0.2,min(1.6,${strengthExpr || "1"}))`;
    const eased = slideBlurEaseExpr(progressExpr, options);
    const amountExpr = options.mode === "in" ? `(1-(${eased}))` : `(${eased})`;
    const sizeExpr = Math.abs(vector.x) > 0 ? frameWExpr : frameHExpr;
    const travelExpr = `((${sizeExpr})*(${formatNumber(0.16)}+(${formatNumber(0.28)}*${safeStrength})))`;
    const translateXExpr = `(${formatNumber(vector.x)}*${travelExpr}*${amountExpr})`;
    const translateYExpr = `(${formatNumber(vector.y)}*${travelExpr}*${amountExpr})`;
    const blurExpr = `max(0,${formatNumber(options.reducedMotion ? 7 : 18)}*${safeStrength}*pow(${amountExpr},1.05))`;
    const opacityExpr = `max(0,min(1,(1-pow(${amountExpr},0.92))))`;
    return {
      effectAmountExpr: amountExpr,
      translateXExpr,
      translateYExpr,
      blurExpr,
      opacityExpr
    };
  }

  function glitterPulse(progress, center, width) {
    const rise = smoothstep(center - width, center, progress);
    const fall = 1 - smoothstep(center, center + width, progress);
    return clamp(rise * fall * 1.1, 0, 1);
  }

  function glitterPulseExpr(progressExpr, center, width) {
    const rise = smoothstepExpr(progressExpr, center - width, center);
    const fall = `(1-(${smoothstepExpr(progressExpr, center, center + width)}))`;
    return `max(0,min(1,(((${rise})*(${fall}))*1.1)))`;
  }

  function computeSunGlitterState(progress, strength, options = {}) {
    const p = clamp(progress, 0, 1);
    const reducedMotion = !!options.reducedMotion;
    const powerBase = clamp(Number(strength ?? 1), 0.2, 1.6);
    const power = reducedMotion ? Math.min(powerBase, 1.1) : powerBase;
    const pulseA = glitterPulse(p, 0.18, reducedMotion ? 0.095 : 0.078);
    const pulseB = glitterPulse(p, 0.43, reducedMotion ? 0.11 : 0.088);
    const flash = clamp((pulseA * 0.86) + (pulseB * 1.08), 0, 1.45);
    const warmth = clamp(
      smoothstep(0.04, 0.2, p) * (1 - smoothstep(0.56, 0.9, p)),
      0,
      1
    );
    const outroOpacity = clamp(1 - smoothstep(0.58, 0.98, p), 0, 1);
    const introOpacity = clamp(smoothstep(0.06, 0.54, p), 0, 1);
    const opacity = options.mode === "in" ? introOpacity : outroOpacity;
    const flashOpacity = clamp((((0.1 + (0.17 * power)) * flash) + (0.05 * warmth)) * opacity, 0, 1);
    const glowOpacity = clamp((((0.08 + (0.14 * power)) * flash) + (0.06 * warmth)) * opacity, 0, 1);
    const brightnessBoost = clamp((0.08 * warmth) + ((0.18 + (0.16 * power)) * flash), 0, 0.95);
    const saturationBoost = clamp((0.12 * warmth) + ((0.2 + (0.18 * power)) * flash), 0, 1.08);
    const contrastBoost = clamp((0.04 * warmth) + ((0.08 + (0.08 * power)) * flash), 0, 0.52);
    const sepiaAmount = clamp((0.08 * warmth) + ((0.14 + (0.14 * power)) * flash), 0, 0.82);
    return {
      progress: p,
      opacity,
      audioOpacity: opacity,
      videoOpacity: opacity,
      flashOpacity,
      glowOpacity,
      brightnessBoost,
      saturationBoost,
      contrastBoost,
      sepiaAmount,
      blurPx: Math.max(0, (reducedMotion ? 1.6 : 3.1) * power * flash),
      glowPx: Math.max(8, (reducedMotion ? 22 : 40) * (0.22 + glowOpacity)),
      pulseA,
      pulseB,
      flash,
      warmth
    };
  }

  function computeSunGlitterStateExpr(progressExpr, strengthExpr, options = {}) {
    const reducedMotion = !!options.reducedMotion;
    const safeStrength = `max(0.2,min(${formatNumber(reducedMotion ? 1.1 : 1.6)},${strengthExpr || "1"}))`;
    const pulseAExpr = glitterPulseExpr(progressExpr, 0.18, reducedMotion ? 0.095 : 0.078);
    const pulseBExpr = glitterPulseExpr(progressExpr, 0.43, reducedMotion ? 0.11 : 0.088);
    const flashExpr = `max(0,min(1.45,(((${pulseAExpr})*0.86)+ ((${pulseBExpr})*1.08))))`;
    const warmthExpr = `max(0,min(1,((${smoothstepExpr(progressExpr, 0.04, 0.2)})*(1-(${smoothstepExpr(progressExpr, 0.56, 0.9)})))))`;
    const outroOpacityExpr = `max(0,min(1,(1-(${smoothstepExpr(progressExpr, 0.58, 0.98)}))))`;
    const introOpacityExpr = `max(0,min(1,${smoothstepExpr(progressExpr, 0.06, 0.54)}))`;
    const opacityExpr = options.mode === "in" ? introOpacityExpr : outroOpacityExpr;
    const flashOpacityExpr = `max(0,min(1,(((${formatNumber(0.1)}+(0.17*${safeStrength}))*(${flashExpr})+(${formatNumber(0.05)}*(${warmthExpr})))*(${opacityExpr}))))`;
    const glowOpacityExpr = `max(0,min(1,(((${formatNumber(0.08)}+(0.14*${safeStrength}))*(${flashExpr})+(${formatNumber(0.06)}*(${warmthExpr})))*(${opacityExpr}))))`;
    const brightnessBoostExpr = `max(0,min(0.95,((${formatNumber(0.08)}*(${warmthExpr}))+(((${formatNumber(0.18)}+(0.16*${safeStrength})))*(${flashExpr})))))`;
    const saturationBoostExpr = `max(0,min(1.08,((${formatNumber(0.12)}*(${warmthExpr}))+(((${formatNumber(0.2)}+(0.18*${safeStrength})))*(${flashExpr})))))`;
    const contrastBoostExpr = `max(0,min(0.52,((${formatNumber(0.04)}*(${warmthExpr}))+(((${formatNumber(0.08)}+(0.08*${safeStrength})))*(${flashExpr})))))`;
    const sepiaAmountExpr = `max(0,min(0.82,((${formatNumber(0.08)}*(${warmthExpr}))+(((${formatNumber(0.14)}+(0.14*${safeStrength})))*(${flashExpr})))))`;
    const blurExpr = `max(0,${formatNumber(reducedMotion ? 1.6 : 3.1)}*${safeStrength}*(${flashExpr}))`;
    const glowPxExpr = `max(8,${formatNumber(reducedMotion ? 22 : 40)}*(0.22+(${glowOpacityExpr})))`;
    return {
      opacityExpr,
      audioOpacityExpr: opacityExpr,
      videoOpacityExpr: opacityExpr,
      flashOpacityExpr,
      glowOpacityExpr,
      brightnessBoostExpr,
      saturationBoostExpr,
      contrastBoostExpr,
      sepiaAmountExpr,
      blurExpr,
      glowPxExpr,
      pulseAExpr,
      pulseBExpr,
      flashExpr,
      warmthExpr
    };
  }

  function normalizeCyberMosaicOptions(raw = {}) {
    const reducedMotion = !!raw.reducedMotion;
    const normalized = {
      mode: String(raw.mode || "out").toLowerCase() === "in" ? "in" : "out",
      intensity: clamp(Number(raw.intensity ?? CYBER_DEFAULTS.intensity), 0.35, 1.6),
      tileDensity: clamp(Number(raw.tileDensity ?? CYBER_DEFAULTS.tileDensity), 0.2, 1),
      sizeVariance: clamp(Number(raw.sizeVariance ?? CYBER_DEFAULTS.sizeVariance), 0, 1),
      clusterCount: Math.round(clamp(Number(raw.clusterCount ?? CYBER_DEFAULTS.clusterCount), 2, 8)),
      clusterSpread: clamp(Number(raw.clusterSpread ?? CYBER_DEFAULTS.clusterSpread), 0.2, 1),
      jitterSpeed: clamp(Number(raw.jitterSpeed ?? CYBER_DEFAULTS.jitterSpeed), 0.4, 2.4),
      seed: Math.round(clamp(Number(raw.seed ?? CYBER_DEFAULTS.seed), 0, 999999)),
      edgeSoftness: clamp(Number(raw.edgeSoftness ?? CYBER_DEFAULTS.edgeSoftness), 0, 0.12),
      reducedMotion
    };
    if (!reducedMotion) return normalized;
    return {
      ...normalized,
      tileDensity: Math.min(normalized.tileDensity, 0.58),
      clusterCount: Math.min(normalized.clusterCount, 4),
      jitterSpeed: Math.min(normalized.jitterSpeed, 1.2),
      edgeSoftness: Math.max(normalized.edgeSoftness, 0.02)
    };
  }

  function cyberMosaicEase(progress, options = {}) {
    return evaluateProfileSmooth(progress, options.reducedMotion ? GENTLE_PROFILE : CYBER_PROFILE);
  }

  function cyberMosaicEaseExpr(progressExpr, options = {}) {
    return evaluateProfileSmoothExpr(progressExpr, options.reducedMotion ? GENTLE_PROFILE : CYBER_PROFILE);
  }

  function hashSeed(value) {
    let x = Math.round(Number(value || 0)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    return (x ^ (x >>> 16)) >>> 0;
  }

  function makeRng(seed) {
    let state = hashSeed(seed) || 0x9e3779b9;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sampleCenterBias(rng) {
    return ((rng() + rng() + rng()) / 3) - 0.5;
  }

  function buildCyberCacheKey(options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    return [
      cfg.intensity.toFixed(3),
      cfg.tileDensity.toFixed(3),
      cfg.sizeVariance.toFixed(3),
      cfg.clusterCount,
      cfg.clusterSpread.toFixed(3),
      cfg.jitterSpeed.toFixed(3),
      cfg.seed,
      cfg.edgeSoftness.toFixed(4),
      cfg.reducedMotion ? 1 : 0
    ].join("|");
  }

  function buildClusterCenters(options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    const rng = makeRng(cfg.seed + 101);
    const centers = [];
    for (let i = 0; i < cfg.clusterCount; i += 1) {
      let best = null;
      let bestScore = -Infinity;
      const tries = 6;
      for (let attempt = 0; attempt < tries; attempt += 1) {
        const candidate = {
          x: lerp(0.1, 0.9, rng()),
          y: lerp(0.1, 0.9, rng()),
          activation: rng()
        };
        let minDist = 1;
        for (let j = 0; j < centers.length; j += 1) {
          const dx = candidate.x - centers[j].x;
          const dy = candidate.y - centers[j].y;
          minDist = Math.min(minDist, Math.hypot(dx, dy));
        }
        const centerBias = 1 - Math.min(1, Math.hypot(candidate.x - 0.5, candidate.y - 0.5) / 0.72);
        const score = minDist + (cfg.clusterSpread * 0.22 * centerBias) + ((rng() - 0.5) * 0.03);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      centers.push(best || { x: 0.5, y: 0.5, activation: rng() });
    }
    return centers
      .sort((a, b) => a.activation - b.activation)
      .map((center, index) => ({ ...center, activationIndex: index }));
  }

  function buildCyberMosaicRectSet(options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    const cacheKey = buildCyberCacheKey(cfg);
    if (cyberRectCache.has(cacheKey)) return cyberRectCache.get(cacheKey);

    const rng = makeRng(cfg.seed + 707);
    const centers = buildClusterCenters(cfg);
    const jitterNorm = (cfg.jitterSpeed - 0.4) / 2;
    const totalRects = Math.max(9, Math.min(20, Math.round(8 + (cfg.tileDensity * 8) + (cfg.clusterCount * 1.15))));
    const countWeights = centers.map(() => 0.8 + rng());
    const countTotal = countWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    let assigned = 0;
    const rects = [];

    centers.forEach((center, centerIndex) => {
      const remainingCenters = centers.length - centerIndex;
      let rectCount = centerIndex === centers.length - 1
        ? Math.max(1, totalRects - assigned)
        : Math.max(1, Math.round((countWeights[centerIndex] / countTotal) * totalRects));
      const maxForCurrent = Math.max(1, totalRects - assigned - Math.max(0, remainingCenters - 1));
      rectCount = Math.max(1, Math.min(rectCount, maxForCurrent));
      assigned += rectCount;

      const clusterStart = clamp(0.04 + (center.activationIndex * (0.54 / Math.max(1, centers.length - 1))) + ((rng() - 0.5) * 0.07), 0.02, 0.72);
      const clusterWindow = clamp(lerp(0.24, 0.08, jitterNorm) * (0.82 + (rng() * 0.42)), 0.06, 0.3);
      const spreadBase = lerp(0.16, 0.42, cfg.clusterSpread);
      const spreadX = spreadBase * (0.8 + (rng() * 0.7));
      const spreadY = spreadBase * (0.7 + (rng() * 0.65));

      for (let i = 0; i < rectCount; i += 1) {
        const tierRoll = rng();
        const tier = tierRoll < (0.56 + ((1 - cfg.sizeVariance) * 0.12))
          ? "small"
          : (tierRoll < 0.88 ? "medium" : "large");
        const sizeBase = tier === "small"
          ? lerp(0.045, 0.082, rng())
          : (tier === "medium" ? lerp(0.082, 0.146, rng()) : lerp(0.14, 0.24, rng()));
        const varianceScale = lerp(1 - (0.24 * (1 - cfg.sizeVariance)), 1 + (0.4 * cfg.sizeVariance), rng());
        const aspect = tier === "large"
          ? lerp(0.84, 1.38, rng())
          : lerp(0.7, 1.6, rng());
        let width = clamp(sizeBase * varianceScale * aspect, 0.035, 0.34);
        let height = clamp(sizeBase * varianceScale / aspect, 0.03, 0.3);
        if (tier === "large") {
          width = Math.min(0.34, width * (0.96 + (cfg.sizeVariance * 0.18)));
          height = Math.min(0.28, height * (0.96 + (cfg.sizeVariance * 0.16)));
        }

        const nx = clamp(center.x + (sampleCenterBias(rng) * spreadX) + ((rng() - 0.5) * 0.05), 0.02, 0.98);
        const ny = clamp(center.y + (sampleCenterBias(rng) * spreadY) + ((rng() - 0.5) * 0.05), 0.02, 0.98);
        const x = clamp(nx - (width / 2), 0.01, 0.99 - width);
        const y = clamp(ny - (height / 2), 0.01, 0.99 - height);
        const revealAt = clamp(
          clusterStart + (rng() * clusterWindow) + ((i / Math.max(1, rectCount - 1)) * 0.028 * (0.6 + jitterNorm)),
          0.02,
          0.86
        );
        const revealSoftness = clamp(lerp(0.06, 0.02, jitterNorm) * (0.72 + (rng() * 0.55)), 0.014, 0.09);

        rects.push({
          x,
          y,
          w: width,
          h: height,
          revealAt,
          revealSoftness,
          clusterIndex: centerIndex,
          tier
        });
      }
    });

    rects.sort((a, b) => a.revealAt - b.revealAt);
    const frozen = Object.freeze(rects.map((rect) => Object.freeze(rect)));
    cyberRectCache.set(cacheKey, frozen);
    return frozen;
  }

  function getCyberEdgeSoftness(rect, options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    return Math.min(cfg.edgeSoftness, rect.w * 0.45, rect.h * 0.45);
  }

  function getCyberSettleStart(options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    return clamp(0.76 - ((cfg.intensity - 1) * 0.05), 0.68, 0.84);
  }

  function getCyberTileBoost(options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    return clamp(0.56 + (cfg.intensity * 0.32), 0.48, 1.08);
  }

  function evalRectEdgeMembership(xNorm, yNorm, rect, options = {}) {
    if (xNorm < rect.x || xNorm > rect.x + rect.w || yNorm < rect.y || yNorm > rect.y + rect.h) return 0;
    const edgeSoftness = getCyberEdgeSoftness(rect, options);
    if (edgeSoftness <= 1e-6) return 1;
    const left = (xNorm - rect.x) / edgeSoftness;
    const right = ((rect.x + rect.w) - xNorm) / edgeSoftness;
    const top = (yNorm - rect.y) / edgeSoftness;
    const bottom = ((rect.y + rect.h) - yNorm) / edgeSoftness;
    return clamp(Math.min(left, right, top, bottom), 0, 1);
  }

  function buildRectEdgeExpr(rect, options = {}) {
    const edgeSoftness = getCyberEdgeSoftness(rect, options);
    const nx = "(X/W)";
    const ny = "(Y/H)";
    if (edgeSoftness <= 1e-6) {
      return `(between(${nx},${formatNumber(rect.x)},${formatNumber(rect.x + rect.w)})*between(${ny},${formatNumber(rect.y)},${formatNumber(rect.y + rect.h)}))`;
    }
    const left = `((${nx}-${formatNumber(rect.x)})/${formatNumber(edgeSoftness)})`;
    const right = `((${formatNumber(rect.x + rect.w)}-${nx})/${formatNumber(edgeSoftness)})`;
    const top = `((${ny}-${formatNumber(rect.y)})/${formatNumber(edgeSoftness)})`;
    const bottom = `((${formatNumber(rect.y + rect.h)}-${ny})/${formatNumber(edgeSoftness)})`;
    return `max(0,min(1,min(min(${left},${right}),min(${top},${bottom}))))`;
  }

  function isPointInsideRect(xNorm, yNorm, rect) {
    return xNorm >= rect.x
      && xNorm <= (rect.x + rect.w)
      && yNorm >= rect.y
      && yNorm <= (rect.y + rect.h);
  }

  function buildRectMembershipExpr(rect) {
    return `(between((X/W),${formatNumber(rect.x)},${formatNumber(rect.x + rect.w)})*between((Y/H),${formatNumber(rect.y)},${formatNumber(rect.y + rect.h)}))`;
  }

  function maxExpr(list, fallback = "0") {
    if (!Array.isArray(list) || !list.length) return fallback;
    return list.reduce((acc, expr) => `max(${acc},${expr})`);
  }

  function computeCyberMosaicState(progress, options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    const eased = cyberMosaicEase(progress, cfg);
    const settle = smoothstep(getCyberSettleStart(cfg), 1, eased);
    const audioReveal = smoothstep(0.08, 0.92, eased);
    return {
      eased,
      settle,
      revealOpacity: clamp(audioReveal, 0, 1),
      opacity: cfg.mode === "in" ? clamp(audioReveal, 0, 1) : clamp(1 - audioReveal, 0, 1),
      mode: cfg.mode
    };
  }

  function computeCyberMosaicMaskValue(progress, xNorm, yNorm, options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    const rects = buildCyberMosaicRectSet(cfg);
    const eased = cyberMosaicEase(progress, cfg);
    const settle = smoothstep(getCyberSettleStart(cfg), 1, eased);
    let tileReveal = 0;
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      const localReveal = smoothstep(rect.revealAt - rect.revealSoftness, rect.revealAt + rect.revealSoftness, eased);
      if (localReveal <= 0.0001) continue;
      if (!isPointInsideRect(xNorm, yNorm, rect)) continue;
      tileReveal = Math.max(tileReveal, localReveal);
    }
    const reveal = clamp(Math.max(settle, tileReveal * getCyberTileBoost(cfg)), 0, 1);
    return cfg.mode === "in" ? reveal : (1 - reveal);
  }

  function computeCyberMosaicStateExpr(progressExpr, options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    const rects = buildCyberMosaicRectSet(cfg);
    const easedExpr = cyberMosaicEaseExpr(progressExpr, cfg);
    const rectExprs = rects.map((rect) => {
      const localReveal = smoothstepExpr(
        easedExpr,
        rect.revealAt - rect.revealSoftness,
        rect.revealAt + rect.revealSoftness
      );
      return `((${localReveal})*${buildRectMembershipExpr(rect)})`;
    });
    const tileRevealExpr = rectExprs.length
      ? `min(1,((${rectExprs.join("+")})*${formatNumber(getCyberTileBoost(cfg))}))`
      : "0";
    const settleExpr = smoothstepExpr(easedExpr, getCyberSettleStart(cfg), 1);
    const revealExpr = `max(${settleExpr},${tileRevealExpr})`;
    const audioRevealExpr = smoothstepExpr(easedExpr, 0.08, 0.92);
    const pixelOpacityExpr = cfg.mode === "in"
      ? `max(0,min(1,${revealExpr}))`
      : `max(0,min(1,(1-(${revealExpr}))))`;
    const opacityExpr = cfg.mode === "in"
      ? `max(0,min(1,${audioRevealExpr}))`
      : `max(0,min(1,(1-(${audioRevealExpr}))))`;
    return {
      easedExpr,
      tileRevealExpr,
      settleExpr,
      revealExpr,
      pixelOpacityExpr,
      opacityExpr
    };
  }

  function buildCyberMaskCacheKey(progress, frameW, frameH, options = {}) {
    const cfg = normalizeCyberMosaicOptions(options);
    const width = Math.max(96, Math.round(Math.min(480, Math.max(96, Number(frameW || 1)))));
    const height = Math.max(54, Math.round(width * (Math.max(1, Number(frameH || 1)) / Math.max(1, Number(frameW || 1)))));
    const frameBucket = Math.round(clamp(progress, 0, 1) * 72);
    return `${buildCyberCacheKey(cfg)}|${frameBucket}|${width}x${height}|${cfg.mode}`;
  }

  function createCanvas(width, height) {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    return null;
  }

  function pruneCyberMaskCache() {
    while (cyberMaskCache.size > CYBER_MASK_CACHE_LIMIT) {
      const firstKey = cyberMaskCache.keys().next().value;
      cyberMaskCache.delete(firstKey);
    }
  }

  function renderCyberMosaicMaskCanvas(progress, frameW, frameH, options = {}) {
    if (typeof document === "undefined") return null;
    const cacheKey = buildCyberMaskCacheKey(progress, frameW, frameH, options);
    const cached = cyberMaskCache.get(cacheKey);
    if (cached?.canvas) return cached.canvas;

    const width = Math.max(96, Math.round(Math.min(480, Math.max(96, Number(frameW || 1)))));
    const height = Math.max(54, Math.round(width * (Math.max(1, Number(frameH || 1)) / Math.max(1, Number(frameW || 1)))));
    const canvas = createCanvas(width, height);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    let cursor = 0;
    for (let y = 0; y < height; y += 1) {
      const py = (y + 0.5) / height;
      for (let x = 0; x < width; x += 1) {
        const px = (x + 0.5) / width;
        const alpha = Math.round(computeCyberMosaicMaskValue(progress, px, py, options) * 255);
        data[cursor] = 255;
        data[cursor + 1] = 255;
        data[cursor + 2] = 255;
        data[cursor + 3] = alpha;
        cursor += 4;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    cyberMaskCache.set(cacheKey, { canvas, dataUrl: "" });
    pruneCyberMaskCache();
    return canvas;
  }

  function renderCyberMosaicMaskDataUrl(progress, frameW, frameH, options = {}) {
    if (typeof document === "undefined") return "";
    const cacheKey = buildCyberMaskCacheKey(progress, frameW, frameH, options);
    const cached = cyberMaskCache.get(cacheKey);
    if (cached?.dataUrl) return cached.dataUrl;
    const canvas = cached?.canvas || renderCyberMosaicMaskCanvas(progress, frameW, frameH, options);
    if (!canvas || typeof canvas.toDataURL !== "function") return "";
    const dataUrl = canvas.toDataURL("image/png");
    cyberMaskCache.set(cacheKey, { canvas, dataUrl });
    pruneCyberMaskCache();
    return dataUrl;
  }

  return {
    INTRO_END,
    BURST_END,
    DEFAULT_EASING,
    CYBER_DEFAULTS,
    focusPullEase,
    focusPullEaseExpr,
    slideBlurEase,
    slideBlurEaseExpr,
    cyberMosaicEase,
    cyberMosaicEaseExpr,
    normalizeCyberMosaicOptions,
    buildCyberMosaicRectSet,
    computeCyberMosaicState,
    computeCyberMosaicMaskValue,
    computeCyberMosaicStateExpr,
    renderCyberMosaicMaskCanvas,
    renderCyberMosaicMaskDataUrl,
    computeFocusPullTransform,
    computeFocusPullTransformExpr,
    computeDirectionalBlurState,
    computeDirectionalBlurStateExpr,
    computeSunGlitterState,
    computeSunGlitterStateExpr
  };
});

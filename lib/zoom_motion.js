(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VideoSmithZoomMotion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const INTRO_END = 0.15;
  const BURST_END = 0.65;
  const DEFAULT_EASING = "fastFocusZoom";

  const DEFAULT_PROFILE = [
    { t: 0.0, value: 0.0, slope: 0.0 },
    { t: INTRO_END, value: 0.05, slope: 0.22 },
    { t: BURST_END, value: 0.88, slope: 0.24 },
    { t: 1.0, value: 1.0, slope: 0.0 }
  ];

  const REDUCED_PROFILE = [
    { t: 0.0, value: 0.0, slope: 0.0 },
    { t: INTRO_END, value: 0.08, slope: 0.18 },
    { t: BURST_END, value: 0.82, slope: 0.18 },
    { t: 1.0, value: 1.0, slope: 0.0 }
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + ((end - start) * amount);
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
    return options.reducedMotion ? REDUCED_PROFILE : DEFAULT_PROFILE;
  }

  function findSegment(progress, profile) {
    for (let i = 0; i < profile.length - 1; i += 1) {
      const next = profile[i + 1];
      if (progress <= next.t + 1e-6) return i;
    }
    return profile.length - 2;
  }

  function evaluateProfile(progress, profile) {
    const p = clamp(progress, 0, 1);
    const segmentIndex = findSegment(p, profile);
    const start = profile[segmentIndex];
    const end = profile[segmentIndex + 1];
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

  function fastFocusZoomEase(progress, options = {}) {
    return evaluateProfile(progress, getProfile(options));
  }

  function fastFocusZoomEaseExpr(progressExpr, options = {}) {
    return evaluateProfileExpr(progressExpr, getProfile(options));
  }

  function computeAnchorZoomTransform(progress, anchorX, anchorY, startScale, endScale, frameW, frameH, options = {}) {
    const width = Math.max(1, Number(frameW || 1));
    const height = Math.max(1, Number(frameH || 1));
    const x = clamp(Number(anchorX ?? 0.5), 0, 1);
    const y = clamp(Number(anchorY ?? 0.5), 0, 1);
    const baseScale = Math.max(0.001, Number(startScale || 1));
    const targetScale = Math.max(0.001, Number(endScale || baseScale));
    const rawProgress = clamp(Number(progress || 0), 0, 1);
    const easedProgress = fastFocusZoomEase(rawProgress, options);
    const motionScale = lerp(baseScale, targetScale, easedProgress);
    const strength = clamp(Number(options.strength ?? 1), 0, 1);
    const strengthBaseScale = Math.max(0.001, Number(options.strengthBaseScale ?? baseScale));
    const scale = lerp(strengthBaseScale, motionScale, strength);
    const anchorPx = width * x;
    const anchorPy = height * y;
    const translateX = anchorPx - (anchorPx * scale);
    const translateY = anchorPy - (anchorPy * scale);

    return {
      progress: rawProgress,
      easedProgress,
      strength,
      motionScale,
      scale,
      anchorX: x,
      anchorY: y,
      anchorPx,
      anchorPy,
      translateX,
      translateY
    };
  }

  function computeAnchorZoomTransformExpr(progressExpr, anchorX, anchorY, startScale, endScale, frameWExpr, frameHExpr, options = {}) {
    const start = Math.max(0.001, Number(startScale || 1));
    const end = Math.max(0.001, Number(endScale || start));
    const anchorXN = clamp(Number(anchorX ?? 0.5), 0, 1);
    const anchorYN = clamp(Number(anchorY ?? 0.5), 0, 1);
    const easedProgressExpr = fastFocusZoomEaseExpr(progressExpr, options);
    const motionScaleExpr = `(${formatNumber(start)}+((${formatNumber(end - start)})*(${easedProgressExpr})))`;
    const strengthExpr = `max(0,min(1,${options.strengthExpr || "1"}))`;
    const strengthBaseScaleExpr = options.strengthBaseScaleExpr || formatNumber(start);
    const scaleExpr = `((${strengthBaseScaleExpr})+(((${motionScaleExpr})-(${strengthBaseScaleExpr}))*${strengthExpr}))`;
    const anchorPxExpr = `((${frameWExpr})*${formatNumber(anchorXN)})`;
    const anchorPyExpr = `((${frameHExpr})*${formatNumber(anchorYN)})`;
    const translateXExpr = `(${anchorPxExpr}-((${anchorPxExpr})*(${scaleExpr})))`;
    const translateYExpr = `(${anchorPyExpr}-((${anchorPyExpr})*(${scaleExpr})))`;
    return {
      easedProgressExpr,
      motionScaleExpr,
      scaleExpr,
      translateXExpr,
      translateYExpr
    };
  }

  return {
    DEFAULT_EASING,
    INTRO_END,
    BURST_END,
    fastFocusZoomEase,
    fastFocusZoomEaseExpr,
    computeAnchorZoomTransform,
    computeAnchorZoomTransformExpr
  };
});

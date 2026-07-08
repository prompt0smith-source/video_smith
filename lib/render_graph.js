(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VideoSmithRenderGraph = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const EPSILON = 1e-6;
  const TIMELINE_TIME_STEP_SEC = 0.01;
  const GAP_EPSILON = TIMELINE_TIME_STEP_SEC;
  const SUPPORTED_TYPES = new Set([
    "cut",
    "fade",
    "cross",
    "sun_glitter_flash",
    "focus_pull_in",
    "cyber_mosaic_burst",
    "blur_slide_left",
    "blur_slide_right",
    "blur_slide_up",
    "blur_slide_down"
  ]);
  const SUPPORTED_SCOPES = new Set(["boundary", "intro", "outro"]);
  const OUTGOING_ONLY_TYPES = new Set([
    "sun_glitter_flash",
    "focus_pull_in",
    "cyber_mosaic_burst",
    "blur_slide_left",
    "blur_slide_right",
    "blur_slide_up",
    "blur_slide_down"
  ]);

  function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clipPlaybackIn(clip) {
    return Math.max(0, toNumber(clip?.in));
  }

  function clipPlaybackOut(clip) {
    const playbackIn = clipPlaybackIn(clip);
    return Math.max(playbackIn + EPSILON, toNumber(clip?.out, playbackIn + EPSILON));
  }

  function clipPlaybackDuration(clip) {
    return Math.max(EPSILON, clipPlaybackOut(clip) - clipPlaybackIn(clip));
  }

  function clipDuration(clip) {
    const raw = toNumber(clip?.timelineDuration, NaN);
    if (Number.isFinite(raw) && raw > EPSILON) return raw;
    return clipPlaybackDuration(clip);
  }

  function clipStart(clip) {
    return toNumber(clip?.start);
  }

  function clipEnd(clip) {
    return clipStart(clip) + clipDuration(clip);
  }

  function clipPlaybackRate(clip) {
    return clipPlaybackDuration(clip) / Math.max(EPSILON, clipDuration(clip));
  }

  function getFrameDuration(options = {}) {
    const fps = toNumber(options?.fps, 0);
    if (!(fps > EPSILON)) return 0;
    return 1 / fps;
  }

  function snapTimeToFrame(value, frameDuration, min, max) {
    const safe = clamp(toNumber(value, 0), min, max);
    if (!(frameDuration > EPSILON)) return safe;
    const snapped = Math.round(safe / frameDuration) * frameDuration;
    return clamp(snapped, min, max);
  }

  function mapClipTimelineOffsetToSourceTime(clip, timelineOffset) {
    const playbackIn = clipPlaybackIn(clip);
    const playbackOut = clipPlaybackOut(clip);
    const timelineDuration = clipDuration(clip);
    const clampedOffset = clamp(toNumber(timelineOffset, 0), 0, timelineDuration);
    if (clampedOffset >= timelineDuration - 1e-6) return playbackOut;
    return clamp(
      playbackIn + (clampedOffset * clipPlaybackRate(clip)),
      playbackIn,
      Math.max(playbackIn, playbackOut - 0.001)
    );
  }

  function transitionLabel(type) {
    if (type === "fade") return "Fade";
    if (type === "cross") return "Cross";
    if (type === "sun_glitter_flash") return "Warm Sun Glitter";
    if (type === "focus_pull_in") return "Focus Pull-In";
    if (type === "cyber_mosaic_burst") return "Cyber Mosaic Burst";
    if (type === "blur_slide_left") return "Blur Slide Left";
    if (type === "blur_slide_right") return "Blur Slide Right";
    if (type === "blur_slide_up") return "Blur Slide Up";
    if (type === "blur_slide_down") return "Blur Slide Down";
    return "Cut";
  }

  function normalizeTransitionScope(value, fallback = "boundary") {
    const scope = String(value || fallback || "boundary").toLowerCase();
    return SUPPORTED_SCOPES.has(scope) ? scope : "boundary";
  }

  function normalizeEasingPreset(value) {
    return String(value || "dynamic").toLowerCase() === "gentle" ? "gentle" : "dynamic";
  }

  function transitionSupportsScope(type, scope) {
    if (!SUPPORTED_TYPES.has(type)) return false;
    if (scope === "boundary") return true;
    if (type === "fade") return true;
    return OUTGOING_ONLY_TYPES.has(type);
  }

  function transitionIsOutgoingOnly(type) {
    return OUTGOING_ONLY_TYPES.has(String(type || "").toLowerCase());
  }

  function transitionDirection(type) {
    const value = String(type || "").toLowerCase();
    if (value === "blur_slide_left") return "left";
    if (value === "blur_slide_right") return "right";
    if (value === "blur_slide_up") return "up";
    if (value === "blur_slide_down") return "down";
    return "";
  }

  function defaultTransitionDuration(type) {
    if (type === "cut") return 0;
    if (type === "sun_glitter_flash") return 0.7;
    if (type === "focus_pull_in") return 0.65;
    if (type === "cyber_mosaic_burst") return 0.6;
    if (transitionIsOutgoingOnly(type)) return 0.55;
    return 0.5;
  }

  function serializeTransition(raw) {
    if (!raw) return null;
    return {
      type: raw.type,
      scope: raw.scope,
      label: raw.label,
      duration: raw.duration,
      strength: raw.strength,
      intensity: raw.intensity,
      tileDensity: raw.tileDensity,
      sizeVariance: raw.sizeVariance,
      clusterCount: raw.clusterCount,
      clusterSpread: raw.clusterSpread,
      jitterSpeed: raw.jitterSpeed,
      seed: raw.seed,
      edgeSoftness: raw.edgeSoftness,
      anchorX: raw.anchorX,
      anchorY: raw.anchorY,
      easingPreset: raw.easingPreset,
      direction: raw.direction,
      clipId: raw.clipId,
      section: raw.section,
      fromClipId: raw.fromClipId,
      toClipId: raw.toClipId
    };
  }

  function normalizeTransition(raw, options = {}) {
    if (!raw || typeof raw !== "object") return null;
    const type = String(raw.type || "").toLowerCase();
    const scope = normalizeTransitionScope(raw.scope, options.scope || "boundary");
    if (!transitionSupportsScope(type, scope)) return null;
    return {
      ...raw,
      type,
      scope,
      label: raw.label || transitionLabel(type),
      duration: type === "cut" ? 0 : Math.max(TIMELINE_TIME_STEP_SEC, toNumber(raw.duration, defaultTransitionDuration(type))),
      strength: clamp(toNumber(raw.strength, 1), 0.2, 1.6),
      intensity: clamp(toNumber(raw.intensity, 1), 0.35, 1.6),
      tileDensity: clamp(toNumber(raw.tileDensity, 0.68), 0.2, 1),
      sizeVariance: clamp(toNumber(raw.sizeVariance, 0.72), 0, 1),
      clusterCount: Math.round(clamp(toNumber(raw.clusterCount, 4), 2, 8)),
      clusterSpread: clamp(toNumber(raw.clusterSpread, 0.46), 0.2, 1),
      jitterSpeed: clamp(toNumber(raw.jitterSpeed, 1.2), 0.4, 2.4),
      seed: Math.round(clamp(toNumber(raw.seed, 17), 0, 999999)),
      edgeSoftness: clamp(toNumber(raw.edgeSoftness, 0.024), 0, 0.12),
      anchorX: clamp(toNumber(raw.anchorX, 0.5), 0, 1),
      anchorY: clamp(toNumber(raw.anchorY, 0.5), 0, 1),
      easingPreset: normalizeEasingPreset(raw.easingPreset || raw.easing),
      direction: transitionDirection(type)
    };
  }

  function makeClipEdgeTransitionKey(scope, clipId) {
    return `${normalizeTransitionScope(scope)}:${String(clipId || "")}`;
  }

  function parseTransitionStorageKey(rawKey) {
    const key = String(rawKey || "");
    const match = /^(intro|outro):(.+)$/.exec(key);
    if (match) {
      return {
        storageKey: key,
        kind: "edge",
        scope: match[1],
        clipId: match[2]
      };
    }
    const boundaryIdx = Number(key);
    if (Number.isFinite(boundaryIdx)) {
      return {
        storageKey: key,
        kind: "boundary",
        scope: "boundary",
        boundaryIdx
      };
    }
    return {
      storageKey: key,
      kind: "unknown",
      scope: normalizeTransitionScope(key)
    };
  }

  function sortVideoClips(project) {
    return [...(project?.videoClips || [])].sort((a, b) => {
      const sectionDelta = toNumber(a?.section, 1) - toNumber(b?.section, 1);
      if (sectionDelta !== 0) return sectionDelta;
      const startDelta = clipStart(a) - clipStart(b);
      if (Math.abs(startDelta) > EPSILON) return startDelta;
      const endDelta = clipEnd(a) - clipEnd(b);
      if (Math.abs(endDelta) > EPSILON) return endDelta;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  function buildSections(project) {
    const bySection = new Map();
    for (const clip of sortVideoClips(project)) {
      const section = Math.max(1, Math.round(toNumber(clip?.section, 1)));
      if (!bySection.has(section)) bySection.set(section, []);
      bySection.get(section).push(clip);
    }

    let boundaryIdx = 0;
    const sections = [];
    for (const section of [...bySection.keys()].sort((a, b) => a - b)) {
      const clips = bySection.get(section) || [];
      const boundaries = [];
      for (let i = 0; i < clips.length - 1; i++) {
        const fromClip = clips[i];
        const toClip = clips[i + 1];
        const overlapStart = clipStart(toClip);
        const overlapEnd = Math.min(clipEnd(fromClip), clipEnd(toClip));
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        const gapDuration = Math.max(0, clipStart(toClip) - clipEnd(fromClip));
        boundaries.push({
          idx: boundaryIdx++,
          section,
          orderInSection: i,
          time: clipStart(toClip),
          fromClip,
          toClip,
          fromClipId: fromClip?.id,
          toClipId: toClip?.id,
          gapDuration,
          overlapStart,
          overlapEnd,
          overlapDuration,
          transitionEligible: overlapDuration <= EPSILON && gapDuration <= GAP_EPSILON + EPSILON
        });
      }
      sections.push({ section, clips, boundaries });
    }
    return sections;
  }

  function ensureAnalysis(target) {
    if (target?.sections && target?.boundaries) return target;
    const project = target?.project || target || {};
    const sections = buildSections(project);
    const boundaries = sections.flatMap((section) => section.boundaries);
    const projectEnd = Math.max(
      toNumber(project?.duration, 0),
      ...sortVideoClips(project).map((clip) => clipEnd(clip)),
      0
    );
    return {
      project,
      sections,
      boundaries,
      projectEnd,
      hasVideo: (project?.videoClips || []).length > 0
    };
  }

  function matchBoundary(boundary, raw, keyInfo) {
    if (!boundary || !raw) return false;
    if (keyInfo?.kind === "boundary" && Number.isFinite(keyInfo.boundaryIdx) && keyInfo.boundaryIdx === boundary.idx) {
      return true;
    }
    if (raw.fromClipId && raw.toClipId) {
      const rawSection = Math.max(1, Math.round(toNumber(raw.section, boundary.section)));
      return rawSection === boundary.section
        && raw.fromClipId === boundary.fromClipId
        && raw.toClipId === boundary.toClipId;
    }
    return false;
  }

  function matchClipEdge(clip, scope, raw, keyInfo) {
    if (!clip || !raw) return false;
    if (keyInfo?.kind === "edge" && keyInfo.scope === scope && keyInfo.clipId === clip.id) return true;
    return raw.clipId === clip.id && normalizeTransitionScope(raw.scope, scope) === scope;
  }

  function findMatchingTransition(transitions, matcher, normalizeScope) {
    let chosen = null;
    for (const [rawKey, rawValue] of Object.entries(transitions || {})) {
      const normalized = normalizeTransition(rawValue, { scope: normalizeScope });
      if (!normalized) continue;
      const keyInfo = parseTransitionStorageKey(rawKey);
      if (!matcher(rawValue, keyInfo)) continue;
      chosen = {
        ...normalized,
        storageKey: keyInfo.storageKey
      };
      if (rawValue?.clipId || (rawValue?.fromClipId && rawValue?.toClipId)) break;
    }
    return chosen;
  }

  function resolveBoundaryTransition(target, boundary) {
    const analysis = ensureAnalysis(target);
    const transitions = analysis.project?.transitions || {};
    const chosen = findMatchingTransition(
      transitions,
      (rawValue, keyInfo) => matchBoundary(boundary, rawValue, keyInfo),
      "boundary"
    );
    if (!chosen || chosen.type === "cut") {
      return chosen
        ? {
            ...chosen,
            boundaryIdx: boundary.idx,
            section: boundary.section,
            fromClipId: boundary.fromClipId,
            toClipId: boundary.toClipId,
            windowStart: boundary.time,
            windowEnd: boundary.time
          }
        : null;
    }
    if (boundary.overlapDuration > EPSILON || !boundary.transitionEligible) return null;
    const duration = Math.max(
      TIMELINE_TIME_STEP_SEC,
      Math.min(chosen.duration, clipDuration(boundary.fromClip), clipDuration(boundary.toClip))
    );
    const halfDuration = duration / 2;
    return {
      ...chosen,
      duration,
      halfDuration,
      boundaryIdx: boundary.idx,
      section: boundary.section,
      fromClipId: boundary.fromClipId,
      toClipId: boundary.toClipId,
      preRoll: Math.max(0, Math.min(duration, clipDuration(boundary.toClip))),
      fadePreRoll: Math.max(0, Math.min(halfDuration, clipDuration(boundary.toClip))),
      windowStart: boundary.time - halfDuration,
      windowEnd: boundary.time + halfDuration,
      fadeMid: boundary.time
    };
  }

  function resolveClipEdgeTransition(target, clip, scope) {
    const normalizedScope = normalizeTransitionScope(scope);
    if (normalizedScope === "boundary") return null;
    const analysis = ensureAnalysis(target);
    const transitions = analysis.project?.transitions || {};
    const chosen = findMatchingTransition(
      transitions,
      (rawValue, keyInfo) => matchClipEdge(clip, normalizedScope, rawValue, keyInfo),
      normalizedScope
    );
    if (!chosen) return null;
    const otherScope = normalizedScope === "intro" ? "outro" : "intro";
    const opposite = findMatchingTransition(
      transitions,
      (rawValue, keyInfo) => matchClipEdge(clip, otherScope, rawValue, keyInfo),
      otherScope
    );
    const clipDur = clipDuration(clip);
    const oppositeDuration = opposite ? Math.max(0, opposite.duration || 0) : 0;
    const maxDuration = Math.max(TIMELINE_TIME_STEP_SEC, clipDur - Math.min(oppositeDuration, Math.max(0, clipDur - TIMELINE_TIME_STEP_SEC)));
    const duration = Math.max(TIMELINE_TIME_STEP_SEC, Math.min(chosen.duration, maxDuration));
    const start = clipStart(clip);
    const end = clipEnd(clip);
    const preRoll = Math.max(0, Math.min(duration, clipDuration(clip)));
    return {
      ...chosen,
      scope: normalizedScope,
      clipId: clip?.id,
      section: Math.max(1, Math.round(toNumber(clip?.section, 1))),
      duration,
      preRoll,
      windowStart: normalizedScope === "intro" ? start : Math.max(start, end - duration),
      windowEnd: normalizedScope === "intro" ? Math.min(end, start + duration) : end
    };
  }

  function buildBoundaryOutgoingState(boundary, transition, rawTime) {
    return {
      kind: "stacked_transition",
      transitionScope: "boundary",
      transitionType: transition.type,
      section: boundary.section,
      boundaryIdx: boundary.idx,
      start: transition.windowStart,
      end: transition.windowEnd,
      progress: clamp((rawTime - transition.windowStart) / Math.max(EPSILON, transition.duration), 0, 1),
      transition,
      baseClip: boundary.toClip,
      overlayClip: boundary.fromClip,
      baseLocalTime: Math.max(0, rawTime - transition.windowStart),
      overlayLocalTime: Math.max(0, rawTime - clipStart(boundary.fromClip))
    };
  }

  function buildClipEdgeState(clip, transition, rawTime) {
    const progress = clamp((rawTime - transition.windowStart) / Math.max(EPSILON, transition.duration), 0, 1);
    if (transition.type === "fade") {
      if (transition.scope === "intro") {
        return {
          kind: "fade_in_black",
          transitionType: "fade",
          transitionScope: "intro",
          section: Math.max(1, Math.round(toNumber(clip?.section, 1))),
          start: transition.windowStart,
          end: transition.windowEnd,
          progress,
          clip,
          clipLocalTime: Math.max(0, rawTime - transition.windowStart)
        };
      }
      return {
        kind: "fade_out_black",
        transitionType: "fade",
        transitionScope: "outro",
        section: Math.max(1, Math.round(toNumber(clip?.section, 1))),
        start: transition.windowStart,
        end: transition.windowEnd,
        progress,
        clip,
        clipLocalTime: Math.max(0, rawTime - clipStart(clip))
      };
    }
    return {
      kind: "single_transition",
      transitionScope: transition.scope,
      transitionType: transition.type,
      section: Math.max(1, Math.round(toNumber(clip?.section, 1))),
      start: transition.windowStart,
      end: transition.windowEnd,
      progress,
      transition,
      clip,
      clipLocalTime: transition.scope === "intro"
        ? Math.max(0, rawTime - transition.windowStart)
        : Math.max(0, rawTime - clipStart(clip))
    };
  }

  function resolveActiveClipEdgeTransition(analysis, clip, rawTime) {
    const intro = resolveClipEdgeTransition(analysis, clip, "intro");
    const outro = resolveClipEdgeTransition(analysis, clip, "outro");
    const active = [];
    if (intro && rawTime >= intro.windowStart - EPSILON && rawTime <= intro.windowEnd + EPSILON) active.push(intro);
    if (outro && rawTime >= outro.windowStart - EPSILON && rawTime <= outro.windowEnd + EPSILON) active.push(outro);
    if (!active.length) return null;
    if (active.length === 1) return active[0];
    const midpoint = clipStart(clip) + (clipDuration(clip) / 2);
    return rawTime <= midpoint ? intro : outro;
  }

  function resolveSectionState(sectionData, analysis, rawTime) {
    for (let i = sectionData.boundaries.length - 1; i >= 0; i--) {
      const boundary = sectionData.boundaries[i];
      if (boundary.overlapDuration <= EPSILON) continue;
      if (rawTime < boundary.overlapStart - EPSILON || rawTime > boundary.overlapEnd + EPSILON) continue;
      return {
        kind: "cross",
        reason: "overlap",
        section: sectionData.section,
        boundaryIdx: boundary.idx,
        start: boundary.overlapStart,
        end: boundary.overlapEnd,
        progress: clamp((rawTime - boundary.overlapStart) / Math.max(EPSILON, boundary.overlapDuration), 0, 1),
        baseClip: boundary.fromClip,
        overlayClip: boundary.toClip,
        baseLocalTime: Math.max(0, rawTime - clipStart(boundary.fromClip)),
        overlayLocalTime: Math.max(0, rawTime - clipStart(boundary.toClip))
      };
    }

    for (let i = sectionData.boundaries.length - 1; i >= 0; i--) {
      const boundary = sectionData.boundaries[i];
      const transition = resolveBoundaryTransition(analysis, boundary);
      if (!transition || transition.type === "cut") continue;
      if (rawTime < transition.windowStart - EPSILON || rawTime > transition.windowEnd + EPSILON) continue;

      if (transition.type === "cross") {
        return {
          kind: "cross",
          reason: "transition",
          transitionType: "cross",
          section: sectionData.section,
          boundaryIdx: boundary.idx,
          start: transition.windowStart,
          end: transition.windowEnd,
          progress: clamp((rawTime - transition.windowStart) / Math.max(EPSILON, transition.duration), 0, 1),
          baseClip: boundary.fromClip,
          overlayClip: boundary.toClip,
          baseLocalTime: Math.max(0, rawTime - clipStart(boundary.fromClip)),
          overlayLocalTime: Math.max(0, rawTime - transition.windowStart)
        };
      }

      return buildBoundaryOutgoingState(boundary, transition, rawTime);
    }

    for (let i = sectionData.boundaries.length - 1; i >= 0; i--) {
      const boundary = sectionData.boundaries[i];
      if (boundary.overlapDuration > EPSILON) continue;
      if (boundary.gapDuration <= EPSILON || boundary.gapDuration > GAP_EPSILON) continue;
      if (rawTime < clipEnd(boundary.fromClip) - EPSILON || rawTime > clipStart(boundary.toClip) + EPSILON) continue;
      return {
        kind: "single",
        section: sectionData.section,
        clip: boundary.fromClip,
        clipLocalTime: clipDuration(boundary.fromClip)
      };
    }

    for (const clip of sectionData.clips) {
      if (rawTime < clipStart(clip) - EPSILON || rawTime > clipEnd(clip) + EPSILON) continue;
      const edgeTransition = resolveActiveClipEdgeTransition(analysis, clip, rawTime);
      if (edgeTransition) return buildClipEdgeState(clip, edgeTransition, rawTime);
      return {
        kind: "single",
        section: sectionData.section,
        clip,
        clipLocalTime: Math.max(0, rawTime - clipStart(clip))
      };
    }

    return { kind: "empty", section: sectionData.section };
  }

  function resolveVideoStateAtTime(target, rawTime) {
    const analysis = ensureAnalysis(target);
    const time = Math.max(0, toNumber(rawTime, 0));
    for (const sectionData of analysis.sections) {
      const state = resolveSectionState(sectionData, analysis, time);
      if (state.kind !== "empty") return state;
    }
    return {
      kind: "empty",
      hasVideo: analysis.hasVideo
    };
  }

  function resolveVideoLayersAtTime(target, rawTime) {
    const analysis = ensureAnalysis(target);
    const time = Math.max(0, toNumber(rawTime, 0));
    const layers = [];
    for (const sectionData of analysis.sections) {
      const state = resolveSectionState(sectionData, analysis, time);
      if (state.kind === "empty") continue;
      layers.push(state);
    }
    return layers.sort((a, b) => toNumber(a?.section, 1) - toNumber(b?.section, 1));
  }

  function uniqueSortedTimes(times, rangeStart, rangeEnd, options = {}) {
    const frameDuration = getFrameDuration(options);
    return [...new Set(
      times
        .map((value) => toNumber(value, NaN))
        .filter((value) => Number.isFinite(value))
        .map((value) => snapTimeToFrame(value, frameDuration, rangeStart, rangeEnd))
    )]
      .sort((a, b) => a - b)
      .filter((value, index, arr) => index === 0 || Math.abs(value - arr[index - 1]) > Math.max(EPSILON, frameDuration * 0.25));
  }

  function describeInterval(state, start, end) {
    const duration = Math.max(0, end - start);
    if (duration <= EPSILON) return null;

    if (state.kind === "empty") return { kind: "empty", start, end, duration };

    if (state.kind === "single") {
      return {
        kind: "single",
        start,
        end,
        duration,
        section: state.section,
        clip: state.clip,
        clipId: state.clip?.id,
        localStart: mapClipTimelineOffsetToSourceTime(state.clip, start - clipStart(state.clip)),
        localEnd: mapClipTimelineOffsetToSourceTime(state.clip, end - clipStart(state.clip))
      };
    }

    if (state.kind === "single_transition") {
      const fullDuration = Math.max(EPSILON, state.end - state.start);
      return {
        kind: "single_transition",
        transitionScope: state.transitionScope,
        transitionType: state.transitionType,
        transition: serializeTransition(state.transition),
        start,
        end,
        duration,
        section: state.section,
        clip: state.clip,
        clipId: state.clip?.id,
        localStart: state.transitionScope === "intro"
          ? mapClipTimelineOffsetToSourceTime(state.clip, start - state.start)
          : mapClipTimelineOffsetToSourceTime(state.clip, start - clipStart(state.clip)),
        localEnd: state.transitionScope === "intro"
          ? mapClipTimelineOffsetToSourceTime(state.clip, end - state.start)
          : mapClipTimelineOffsetToSourceTime(state.clip, end - clipStart(state.clip)),
        progressFrom: clamp((start - state.start) / fullDuration, 0, 1),
        progressTo: clamp((end - state.start) / fullDuration, 0, 1)
      };
    }

    if (state.kind === "stacked_transition") {
      const fullDuration = Math.max(EPSILON, state.end - state.start);
      return {
        kind: "stacked_transition",
        transitionScope: state.transitionScope,
        transitionType: state.transitionType,
        transition: serializeTransition(state.transition),
        start,
        end,
        duration,
        section: state.section,
        boundaryIdx: state.boundaryIdx,
        baseClip: state.baseClip,
        overlayClip: state.overlayClip,
        baseClipId: state.baseClip?.id,
        overlayClipId: state.overlayClip?.id,
        baseLocalStart: mapClipTimelineOffsetToSourceTime(state.baseClip, start - state.start),
        baseLocalEnd: mapClipTimelineOffsetToSourceTime(state.baseClip, end - state.start),
        overlayLocalStart: mapClipTimelineOffsetToSourceTime(state.overlayClip, start - clipStart(state.overlayClip)),
        overlayLocalEnd: mapClipTimelineOffsetToSourceTime(state.overlayClip, end - clipStart(state.overlayClip)),
        progressFrom: clamp((start - state.start) / fullDuration, 0, 1),
        progressTo: clamp((end - state.start) / fullDuration, 0, 1)
      };
    }

    if (state.kind === "cross") {
      const fullDuration = Math.max(EPSILON, state.end - state.start);
      return {
        kind: "cross",
        reason: state.reason,
        transitionType: state.transitionType || state.reason,
        start,
        end,
        duration,
        section: state.section,
        boundaryIdx: state.boundaryIdx,
        baseClip: state.baseClip,
        overlayClip: state.overlayClip,
        baseClipId: state.baseClip?.id,
        overlayClipId: state.overlayClip?.id,
        baseLocalStart: mapClipTimelineOffsetToSourceTime(state.baseClip, start - clipStart(state.baseClip)),
        baseLocalEnd: mapClipTimelineOffsetToSourceTime(state.baseClip, end - clipStart(state.baseClip)),
        overlayLocalStart: state.reason === "transition"
          ? mapClipTimelineOffsetToSourceTime(state.overlayClip, start - state.start)
          : mapClipTimelineOffsetToSourceTime(state.overlayClip, start - clipStart(state.overlayClip)),
        overlayLocalEnd: state.reason === "transition"
          ? mapClipTimelineOffsetToSourceTime(state.overlayClip, end - state.start)
          : mapClipTimelineOffsetToSourceTime(state.overlayClip, end - clipStart(state.overlayClip)),
        progressFrom: clamp((start - state.start) / fullDuration, 0, 1),
        progressTo: clamp((end - state.start) / fullDuration, 0, 1)
      };
    }

    if (state.kind === "fade_out_black" || state.kind === "fade_in_black") {
      const fullDuration = Math.max(EPSILON, state.end - state.start);
      return {
        kind: state.kind,
        transitionType: "fade",
        transitionScope: state.transitionScope || "boundary",
        start,
        end,
        duration,
        section: state.section,
        boundaryIdx: state.boundaryIdx,
        clip: state.clip,
        clipId: state.clip?.id,
        localStart: state.kind === "fade_in_black"
          ? mapClipTimelineOffsetToSourceTime(state.clip, start - state.start)
          : mapClipTimelineOffsetToSourceTime(state.clip, start - clipStart(state.clip)),
        localEnd: state.kind === "fade_in_black"
          ? mapClipTimelineOffsetToSourceTime(state.clip, end - state.start)
          : mapClipTimelineOffsetToSourceTime(state.clip, end - clipStart(state.clip)),
        progressFrom: clamp((start - state.start) / fullDuration, 0, 1),
        progressTo: clamp((end - state.start) / fullDuration, 0, 1)
      };
    }

    return null;
  }

  function intervalKey(interval) {
    if (!interval) return "";
    if (interval.kind === "single") return `single:${interval.clipId}:${interval.section}`;
    if (interval.kind === "single_transition") {
      return `single_transition:${interval.transitionScope}:${interval.transitionType}:${interval.clipId}:${interval.section}`;
    }
    if (interval.kind === "stacked_transition") {
      return `stacked_transition:${interval.transitionScope}:${interval.transitionType}:${interval.baseClipId}:${interval.overlayClipId}:${interval.section}:${interval.boundaryIdx}`;
    }
    if (interval.kind === "cross") {
      return `cross:${interval.reason}:${interval.baseClipId}:${interval.overlayClipId}:${interval.section}:${interval.boundaryIdx}`;
    }
    if (interval.kind === "fade_out_black" || interval.kind === "fade_in_black") {
      return `${interval.kind}:${interval.transitionScope || "boundary"}:${interval.clipId}:${interval.section}:${interval.boundaryIdx || ""}`;
    }
    return interval.kind;
  }

  function canMergeIntervals(prev, next) {
    if (!prev || !next) return false;
    if (intervalKey(prev) !== intervalKey(next)) return false;
    if (Math.abs(prev.end - next.start) > EPSILON) return false;
    if (prev.kind === "empty") return true;
    if (prev.kind === "single") return Math.abs(prev.localEnd - next.localStart) <= 0.02;
    if (prev.kind === "single_transition") {
      return Math.abs(prev.localEnd - next.localStart) <= 0.02
        && Math.abs(prev.progressTo - next.progressFrom) <= 0.02;
    }
    if (prev.kind === "stacked_transition" || prev.kind === "cross") {
      return Math.abs(prev.baseLocalEnd - next.baseLocalStart) <= 0.02
        && Math.abs(prev.overlayLocalEnd - next.overlayLocalStart) <= 0.02
        && Math.abs(prev.progressTo - next.progressFrom) <= 0.02;
    }
    if (prev.kind === "fade_out_black" || prev.kind === "fade_in_black") {
      return Math.abs(prev.localEnd - next.localStart) <= 0.02
        && Math.abs(prev.progressTo - next.progressFrom) <= 0.02;
    }
    return false;
  }

  function mergeIntervals(prev, next) {
    prev.end = next.end;
    prev.duration = prev.end - prev.start;
    if (prev.kind === "single") {
      prev.localEnd = next.localEnd;
      return prev;
    }
    if (prev.kind === "single_transition") {
      prev.localEnd = next.localEnd;
      prev.progressTo = next.progressTo;
      return prev;
    }
    if (prev.kind === "stacked_transition" || prev.kind === "cross") {
      prev.baseLocalEnd = next.baseLocalEnd;
      prev.overlayLocalEnd = next.overlayLocalEnd;
      prev.progressTo = next.progressTo;
      return prev;
    }
    if (prev.kind === "fade_out_black" || prev.kind === "fade_in_black") {
      prev.localEnd = next.localEnd;
      prev.progressTo = next.progressTo;
      return prev;
    }
    return prev;
  }

  function collectVisibleIntervals(target, rangeStart = 0, rangeEnd = null, options = {}) {
    const analysis = ensureAnalysis(target);
    const start = Math.max(0, toNumber(rangeStart, 0));
    const end = Math.max(start, rangeEnd == null ? analysis.projectEnd : toNumber(rangeEnd, analysis.projectEnd));
    const points = [start, end];
    const frameDuration = getFrameDuration(options);

    for (const sectionData of analysis.sections) {
      for (const clip of sectionData.clips) {
        points.push(clipStart(clip), clipEnd(clip));
        const intro = resolveClipEdgeTransition(analysis, clip, "intro");
        const outro = resolveClipEdgeTransition(analysis, clip, "outro");
        if (intro) points.push(intro.windowStart, intro.windowEnd);
        if (outro) points.push(outro.windowStart, outro.windowEnd);
      }
      for (const boundary of sectionData.boundaries) {
        points.push(boundary.time);
        if (boundary.overlapDuration > EPSILON) points.push(boundary.overlapStart, boundary.overlapEnd);
        const transition = resolveBoundaryTransition(analysis, boundary);
        if (!transition || transition.type === "cut") continue;
        points.push(transition.windowStart, transition.windowEnd);
        if (transition.type === "fade") points.push(transition.fadeMid);
      }
    }

    const sortedTimes = uniqueSortedTimes(points, start, end, options);
    const intervals = [];
    let merged = null;
    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const intervalStart = sortedTimes[i];
      const intervalEnd = sortedTimes[i + 1];
      if (intervalEnd - intervalStart <= Math.max(EPSILON, frameDuration * 0.25)) continue;
      const midpoint = intervalStart + ((intervalEnd - intervalStart) / 2);
      const state = resolveVideoStateAtTime(analysis, midpoint);
      const described = describeInterval(state, intervalStart, intervalEnd);
      if (!described) continue;
      if (canMergeIntervals(merged, described)) {
        merged = mergeIntervals(merged, described);
        continue;
      }
      if (merged) intervals.push(merged);
      merged = described;
    }
    if (merged) intervals.push(merged);
    return intervals;
  }

  return {
    EPSILON,
    GAP_EPSILON,
    clamp,
    clipDuration,
    clipEnd,
    clipStart,
    normalizeTransition,
    normalizeTransitionScope,
    normalizeEasingPreset,
    transitionSupportsScope,
    transitionIsOutgoingOnly,
    makeClipEdgeTransitionKey,
    parseTransitionStorageKey,
    analyzeProject: ensureAnalysis,
    resolveBoundaryTransition,
    resolveClipEdgeTransition,
    resolveVideoStateAtTime,
    resolveVideoLayersAtTime,
    collectVisibleIntervals
  };
});

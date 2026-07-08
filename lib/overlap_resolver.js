(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VideoSmithOverlapResolver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const EPSILON = 1e-6;
  const TIMELINE_TIME_STEP_SEC = 0.01;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clipDuration(clip) {
    return Math.max(0, toNumber(clip?.out) - toNumber(clip?.in));
  }

  function clipEnd(clip) {
    return toNumber(clip?.start) + clipDuration(clip);
  }

  function sortSections(project) {
    const bySection = new Map();
    for (const clip of (project?.videoClips || [])) {
      const section = Math.max(1, Math.round(toNumber(clip?.section, 1)));
      if (!bySection.has(section)) bySection.set(section, []);
      bySection.get(section).push(clip);
    }
    return [...bySection.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([section, clips]) => ({
        section,
        clips: [...clips].sort((a, b) => {
          const startDelta = toNumber(a?.start) - toNumber(b?.start);
          if (Math.abs(startDelta) > EPSILON) return startDelta;
          return String(a?.id || "").localeCompare(String(b?.id || ""));
        })
      }));
  }

  function normalizeTransition(raw) {
    if (!raw || typeof raw !== "object") return null;
    const type = String(raw.type || "").toLowerCase();
    if (!["cut", "fade", "cross"].includes(type)) return null;
    return {
      ...raw,
      type,
      duration: type === "cut" ? 0 : Math.max(TIMELINE_TIME_STEP_SEC, toNumber(raw.duration, 0.5))
    };
  }

  function resolveTransition(project, boundary, idx) {
    const transitions = project?.transitions || {};
    const direct = normalizeTransition(transitions[idx]);
    if (!direct) return null;
    if (direct.type === "cut") return direct;
    const maxDuration = Math.max(TIMELINE_TIME_STEP_SEC, Math.min(direct.duration, clipDuration(boundary.a), clipDuration(boundary.b)));
    return {
      ...direct,
      duration: maxDuration
    };
  }

  function buildBoundaries(project, sectionData) {
    const boundaries = [];
    for (let i = 0; i < sectionData.clips.length - 1; i++) {
      const a = sectionData.clips[i];
      const b = sectionData.clips[i + 1];
      const overlapStart = Math.max(toNumber(a?.start), toNumber(b?.start));
      const overlapEnd = Math.min(clipEnd(a), clipEnd(b));
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      boundaries.push({
        idx: i,
        a,
        b,
        overlapStart,
        overlapEnd,
        overlapDuration,
        transition: resolveTransition(project, { a, b }, i)
      });
    }
    return boundaries;
  }

  function resolve(project, timelineTime) {
    const t = Math.max(0, toNumber(timelineTime, 0));
    for (const sectionData of sortSections(project)) {
      const boundaries = buildBoundaries(project, sectionData);
      for (const boundary of boundaries) {
        if (boundary.overlapDuration > EPSILON && t >= boundary.overlapStart - EPSILON && t <= boundary.overlapEnd + EPSILON) {
          const progress = clamp((t - boundary.overlapStart) / Math.max(boundary.overlapDuration, EPSILON), 0, 1);
          return Object.freeze({
            kind: "overlap",
            baseClip: boundary.a,
            overlayClip: boundary.b,
            baseLocalTime: toNumber(boundary.a?.in) + (t - toNumber(boundary.a?.start)),
            overlayLocalTime: toNumber(boundary.b?.in) + (t - toNumber(boundary.b?.start)),
            baseOpacity: 1 - progress,
            overlayOpacity: progress,
            baseVolume: 1 - progress,
            overlayVolume: progress,
            blackOpacity: 0,
            section: sectionData.section,
            start: boundary.overlapStart,
            end: boundary.overlapEnd,
            progress
          });
        }
        if (!boundary.transition || boundary.overlapDuration > EPSILON || boundary.transition.type === "cut") continue;
        const start = toNumber(boundary.b?.start) - boundary.transition.duration;
        const end = toNumber(boundary.b?.start);
        if (t < start - EPSILON || t > end + EPSILON) continue;
        const progress = clamp((t - start) / Math.max(boundary.transition.duration, EPSILON), 0, 1);
        if (boundary.transition.type === "cross") {
          return Object.freeze({
            kind: "transition_cross",
            baseClip: boundary.a,
            overlayClip: boundary.b,
            baseLocalTime: toNumber(boundary.a?.in) + (t - toNumber(boundary.a?.start)),
            overlayLocalTime: toNumber(boundary.b?.in) + (t - start),
            baseOpacity: 1 - progress,
            overlayOpacity: progress,
            baseVolume: 1 - progress,
            overlayVolume: progress,
            blackOpacity: 0,
            section: sectionData.section,
            start,
            end,
            progress
          });
        }
        if (t <= start + (boundary.transition.duration / 2)) {
          const localProgress = clamp((t - start) / Math.max(boundary.transition.duration / 2, EPSILON), 0, 1);
          return Object.freeze({
            kind: "transition_fade",
            baseClip: boundary.a,
            overlayClip: null,
            baseLocalTime: toNumber(boundary.a?.in) + (t - toNumber(boundary.a?.start)),
            overlayLocalTime: 0,
            baseOpacity: 1 - localProgress,
            overlayOpacity: 0,
            baseVolume: 1 - localProgress,
            overlayVolume: 0,
            blackOpacity: localProgress,
            section: sectionData.section,
            start,
            end,
            progress: localProgress
          });
        }
        const fadeInStart = start + (boundary.transition.duration / 2);
        const localProgress = clamp((t - fadeInStart) / Math.max(boundary.transition.duration / 2, EPSILON), 0, 1);
        return Object.freeze({
          kind: "transition_fade",
          baseClip: null,
          overlayClip: boundary.b,
          baseLocalTime: 0,
          overlayLocalTime: toNumber(boundary.b?.in) + (t - fadeInStart),
          baseOpacity: 0,
          overlayOpacity: localProgress,
          baseVolume: 0,
          overlayVolume: localProgress,
          blackOpacity: 1 - localProgress,
          section: sectionData.section,
          start,
          end,
          progress: localProgress
        });
      }

      for (const clip of sectionData.clips) {
        const clipStart = toNumber(clip?.start);
        const end = clipEnd(clip);
        if (t < clipStart - EPSILON || t > end + EPSILON) continue;
        return Object.freeze({
          kind: "single",
          baseClip: clip,
          overlayClip: null,
          baseLocalTime: toNumber(clip?.in) + (t - clipStart),
          overlayLocalTime: 0,
          baseOpacity: 1,
          overlayOpacity: 0,
          baseVolume: 1,
          overlayVolume: 0,
          blackOpacity: 0,
          section: sectionData.section,
          start: clipStart,
          end
        });
      }
    }

    return Object.freeze({
      kind: "empty",
      baseClip: null,
      overlayClip: null,
      baseLocalTime: 0,
      overlayLocalTime: 0,
      baseOpacity: 0,
      overlayOpacity: 0,
      baseVolume: 0,
      overlayVolume: 0,
      blackOpacity: 1,
      section: 1,
      start: t,
      end: t
    });
  }

  function getSegmentKey(frame) {
    if (!frame) return "empty";
    return [
      frame.kind,
      frame.baseClip?.id || "",
      frame.overlayClip?.id || "",
      frame.start ?? "",
      frame.end ?? ""
    ].join(":");
  }

  return {
    resolve,
    getSegmentKey
  };
});

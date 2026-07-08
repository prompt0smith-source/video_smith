(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VideoSmithTimelineTransport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const TIMELINE_TIME_STEP_SEC = 0.01;

  function snapTime(value) {
    return Number((Math.round(Number(value || 0) / TIMELINE_TIME_STEP_SEC) * TIMELINE_TIME_STEP_SEC).toFixed(2));
  }

  function createTransport({ getDuration, onTime, debug = false } = {}) {
    let rawTime = 0;
    let currentTime = 0;
    let playing = false;
    let rafId = null;
    let lastTs = 0;

    const isDebugEnabled = () => (typeof debug === "function" ? !!debug() : !!debug);
    const log = (...args) => {
      if (!isDebugEnabled()) return;
      console.log("[transport]", ...args);
    };

    function emit() {
      onTime?.(currentTime);
    }

    function setTime(nextTime) {
      const maxDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(getDuration?.() || TIMELINE_TIME_STEP_SEC));
      rawTime = clamp(Number(nextTime || 0), 0, maxDuration);
      currentTime = clamp(snapTime(rawTime), 0, maxDuration);
      emit();
    }

    function step(now) {
      if (!playing) {
        rafId = null;
        return;
      }
      if (!lastTs) lastTs = now;
      const deltaSec = Math.max(0, (now - lastTs) / 1000);
      lastTs = now;
      const maxDuration = Math.max(TIMELINE_TIME_STEP_SEC, Number(getDuration?.() || TIMELINE_TIME_STEP_SEC));
      rawTime = clamp(rawTime + deltaSec, 0, maxDuration);
      const nextTime = clamp(snapTime(rawTime), 0, maxDuration);
      if (nextTime !== currentTime) {
        currentTime = nextTime;
        emit();
      }
      if (rawTime >= maxDuration - 1e-4) {
        currentTime = maxDuration;
        emit();
        log("reached end", currentTime);
        playing = false;
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(step);
    }

    return {
      play() {
        if (playing) return;
        playing = true;
        lastTs = 0;
        log("play", currentTime);
        rafId = requestAnimationFrame(step);
      },
      pause() {
        playing = false;
        if (rafId != null) cancelAnimationFrame(rafId);
        rafId = null;
        log("pause", currentTime);
      },
      seek(time) {
        log("seek", time);
        setTime(time);
      },
      stop() {
        this.pause();
        setTime(0);
      },
      getCurrentTime() {
        return currentTime;
      },
      isPlaying() {
        return playing;
      }
    };
  }

  return { createTransport };
});

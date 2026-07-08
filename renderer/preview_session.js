(() => {
  const STEADY_PLAYBACK_DRIFT_SEC = 0.18;
  const NOT_READY_DRIFT_SEC = 0.08;
  const PAUSED_DRIFT_SEC = 0.02;
  const SAME_SOURCE_BOUNDARY_DRIFT_SEC = 0.045;
  const SEEK_RATE_LIMIT_MS = 90;
  const WARM_HOLD_MS = 280;
  const COOLDOWN_MS = 160;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getClipPlaybackIn(clip) {
    return Math.max(0, Number(clip?.in || 0));
  }

  function getClipPlaybackOut(clip) {
    const playbackIn = getClipPlaybackIn(clip);
    return Math.max(playbackIn + 0.02, Number(clip?.out || playbackIn + 0.02));
  }

  function getClipPlaybackDuration(clip) {
    return Math.max(0.02, getClipPlaybackOut(clip) - getClipPlaybackIn(clip));
  }

  function getClipTimelineDuration(clip) {
    const raw = Number(clip?.timelineDuration);
    if (Number.isFinite(raw) && raw >= 0.02) return raw;
    return getClipPlaybackDuration(clip);
  }

  function getClipPlaybackRate(clip) {
    const timelineDuration = Math.max(0.02, getClipTimelineDuration(clip));
    return Math.max(0.02 / timelineDuration, getClipPlaybackDuration(clip) / timelineDuration);
  }

  function mapClipTimelineOffsetToSourceTime(clip, timelineOffset) {
    const playbackIn = getClipPlaybackIn(clip);
    const playbackOut = getClipPlaybackOut(clip);
    const timelineDuration = getClipTimelineDuration(clip);
    const clampedOffset = clamp(Number(timelineOffset || 0), 0, timelineDuration);
    if (clampedOffset >= timelineDuration - 1e-6) return playbackOut;
    return clamp(
      playbackIn + (clampedOffset * getClipPlaybackRate(clip)),
      playbackIn,
      Math.max(playbackIn, playbackOut - 0.001)
    );
  }

  function applyPlaybackRate(videoEl, clip) {
    if (!videoEl) return;
    const rate = clip ? getClipPlaybackRate(clip) : 1;
    try {
      videoEl.playbackRate = clamp(rate, 0.0625, 16);
    } catch {
      videoEl.playbackRate = 1;
    }
  }

  function nowMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  function createLayerState() {
    return {
      loadedClipId: "",
      preloadedClipId: "",
      logicalClipId: "",
      prevLogicalClipId: "",
      loadedSourcePath: "",
      lastAppliedLocalTime: NaN,
      lastRenderKind: "",
      isPreloading: false,
      pendingLocalTime: NaN,
      playOnLoad: false,
      warmState: "idle",
      keepWarmUntilMs: 0,
      cooldownUntilMs: 0,
      loadToken: 0,
      loadCount: 0,
      forcedSeekCount: 0,
      correctiveSeekCount: 0,
      playCalls: 0,
      pauseCalls: 0,
      warmStarts: 0,
      warmStops: 0,
      lastPlayCallAtMs: 0,
      lastPauseCallAtMs: 0,
      lastForcedSeekAtMs: 0,
      lastCorrectiveSeekAtMs: 0,
      lastForcedSeekTarget: NaN,
      lastCorrectiveSeekTarget: NaN
    };
  }

  function createSession({ getLayers, fileUrl, debug = false, requestRender = null } = {}) {
    const layerStates = {
      base: createLayerState(),
      overlay: createLayerState()
    };
    let lastSegmentKey = "";
    let carryOverSingleLayer = { clipId: "", layer: "" };

    const isDebugEnabled = () => (typeof debug === "function" ? !!debug() : !!debug);
    const log = (label, payload) => {
      if (!isDebugEnabled()) return;
      console.log(`[preview_session] ${label}`, payload);
    };
    const requestVisualRefresh = () => {
      if (typeof requestRender !== "function") return;
      try { requestRender(); } catch {}
    };

    function getLayerElements() {
      return getLayers?.() || {};
    }

    function getVideoEl(layerName) {
      const layers = getLayerElements();
      return layerName === "base" ? layers.base : layers.overlay;
    }

    function snapshotLayerState(state) {
      return {
        loadedClipId: state.loadedClipId,
        preloadedClipId: state.preloadedClipId,
        logicalClipId: state.logicalClipId,
        loadedSourcePath: state.loadedSourcePath,
        warmState: state.warmState,
        loadCount: state.loadCount,
        forcedSeekCount: state.forcedSeekCount,
        correctiveSeekCount: state.correctiveSeekCount,
        playCalls: state.playCalls,
        pauseCalls: state.pauseCalls,
        warmStarts: state.warmStarts,
        warmStops: state.warmStops
      };
    }

    function syncGlobalDebugStats() {
      if (typeof window === "undefined") return;
      const stats = {
        segmentKey: lastSegmentKey,
        base: snapshotLayerState(layerStates.base),
        overlay: snapshotLayerState(layerStates.overlay)
      };
      window.__VIDEOSMITH_PREVIEW_STATS__ = stats;
      if (window.__VIDEOSMITH_DEBUG__) window.__VIDEOSMITH_DEBUG__.previewStats = stats;
    }

    function syncLayerDataset(videoEl, state) {
      if (!videoEl) return;
      if (state.loadedSourcePath) videoEl.dataset.sourcePath = state.loadedSourcePath;
      else delete videoEl.dataset.sourcePath;
      if (state.loadedClipId) videoEl.dataset.clipId = state.loadedClipId;
      else delete videoEl.dataset.clipId;
      if (state.preloadedClipId) videoEl.dataset.preloadedClipId = state.preloadedClipId;
      else delete videoEl.dataset.preloadedClipId;
      if (Number.isFinite(state.pendingLocalTime)) videoEl.dataset.pendingTime = String(state.pendingLocalTime);
      else delete videoEl.dataset.pendingTime;
      if (state.warmState) videoEl.dataset.warmState = state.warmState;
      else delete videoEl.dataset.warmState;
      syncGlobalDebugStats();
    }

    function setWarmState(state, nextWarmState) {
      const next = String(nextWarmState || "idle");
      if (state.warmState === next) return;
      if (next === "warming") state.warmStarts += 1;
      if (state.warmState === "warming" && next !== "warming") state.warmStops += 1;
      state.warmState = next;
      syncGlobalDebugStats();
    }

    function ensurePlaying(videoEl, state) {
      if (!videoEl || !videoEl.paused) return false;
      const now = nowMs();
      if ((now - state.lastPlayCallAtMs) < 100) return false;
      state.lastPlayCallAtMs = now;
      state.playCalls += 1;
      syncGlobalDebugStats();
      try {
        const p = videoEl.play?.();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {}
      return true;
    }

    function ensurePaused(videoEl, state) {
      if (!videoEl || videoEl.paused) return false;
      const now = nowMs();
      if ((now - state.lastPauseCallAtMs) < 40) return false;
      state.lastPauseCallAtMs = now;
      state.pauseCalls += 1;
      syncGlobalDebugStats();
      try { videoEl.pause?.(); } catch {}
      return true;
    }

    function recordSeek(state, seekKind, targetLocalTime) {
      const now = nowMs();
      if (seekKind === "forced") {
        state.forcedSeekCount += 1;
        state.lastForcedSeekAtMs = now;
        state.lastForcedSeekTarget = targetLocalTime;
      } else {
        state.correctiveSeekCount += 1;
        state.lastCorrectiveSeekAtMs = now;
        state.lastCorrectiveSeekTarget = targetLocalTime;
      }
      syncGlobalDebugStats();
    }

    function shouldRateLimitSeek(state, seekKind, targetLocalTime) {
      const now = nowMs();
      const lastAt = seekKind === "forced" ? state.lastForcedSeekAtMs : state.lastCorrectiveSeekAtMs;
      const lastTarget = seekKind === "forced" ? state.lastForcedSeekTarget : state.lastCorrectiveSeekTarget;
      return (now - lastAt) < SEEK_RATE_LIMIT_MS
        && Number.isFinite(lastTarget)
        && Math.abs(lastTarget - targetLocalTime) <= 0.02;
    }

    function applySeek(videoEl, state, targetLocalTime, seekKind) {
      if (!videoEl || shouldRateLimitSeek(state, seekKind, targetLocalTime)) return false;
      try {
        videoEl.currentTime = Math.max(0, targetLocalTime);
      } catch {
        return false;
      }
      recordSeek(state, seekKind, targetLocalTime);
      return true;
    }

    function refreshWarmState(state) {
      const now = nowMs();
      if (state.warmState === "warming" && now > state.keepWarmUntilMs) {
        setWarmState(state, state.preloadedClipId ? "preloaded" : "idle");
      }
      if (state.warmState === "cooldown" && now > state.cooldownUntilMs) {
        setWarmState(state, state.preloadedClipId ? "preloaded" : "idle");
      }
    }

    function renewWarmWindow(state, options = {}) {
      if (!options.keepWarm && !options.warmPlayback) return;
      state.keepWarmUntilMs = Math.max(
        state.keepWarmUntilMs,
        nowMs() + Math.max(40, Number(options.keepWarmMs || WARM_HOLD_MS))
      );
    }

    function loadClipToLayer(layerName, clip, localTime, options = {}) {
      const videoEl = getVideoEl(layerName);
      const state = layerStates[layerName];
      if (!videoEl || !clip) {
        return {
          reloaded: false,
          sameSource: false,
          logicalClipChanged: false,
          previousLogicalClipId: state.logicalClipId || ""
        };
      }
      const sourcePath = clip.previewPath || clip.internalPath || clip.originalPath || "";
      if (!sourcePath) {
        return {
          reloaded: false,
          sameSource: false,
          logicalClipChanged: false,
          previousLogicalClipId: state.logicalClipId || ""
        };
      }

      const preloadOnly = !!options.preloadOnly;
      const warmPlayback = !!options.warmPlayback;
      const nextSrc = fileUrl(sourcePath);
      const previousLogicalClipId = state.logicalClipId || state.loadedClipId || state.preloadedClipId || "";
      const previousSourcePath = state.loadedSourcePath || videoEl.dataset.sourcePath || "";
      const sameSource = previousSourcePath === sourcePath;
      const logicalClipChanged = previousLogicalClipId !== clip.id;

      state.prevLogicalClipId = previousLogicalClipId;
      state.loadedSourcePath = sourcePath;
      state.logicalClipId = clip.id;
      state.pendingLocalTime = Math.max(0, Number(localTime || 0));
      state.playOnLoad = !preloadOnly && !!options.playing;
      state.isPreloading = preloadOnly;

      if (preloadOnly) {
        state.loadedClipId = "";
        state.preloadedClipId = clip.id;
        renewWarmWindow(state, options);
        setWarmState(state, warmPlayback ? "warming" : "preloaded");
      } else {
        state.loadedClipId = clip.id;
        state.preloadedClipId = "";
        state.cooldownUntilMs = 0;
        setWarmState(state, options.playing ? "active" : "idle");
      }

      syncLayerDataset(videoEl, state);

      if (!sameSource) {
        const loadToken = state.loadToken + 1;
        state.loadToken = loadToken;
        videoEl.preload = "auto";
        videoEl.playsInline = true;
        videoEl.onloadedmetadata = () => {
          if (state.loadToken !== loadToken) return;
          const pendingLocalTime = Number.isFinite(state.pendingLocalTime) ? state.pendingLocalTime : 0;
          try { videoEl.currentTime = Math.max(0, pendingLocalTime); } catch {}
          refreshWarmState(state);
          if (state.playOnLoad || state.warmState === "warming" || state.warmState === "cooldown") {
            ensurePlaying(videoEl, state);
          } else {
            ensurePaused(videoEl, state);
          }
          syncLayerDataset(videoEl, state);
          requestVisualRefresh();
        };
        videoEl.onloadeddata = () => {
          if (state.loadToken !== loadToken) return;
          requestVisualRefresh();
        };
        videoEl.src = nextSrc;
        state.loadCount += 1;
        syncGlobalDebugStats();
        videoEl.load();
        return {
          reloaded: true,
          sameSource: false,
          logicalClipChanged,
          previousLogicalClipId
        };
      }

      return {
        reloaded: false,
        sameSource: true,
        logicalClipChanged,
        previousLogicalClipId
      };
    }

    function maybeSeek(layerName, clip, targetLocalTime, options = {}) {
      const videoEl = getVideoEl(layerName);
      const state = layerStates[layerName];
      if (!videoEl || !clip) return false;

      const current = Number(videoEl.currentTime);
      const drift = Number.isFinite(current) ? Math.abs(current - targetLocalTime) : Infinity;
      const readyEnough = videoEl.readyState >= 2;
      const playingLike = !!options.playing || !!options.warmPlayback;
      const explicitSeek = !!options.explicitSeek;
      const segmentChanged = !!options.segmentChanged;
      const logicalClipChanged = !!options.logicalClipChanged;
      const sameLogicalClip = !!options.sameLogicalClip;
      const sameSource = !!options.sameSource;
      const reloaded = !!options.reloaded;
      const enteringBlend = !!options.enteringBlend;
      const ended = !!videoEl.ended;
      const invalidCurrentTime = !Number.isFinite(current);
      const pausedWhilePlaying = playingLike && videoEl.paused && !reloaded;
      const sameSourceBoundaryNeedsSeek = logicalClipChanged && sameSource && drift > SAME_SOURCE_BOUNDARY_DRIFT_SEC;
      const enteringBlendNeedsSeek = enteringBlend
        && (reloaded || invalidCurrentTime || !readyEnough || videoEl.paused || drift > SAME_SOURCE_BOUNDARY_DRIFT_SEC);

      const mustSeek = explicitSeek
        || reloaded
        || ended
        || invalidCurrentTime
        || pausedWhilePlaying
        || enteringBlendNeedsSeek
        || (logicalClipChanged && (!sameSource || sameSourceBoundaryNeedsSeek))
        || (segmentChanged && !sameLogicalClip && (!sameSource || drift > SAME_SOURCE_BOUNDARY_DRIFT_SEC));

      if (!playingLike) {
        if (!mustSeek && drift <= PAUSED_DRIFT_SEC) return false;
        return applySeek(videoEl, state, targetLocalTime, mustSeek ? "forced" : "corrective");
      }

      if (mustSeek) {
        return applySeek(videoEl, state, targetLocalTime, "forced");
      }

      if (!readyEnough || videoEl.paused) return false;
      if (!sameLogicalClip) return false;
      if (options.renderKind === "cross" || options.renderKind === "overlap" || options.renderKind === "transition_cross" || options.renderKind === "stacked_transition" || options.warmPlayback) {
        return false;
      }

      const correctiveThreshold = readyEnough ? STEADY_PLAYBACK_DRIFT_SEC : NOT_READY_DRIFT_SEC;
      if (drift <= correctiveThreshold) return false;
      return applySeek(videoEl, state, targetLocalTime, "corrective");
    }

    function applyHiddenLayerState(videoEl, state, options = {}) {
      const previousRenderKind = state.lastRenderKind;
      const now = nowMs();
      const shouldCooldown = !!options.playing
        && !!state.loadedSourcePath
        && (previousRenderKind === "cross"
          || previousRenderKind === "overlap"
          || previousRenderKind === "transition_cross"
          || previousRenderKind === "stacked_transition"
          || previousRenderKind === "fade_out_black"
          || previousRenderKind === "fade_in_black");

      if (shouldCooldown) {
        state.cooldownUntilMs = Math.max(
          state.cooldownUntilMs,
          now + Math.max(40, Number(options.cooldownMs || COOLDOWN_MS))
        );
        if (state.warmState !== "warming") setWarmState(state, "cooldown");
      }

      refreshWarmState(state);
      videoEl.style.opacity = "0";
      applyPlaybackRate(videoEl, null);
      videoEl.volume = 0;
      videoEl.muted = true;

      const keepPlayingHidden = (state.warmState === "warming" && now <= state.keepWarmUntilMs)
        || (state.warmState === "cooldown" && now <= state.cooldownUntilMs);
      if (!keepPlayingHidden && state.warmState === "active") {
        setWarmState(state, state.preloadedClipId ? "preloaded" : "idle");
      }
      if (keepPlayingHidden) ensurePlaying(videoEl, state);
      else ensurePaused(videoEl, state);

      state.lastRenderKind = options.renderKind || "";
      syncLayerDataset(videoEl, state);
      return { seekApplied: false, layerSwap: false };
    }

    function applyLayer(layerName, clip, localTime, opacity, volume, options = {}) {
      const videoEl = getVideoEl(layerName);
      const state = layerStates[layerName];
      if (!videoEl) return { seekApplied: false, layerSwap: false, readyForDisplay: false };

      if (!clip) return applyHiddenLayerState(videoEl, state, options);

      const timelineDuration = getClipTimelineDuration(clip);
      const targetTimelineOffset = clamp(Number(localTime || 0), 0, Math.max(0, timelineDuration - 0.001));
      const targetSourceTime = mapClipTimelineOffsetToSourceTime(clip, targetTimelineOffset);
      applyPlaybackRate(videoEl, clip);
      const loadState = loadClipToLayer(layerName, clip, targetSourceTime, options);
      const seekApplied = maybeSeek(layerName, clip, targetSourceTime, {
        ...options,
        logicalClipChanged: loadState.logicalClipChanged,
        sameLogicalClip: loadState.previousLogicalClipId === clip.id,
        sameSource: loadState.sameSource,
        reloaded: loadState.reloaded
      });
      const readyForDisplay = !!loadState.sameSource || videoEl.readyState >= 2;
      const appliedOpacity = readyForDisplay ? clamp(opacity, 0, 1) : 0;
      const appliedVolume = readyForDisplay ? clamp(volume, 0, 1) : 0;

      renewWarmWindow(state, options);
      videoEl.style.opacity = String(appliedOpacity);
      videoEl.volume = appliedVolume;
      videoEl.muted = appliedVolume <= 0.0001;

      if (options.warmPlayback || (!!options.playing && !options.preloadOnly)) {
        ensurePlaying(videoEl, state);
      } else {
        ensurePaused(videoEl, state);
      }

      state.lastAppliedLocalTime = targetTimelineOffset;
      state.lastRenderKind = options.renderKind || "";
      if (!options.preloadOnly) {
        state.isPreloading = false;
        state.playOnLoad = !!options.playing;
        state.cooldownUntilMs = 0;
        setWarmState(state, options.playing ? "active" : "idle");
      }
      syncLayerDataset(videoEl, state);
      return { seekApplied, layerSwap: false, readyForDisplay, appliedOpacity };
    }

    function rebalanceBlendVisuals(frameState, baseResult, overlayResult) {
      const baseEl = getVideoEl("base");
      const overlayEl = getVideoEl("overlay");
      if (!baseEl || !overlayEl) return;
      const desiredTotalOpacity = clamp(
        Number(frameState.baseOpacity || 0) + Number(frameState.overlayOpacity || 0),
        0,
        1
      );
      const baseReady = !frameState.baseClip || !!baseResult?.readyForDisplay;
      const overlayReady = !frameState.overlayClip || !!overlayResult?.readyForDisplay;
      if (baseReady && overlayReady) return;
      if (baseReady && !overlayReady) {
        baseEl.style.opacity = String(desiredTotalOpacity);
        return;
      }
      if (!baseReady && overlayReady) {
        overlayEl.style.opacity = String(desiredTotalOpacity);
      }
    }

    function pickSinglePrimary(frame) {
      const base = layerStates.base;
      const overlay = layerStates.overlay;
      const clipId = frame.baseClip?.id || "";
      const matchesClip = (state) => state.loadedClipId === clipId || state.preloadedClipId === clipId;
      const matchScore = (state) => {
        if (!clipId) return 0;
        let score = 0;
        if (state.loadedClipId === clipId) score += 3;
        else if (state.preloadedClipId === clipId) score += 2;
        if (state.warmState === "active") score += 1;
        else if (state.warmState === "warming" || state.warmState === "cooldown" || state.warmState === "preloaded") score += 0.5;
        return score;
      };
      if (carryOverSingleLayer.clipId === frame.baseClip?.id && carryOverSingleLayer.layer) {
        return carryOverSingleLayer.layer;
      }
      const overlayMatches = matchesClip(overlay);
      const baseMatches = matchesClip(base);
      if (overlayMatches && (overlay.lastRenderKind === "overlap" || overlay.lastRenderKind === "cross" || overlay.lastRenderKind === "transition_cross" || overlay.lastRenderKind === "stacked_transition")) return "overlay";
      if (overlayMatches && !baseMatches) return "overlay";
      if (baseMatches && !overlayMatches) return "base";
      if (baseMatches && overlayMatches) {
        const overlayScore = matchScore(overlay);
        const baseScore = matchScore(base);
        if (Math.abs(overlayScore - baseScore) > 0.001) return overlayScore > baseScore ? "overlay" : "base";
        const expected = Number(frame.baseLocalTime || 0);
        const baseDist = Math.abs(Number(base.lastAppliedLocalTime || 0) - expected);
        const overlayDist = Math.abs(Number(overlay.lastAppliedLocalTime || 0) - expected);
        return overlayDist <= baseDist ? "overlay" : "base";
      }
      return "base";
    }

    function preload(clip, layerName = "overlay", localTime = 0, options = {}) {
      if (!clip) return;
      applyLayer(layerName, clip, localTime, 0, 0, {
        preloadOnly: true,
        renderKind: "preload",
        explicitSeek: !!options.explicitSeek,
        keepWarm: !!options.keepWarm,
        warmPlayback: !!options.warmPlayback,
        keepWarmMs: options.keepWarmMs
      });
      log("preload", {
        layerName,
        clipId: clip.id,
        localTime,
        warmPlayback: !!options.warmPlayback,
        keepWarm: !!options.keepWarm
      });
    }

    return {
      reset() {
        lastSegmentKey = "";
        layerStates.base.lastRenderKind = "";
        layerStates.base.keepWarmUntilMs = 0;
        layerStates.base.cooldownUntilMs = 0;
        layerStates.overlay.lastRenderKind = "";
        layerStates.overlay.keepWarmUntilMs = 0;
        layerStates.overlay.cooldownUntilMs = 0;
        carryOverSingleLayer = { clipId: "", layer: "" };
        refreshWarmState(layerStates.base);
        refreshWarmState(layerStates.overlay);
        syncGlobalDebugStats();
      },
      getState() {
        return {
          base: { ...layerStates.base },
          overlay: { ...layerStates.overlay }
        };
      },
      preload,
      render(frameState, options = {}) {
        const { black } = getLayerElements();
        const segmentKey = options.segmentKey || "";
        const segmentChanged = segmentKey !== lastSegmentKey;
        let seekApplied = false;
        let layerSwap = false;

        if (frameState.kind === "single" || frameState.kind === "single_transition") {
          const primary = pickSinglePrimary(frameState);
          const secondary = primary === "base" ? "overlay" : "base";
          const primaryResult = applyLayer(primary, frameState.baseClip, frameState.baseLocalTime, frameState.baseOpacity, frameState.baseVolume, {
            ...options,
            segmentChanged,
            renderKind: frameState.kind
          });
          const secondaryResult = applyLayer(secondary, null, 0, 0, 0, {
            ...options,
            renderKind: frameState.kind
          });
          seekApplied = primaryResult.seekApplied || secondaryResult.seekApplied;
          layerSwap = primary === "overlay";
          carryOverSingleLayer = { clipId: frameState.baseClip?.id || "", layer: primary };
        } else if (frameState.kind === "cross" || frameState.kind === "overlap" || frameState.kind === "transition_cross" || frameState.kind === "stacked_transition") {
          const baseResult = applyLayer("base", frameState.baseClip, frameState.baseLocalTime, frameState.baseOpacity, frameState.baseVolume, {
            ...options,
            segmentChanged,
            renderKind: frameState.kind
          });
          const overlayResult = applyLayer("overlay", frameState.overlayClip, frameState.overlayLocalTime, frameState.overlayOpacity, frameState.overlayVolume, {
            ...options,
            segmentChanged,
            enteringBlend: segmentChanged,
            renderKind: frameState.kind
          });
          rebalanceBlendVisuals(frameState, baseResult, overlayResult);
          seekApplied = baseResult.seekApplied || overlayResult.seekApplied;
          carryOverSingleLayer = frameState.overlayClip
            ? { clipId: frameState.overlayClip.id, layer: "overlay" }
            : { clipId: "", layer: "" };
        } else if (frameState.kind === "transition_fade" || frameState.kind === "fade_out_black" || frameState.kind === "fade_in_black") {
          const baseResult = applyLayer("base", frameState.baseClip, frameState.baseLocalTime, frameState.baseOpacity, frameState.baseVolume, {
            ...options,
            segmentChanged,
            renderKind: frameState.kind
          });
          const overlayResult = applyLayer("overlay", frameState.overlayClip, frameState.overlayLocalTime, frameState.overlayOpacity, frameState.overlayVolume, {
            ...options,
            segmentChanged,
            enteringBlend: frameState.kind === "fade_in_black" && segmentChanged,
            renderKind: frameState.kind
          });
          seekApplied = baseResult.seekApplied || overlayResult.seekApplied;
          carryOverSingleLayer = frameState.overlayClip
            ? { clipId: frameState.overlayClip.id, layer: "overlay" }
            : { clipId: "", layer: "" };
        } else {
          applyLayer("base", null, 0, 0, 0, { ...options, renderKind: frameState.kind });
          applyLayer("overlay", null, 0, 0, 0, { ...options, renderKind: frameState.kind });
          carryOverSingleLayer = { clipId: "", layer: "" };
        }

        if (black) {
          black.style.opacity = String(clamp(frameState.blackOpacity || 0, 0, 1));
          black.classList.toggle("show", Number(frameState.blackOpacity || 0) > 0.001);
        }

        lastSegmentKey = segmentKey;
        syncGlobalDebugStats();
        log("render", {
          timelineTime: options.timelineTime,
          kind: frameState.kind,
          baseClipId: frameState.baseClip?.id || "",
          overlayClipId: frameState.overlayClip?.id || "",
          baseLocalTime: frameState.baseLocalTime || 0,
          overlayLocalTime: frameState.overlayLocalTime || 0,
          seekApplied,
          counters: {
            base: snapshotLayerState(layerStates.base),
            overlay: snapshotLayerState(layerStates.overlay)
          },
          layerSwap
        });
        return { seekApplied, layerSwap };
      }
    };
  }

  window.VideoSmithPreviewSession = { createSession };
})();

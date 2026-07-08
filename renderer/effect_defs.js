(() => {
  const common = {
    kind: "overlay",
    section: 1,
    start: 0,
    duration: 2.5,
    x: 0.5,
    y: 0.82,
    opacity: 1
  };

  const fxDefinitions = {
    point_pop_line: {
      palette: { type: "point_pop_line", glyph: "FX", name: "Point Pop", desc: "Burst line accent for quick emphasis." },
      defaults: { overlayType: "point_pop_line", color: "#38bdf8", radius: 0.07, lineLength: 0.045, strokeWidth: 5, lineCount: 10, spreadAmount: 0.18, jitter: 0.18, durationMs: 520, duration: 0.52, opacity: 0.96, easing: "easeOutCubic" }
    },
    underline: {
      palette: { type: "underline", glyph: "U", name: "Underline", desc: "Animated underline highlight for text or UI." },
      defaults: { overlayType: "underline", color: "#38bdf8", accentColor: "#ffffff", width: 0.24, size: 0.24, lineThickness: 10, drawDuration: 0.9, holdDuration: 0.4, fadeOutDuration: 0.28, easing: "easeOutCubic", duration: 1.55, y: 0.78 }
    },
    focus_box_draw: {
      palette: { type: "focus_box_draw", glyph: "[]", name: "Focus Box", desc: "Draw a box around a target area." },
      defaults: { overlayType: "focus_box_draw", color: "#38bdf8", accentColor: "#ffffff", x: 0.5, y: 0.44, boxWidth: 0.28, boxHeight: 0.18, strokeWidth: 6, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28, easing: "easeOutCubic", duration: 1.42, opacity: 0.96 }
    },
    zoom_focus: {
      palette: { type: "zoom_focus", glyph: "Z", name: "Zoom Focus", desc: "Pick a box area and zoom the video toward it." },
      defaults: { overlayType: "zoom_focus", color: "#60a5fa", accentColor: "#ffffff", x: 0.5, y: 0.46, boxWidth: 0.34, boxHeight: 0.24, duration: 1.8, easing: "fastFocusZoom", opacity: 1 }
    },
    zoom_out_focus: {
      palette: { type: "zoom_out_focus", glyph: "ZO", name: "Zoom Out Focus", desc: "Shrink away from the chosen focus area while fading out." },
      defaults: { overlayType: "zoom_out_focus", color: "#60a5fa", accentColor: "#ffffff", x: 0.5, y: 0.46, boxWidth: 0.34, boxHeight: 0.24, duration: 1.8, easing: "fastFocusZoom", opacity: 1 }
    },
    motion_path_move: {
      palette: { type: "motion_path_move", glyph: "M", name: "이동 경로", desc: "선으로 방향과 거리를 지정해 클립을 이동시킵니다." },
      defaults: { overlayType: "motion_path_move", color: "#38bdf8", x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, duration: 1.2, easing: "easeInOutQuad", strokeWidth: 4, opacity: 1, targetClipId: null }
    },
    callout_line_draw: {
      palette: { type: "callout_line_draw", glyph: "L", name: "Callout Line", desc: "Directional line callout for pointing at details." },
      defaults: { overlayType: "callout_line_draw", color: "#38bdf8", accentColor: "#ffffff", x: 0.38, y: 0.44, lineLength: 0.22, lineAngle: -18, strokeWidth: 6, drawDuration: 0.52, holdDuration: 0.42, fadeOutDuration: 0.24, easing: "easeOutCubic", duration: 1.18, opacity: 0.96 }
    },
    soft_spotlight: {
      palette: { type: "soft_spotlight", glyph: "S", name: "Soft Spotlight", desc: "Soft glow spotlight over a focus area." },
      defaults: { overlayType: "soft_spotlight", color: "#ffffff", x: 0.5, y: 0.48, boxWidth: 0.26, boxHeight: 0.16, softness: 0.56, drawDuration: 0.28, holdDuration: 0.78, fadeOutDuration: 0.38, duration: 1.44, opacity: 0.42, easing: "easeOutCubic" }
    },
    highlight_bar_sweep: {
      palette: { type: "highlight_bar_sweep", glyph: "H", name: "Highlight Sweep", desc: "Sweep a highlight bar across a focused area." },
      defaults: { overlayType: "highlight_bar_sweep", color: "#fde68a", accentColor: "#ffffff", x: 0.5, y: 0.42, width: 0.34, boxHeight: 0.12, drawDuration: 0.42, holdDuration: 0.52, fadeOutDuration: 0.24, duration: 1.18, opacity: 0.44, easing: "easeOutCubic" }
    },
    checkpoint_pop: {
      palette: { type: "checkpoint_pop", glyph: "C", name: "Checkpoint Pop", desc: "Short success marker pop animation." },
      defaults: { overlayType: "checkpoint_pop", color: "#22c55e", accentColor: "#ffffff", x: 0.5, y: 0.48, radius: 0.052, lineLength: 0.032, strokeWidth: 4.5, lineCount: 8, spreadAmount: 0.12, jitter: 0.12, durationMs: 680, duration: 0.68, opacity: 0.98, easing: "easeOutCubic" }
    },
    section_divider_slide: {
      palette: { type: "section_divider_slide", glyph: "D", name: "Divider Slide", desc: "Sliding divider accent for section changes." },
      defaults: { overlayType: "section_divider_slide", color: "#cbd5e1", accentColor: "#38bdf8", x: 0.5, y: 0.24, width: 0.78, lineThickness: 4, drawDuration: 0.48, holdDuration: 0.5, fadeOutDuration: 0.24, duration: 1.22, opacity: 0.96, easing: "easeOutCubic" }
    },
    drop_wave: {
      palette: { type: "drop_wave", glyph: "W", name: "Drop Wave", desc: "Localized water-ripple distortion that warps the image surface around an impact point." },
      defaults: {
        overlayType: "drop_wave",
        x: 0.5,
        y: 0.46,
        radius: 0.12,
        waveCount: 4,
        waveSpacing: 0.055,
        amplitude: 0.032,
        speed: 1.2,
        softness: 0.64,
        drawDuration: 0.18,
        holdDuration: 0.74,
        fadeOutDuration: 0.32,
        duration: 1.24,
        easing: "easeOutCubic",
        // Keep legacy keys so old project JSON still round-trips safely.
        color: "#67e8f9",
        accentColor: "#ffffff",
        strokeWidth: 5.5,
        opacity: 0.94
      }
    },
    circle: {
      palette: { type: "circle", glyph: "O", name: "Circle Focus", desc: "Draw a circular focus ring around a target area, then let it fade away." },
      defaults: { overlayType: "circle", color: "#60a5fa", radius: 0.11, size: 0.11, strokeWidth: 6, sparkleCount: 4, sparkleDistance: 0.035, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28, duration: 1.42, opacity: 0.96, x: 0.5, y: 0.44 }
    }
  };

  const visibleFxTypes = [
    "circle",
    "point_pop_line",
    "underline",
    "focus_box_draw",
    "zoom_focus",
    "zoom_out_focus",
    "motion_path_move",
    "callout_line_draw",
    "soft_spotlight",
    "highlight_bar_sweep",
    "checkpoint_pop",
    "section_divider_slide",
    "drop_wave"
  ];

  function makeOverlayDefaults(type, overrides = {}) {
    if (type === "text") {
      return {
        ...common,
        overlayType: "text",
        duration: 2,
        text: "Text",
        fontSize: 64,
        color: "#ffffff",
        fontFamily: "Arial",
        fontWeight: "700",
        textAlign: "center",
        strokeColor: "#000000",
        strokeWidth: 3,
        y: 0.82,
        ...overrides
      };
    }

    const definition = fxDefinitions[type] || fxDefinitions.point_pop_line;
    return {
      ...common,
      ...definition.defaults,
      overlayType: type,
      ...overrides
    };
  }

  const paletteItems = {
    text: { type: "text", glyph: "T", name: "Text Overlay", desc: "Title, subtitle, or caption clip." }
  };

  Object.values(fxDefinitions).forEach((definition) => {
    paletteItems[definition.palette.type] = definition.palette;
  });

  window.VideoSmithEffectDefs = {
    allFxTypes: Object.keys(fxDefinitions),
    fxTypes: visibleFxTypes,
    paletteItems,
    makeOverlayDefaults
  };
})();

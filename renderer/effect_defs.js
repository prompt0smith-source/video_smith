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
      defaults: { overlayType: "point_pop_line", color: "#61c7ff", radius: 0.048, lineLength: 0.032, strokeWidth: 2.2, lineCount: 6, spreadAmount: 0.1, jitter: 0.08, durationMs: 560, duration: 0.56, opacity: 0.82, easing: "easeOutQuart" }
    },
    underline: {
      palette: { type: "underline", glyph: "U", name: "Underline", desc: "Animated underline highlight for text or UI." },
      defaults: { overlayType: "underline", color: "#61c7ff", accentColor: "#61c7ff", width: 0.28, size: 0.28, lineThickness: 2.2, drawDuration: 0.72, holdDuration: 0.48, fadeOutDuration: 0.26, easing: "easeOutQuart", duration: 1.46, y: 0.78 }
    },
    focus_box_draw: {
      palette: { type: "focus_box_draw", glyph: "[]", name: "Focus Box", desc: "Draw a box around a target area." },
      defaults: { overlayType: "focus_box_draw", color: "#61c7ff", accentColor: "#61c7ff", x: 0.5, y: 0.44, boxWidth: 0.28, boxHeight: 0.18, strokeWidth: 2.4, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28, easing: "easeOutCubic", duration: 1.42, opacity: 0.82 }
    },
    zoom_focus: {
      palette: { type: "zoom_focus", glyph: "Z", name: "Zoom Focus", desc: "Pick a box area and zoom the video toward it." },
      defaults: { overlayType: "zoom_focus", color: "#61c7ff", accentColor: "#61c7ff", x: 0.5, y: 0.46, boxWidth: 0.34, boxHeight: 0.24, duration: 1.8, easing: "fastFocusZoom", opacity: 1 }
    },
    zoom_out_focus: {
      palette: { type: "zoom_out_focus", glyph: "ZO", name: "Zoom Out Focus", desc: "Shrink away from the chosen focus area while fading out." },
      defaults: { overlayType: "zoom_out_focus", color: "#61c7ff", accentColor: "#61c7ff", x: 0.5, y: 0.46, boxWidth: 0.34, boxHeight: 0.24, duration: 1.8, easing: "fastFocusZoom", opacity: 1 }
    },
    motion_path_move: {
      palette: { type: "motion_path_move", glyph: "M", name: "이동 경로", desc: "선으로 방향과 거리를 지정해 클립을 이동시킵니다." },
      defaults: { overlayType: "motion_path_move", color: "#61c7ff", x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, duration: 1.2, easing: "easeInOutQuad", strokeWidth: 2.2, opacity: 0.86, targetClipId: null }
    },
    callout_line_draw: {
      palette: { type: "callout_line_draw", glyph: "L", name: "Callout Line", desc: "Directional line callout for pointing at details." },
      defaults: { overlayType: "callout_line_draw", color: "#61c7ff", accentColor: "#61c7ff", x: 0.38, y: 0.44, lineLength: 0.22, lineAngle: -18, strokeWidth: 2.4, drawDuration: 0.52, holdDuration: 0.42, fadeOutDuration: 0.24, easing: "easeOutCubic", duration: 1.18, opacity: 0.84 }
    },
    soft_spotlight: {
      palette: { type: "soft_spotlight", glyph: "S", name: "Soft Spotlight", desc: "Soft glow spotlight over a focus area." },
      defaults: { overlayType: "soft_spotlight", color: "#61c7ff", x: 0.5, y: 0.48, boxWidth: 0.26, boxHeight: 0.16, softness: 0.64, drawDuration: 0.28, holdDuration: 0.78, fadeOutDuration: 0.38, duration: 1.44, opacity: 0.28, easing: "easeOutCubic" }
    },
    highlight_bar_sweep: {
      palette: { type: "highlight_bar_sweep", glyph: "H", name: "Highlight Sweep", desc: "Sweep a highlight bar across a focused area." },
      defaults: { overlayType: "highlight_bar_sweep", color: "#61c7ff", accentColor: "#61c7ff", x: 0.5, y: 0.42, width: 0.34, boxHeight: 0.035, drawDuration: 0.42, holdDuration: 0.52, fadeOutDuration: 0.24, duration: 1.18, opacity: 0.36, easing: "easeOutQuart" }
    },
    checkpoint_pop: {
      palette: { type: "checkpoint_pop", glyph: "C", name: "Checkpoint Pop", desc: "Short success marker pop animation." },
      defaults: { overlayType: "checkpoint_pop", color: "#61c7ff", accentColor: "#61c7ff", x: 0.5, y: 0.48, radius: 0.038, lineLength: 0.026, strokeWidth: 2.1, lineCount: 6, spreadAmount: 0.08, jitter: 0.06, durationMs: 680, duration: 0.68, opacity: 0.84, easing: "easeOutQuart" }
    },
    section_divider_slide: {
      palette: { type: "section_divider_slide", glyph: "D", name: "Divider Slide", desc: "Sliding divider accent for section changes." },
      defaults: { overlayType: "section_divider_slide", color: "#61c7ff", accentColor: "#61c7ff", x: 0.5, y: 0.24, width: 0.78, lineThickness: 2.2, drawDuration: 0.48, holdDuration: 0.5, fadeOutDuration: 0.24, duration: 1.22, opacity: 0.82, easing: "easeOutQuart" }
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
        color: "#61c7ff",
        accentColor: "#61c7ff",
        strokeWidth: 2.2,
        opacity: 0.72
      }
    },
    circle: {
      palette: { type: "circle", glyph: "O", name: "Circle Focus", desc: "Draw a circular focus ring around a target area, then let it fade away." },
      defaults: { overlayType: "circle", color: "#61c7ff", radius: 0.11, size: 0.11, strokeWidth: 2.2, sparkleCount: 0, sparkleDistance: 0.02, drawDuration: 0.58, holdDuration: 0.46, fadeOutDuration: 0.28, easing: "easeOutCubic", duration: 1.42, opacity: 0.82, x: 0.5, y: 0.44 }
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
        fontFamily: "Malgun Gothic",
        fontWeight: "700",
        textAlign: "center",
        strokeColor: "#000000",
        strokeWidth: 0,
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

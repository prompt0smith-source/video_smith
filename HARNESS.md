# VideoSmith Effect & Transition Harness

This document is the working contract for adding or changing VideoSmith visual effects and scene transitions. Treat it as implementation guidance, not marketing copy.

## 1. Visual Design Contract

- Effects use a single hue family by default. Use alpha, blur, and brightness variation inside that hue instead of rainbow or multi-color styling.
- Default effect color is the theme accent: dark `rgba(97,199,255,...)`, light `rgba(37,99,235,...)`.
- Every line or shape must have alpha falloff. The center/core may be stronger, but ends and outer edges must feather out naturally.
- Do not draw editor chrome in effect render paths: no selection boxes, resize handles, debug rectangles, draggable bars, or transform outlines.
- Avoid blunt solid rectangles. If a solid block is intentionally required, document why and add a test that proves it is not editor UI.
- Avoid toy-like bounce, sticker colors, starburst excess, and large pill/marker graphics.
- Palette preview, stage preview, and final render must share the same drawing core whenever possible.

## 2. Motion Contract

- Do not use raw linear progress for reveal, movement, radius expansion, opacity, or scale.
- Use shared helpers such as `easeOutCubic`, `easeOutQuart`, `easeInOutCubic`, or `fastOutSlowIn`.
- Revealed length should usually use `easeOutQuart`.
- Position movement should usually use `easeOutCubic` or `fastOutSlowIn`.
- Radius expansion should usually use `easeOutCubic`.
- Fade should usually use `easeInOutCubic`.
- Pop scale may overshoot only subtly. Large elastic or sticker-style bounce is not acceptable.
- Palette preview, stage preview, and render output must use the same easing for the same effect.

## 3. Preview Contract

- Palette previews must show the real effect over the city preview background.
- Static preview is required. Hover/focus animated preview is required.
- Pointer leave must return to static preview, not clear to a blank or fallback box.
- Palette preview must pass `hideEditorChrome: true`.
- `renderFxPreviewCanvas` must not include handles, bounds, selection strokes, or debug overlays when `hideEditorChrome` is true.
- Fallback black boxes are not acceptable for supported effects. If an effect cannot render, show a deliberate lightweight glyph only as error fallback.

## 4. Render Contract

- Preview and render should share `overlay_engine.js` drawing logic for canvas effects.
- If FFmpeg filters diverge from canvas preview, add a parity test or document the expected difference.
- Text and font render preflight must handle Korean/non-ASCII text and custom font paths before final render.
- New effects must consider both preview canvas and final render fallback paths.
- Render completion must be validated after final output file exists and is non-empty.

## 5. Effect Definition Schema

Add new effects in `renderer/effect_defs.js` with:

- `id` / `overlayType`: stable string identifier.
- `name`: short display name.
- `desc`: one sentence, UI-safe.
- `defaultDuration`: represented by `duration`.
- `defaultColor`: one-tone theme accent or a documented override.
- `supportsPreview`: implied by `renderFxPreviewCanvas` support.
- `supportsRender`: implied by canvas render or FFmpeg render support.
- `preview sample time`: static palette preview should choose a meaningful non-empty moment.
- `render strategy`: shared canvas drawing, FFmpeg filter, or documented fallback.

Default values must not introduce multi-color accents, thick blocks, or editor-like handles.

## 6. Testing Requirements

Required tests for new or modified effects:

- `renderFxPreviewCanvas` draws a non-empty preview over a background.
- `hideEditorChrome=true` does not draw selection UI, bounds, handles, or debug rectangles.
- Static preview returns after hover/focus animation.
- Easing helpers return values in the 0..1 range.
- Feathered line/shape helpers use alpha falloff gradients.
- Preview/render parity is sampled when render output can diverge.
- `npm test` must pass.

## 7. Transition Model Contract

- A scene transition is a seam entity, not an effect attached to one clip edge.
- Seam transition data requires `fromClipId`, `toClipId`, `trackId`, and `seamTime`.
- The transition window is centered on `seamTime` using `alignment: "center"`.
- Transitions require adjacent clips in the same video track. If the next/previous clip is missing or the gap exceeds tolerance, do not render the transition.
- A transition on a seam suppresses duplicate fade in/out UI on the same edges.
- Timeline UI must use a compact `transitionBridge` over the seam.
- The bridge label must stay short, for example `Cross 0.8s`; full name and description belong in tooltip or popover.
- Migration must convert legacy `clip.transitionOut` and `clip.transitionIn` to seam transitions where adjacent clips exist.
- Orphan legacy transitions must be preserved in `orphanedTransitions` or logged as migration warnings rather than silently deleted.

Canonical seam transition shape:

```js
{
  id,
  trackId,
  fromClipId,
  toClipId,
  seamTime,
  duration,
  type,
  easing,
  alignment: "center",
  createdAt,
  updatedAt
}
```

Render, preview, timeline, save/load, and migration code must agree on the same seam timing.

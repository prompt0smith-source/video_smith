const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function dataUrlToBuffer(dataUrl) {
  const raw = String(dataUrl || "");
  const commaIdx = raw.indexOf(",");
  if (commaIdx < 0) return Buffer.alloc(0);
  return Buffer.from(raw.slice(commaIdx + 1), "base64");
}

async function renderFxSequenceToDir(payload = {}) {
  const overlayEngine = window.VideoSmithOverlayEngine;
  if (!overlayEngine?.renderFxFrameToDataUrl) {
    throw new Error("FX render host is not ready.");
  }
  const framesDir = String(payload.framesDir || "").trim();
  if (!framesDir) throw new Error("framesDir is required.");
  ensureDir(framesDir);
  const fps = Math.max(1, Number(payload.fps || 30));
  const durationSec = Math.max(1 / fps, Number(payload.durationSec || (1 / fps)));
  const frameCount = Math.max(1, Math.round(durationSec * fps));
  const width = Math.max(1, Math.round(Number(payload.width || 1920)));
  const height = Math.max(1, Math.round(Number(payload.height || 1080)));
  const resolutionName = payload.resolutionName || "FHD";
  const startTime = Number(payload.startTime || 0);
  const overlays = Array.isArray(payload.overlays) ? payload.overlays : [];
  for (let index = 0; index < frameCount; index += 1) {
    const currentTime = startTime + (index / fps);
    const dataUrl = overlayEngine.renderFxFrameToDataUrl({
      width,
      height,
      resolutionName,
      overlays,
      currentTime
    });
    const framePath = path.join(framesDir, `fx_${String(index).padStart(6, "0")}.png`);
    fs.writeFileSync(framePath, dataUrlToBuffer(dataUrl));
  }
  return {
    frameCount,
    firstFramePath: path.join(framesDir, "fx_000000.png"),
    inputPattern: path.join(framesDir, "fx_%06d.png")
  };
}

async function loadTextOverlayFonts(overlays = []) {
  if (typeof FontFace === "undefined" || !document?.fonts) return [];
  const loaded = [];
  const seen = new Set();
  for (const overlay of overlays) {
    const fontFile = String(overlay?.fontFile || overlay?._renderFontFile || "").trim();
    const fontFamily = String(overlay?.fontFamily || "").trim();
    if (!fontFile || !fontFamily || seen.has(`${fontFamily}:${fontFile}`)) continue;
    seen.add(`${fontFamily}:${fontFile}`);
    try {
      if (!fs.existsSync(fontFile) || !fs.statSync(fontFile).isFile()) continue;
      const face = new FontFace(fontFamily, `url("${pathToFileURL(fontFile).href}")`);
      await face.load();
      document.fonts.add(face);
      loaded.push({ fontFamily, fontFile });
    } catch {
      // System font fallback still keeps canvas text renderable.
    }
  }
  try {
    await document.fonts.ready;
  } catch {
    // ignore font readiness failures
  }
  return loaded;
}

async function renderTextSequenceToDir(payload = {}) {
  const overlayEngine = window.VideoSmithOverlayEngine;
  if (!overlayEngine?.renderTextFrameToDataUrl) {
    throw new Error("Text render host is not ready.");
  }
  const framesDir = String(payload.framesDir || "").trim();
  if (!framesDir) throw new Error("framesDir is required.");
  ensureDir(framesDir);
  const fps = Math.max(1, Number(payload.fps || 30));
  const durationSec = Math.max(1 / fps, Number(payload.durationSec || (1 / fps)));
  const frameCount = Math.max(1, Math.round(durationSec * fps));
  const width = Math.max(1, Math.round(Number(payload.width || 1920)));
  const height = Math.max(1, Math.round(Number(payload.height || 1080)));
  const resolutionName = payload.resolutionName || "FHD";
  const aspectRatio = payload.aspectRatio || "16:9";
  const startTime = Number(payload.startTime || 0);
  const overlays = Array.isArray(payload.overlays) ? payload.overlays : [];
  const loadedFonts = await loadTextOverlayFonts(overlays);
  for (let index = 0; index < frameCount; index += 1) {
    const currentTime = startTime + (index / fps);
    const dataUrl = overlayEngine.renderTextFrameToDataUrl({
      width,
      height,
      resolutionName,
      aspectRatio,
      overlays,
      currentTime
    });
    const framePath = path.join(framesDir, `txt_${String(index).padStart(6, "0")}.png`);
    fs.writeFileSync(framePath, dataUrlToBuffer(dataUrl));
  }
  return {
    frameCount,
    loadedFonts,
    firstFramePath: path.join(framesDir, "txt_000000.png"),
    inputPattern: path.join(framesDir, "txt_%06d.png")
  };
}

window.VideoSmithFxRenderHost = {
  ready: true,
  renderFxSequenceToDir,
  renderTextSequenceToDir
};

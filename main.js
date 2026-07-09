const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { nativeImage: electronNativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const zlib = require("zlib");
const { exec, execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
let ffprobeInstallerPath = "";
try {
  ffprobeInstallerPath = require("@ffprobe-installer/ffprobe").path || "";
} catch {
  ffprobeInstallerPath = "";
}
const ffmpeg = require("fluent-ffmpeg");
const { randomUUID } = require("crypto");
const renderGraph = require("./lib/render_graph");
const zoomMotion = require("./lib/zoom_motion");
const transitionMotion = require("./lib/transition_motion");
const clipVisuals = require("./lib/clip_visuals");

const TIMELINE_TIME_STEP_SEC = 0.01;
const MIN_OVERLAY_CLIP_SEC = TIMELINE_TIME_STEP_SEC;
const MIN_AUDIO_CLIP_SEC = TIMELINE_TIME_STEP_SEC;
const FILTER_SCRIPT_THRESHOLD = 12000;
const FAST_RENDER_EPSILON = TIMELINE_TIME_STEP_SEC;
const FILTER_THREAD_CAP = 8;
const OUTPUT_STAGE_PATH_THRESHOLD = 220;
const FINALIZING_RENDER_PERCENT = 99.8;
const VIDEOSMITH_PROJECT_EXT = "vsm";
const VIDEOSMITH_PROJECT_MAGIC = Buffer.from("VSM1\n", "utf8");
const RENDER_PREFLIGHT_TIMEOUT_MS = 15000;
const CANVAS_PRERENDER_TIMEOUT_MS = 20000;
const RENDER_NO_PROGRESS_WARNING_MS = 60000;
const RENDER_NO_PROGRESS_HARD_TIMEOUT_MS = 120000;
const DRAWTEXT_SELF_TEST_CACHE = new Map();
const FFMPEG_CAPABILITY_CACHE = {
  filters: null,
  encoders: null,
  promise: null
};
const FLUENT_FORMAT_FALLBACKS = Object.freeze({
  lavfi: { description: "Libavfilter virtual input device", canDemux: true, canMux: false },
  mp4: { description: "MP4 (MPEG-4 Part 14)", canDemux: true, canMux: true },
  mov: { description: "QuickTime / MOV", canDemux: true, canMux: true },
  avi: { description: "AVI (Audio Video Interleaved)", canDemux: true, canMux: true },
  matroska: { description: "Matroska", canDemux: true, canMux: true },
  asf: { description: "ASF / WMV", canDemux: true, canMux: true },
  webm: { description: "WebM", canDemux: true, canMux: true },
  wav: { description: "WAV / WAVE", canDemux: true, canMux: true },
  aiff: { description: "AIFF", canDemux: true, canMux: true },
  flac: { description: "FLAC", canDemux: true, canMux: true },
  mp3: { description: "MP3", canDemux: true, canMux: true },
  adts: { description: "ADTS AAC", canDemux: true, canMux: true }
});
const FLUENT_ENCODER_FALLBACKS = Object.freeze({
  libx264: { type: "video", description: "H.264 / AVC", experimental: false },
  mpeg4: { type: "video", description: "MPEG-4 part 2", experimental: false },
  wmv2: { type: "video", description: "Windows Media Video 8", experimental: false },
  libvpx_vp9: { type: "video", description: "VP9", experimental: false },
  "libvpx-vp9": { type: "video", description: "VP9", experimental: false },
  aac: { type: "audio", description: "AAC", experimental: false },
  libmp3lame: { type: "audio", description: "MP3", experimental: false },
  mp3: { type: "audio", description: "MP3", experimental: false },
  libopus: { type: "audio", description: "Opus", experimental: false },
  wmav2: { type: "audio", description: "Windows Media Audio 2", experimental: false },
  flac: { type: "audio", description: "FLAC", experimental: false },
  pcm_s16le: { type: "audio", description: "PCM signed 16-bit little-endian", experimental: false },
  pcm_s16be: { type: "audio", description: "PCM signed 16-bit big-endian", experimental: false }
});

function cloneCapabilityMap(sourceMap = {}) {
  const result = Object.fromEntries(
    Object.entries(sourceMap).map(([key, value]) => [key, { ...value }])
  );
  const findKey = (name) => {
    const raw = String(name || "");
    if (raw in result) return raw;
    const lower = raw.toLowerCase();
    if (lower in result) return lower;
    const underscored = lower.replace(/-/g, "_");
    if (underscored in result) return underscored;
    const dashed = lower.replace(/_/g, "-");
    if (dashed in result) return dashed;
    return "";
  };
  Object.defineProperties(result, {
    get: {
      enumerable: false,
      value(name) {
        const key = findKey(name);
        return key ? result[key] : undefined;
      }
    },
    has: {
      enumerable: false,
      value(name) {
        return !!findKey(name);
      }
    }
  });
  return result;
}

function installFluentFfmpegCapabilityFallbacks() {
  if (process.platform !== "win32") return;
  if (ffmpeg.__videosmithCapabilityFallbacksInstalled) return;
  const proto = ffmpeg?.prototype;
  if (!proto) return;

  const invokeCapabilityCallback = (callback, payloadFactory) => {
    if (typeof callback === "function") callback(null, payloadFactory());
  };

  proto.availableFormats =
  proto.getAvailableFormats = function(callback) {
    invokeCapabilityCallback(callback, () => cloneCapabilityMap(FLUENT_FORMAT_FALLBACKS));
    return this;
  };

  proto.availableEncoders =
  proto.getAvailableEncoders = function(callback) {
    invokeCapabilityCallback(callback, () => cloneCapabilityMap(FLUENT_ENCODER_FALLBACKS));
    return this;
  };

  ffmpeg.availableFormats =
  ffmpeg.getAvailableFormats = function(callback) {
    invokeCapabilityCallback(callback, () => cloneCapabilityMap(FLUENT_FORMAT_FALLBACKS));
  };

  ffmpeg.availableEncoders =
  ffmpeg.getAvailableEncoders = function(callback) {
    invokeCapabilityCallback(callback, () => cloneCapabilityMap(FLUENT_ENCODER_FALLBACKS));
  };

  ffmpeg.__videosmithCapabilityFallbacksInstalled = true;
}

function installFluentFfmpegSpawnGuard() {
  if (ffmpeg.__videosmithSpawnGuardInstalled) return;
  const proto = ffmpeg?.prototype;
  const originalSpawnFfmpeg = proto?._spawnFfmpeg;
  if (!proto || typeof originalSpawnFfmpeg !== "function") return;
  const makeEmptyRing = () => ({
    get() {
      return "";
    },
    callback() {
      return undefined;
    },
    close() {
      return undefined;
    }
  });
  const normalizeRing = (ring) => (
    ring && typeof ring.get === "function" ? ring : makeEmptyRing()
  );
  proto._spawnFfmpeg = function(...args) {
    const safeArgs = [...args];
    const endCbIndex = typeof safeArgs[3] === "function" ? 3 : -1;
    const originalEndCB = endCbIndex >= 0 ? safeArgs[endCbIndex] : null;
    if (originalEndCB) {
      safeArgs[endCbIndex] = function(err, stdoutRing, stderrRing) {
        return originalEndCB.call(this, err, normalizeRing(stdoutRing), normalizeRing(stderrRing));
      };
    }
    try {
      return originalSpawnFfmpeg.apply(this, safeArgs);
    } catch (err) {
      if (safeArgs[endCbIndex]) {
        safeArgs[endCbIndex](err, makeEmptyRing(), makeEmptyRing());
        return this;
      }
      throw err;
    }
  };
  ffmpeg.__videosmithSpawnGuardInstalled = true;
}

function resolveBinaryPath(rawPath, fallbacks = []) {
  const candidates = [];
  if (rawPath) candidates.push(rawPath);
  for (const p of (fallbacks || [])) {
    if (p) candidates.push(p);
  }
  const normalized = [];
  for (const c of candidates) {
    // Executables cannot run from app.asar; prefer unpacked path first.
    if (String(c).includes("app.asar")) {
      normalized.push(String(c).replace("app.asar", "app.asar.unpacked"));
    }
    normalized.push(c);
  }
  for (const c of normalized) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return rawPath;
}

function forceUnpackedExecPath(p) {
  const s = String(p || "");
  if (!s) return s;
  if (s.includes("app.asar")) return s.replace("app.asar", "app.asar.unpacked");
  return s;
}

function findFirstFile(rootDir, fileName, maxDepth = 6, depth = 0) {
  try {
    if (!rootDir || !fs.existsSync(rootDir)) return "";
    if (depth > maxDepth) return "";
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const ent of entries) {
      const p = path.join(rootDir, ent.name);
      if (ent.isFile() && ent.name.toLowerCase() === String(fileName || "").toLowerCase()) return p;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const p = path.join(rootDir, ent.name);
      const found = findFirstFile(p, fileName, maxDepth, depth + 1);
      if (found) return found;
    }
  } catch {
    // ignore traversal errors
  }
  return "";
}

const ffmpegResolved = resolveBinaryPath(ffmpegPath, [
  process.platform === "win32" ? path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe") : "",
  process.platform === "win32" ? path.join(__dirname, "node_modules", "ffmpeg-static", "ffmpeg.exe") : ""
]);
const ffprobeResolved = resolveBinaryPath(ffprobeInstallerPath || ffprobePath, [
  ffprobePath,
  process.platform === "win32" ? path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffprobe-static", "bin", "win32", "x64", "ffprobe.exe") : "",
  process.platform === "win32" ? path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffprobe-static", "bin", "win32", "ia32", "ffprobe.exe") : "",
  process.platform === "win32" ? path.join(__dirname, "node_modules", "ffprobe-static", "bin", "win32", "x64", "ffprobe.exe") : ""
]);

let runtimeFfmpegPath = forceUnpackedExecPath(ffmpegResolved);
let runtimeFfprobePath = forceUnpackedExecPath(ffprobeResolved);

function canUseRuntimeWorkRoot(candidate) {
  const root = String(candidate || "");
  if (!root) return false;
  const probeDir = path.join(root, `.probe_${randomUUID().slice(0, 8)}`);
  try {
    ensureDir(root);
    ensureDir(probeDir);
    fs.writeFileSync(path.join(probeDir, "write.test"), "ok");
    fs.rmSync(probeDir, { recursive: true, force: true });
    return true;
  } catch {
    try {
      if (fs.existsSync(probeDir)) fs.rmSync(probeDir, { recursive: true, force: true });
    } catch {
      // ignore probe cleanup failures
    }
    return false;
  }
}

function getShortRuntimeWorkRoot() {
  const candidates = [];
  if (process.platform === "win32") {
    try {
      const driveRoot = path.parse(process.execPath || "C:\\").root || "C:\\";
      candidates.push(path.join(driveRoot, "vsm"));
    } catch {
      // ignore root resolution failures
    }
    const publicDir = String(process.env.PUBLIC || "").trim();
    if (publicDir) candidates.push(path.join(publicDir, "vsm"));
  }
  try {
    candidates.push(path.join(app.getPath("temp"), "vsm"));
  } catch {
    candidates.push(path.join(os.tmpdir(), "vsm"));
  }
  for (const candidate of candidates) {
    if (canUseRuntimeWorkRoot(candidate)) return candidate;
  }
  return path.join(os.tmpdir(), "vsm");
}

function getRuntimeBinaryDir() {
  return path.join(getShortRuntimeWorkRoot(), "bin");
}

function stageRuntimeBinary(sourcePath, outputName) {
  const source = String(sourcePath || "");
  const fileName = String(outputName || "");
  if (!source || !fileName) return sourcePath;
  try {
    if (!fs.existsSync(source)) return sourcePath;
    const runtimeDir = getRuntimeBinaryDir();
    ensureDir(runtimeDir);
    const stagedPath = path.join(runtimeDir, fileName);
    let shouldCopy = true;
    try {
      if (fs.existsSync(stagedPath)) {
        const srcStat = fs.statSync(source);
        const stagedStat = fs.statSync(stagedPath);
        shouldCopy = srcStat.size !== stagedStat.size || Math.abs(srcStat.mtimeMs - stagedStat.mtimeMs) > 1000;
      }
    } catch {
      shouldCopy = true;
    }
    if (shouldCopy) {
      fs.copyFileSync(source, stagedPath);
    }
    return stagedPath;
  } catch {
    return sourcePath;
  }
}

function applyRuntimeBinaryPaths() {
  process.env.FFMPEG_PATH = runtimeFfmpegPath;
  process.env.FFPROBE_PATH = runtimeFfprobePath;
  ffmpeg.setFfmpegPath(runtimeFfmpegPath);
  ffmpeg.setFfprobePath(runtimeFfprobePath);
}

function tryRecoverFfprobePath() {
  const candidates = [
    process.platform === "win32" ? path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffprobe-static", "bin", "win32", "x64", "ffprobe.exe") : "",
    process.platform === "win32" ? path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffprobe-static", "bin", "win32", "ia32", "ffprobe.exe") : "",
    process.platform === "win32" ? path.join(path.dirname(process.execPath || ""), "resources", "app.asar.unpacked", "node_modules", "ffprobe-static", "bin", "win32", "x64", "ffprobe.exe") : "",
    process.platform === "win32" ? path.join(path.dirname(process.execPath || ""), "resources", "app.asar.unpacked", "node_modules", "ffprobe-static", "bin", "win32", "ia32", "ffprobe.exe") : "",
    process.platform === "win32" ? path.join(String(__dirname || "").replace("app.asar", "app.asar.unpacked"), "node_modules", "ffprobe-static", "bin", "win32", "x64", "ffprobe.exe") : "",
    process.platform === "win32" ? path.join(String(__dirname || "").replace("app.asar", "app.asar.unpacked"), "node_modules", "ffprobe-static", "bin", "win32", "ia32", "ffprobe.exe") : ""
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        runtimeFfprobePath = p;
        applyRuntimeBinaryPaths();
        return p;
      }
    } catch {
      // ignore
    }
  }

  const unpackRoot = path.join(process.resourcesPath || "", "app.asar.unpacked");
  const found = findFirstFile(unpackRoot, "ffprobe.exe", 8);
  if (found) {
    runtimeFfprobePath = found;
    applyRuntimeBinaryPaths();
    return found;
  }
  return "";
}

function tryRecoverFfmpegPath() {
  const candidates = [
    process.platform === "win32" ? path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe") : "",
    process.platform === "win32" ? path.join(path.dirname(process.execPath || ""), "resources", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe") : "",
    process.platform === "win32" ? path.join(String(__dirname || "").replace("app.asar", "app.asar.unpacked"), "node_modules", "ffmpeg-static", "ffmpeg.exe") : ""
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        runtimeFfmpegPath = p;
        applyRuntimeBinaryPaths();
        return p;
      }
    } catch {
      // ignore
    }
  }

  const unpackRoot = path.join(process.resourcesPath || "", "app.asar.unpacked");
  const found = findFirstFile(unpackRoot, "ffmpeg.exe", 8);
  if (found) {
    runtimeFfmpegPath = found;
    applyRuntimeBinaryPaths();
    return found;
  }
  return "";
}

function ensureRuntimeBinaryPaths() {
  try {
    if (!runtimeFfmpegPath || !fs.existsSync(runtimeFfmpegPath)) tryRecoverFfmpegPath();
  } catch {
    tryRecoverFfmpegPath();
  }
  try {
    if (!runtimeFfprobePath || !fs.existsSync(runtimeFfprobePath)) tryRecoverFfprobePath();
  } catch {
    tryRecoverFfprobePath();
  }
  runtimeFfmpegPath = stageRuntimeBinary(forceUnpackedExecPath(runtimeFfmpegPath), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  runtimeFfprobePath = stageRuntimeBinary(forceUnpackedExecPath(runtimeFfprobePath), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  applyRuntimeBinaryPaths();
}

// Some fluent-ffmpeg code paths prefer env vars over static setters.
applyRuntimeBinaryPaths();
// Windows long-path environments can crash during fluent-ffmpeg capability probing
// before the real render command even starts. We use the app's supported codec/format
// matrix directly so those probe spawns are skipped.
installFluentFfmpegCapabilityFallbacks();
installFluentFfmpegSpawnGuard();
app.setName("VideoS");
if (process.platform === "win32") {
  app.setAppUserModelId("com.videosmith.app");
}

const MAX_W = 3840;
const MAX_H = 2160;
const MAX_FPS = 60;
const SUPPORTED_VIDEO_EXT = new Set(["mp4", "mov", "avi", "mkv", "wmv", "webm"]);
const SUPPORTED_AUDIO_EXT = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);
const SUPPORTED_IMAGE_EXT = new Set([
  "jpg", "jpeg", "jpe", "jfif", "jif",
  "png", "apng",
  "bmp", "dib",
  "gif", "webp",
  "tif", "tiff",
  "avif", "heic", "heif",
  "svg", "ico", "cur",
  "ppm", "pgm", "pbm", "pnm", "pam",
  "tga", "dds", "hdr", "exr",
  "jxl", "jp2", "j2k", "jpf", "jpm", "jpx", "mj2"
]);
const CANVAS_FX_OVERLAY_TYPES = new Set([
  "circle",
  "underline",
  "point_pop_line",
  "focus_box_draw",
  "callout_line_draw",
  "soft_spotlight",
  "highlight_bar_sweep",
  "checkpoint_pop",
  "section_divider_slide"
]);
const SUPPORTED_EXT = new Set([...SUPPORTED_VIDEO_EXT, ...SUPPORTED_AUDIO_EXT, ...SUPPORTED_IMAGE_EXT]);
let renderWindow = null;
let fxRenderHostWindow = null;
let fxRenderHostReady = null;
let outputFolder = "";
let activeOverlayProject = null;
let activeRender = {
  jobId: 0,
  sessionId: "",
  status: "idle",
  percent: 0,
  timemark: "",
  durationSec: 0,
  message: "",
  errorDetail: "",
  debugLogPath: "",
  outputPath: "",
  outputPaths: [],
  openFolderAfter: false,
  payload: null,
  command: null,
  pid: null,
  childPids: new Set(),
  cancelToken: null,
  debugSession: null
};
let nextRenderJobId = 0;

function cloneRenderPayload(payload) {
  try {
    if (typeof structuredClone === "function") return structuredClone(payload);
  } catch {
    // fall through to JSON clone
  }
  return JSON.parse(JSON.stringify(payload || {}));
}

function createRenderCancelToken(jobId, sessionId) {
  return {
    jobId,
    sessionId,
    cancelled: false,
    reason: ""
  };
}

function createRenderCancelError(reason = "render cancelled") {
  const err = new Error(reason);
  err.code = "ERR_RENDER_CANCELLED";
  err.renderCancelled = true;
  return err;
}

function isRenderCancelledError(err) {
  return !!(err?.renderCancelled || err?.code === "ERR_RENDER_CANCELLED");
}

function isCurrentRenderJob(jobId, token) {
  return !!(
    jobId
    && token
    && activeRender.jobId === jobId
    && activeRender.cancelToken === token
    && !token.cancelled
  );
}

function requireCurrentRenderJob(jobId, token) {
  if (isCurrentRenderJob(jobId, token)) return;
  throw createRenderCancelError(token?.reason || "render job is no longer active");
}

function updateActiveRenderForJob(jobId, token, fields = {}) {
  if (!isCurrentRenderJob(jobId, token)) return false;
  Object.assign(activeRender, fields);
  broadcastRenderState();
  return true;
}

function clearActiveRenderProcessRefs() {
  activeRender.command = null;
  activeRender.pid = null;
  activeRender.childPids = new Set();
}

function logActiveRenderDiagnostic(title, detail = "") {
  try {
    activeRender.debugSession?.write?.(title, detail);
  } catch {
    // ignore diagnostic logging failures
  }
}

function getRenderFinalizingPercent(message, outputStaged = false) {
  switch (String(message || "")) {
    case "encoder_finished":
      return 99.35;
    case "moving_output":
      return outputStaged ? 99.65 : 99.45;
    case "cleaning_up_render":
      return 99.75;
    case "validating_output":
      return 99.9;
    case "finalizing_output":
      return FINALIZING_RENDER_PERCENT;
    case "wrapping_up_render":
    default:
      return outputStaged ? FINALIZING_RENDER_PERCENT : 99.6;
  }
}

function makeId() {
  // Stable local ID without ESM-only dependency.
  return randomUUID().replace(/-/g, "").slice(0, 21);
}


function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ensureVsmExtension(filePath) {
  const rawPath = String(filePath || "");
  if (!rawPath) return rawPath;
  const ext = path.extname(rawPath).toLowerCase();
  if (ext === `.${VIDEOSMITH_PROJECT_EXT}`) return rawPath;
  return `${rawPath}.${VIDEOSMITH_PROJECT_EXT}`;
}

function encodeVideoSmithProjectFile(projectJson) {
  const jsonText = String(projectJson || "");
  const compressed = zlib.gzipSync(Buffer.from(jsonText, "utf8"));
  return Buffer.concat([VIDEOSMITH_PROJECT_MAGIC, compressed]);
}

function decodeVideoSmithProjectFile(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length <= VIDEOSMITH_PROJECT_MAGIC.length || !buf.subarray(0, VIDEOSMITH_PROJECT_MAGIC.length).equals(VIDEOSMITH_PROJECT_MAGIC)) {
    throw new Error("Invalid VideoSmith project file.");
  }
  const compressed = buf.subarray(VIDEOSMITH_PROJECT_MAGIC.length);
  return zlib.gunzipSync(compressed).toString("utf8");
}

function getRenderDebugDir() {
  const preferredDir = path.join(__dirname, "debug");
  try {
    ensureDir(preferredDir);
    return preferredDir;
  } catch {
    const fallbackDir = path.join(app.getPath("userData"), "render-debug");
    ensureDir(fallbackDir);
    return fallbackDir;
  }
}

function createRenderDebugSession(payload = null, outputPath = "") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = getRenderDebugDir();
  const logPath = path.join(logDir, `render_debug_${stamp}_${randomUUID().slice(0, 6)}.txt`);
  const latestLogPath = path.join(logDir, "latest_render_debug.txt");
  const stream = fs.createWriteStream(logPath, { flags: "a", encoding: "utf8" });
  let closed = false;
  const write = (title, detail = "") => {
    if (closed) return;
    try {
      const lines = [
        `[${new Date().toISOString()}] ${title}`,
        ...(detail ? [String(detail)] : []),
        ""
      ];
      stream.write(`${lines.join("\n")}\n`);
    } catch {
      // ignore logging failures
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      stream.end();
    } catch {
      // ignore close failures
    }
    try {
      fs.copyFileSync(logPath, latestLogPath);
    } catch {
      // ignore latest log copy failures
    }
  };

  write("Render debug session created", [
    `overlayTypes=${Array.isArray(payload?.project?.overlayItems)
      ? JSON.stringify(
          payload.project.overlayItems.reduce((acc, item) => {
            const type = String(item?.overlayType || "text");
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {})
        )
      : "{}"}`,
    `outputPath=${String(outputPath || "")}`,
    `renderMode=${String(payload?.settings?.renderMode || "video")}`,
    `container=${String(payload?.settings?.container || "")}`,
    `audioContainer=${String(payload?.settings?.audioContainer || "")}`,
    `resolution=${String(payload?.settings?.resolutionName || "")}`,
    `aspectRatio=${String(payload?.settings?.aspectRatio || "16:9")}`,
    `fps=${String(payload?.settings?.fps || "")}`,
    `region=${payload?.region?.enabled ? `${payload.region.start}~${payload.region.end}` : "full"}`,
    `videoClips=${Array.isArray(payload?.project?.videoClips) ? payload.project.videoClips.length : 0}`,
    `audioItems=${Array.isArray(payload?.project?.audioItems) ? payload.project.audioItems.length : 0}`,
    `overlayItems=${Array.isArray(payload?.project?.overlayItems) ? payload.project.overlayItems.length : 0}`,
    `overlaySummary=${Array.isArray(payload?.project?.overlayItems)
      ? JSON.stringify(
          payload.project.overlayItems.map((item) => ({
            id: item?.id || "",
            type: String(item?.overlayType || "text"),
            section: Math.max(1, Number(item?.section || 1)),
            start: Number(item?.start || 0),
            duration: Number(item?.duration || 0),
            targetClipId: item?.targetClipId || null
          }))
        )
      : "[]"}`
  ].join("\n"));

  return {
    logPath,
    latestLogPath,
    write,
    close
  };
}

function getAutosaveCachePath() {
  return path.join(app.getPath("userData"), "autosave", "videosmith-session-cache.json");
}

function extOf(filePath) {
  return path.extname(filePath).replace(".", "").toLowerCase();
}

function bufferStartsWith(buffer, bytes) {
  if (!buffer || !bytes || buffer.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[i] !== bytes[i]) return false;
  }
  return true;
}

function detectStillImageHeader(buffer) {
  if (!buffer?.length) return false;

  if (bufferStartsWith(buffer, [0xff, 0xd8, 0xff])) return true; // jpg / jpeg / jfif
  if (bufferStartsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true; // png / apng
  if (buffer.slice(0, 6).toString("ascii") === "GIF87a" || buffer.slice(0, 6).toString("ascii") === "GIF89a") return true;
  if (bufferStartsWith(buffer, [0x42, 0x4d])) return true; // bmp / dib
  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return true;
  if (
    bufferStartsWith(buffer, [0x49, 0x49, 0x2a, 0x00])
    || bufferStartsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
    || bufferStartsWith(buffer, [0x49, 0x49, 0x2b, 0x00])
    || bufferStartsWith(buffer, [0x4d, 0x4d, 0x00, 0x2b])
  ) return true; // tif / tiff
  if (
    bufferStartsWith(buffer, [0x00, 0x00, 0x01, 0x00])
    || bufferStartsWith(buffer, [0x00, 0x00, 0x02, 0x00])
  ) return true; // ico / cur
  if (bufferStartsWith(buffer, [0xff, 0x0a])) return true; // jpeg xl codestream
  if (bufferStartsWith(buffer, [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20])) return true; // jpeg xl container
  if (buffer[0] === 0x50 && buffer[1] >= 0x31 && buffer[1] <= 0x37) return true; // pnm / pam
  if (buffer.slice(4, 8).toString("ascii") === "ftyp") {
    const majorBrand = buffer.slice(8, 12).toString("ascii").trim().toLowerCase();
    if (["avif", "avis", "heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(majorBrand)) return true;
  }

  const textHead = buffer.toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (/<svg[\s>]/i.test(textHead) || /<!doctype\s+svg/i.test(textHead)) return true;

  return false;
}

function detectStillImageCanonicalExt(buffer, filePath = "") {
  if (buffer?.length) {
    if (bufferStartsWith(buffer, [0xff, 0xd8, 0xff])) return "jpg";
    if (bufferStartsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
    if (buffer.slice(0, 6).toString("ascii") === "GIF87a" || buffer.slice(0, 6).toString("ascii") === "GIF89a") return "gif";
    if (bufferStartsWith(buffer, [0x42, 0x4d])) return "bmp";
    if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "webp";
    if (
      bufferStartsWith(buffer, [0x49, 0x49, 0x2a, 0x00])
      || bufferStartsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
      || bufferStartsWith(buffer, [0x49, 0x49, 0x2b, 0x00])
      || bufferStartsWith(buffer, [0x4d, 0x4d, 0x00, 0x2b])
    ) return "tiff";
    if (bufferStartsWith(buffer, [0x00, 0x00, 0x01, 0x00])) return "ico";
    if (bufferStartsWith(buffer, [0x00, 0x00, 0x02, 0x00])) return "cur";
    if (bufferStartsWith(buffer, [0xff, 0x0a]) || bufferStartsWith(buffer, [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20])) return "jxl";
    if (buffer[0] === 0x50 && buffer[1] >= 0x31 && buffer[1] <= 0x37) return buffer[1] === 0x37 ? "pam" : "ppm";
    if (buffer.slice(4, 8).toString("ascii") === "ftyp") {
      const majorBrand = buffer.slice(8, 12).toString("ascii").trim().toLowerCase();
      if (["avif", "avis"].includes(majorBrand)) return "avif";
      if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(majorBrand)) return "heic";
    }
    const textHead = buffer.toString("utf8").replace(/^\uFEFF/, "").trimStart();
    if (/<svg[\s>]/i.test(textHead) || /<!doctype\s+svg/i.test(textHead)) return "svg";
  }
  const ext = extOf(filePath);
  if (SUPPORTED_IMAGE_EXT.has(ext)) {
    if (["jpeg", "jpe", "jfif", "jif"].includes(ext)) return "jpg";
    if (ext === "tif") return "tiff";
    return ext;
  }
  return "png";
}

async function stageStillImageSource(originalPath, id, mediaDir) {
  const targetDir = mediaDir || path.dirname(originalPath);
  ensureDir(targetDir);
  let canonicalExt = "png";
  try {
    canonicalExt = detectStillImageCanonicalExt(await readFileHead(originalPath), originalPath);
  } catch {
    canonicalExt = detectStillImageCanonicalExt(null, originalPath);
  }
  const stagedPath = path.join(targetDir, `${id}.stillsrc.${canonicalExt}`);
  const samePath = String(path.resolve(originalPath)).toLowerCase() === String(path.resolve(stagedPath)).toLowerCase();
  if (!samePath) {
    await fs.promises.copyFile(originalPath, stagedPath);
  }
  return stagedPath;
}

async function sanitizeStillImageForFfmpeg(inputPath, outputPath) {
  try {
    const image = electronNativeImage.createFromPath(inputPath);
    if (!image || image.isEmpty()) return "";
    const pngBuffer = image.toPNG();
    if (!pngBuffer?.length) return "";
    await fs.promises.writeFile(outputPath, pngBuffer);
    return outputPath;
  } catch {
    return "";
  }
}

function getStillImageSizeViaNativeImage(filePath) {
  try {
    const image = electronNativeImage.createFromPath(filePath);
    if (!image || image.isEmpty()) return null;
    const size = image.getSize();
    const width = Math.max(0, Number(size?.width || 0));
    const height = Math.max(0, Number(size?.height || 0));
    if (width < 1 || height < 1) return null;
    return { width, height };
  } catch {
    return null;
  }
}

function dataUrlToBuffer(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/i);
  if (!match) throw new Error("invalid data url");
  return Buffer.from(match[2] || "", "base64");
}

async function readFileHead(filePath, bytes = 4096) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function readFileHeadSync(filePath, bytes = 4096) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const bytesRead = fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function isStillImageMeta(meta) {
  const formatName = String(meta?.format?.format_name || "").toLowerCase();
  if (formatName.includes("image2")) return true;

  const v = getVideoStream(meta);
  const a = getAudioStream(meta);
  if (a || !v) return false;

  const duration = Number(meta?.format?.duration || 0);
  const nbFrames = Number(v?.nb_frames || 0);
  const codecName = String(v?.codec_name || "").toLowerCase();
  if (nbFrames === 1 && duration <= 0.05) return true;
  if (duration <= 0.05 && ["mjpeg", "png", "gif", "bmp", "webp", "tiff", "svg", "jpeg2000", "jxl", "ppm"].includes(codecName)) {
    return true;
  }
  return false;
}

async function looksLikeStillImageFile(filePath) {
  if (!filePath) return false;
  if (SUPPORTED_IMAGE_EXT.has(extOf(filePath))) return true;
  try {
    const head = await readFileHead(filePath);
    if (detectStillImageHeader(head)) return true;
  } catch {
    // ignore header read failures
  }
  try {
    return isStillImageMeta(await probe(filePath));
  } catch {
    return false;
  }
}

function looksLikeStillImageFileSync(filePath) {
  if (!filePath) return false;
  if (SUPPORTED_IMAGE_EXT.has(extOf(filePath))) return true;
  try {
    return detectStillImageHeader(readFileHeadSync(filePath));
  } catch {
    return false;
  }
}

function parseFps(ffprobeStream) {
  // ffprobe stream.avg_frame_rate: "30000/1001"
  const afr = ffprobeStream.avg_frame_rate || ffprobeStream.r_frame_rate || "0/1";
  const m = afr.split("/");
  const num = parseFloat(m[0] || "0");
  const den = parseFloat(m[1] || "1");
  if (!den) return 0;
  return num / den;
}

function getVideoStream(meta) {
  return (meta.streams || []).find(s => s.codec_type === "video");
}

function getAudioStream(meta) {
  return (meta.streams || []).find(s => s.codec_type === "audio");
}

function probe(filePath) {
  ensureRuntimeBinaryPaths();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (!err) {
        resolve(meta);
        return;
      }
      const msg = String(err?.message || err || "");
      if (/ffprobe/i.test(msg) && /enoent/i.test(msg)) {
        const recovered = tryRecoverFfprobePath();
        if (recovered) {
          ffmpeg.ffprobe(filePath, (err2, meta2) => {
            if (err2) reject(err2);
            else resolve(meta2);
          });
          return;
        }
      }
      reject(err);
    });
  });
}

function makeScaleFilter(inW, inH) {
  // Keep aspect ratio, downscale only if needed.
  // Use ffmpeg expression to avoid computing rotation etc.
  return `scale='min(${MAX_W},iw)':'min(${MAX_H},ih)':force_original_aspect_ratio=decrease`;
}

function transcodeToInternalMP4(inputPath, outPath, meta) {
  return new Promise((resolve, reject) => {
    const v = getVideoStream(meta);
    const fps = v ? parseFps(v) : 0;
    const w = v ? v.width : 0;
    const h = v ? v.height : 0;

    const needsScale = w > MAX_W || h > MAX_H;
    const needsFpsClamp = fps > MAX_FPS;

    let cmd = ffmpeg(inputPath).outputOptions([
      "-movflags +faststart",
      "-pix_fmt yuv420p",
      "-c:v libx264",
      "-preset veryfast",
      "-crf 18",
      "-c:a aac",
      "-b:a 192k"
    ]);

    if (needsScale) {
      cmd = cmd.videoFilters([makeScaleFilter(w, h)]);
    }

    if (needsFpsClamp) {
      cmd = cmd.outputOptions([`-r ${MAX_FPS}`]);
    }

    cmd
      .on("error", reject)
      .on("end", () => resolve({ needsScale, needsFpsClamp }))
      .save(outPath);
  });
}

function transcodeStillImageToInternalMP4(inputPath, outPath, durationSec = 5) {
  ensureRuntimeBinaryPaths();
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(["-loop 1"])
      // Some PNG/JPG screenshots arrive with odd pixel dimensions (for example 1431x713).
      // yuv420p/libx264 rejects those sizes, so normalize by trimming at most 1px per side.
      .videoFilters(["crop=iw-mod(iw\\,2):ih-mod(ih\\,2)"])
      .outputOptions([
        `-t ${durationSec}`,
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-c:v libx264",
        "-preset veryfast",
        "-crf 18",
        "-r 30",
        "-an"
      ])
      .on("error", reject)
      .on("end", resolve)
      .save(outPath);
  });
}

function transcodeStillImageToAlphaWebM(inputPath, outPath, durationSec = 5) {
  ensureRuntimeBinaryPaths();
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(["-loop 1"])
      .videoFilters(["crop=iw-mod(iw\\,2):ih-mod(ih\\,2)"])
      .outputOptions([
        `-t ${durationSec}`,
        "-c:v libvpx-vp9",
        "-pix_fmt yuva420p",
        "-auto-alt-ref 0",
        "-b:v 0",
        "-crf 28",
        "-deadline good",
        "-cpu-used 2",
        "-row-mt 1",
        "-r 30",
        "-an"
      ])
      .on("error", reject)
      .on("end", resolve)
      .save(outPath);
  });
}

async function buildStillImageImportResult(originalPath, id, outPath) {
  const mediaDir = path.dirname(outPath);
  let stillImagePath = await stageStillImageSource(originalPath, id, mediaDir);
  try {
    await transcodeStillImageToInternalMP4(stillImagePath, outPath, 5);
  } catch (err) {
    const sanitizedPath = path.join(mediaDir, `${id}.sanitized.png`);
    const recoveredPath = await sanitizeStillImageForFfmpeg(stillImagePath, sanitizedPath);
    if (!recoveredPath) throw err;
    stillImagePath = recoveredPath;
    await transcodeStillImageToInternalMP4(stillImagePath, outPath, 5);
  }
  let width = 0;
  let height = 0;
  try {
    const imageMeta = await probe(stillImagePath);
    const vImg = getVideoStream(imageMeta);
    width = vImg?.width || 0;
    height = vImg?.height || 0;
  } catch {
    const nativeSize = getStillImageSizeViaNativeImage(stillImagePath);
    width = nativeSize?.width || 0;
    height = nativeSize?.height || 0;
  }
  return {
    ok: true,
    id,
    kind: "video",
    originalPath,
    stillImagePath,
    internalPath: outPath,
    isImage: true,
    meta: {
      duration: 5,
      fps: 30,
      width,
      height,
      hasAudio: false,
      isImage: true
    },
    warnings: []
  };
}

function createBackgroundColorClipMP4(outPath, options = {}) {
  ensureRuntimeBinaryPaths();
  const durationSec = Math.max(TIMELINE_TIME_STEP_SEC, Number(options.durationSec || 5));
  const fps = Math.max(1, Number(options.fps || 30));
  const { w, h } = resToWH(options.resolutionName || "FHD", options.aspectRatio || "16:9");
  const colorValue = `0x${normalizeHexColor(options.color, "FFFFFF")}`;
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${colorValue}:s=${w}x${h}:r=${fps}:d=${durationSec}`)
      .inputFormat("lavfi")
      .outputOptions([
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-c:v libx264",
        "-preset veryfast",
        "-crf 18",
        `-r ${fps}`,
        "-an"
      ])
      .on("error", reject)
      .on("end", () => resolve({ width: w, height: h, fps, durationSec }))
      .save(outPath);
  });
}

function codecForContainer(fmt) {
  // Reasonable defaults (ffmpeg-static builds usually include these).
  // You can expand/adjust for quality.
  switch ((fmt || "mp4").toLowerCase()) {
    case "webm":
      return {
        vcodec: "libvpx-vp9",
        acodec: "libopus",
        extra: ["-b:v 0", "-crf 32"]
      };
    case "wmv":
      return { vcodec: "wmv2", acodec: "wmav2", extra: [] };
    case "avi":
      return { vcodec: "mpeg4", acodec: "mp3", extra: [] };
    case "mkv":
    case "mov":
    case "mp4":
    default:
      return { vcodec: "libx264", acodec: "aac", extra: ["-pix_fmt yuv420p"] };
  }
}

function audioCodecForContainer(fmt) {
  switch ((fmt || "mp3").toLowerCase()) {
    case "wav":
      return { acodec: "pcm_s16le", extra: [] };
    case "aiff":
    case "aif":
      return { acodec: "pcm_s16be", extra: [] };
    case "flac":
      return { acodec: "flac", extra: [] };
    case "aac":
      return { acodec: "aac", extra: ["-b:a 192k"] };
    case "mp3":
    default:
      return { acodec: "libmp3lame", extra: ["-b:a 192k"] };
  }
}

function outputExtFromSettings(settings = {}) {
  const mode = settings.renderMode === "audio" ? "audio" : "video";
  if (mode === "audio") {
    return String(settings.audioContainer || "mp3").toLowerCase();
  }
  return String(settings.container || "mp4").toLowerCase();
}

function ffmpegFormatForExt(ext) {
  switch (String(ext || "").toLowerCase()) {
    case "mp4": return "mp4";
    case "mov": return "mov";
    case "avi": return "avi";
    case "mkv": return "matroska";
    case "wmv": return "asf";
    case "webm": return "webm";
    case "wav": return "wav";
    case "aiff":
    case "aif": return "aiff";
    case "flac": return "flac";
    case "mp3": return "mp3";
    case "aac": return "adts";
    default: return "";
  }
}

function isVideoContainerExt(ext) {
  const e = String(ext || "").toLowerCase();
  return ["mp4", "mov", "avi", "mkv", "wmv", "webm"].includes(e);
}

function normalizeOutPath(outPath, settings = {}) {
  const desiredExt = outputExtFromSettings(settings);
  const dir = path.dirname(outPath);
  const base = path.basename(outPath, path.extname(outPath)).replace(/[. ]+$/g, "");
  return path.join(dir, `${base}.${desiredExt}`);
}

function toFfmpegOutputPath(outPath) {
  // Keep relative paths relative for ffmpeg invocation.
  // Some Windows ffmpeg builds fail with absolute drive-letter targets in specific cases.
  return String(outPath || "");
}

function makeSafeFallbackOutPath(settings = {}) {
  const ext = outputExtFromSettings(settings);
  const dir = path.join(app.getPath("temp"), "pearlcut_out");
  ensureDir(dir);
  return path.join(dir, `render_${Date.now()}.${ext}`);
}

function ensureWritableOutputPath(outPath, settings = {}) {
  const abs = path.resolve(String(outPath || ""));
  const dir = path.dirname(abs);
  const ext = path.extname(abs);
  const baseRaw = path.basename(abs, ext);
  const baseSafe = baseRaw.replace(/[<>:"/\\|?*]/g, "_") || `render_${Date.now()}`;
  const sanitized = path.join(dir, `${baseSafe}${ext}`);
  try {
    ensureDir(path.dirname(sanitized));
    const fd = fs.openSync(sanitized, "w");
    fs.closeSync(fd);
    fs.unlinkSync(sanitized);
    return sanitized;
  } catch {
    return makeSafeFallbackOutPath(settings);
  }
}

function parseTimemarkToSec(tm) {
  const s = String(tm || "").trim();
  if (!s) return 0;
  const m = s.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return 0;
  const hh = Number(m[1] || 0);
  const mm = Number(m[2] || 0);
  const ss = Number(m[3] || 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return 0;
  return hh * 3600 + mm * 60 + ss;
}

function trackActiveOutputPath(p) {
  const fp = String(p || "").trim();
  if (!fp) return;
  if (!Array.isArray(activeRender.outputPaths)) activeRender.outputPaths = [];
  if (!activeRender.outputPaths.includes(fp)) activeRender.outputPaths.push(fp);
}

function purgeActiveRenderOutputs() {
  const all = new Set([...(activeRender.outputPaths || []), String(activeRender.outputPath || "")].filter(Boolean));
  for (const p of all) {
    try {
      const abs = path.resolve(p);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
      // ignore delete failures
    }
  }
  activeRender.outputPath = "";
  activeRender.outputPaths = [];
  activeRender.debugLogPath = "";
}

async function validateFinalOutputPath(filePath, debugSession = null, label = "final_output") {
  const finalPath = String(filePath || "").trim();
  if (!finalPath) {
    const msg = `${label} validation failed: empty output path`;
    debugSession?.write?.("Final output validation failed", msg);
    throw new Error(msg);
  }
  let stat = null;
  try {
    stat = await fs.promises.stat(finalPath);
  } catch (err) {
    const msg = `${label} validation failed: missing output: ${finalPath}`;
    debugSession?.write?.("Final output validation failed", `${msg}\n${String(err?.message || err || "")}`);
    throw new Error(msg);
  }
  if (!stat.isFile() || stat.size <= 0) {
    const msg = `${label} validation failed: output is empty: ${finalPath}`;
    debugSession?.write?.("Final output validation failed", `${msg}\nsize=${Number(stat.size || 0)}`);
    throw new Error(msg);
  }
  debugSession?.write?.("Final output validated", `${label}: ${finalPath}\nsize=${stat.size}`);
  return finalPath;
}

function baseResToWH(resKey) {
  switch (resKey) {
    case "SD": return { w: 854, h: 480 };
    case "HD": return { w: 1280, h: 720 };
    case "FHD": return { w: 1920, h: 1080 };
    case "QHD": return { w: 2560, h: 1440 };
    case "UHD / 4K": return { w: 3840, h: 2160 };
    default: return { w: 3840, h: 2160 };
  }
}

function evenRenderDimension(value, min = 2) {
  const safe = Math.max(min, Math.round(Number(value) || min));
  return safe % 2 === 0 ? safe : safe + 1;
}

function parseAspectRatio(value) {
  const raw = String(value || "16:9").trim();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return { w: 16, h: 9, value: "16:9" };
  const w = Math.max(1, Number(match[1] || 16));
  const h = Math.max(1, Number(match[2] || 9));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return { w: 16, h: 9, value: "16:9" };
  return { w, h, value: raw };
}

function resToWH(resKey, aspectRatio = "16:9") {
  // SD/HD/FHD/QHD/UHD-4K. For non-16:9 targets, preserve the preset short edge.
  const base = baseResToWH(resKey);
  const aspect = parseAspectRatio(aspectRatio);
  if (Math.abs((aspect.w / aspect.h) - (16 / 9)) < 0.0001) return base;
  const shortEdge = Math.max(2, Math.min(base.w, base.h));
  if (Math.abs(aspect.w - aspect.h) < 0.0001) {
    return { w: evenRenderDimension(shortEdge), h: evenRenderDimension(shortEdge) };
  }
  if (aspect.w > aspect.h) {
    return { w: evenRenderDimension(shortEdge * (aspect.w / aspect.h)), h: evenRenderDimension(shortEdge) };
  }
  return { w: evenRenderDimension(shortEdge), h: evenRenderDimension(shortEdge * (aspect.h / aspect.w)) };
}

function fmtNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toFixed(3).replace(/\.?0+$/, "");
}

function fmtGain(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "1";
  return Math.max(0, Math.min(1, v)).toFixed(4);
}

function finiteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampFinite(value, min, max, fallback = min) {
  return Math.max(min, Math.min(max, finiteNumber(value, fallback)));
}

function getRenderFrameDuration(target) {
  const fps = Math.max(1, finiteNumber(target?.fps, 30));
  return 1 / fps;
}

function getRenderFps(target) {
  return Math.max(1, finiteNumber(target?.fps, 30));
}

function getExpectedRenderFrameCount(durationSec, target) {
  const fps = getRenderFps(target);
  return Math.max(1, Math.round(Math.max(0.001, finiteNumber(durationSec, 0.001)) * fps));
}

function snapRenderTimeToFrame(value, target, mode = "nearest") {
  const frameDuration = getRenderFrameDuration(target);
  const safeValue = Math.max(0, finiteNumber(value, 0));
  if (!(frameDuration > 1e-6)) return safeValue;
  const scaled = safeValue / frameDuration;
  if (mode === "floor") return Math.max(0, Math.floor(scaled + 1e-9) * frameDuration);
  if (mode === "ceil") return Math.max(0, Math.ceil(scaled - 1e-9) * frameDuration);
  return Math.max(0, Math.round(scaled) * frameDuration);
}

function snapRenderWindowToFrames(start, end, target, options = {}) {
  const frameDuration = getRenderFrameDuration(target);
  const startMode = options.startMode || "nearest";
  const endMode = options.endMode || "nearest";
  const safeStart = snapRenderTimeToFrame(start, target, startMode);
  let safeEnd = snapRenderTimeToFrame(Math.max(safeStart, finiteNumber(end, safeStart)), target, endMode);
  if (safeEnd <= safeStart + 1e-6) safeEnd = safeStart + frameDuration;
  return {
    start: safeStart,
    end: safeEnd,
    duration: Math.max(frameDuration, safeEnd - safeStart)
  };
}

function sanitizeFilterExpr(expr, fallback = "1") {
  const text = String(expr ?? "").trim();
  if (!text) return String(fallback);
  if (/nan|infinity|undefined|null/i.test(text)) return String(fallback);
  return text;
}

function guardRuntimeUnitExpr(expr, fallback = "1") {
  const safeExpr = sanitizeFilterExpr(expr, fallback);
  const safeFallback = sanitizeFilterExpr(fallback, "1");
  return `max(0,min(1,if(eq((${safeExpr}),(${safeExpr})),(${safeExpr}),(${safeFallback}))))`;
}

function buildVolumeExpr(baseGain, multiplierExpr = "1") {
  const gain = fmtGain(baseGain);
  const extra = guardRuntimeUnitExpr(multiplierExpr, "1");
  const combined = extra === "1" ? gain : `(${gain})*(${extra})`;
  return guardRuntimeUnitExpr(combined, gain);
}

function hashString(input) {
  let hash = 0;
  const text = String(input || "");
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededUnit(seed, index, salt = 0) {
  const raw = Math.sin(((seed + 1) * 12.9898) + ((index + 1) * 78.233) + (salt * 37.719)) * 43758.5453;
  return raw - Math.floor(raw);
}

function buildConcatFilter(clips, probeMetas = [], target = {}) {
  // v0: basic CUT concat only.
  // Each clip = { internalPath, in, out }
  // We open each clip as separate ffmpeg input and trim.
  // Returns { inputs: [paths], filter: string, map: {vLabel,aLabel} }
  const inputs = [];
  const parts = [];
  const pairs = [];
  let gapIndex = 0;

  const fmt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toFixed(3).replace(/\.?0+$/, "");
  };
  const fmtGain = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "1";
    return Math.max(0, Math.min(1, v)).toFixed(4);
  };
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = Math.max(1, Number(target.fps || 30));
  const includeAudio = target?.includeAudio !== false;
  const backgroundColor = getProjectBackgroundColorValue(target, 1);
  const sortedClips = [...clips].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
  let cursor = Number.isFinite(Number(target.timelineStart)) ? Number(target.timelineStart) : Number(sortedClips[0]?.start || 0);
  const appendGapSegment = (duration) => {
    const safeDuration = Math.max(0, Number(duration || 0));
    if (safeDuration <= 0.001) return;
    const vGap = `vgap${gapIndex}`;
    const aGap = `agap${gapIndex}`;
    gapIndex += 1;
    parts.push(
      `color=c=${backgroundColor}:s=${w}x${h}:r=${fps}:d=${fmt(safeDuration)},format=yuv420p[${vGap}]`
    );
    if (includeAudio) {
      parts.push(
        `anullsrc=r=48000:cl=stereo,atrim=duration=${fmt(safeDuration)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,aresample=48000,volume=1[${aGap}]`
      );
      pairs.push(`[${vGap}][${aGap}]`);
    } else {
      pairs.push(`[${vGap}]`);
    }
  };

  sortedClips.forEach((c, idx) => {
    const clipStartOnTimeline = Math.max(0, Number(c.start || cursor || 0));
    if (clipStartOnTimeline > cursor + 0.001) appendGapSegment(clipStartOnTimeline - cursor);
    inputs.push(c.internalPath);
    const meta = probeMetas[idx] || null;
    const vStream = getVideoStream(meta || {});
    const aStream = getAudioStream(meta || {});
    const srcDurRaw = Number(meta?.format?.duration || vStream?.duration || aStream?.duration || 0);

    const vT = `v${idx}t`;
    const aT = `a${idx}t`;

    let start = Math.max(0, Number(c.in || 0));
    let end = Math.max(start, Number(c.out || 0));

    // Clamp trim range to source duration to avoid filter graph parse/runtime failures.
    if (Number.isFinite(srcDurRaw) && srcDurRaw > 0) {
      const srcDur = Math.max(0.001, srcDurRaw);
      start = Math.min(start, Math.max(0, srcDur - 0.02));
      end = Math.min(end, srcDur);
    }
    if (end <= start + 0.001) end = start + 0.02;

    const playbackDuration = Math.max(0.02, end - start);
    const timelineDuration = Math.max(0.02, Number(c.timelineDuration || playbackDuration));
    const playbackRate = Math.max(
      0.01,
      Number(clipVisuals?.getClipPlaybackRate ? clipVisuals.getClipPlaybackRate(c) : (playbackDuration / timelineDuration)) || 1
    );
    const gain = Math.max(0, Math.min(1, Number(c.gain ?? 1)));
    const videoFadeInSec = Math.max(0, Math.min(timelineDuration - 0.01, Number(c.manualFadeInSec ?? c.fadeInSec ?? 0)));
    const videoFadeOutSec = Math.max(0, Math.min(timelineDuration - 0.01, Number(c.manualFadeOutSec ?? c.fadeOutSec ?? 0)));
    const audioFadeInSec = Math.max(0, Math.min(timelineDuration - 0.01, Number(c.audioManualFadeInSec ?? c.manualFadeInSec ?? c.fadeInSec ?? 0)));
    const audioFadeOutSec = Math.max(0, Math.min(timelineDuration - 0.01, Number(c.audioManualFadeOutSec ?? c.manualFadeOutSec ?? c.fadeOutSec ?? 0)));
    const audioEnabled = getClipAudioEnabled(c);
    const vFilters = [
      `trim=start=${fmt(start)}:end=${fmt(end)}`,
      "setpts=PTS-STARTPTS"
    ];
    if (Math.abs(playbackRate - 1) > 0.0005) vFilters.push(`setpts=${fmt(1 / playbackRate)}*PTS`);
    vFilters.push(
      `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:${backgroundColor}`,
      `fps=${fps}`,
      "format=yuv420p"
    );
    const fastVideoFadeFilters = buildManualFadeFilters("video", c, start, end, timelineDuration, { target });
    if (fastVideoFadeFilters.length) vFilters.push(...fastVideoFadeFilters);
    const aFilters = [
      `atrim=start=${fmt(start)}:end=${fmt(end)}`,
      "asetpts=PTS-STARTPTS"
    ];
    if (Math.abs(playbackRate - 1) > 0.0005) aFilters.push(...buildAtempoFilters(playbackRate));
    if (audioFadeInSec > 0.01) aFilters.push(`afade=t=in:st=0:d=${fmt(audioFadeInSec)}`);
    if (audioFadeOutSec > 0.01) aFilters.push(`afade=t=out:st=${fmt(Math.max(0, timelineDuration - audioFadeOutSec))}:d=${fmt(audioFadeOutSec)}`);
    aFilters.push(
      "aformat=sample_rates=48000:channel_layouts=stereo",
      "aresample=48000",
      `volume=${fmtGain(gain)}`
    );

    parts.push(`[${idx}:v:0]${vFilters.join(",")}[${vT}]`);
    if (includeAudio && audioEnabled && aStream) {
      parts.push(`[${idx}:a:0]${aFilters.join(",")}[${aT}]`);
    } else if (includeAudio) {
      // If a clip has no audio stream, generate a silent segment with matching duration.
      const silentFilters = [
        `atrim=duration=${fmt(timelineDuration)}`,
        "asetpts=PTS-STARTPTS"
      ];
      if (audioFadeInSec > 0.01) silentFilters.push(`afade=t=in:st=0:d=${fmt(audioFadeInSec)}`);
      if (audioFadeOutSec > 0.01) silentFilters.push(`afade=t=out:st=${fmt(Math.max(0, timelineDuration - audioFadeOutSec))}:d=${fmt(audioFadeOutSec)}`);
      silentFilters.push(
        "aformat=sample_rates=48000:channel_layouts=stereo",
        "aresample=48000",
        `volume=${fmtGain(gain)}`
      );
      parts.push(`anullsrc=r=48000:cl=stereo,${silentFilters.join(",")}[${aT}]`);
    }
    if (includeAudio) {
      pairs.push(`[${vT}][${aT}]`);
    } else {
      pairs.push(`[${vT}]`);
    }
    cursor = clipStartOnTimeline + timelineDuration;
  });

  const timelineEnd = Number(target.timelineEnd);
  if (Number.isFinite(timelineEnd) && timelineEnd > cursor + 0.001) appendGapSegment(timelineEnd - cursor);

  // concat filter
  const n = pairs.length;
  if (includeAudio) {
    parts.push(`${pairs.join("")}concat=n=${n}:v=1:a=1[vout][aout]`);
    return { inputs, filter: parts.join(";"), map: { v: "vout", a: "aout" } };
  }
  parts.push(`${pairs.join("")}concat=n=${n}:v=1:a=0[vout]`);
  return { inputs, filter: parts.join(";"), map: { v: "vout" } };
}

function buildAudioConcatFilter(clips, probeMetas = []) {
  const inputs = [];
  const parts = [];
  const aLabels = [];
  const fmt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toFixed(3).replace(/\.?0+$/, "");
  };
  const fmtGain = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "1";
    return Math.max(0, Math.min(1, v)).toFixed(4);
  };

  clips.forEach((c, idx) => {
    inputs.push(c.internalPath);
    const meta = probeMetas[idx] || null;
    const aStream = getAudioStream(meta || {});
    const srcDurRaw = Number(meta?.format?.duration || aStream?.duration || 0);
    let start = Math.max(0, Number(c.in || 0));
    let end = Math.max(start, Number(c.out || 0));
    if (Number.isFinite(srcDurRaw) && srcDurRaw > 0) {
      const srcDur = Math.max(0.001, srcDurRaw);
      start = Math.min(start, Math.max(0, srcDur - 0.02));
      end = Math.min(end, srcDur);
    }
    if (end <= start + 0.001) end = start + 0.02;
    const clipDur = Math.max(0.02, end - start);
    const gain = Math.max(0, Math.min(1, Number(c.gain ?? 1)));
    const aT = `a${idx}t`;
    if (aStream) {
      parts.push(`[${idx}:a:0]atrim=start=${fmt(start)}:end=${fmt(end)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,aresample=48000,volume=${fmtGain(gain)}[${aT}]`);
    } else {
      parts.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${fmt(clipDur)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,aresample=48000,volume=${fmtGain(gain)}[${aT}]`);
    }
    aLabels.push(`[${aT}]`);
  });

  const n = clips.length;
  parts.push(`${aLabels.join("")}concat=n=${n}:v=0:a=1[aout]`);
  return { inputs, filter: parts.join(";"), map: { a: "aout" } };
}

function isStillImageClipSource(filePath) {
  return looksLikeStillImageFileSync(filePath || "");
}

function getRenderableStillImageSourcePath(clip) {
  return clip?.imageCutoutOriginalPath
    || clip?.stillImagePath
    || clip?.imageCutoutPreviewPath
    || clip?.sourcePath
    || clip?.originalPath
    || clip?.previewPath
    || clip?.internalPath
    || "";
}

function getRenderableClipSourcePath(clip) {
  const sourcePath = clip?.sourcePath || clip?.originalPath || "";
  const stillImagePath = getRenderableStillImageSourcePath(clip);
  if (
    clip?.isImage
    || clip?.meta?.isImage
    || isStillImageClipSource(stillImagePath)
    || isStillImageClipSource(sourcePath)
  ) {
    return stillImagePath || sourcePath || clip?.originalPath || clip?.internalPath || clip?.previewPath || "";
  }
  return sourcePath || clip?.internalPath || clip?.previewPath || clip?.originalPath || "";
}

function getClipSourcePath(clip) {
  return getRenderableClipSourcePath(clip);
}

function getClipAudioEnabled(clip) {
  if (!clip) return false;
  if (typeof clip.audioEnabled === "boolean") return clip.audioEnabled;
  if (clip.linkMode === "detached" && clip.linkedAudioId) return false;
  return true;
}

function projectHasRenderableAudio(project = {}, clips = []) {
  if ((project.audioItems || []).some((audio) => getAudioItemSourcePath(audio) && Number(audio?.duration || 0) > 0.001)) {
    return true;
  }
  return (clips || []).some((clip) => {
    if (!getClipAudioEnabled(clip)) return false;
    if (clip?.linkedAudioId) return true;
    if (clip?.meta?.hasAudio) return true;
    return false;
  });
}

function getAudioItemSourcePath(audio) {
  return audio?.internalPath || audio?.previewPath || audio?.sourcePath || audio?.originalPath || "";
}

function approxEqual(a, b, epsilon = 0.0005) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
}

function projectHasComplexTransitions(project = {}) {
  for (const transition of Object.values(project?.transitions || {})) {
    if (!transition) continue;
    const type = String(transition?.type || transition || "").toLowerCase();
    if (type && type !== "cut") return true;
  }
  return false;
}

function clipUsesAdvancedVisuals(clip) {
  const visuals = clipVisuals?.normalizeVisualState
    ? clipVisuals.normalizeVisualState(clip)
    : null;
  const defaults = clipVisuals?.DEFAULT_VISUALS || {};
  if (!visuals) return false;
  return (
    !approxEqual(visuals.scaleX, defaults.scaleX ?? 1)
    || !approxEqual(visuals.scaleY, defaults.scaleY ?? 1)
    || !approxEqual(visuals.positionX, defaults.positionX ?? 0.5)
    || !approxEqual(visuals.positionY, defaults.positionY ?? 0.5)
    || !approxEqual(visuals.anchorX, defaults.anchorX ?? 0.5)
    || !approxEqual(visuals.anchorY, defaults.anchorY ?? 0.5)
    || !approxEqual(visuals.rotation, defaults.rotation ?? 0)
    || !approxEqual(visuals.opacity, defaults.opacity ?? 1)
    || !!visuals.chromaKeyEnabled
    || !approxEqual(visuals.cropLeft, 0)
    || !approxEqual(visuals.cropRight, 0)
    || !approxEqual(visuals.cropTop, 0)
    || !approxEqual(visuals.cropBottom, 0)
    || String(visuals.fitMode || "contain") !== "contain"
    || String(visuals.placementPreset || "center") !== "center"
  );
}

function clipsHaveTimelineOverlaps(clips, epsilon = FAST_RENDER_EPSILON) {
  const sorted = [...clips].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
  let cursor = Number.NEGATIVE_INFINITY;
  for (const clip of sorted) {
    const start = Math.max(0, Number(clip?.start || 0));
    if (start < cursor - epsilon) return true;
    cursor = start + getVideoClipTimelineDuration(clip);
  }
  return false;
}

function clipsHaveTimelineGaps(clips, rangeStart = 0, rangeEnd = null, epsilon = FAST_RENDER_EPSILON) {
  const sorted = [...clips].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
  let cursor = Number.isFinite(Number(rangeStart)) ? Number(rangeStart) : Number(sorted[0]?.start || 0);
  for (const clip of sorted) {
    const start = Math.max(0, Number(clip?.start || 0));
    if (start > cursor + epsilon) return true;
    cursor = Math.max(cursor, start + getVideoClipTimelineDuration(clip));
  }
  if (Number.isFinite(Number(rangeEnd)) && Number(rangeEnd) > cursor + epsilon) return true;
  return false;
}

function projectHasDetachedAudio(project = {}) {
  return (project.audioItems || []).some((audio) => {
    const linkMode = String(audio?.linkMode || "detached").toLowerCase();
    return linkMode !== "linked" || !audio?.linkedVideoId;
  });
}

function canUseFastVideoConcatRender(project = {}, clips = []) {
  if (!Array.isArray(clips) || !clips.length) return false;
  if ((project.overlayItems || []).length) return false;
  if (projectHasComplexTransitions(project)) return false;
  if (projectHasDetachedAudio(project)) return false;
  const sections = new Set(clips.map((clip) => Math.max(1, Number(clip?.section || 1))));
  if (sections.size !== 1) return false;
  if (clipsHaveTimelineOverlaps(clips)) return false;
  return clips.every((clip) => {
    if (!getClipSourcePath(clip)) return false;
    if (clipUsesAdvancedVisuals(clip)) return false;
    if (clip?.isImage || clip?.meta?.isImage) return false;
    if (isStillImageClipSource(getClipSourcePath(clip))) return false;
    return true;
  });
}

function canUseFastAudioConcatRender(project = {}, clips = [], rangeStart = 0, rangeEnd = null) {
  if (!Array.isArray(clips) || !clips.length) return false;
  if ((project.videoClips || []).length) return false;
  if ((project.overlayItems || []).length) return false;
  if (projectHasComplexTransitions(project)) return false;
  if (clipsHaveTimelineOverlaps(clips)) return false;
  if (clipsHaveTimelineGaps(clips, rangeStart, rangeEnd)) return false;
  return clips.every((clip) => !!clip?.internalPath);
}

function getAudioItemSourceIn(audio) {
  const value = Number(audio?.sourceIn ?? audio?.in ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getAudioItemSourceOut(audio) {
  const start = getAudioItemSourceIn(audio);
  const raw = Number(audio?.sourceOut ?? audio?.out);
  if (Number.isFinite(raw) && raw > start) return raw;
  return start + Math.max(MIN_AUDIO_CLIP_SEC, Number(audio?.duration || MIN_AUDIO_CLIP_SEC));
}

function normalizeAudioItemForRender(audio) {
  const clipIn = getAudioItemSourceIn(audio);
  const clipOut = Math.max(clipIn + MIN_AUDIO_CLIP_SEC, getAudioItemSourceOut(audio));
  return {
    ...audio,
    internalPath: getAudioItemSourcePath(audio),
    in: clipIn,
    out: clipOut,
    start: Math.max(0, Number(audio?.start || 0)),
    duration: Math.max(MIN_AUDIO_CLIP_SEC, clipOut - clipIn),
    gain: Math.max(0, Math.min(1, Number(audio?.gain ?? 1))),
    manualFadeInSec: Math.max(0, Number(audio?.manualFadeInSec || audio?.fadeInSec || 0)),
    manualFadeOutSec: Math.max(0, Number(audio?.manualFadeOutSec || audio?.fadeOutSec || 0))
  };
}

function sourceDurationForClip(clip, meta) {
  const videoStream = getVideoStream(meta || {});
  const audioStream = getAudioStream(meta || {});
  const clipOut = Number(clip?.out || 0);
  const sourceDuration = Number(
    meta?.format?.duration
    || videoStream?.duration
    || audioStream?.duration
    || clip?.meta?.duration
    || clipOut
    || 0
  );
  return Number.isFinite(sourceDuration) && sourceDuration > 0 ? sourceDuration : Math.max(clipOut, 0.02);
}

function getVideoClipPlaybackIn(clip) {
  if (clipVisuals?.getClipPlaybackIn) return clipVisuals.getClipPlaybackIn(clip);
  return Math.max(0, Number(clip?.in || 0));
}

function getVideoClipPlaybackOut(clip) {
  if (clipVisuals?.getClipPlaybackOut) return clipVisuals.getClipPlaybackOut(clip);
  const playbackIn = getVideoClipPlaybackIn(clip);
  return Math.max(playbackIn + 0.02, Number(clip?.out || playbackIn + 0.02));
}

function getVideoClipPlaybackDuration(clip) {
  if (clipVisuals?.getClipPlaybackDuration) return clipVisuals.getClipPlaybackDuration(clip);
  return Math.max(0.02, getVideoClipPlaybackOut(clip) - getVideoClipPlaybackIn(clip));
}

function getVideoClipTimelineDuration(clip) {
  if (clipVisuals?.getClipTimelineDuration) return clipVisuals.getClipTimelineDuration(clip);
  const raw = Number(clip?.timelineDuration);
  if (Number.isFinite(raw) && raw >= 0.02) return raw;
  return getVideoClipPlaybackDuration(clip);
}

function mapVideoClipTimelineOffsetToSourceTime(clip, timelineOffset) {
  if (clipVisuals?.mapClipTimelineOffsetToSourceTime) return clipVisuals.mapClipTimelineOffsetToSourceTime(clip, timelineOffset);
  const playbackIn = getVideoClipPlaybackIn(clip);
  const playbackOut = getVideoClipPlaybackOut(clip);
  const timelineDuration = Math.max(0.02, getVideoClipTimelineDuration(clip));
  const playbackDuration = getVideoClipPlaybackDuration(clip);
  const clampedOffset = Math.max(0, Math.min(timelineDuration, Number(timelineOffset || 0)));
  if (clampedOffset >= timelineDuration - 1e-6) return playbackOut;
  return Math.max(
    playbackIn,
    Math.min(playbackOut - 0.001, playbackIn + (clampedOffset * (playbackDuration / timelineDuration)))
  );
}

function buildAtempoFilters(playbackRate) {
  const rate = Math.max(0.01, Number(playbackRate || 1));
  if (Math.abs(rate - 1) <= 0.0005) return [];
  const filters = [];
  let remaining = rate;
  while (remaining > 2.0) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  filters.push(`atempo=${fmtNumber(remaining)}`);
  return filters;
}

function clampSliceWindow(clip, localStart, localEnd, requestedDuration, meta) {
  const clipIn = getVideoClipPlaybackIn(clip);
  const clipOut = getVideoClipPlaybackOut(clip);
  const sourceDuration = sourceDurationForClip(clip, meta);
  let start = Math.max(0, Number(localStart || 0));
  let end = Math.max(start + 0.02, Number(localEnd || start + 0.02));
  start = Math.min(start, Math.max(0, clipOut - 0.02));
  end = Math.min(Math.max(start + 0.02, end), clipOut, sourceDuration);
  const actualDuration = Math.max(0.02, end - start);
  const freezeDuration = Math.max(0, Number(requestedDuration || actualDuration) - actualDuration);
  return { start, end, actualDuration, freezeDuration };
}

function getProjectBackgroundHex(target, fallback = "000000") {
  return normalizeHexColor(target?.backgroundColor, fallback);
}

function getProjectBackgroundColorValue(target, alpha = 1, fallback = "000000") {
  return `0x${getProjectBackgroundHex(target, fallback)}@${fmtGain(alpha)}`;
}

function pushBlackVideoSource(parts, outLabel, durationSec, target) {
  parts.push(
    `color=c=${getProjectBackgroundColorValue(target, 1)}:s=${Math.max(2, Number(target.w || 1920))}x${Math.max(2, Number(target.h || 1080))}:r=${fmtNumber(Math.max(1, Number(target.fps || 30)))}:d=${fmtNumber(durationSec)},format=yuv420p[${outLabel}]`
  );
}

function pushSilentAudioSource(parts, outLabel, durationSec, gainExpr = "1") {
  const safeGainExpr = guardRuntimeUnitExpr(gainExpr, "1");
  parts.push(
    `anullsrc=r=48000:cl=stereo,atrim=duration=${fmtNumber(durationSec)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,aresample=48000,volume='${safeGainExpr}'[${outLabel}]`
  );
}

function buildManualFadeFilters(type, clip, localStart, localEnd, requestedDuration, options = {}) {
  const filters = [];
  const clipIn = Math.max(0, Number(clip?.in || 0));
  const clipOut = Math.max(clipIn + 0.02, Number(clip?.out || clipIn + 0.02));
  const duration = Math.max(0.02, Number(requestedDuration || 0.02));
  const frameDuration = type === "audio" ? 0 : getRenderFrameDuration(options.target);
  const fadeInSource = type === "audio"
    ? (clip?.audioManualFadeInSec ?? clip?.manualFadeInSec ?? clip?.fadeInSec)
    : (clip?.manualFadeInSec ?? clip?.fadeInSec);
  const fadeOutSource = type === "audio"
    ? (clip?.audioManualFadeOutSec ?? clip?.manualFadeOutSec ?? clip?.fadeOutSec)
    : (clip?.manualFadeOutSec ?? clip?.fadeOutSec);
  const fadeInSec = Math.max(0, Number(fadeInSource || 0));
  const fadeOutSec = Math.max(0, Number(fadeOutSource || 0));
  const startsAtClipStart = Number(localStart) <= clipIn + 0.02;
  const endsAtClipEnd = Number(localEnd) >= clipOut - 0.02;
  const alphaSuffix = type === "audio" || !options.alpha ? "" : ":alpha=1";
  if (fadeInSec > 0.01 && startsAtClipStart) {
    let d = Math.max(0.01, Math.min(duration - 0.01, fadeInSec));
    if (frameDuration > 1e-6) {
      d = Math.max(frameDuration, snapRenderTimeToFrame(d, options.target, "nearest"));
      d = Math.min(Math.max(0.01, duration - 0.01), d);
    }
    filters.push(type === "audio" ? `afade=t=in:st=0:d=${fmtNumber(d)}` : `fade=t=in:st=0:d=${fmtNumber(d)}${alphaSuffix}`);
  }
  if (fadeOutSec > 0.01 && endsAtClipEnd) {
    let d = Math.max(0.01, Math.min(duration - 0.01, fadeOutSec));
    if (frameDuration > 1e-6) {
      d = Math.max(frameDuration, snapRenderTimeToFrame(d, options.target, "nearest"));
      d = Math.min(Math.max(0.01, duration - 0.01), d);
    }
    const st = Math.max(0, duration - d);
    filters.push(type === "audio" ? `afade=t=out:st=${fmtNumber(st)}:d=${fmtNumber(d)}` : `fade=t=out:st=${fmtNumber(st)}:d=${fmtNumber(d)}${alphaSuffix}`);
  }
  return filters;
}

function buildVideoVisualPlan(clip, meta, target) {
  const stream = getVideoStream(meta || {}) || {};
  const frameW = Math.max(2, Number(target.w || 1920));
  const frameH = Math.max(2, Number(target.h || 1080));
  const layoutMeta = Number(stream.width || 0) > 1 || Number(stream.height || 0) > 1
    ? {
        width: Number(stream.width || clip?.meta?.sourceWidth || clip?.meta?.width || frameW),
        height: Number(stream.height || clip?.meta?.sourceHeight || clip?.meta?.height || frameH),
        rotation: clipVisuals.extractMediaRotation ? clipVisuals.extractMediaRotation(stream) : Number(stream?.tags?.rotate || stream?.rotation || 0),
        side_data_list: Array.isArray(stream.side_data_list) ? stream.side_data_list : []
      }
    : {
        width: Number(clip?.meta?.sourceWidth || clip?.meta?.width || frameW),
        height: Number(clip?.meta?.sourceHeight || clip?.meta?.height || frameH),
        displayWidth: Number(clip?.meta?.displayWidth || clip?.meta?.width || frameW),
        displayHeight: Number(clip?.meta?.displayHeight || clip?.meta?.height || frameH),
        rotation: Number(clip?.meta?.rotation || 0)
      };
  const layout = clipVisuals.computeLayout(
    clip,
    layoutMeta,
    frameW,
    frameH
  );
  const displayWidth = clipVisuals.evenize(Math.max(2, layout.displayWidth));
  const displayHeight = clipVisuals.evenize(Math.max(2, layout.displayHeight));
  const anchorPxX = displayWidth * Math.max(0, Math.min(1, Number(layout.visuals.anchorX || 0.5)));
  const anchorPxY = displayHeight * Math.max(0, Math.min(1, Number(layout.visuals.anchorY || 0.5)));
  const padWidth = clipVisuals.evenize(Math.max(displayWidth * 2, displayWidth + 2));
  const padHeight = clipVisuals.evenize(Math.max(displayHeight * 2, displayHeight + 2));
  const padX = (padWidth / 2) - anchorPxX;
  const padY = (padHeight / 2) - anchorPxY;
  const angleRad = (Number(layout.visuals.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angleRad));
  const sin = Math.abs(Math.sin(angleRad));
  const rotatedWidth = clipVisuals.evenize(Math.max(displayWidth, (padWidth * cos) + (padHeight * sin)));
  const rotatedHeight = clipVisuals.evenize(Math.max(displayHeight, (padWidth * sin) + (padHeight * cos)));
  return {
    layout,
    displayWidth,
    displayHeight,
    anchorPxX,
    anchorPxY,
    padWidth,
    padHeight,
    padX,
    padY,
    rotatedWidth,
    rotatedHeight,
    overlayX: Number(layout.positionPxX || 0) - (rotatedWidth / 2),
    overlayY: Number(layout.positionPxY || 0) - (rotatedHeight / 2),
    cropX: Math.max(0, Number(layout.sourceCropX || 0)),
    cropY: Math.max(0, Number(layout.sourceCropY || 0)),
    cropW: Math.max(2, Number(layout.sourceCropW || frameW)),
    cropH: Math.max(2, Number(layout.sourceCropH || frameH)),
    opacity: Math.max(0, Math.min(1, Number(layout.visuals.opacity ?? clip?.opacity ?? 1))),
    rotationDeg: Number(layout.visuals.rotation || 0)
  };
}

function clipNeedsAlphaSafeTransforms(clip) {
  return !!(
    clip?.imageCutoutOriginalPath
    || clip?.meta?.hasAlphaCutout
  );
}

function pushTransparentVideoSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, target, options = {}) {
  const slice = clampSliceWindow(clip, localStart, localEnd, requestedDuration, meta);
  const visualPlan = buildVideoVisualPlan(clip, meta, target);
  const targetFps = fmtNumber(Math.max(1, Number(target?.fps || 30)));
  const alphaSafeTransforms = clipNeedsAlphaSafeTransforms(clip);
  const mediaFilters = [
    `trim=start=${fmtNumber(slice.start)}:end=${fmtNumber(slice.end)}`,
    "setpts=PTS-STARTPTS"
  ];
  if (Math.abs(Number(requestedDuration || slice.actualDuration) - slice.actualDuration) > 0.001) {
    mediaFilters.push(`setpts=${fmtNumber(Math.max(0.02, Number(requestedDuration || slice.actualDuration)) / Math.max(0.02, slice.actualDuration))}*PTS`);
  }
  if (slice.freezeDuration > 0.001) {
    mediaFilters.push(`tpad=stop_mode=clone:stop_duration=${fmtNumber(slice.freezeDuration)}`);
  }
  if (
    Number(visualPlan.layout.visuals.cropLeft || 0) > 0.0001
    || Number(visualPlan.layout.visuals.cropRight || 0) > 0.0001
    || Number(visualPlan.layout.visuals.cropTop || 0) > 0.0001
    || Number(visualPlan.layout.visuals.cropBottom || 0) > 0.0001
  ) {
    mediaFilters.push(
      `crop=w=${fmtNumber(visualPlan.cropW)}:h=${fmtNumber(visualPlan.cropH)}:x=${fmtNumber(visualPlan.cropX)}:y=${fmtNumber(visualPlan.cropY)}`
    );
  }
  mediaFilters.push("format=rgba");
  if (alphaSafeTransforms) mediaFilters.push("premultiply=inplace=1");
  mediaFilters.push(`scale=${visualPlan.displayWidth}:${visualPlan.displayHeight}:flags=lanczos`);
  if (alphaSafeTransforms) mediaFilters.push("unpremultiply=inplace=1");
  mediaFilters.push("format=rgba");
  if (visualPlan.layout?.visuals?.chromaKeyEnabled) {
    const baseSimilarity = clampFinite(visualPlan.layout.visuals.chromaKeySimilarity, 0.01, 0.6, 0.14);
    const reflectionTolerance = clampFinite(visualPlan.layout.visuals.chromaKeyReflectionTolerance, 0, 0.5, 0);
    const effectiveSimilarity = clampFinite(baseSimilarity + (reflectionTolerance * 0.42), 0.01, 0.82, 0.14);
    const effectiveBlend = clampFinite(
      Math.max(0, Number(visualPlan.layout.visuals.chromaKeyBlend || 0.08)) + (reflectionTolerance * 0.1),
      0,
      0.5,
      0.08
    );
    mediaFilters.push(
      `colorkey=0x${normalizeHexColor(visualPlan.layout.visuals.chromaKeyColor, "00FF00")}:${fmtNumber(effectiveSimilarity)}:${fmtNumber(effectiveBlend)}`
    );
  }
  mediaFilters.push(`fps=${targetFps}`, "settb=AVTB", `setpts=N/(${targetFps}*TB)`);
  mediaFilters.push(`colorchannelmixer=aa=${fmtNumber(visualPlan.opacity)}`);
  if (!options.skipManualFade) {
    mediaFilters.push(...buildManualFadeFilters("video", clip, localStart, localEnd, requestedDuration, {
      alpha: true,
      target
    }));
  }

  const mediaLabel = `${outLabel}_media`;
  const paddedLabel = `${outLabel}_pad`;
  const rotatedLabel = `${outLabel}_rot`;
  parts.push(`[${inputIndex}:v:0]${mediaFilters.join(",")}[${mediaLabel}]`);
  parts.push(
    `[${mediaLabel}]pad=${visualPlan.padWidth}:${visualPlan.padHeight}:${fmtNumber(visualPlan.padX)}:${fmtNumber(visualPlan.padY)}:color=black@0.0[${paddedLabel}]`
  );
  if (Math.abs(Number(visualPlan.rotationDeg || 0)) > 0.0001) {
    if (alphaSafeTransforms) {
      parts.push(
        `[${paddedLabel}]premultiply=inplace=1,rotate=a=${fmtNumber((Number(visualPlan.rotationDeg || 0) * Math.PI) / 180)}:ow=${visualPlan.rotatedWidth}:oh=${visualPlan.rotatedHeight}:c=black@0.0,unpremultiply=inplace=1[${rotatedLabel}]`
      );
    } else {
      parts.push(
        `[${paddedLabel}]rotate=a=${fmtNumber((Number(visualPlan.rotationDeg || 0) * Math.PI) / 180)}:ow=${visualPlan.rotatedWidth}:oh=${visualPlan.rotatedHeight}:c=black@0.0[${rotatedLabel}]`
      );
    }
  } else {
    parts.push(`[${paddedLabel}]null[${rotatedLabel}]`);
  }
  return { slice, visualPlan, rgbaLabel: rotatedLabel };
}

function pushRgbaCanvas(parts, outLabel, durationSec, target, colorValue = "black@0.0") {
  parts.push(
    `color=c=${colorValue}:s=${Math.max(2, Number(target.w || 1920))}x${Math.max(2, Number(target.h || 1080))}:r=${fmtNumber(Math.max(1, Number(target.fps || 30)))}:d=${fmtNumber(Math.max(0.02, durationSec || 0.02))},format=rgba[${outLabel}]`
  );
}

function pushTransparentCanvas(parts, outLabel, durationSec, target) {
  pushRgbaCanvas(parts, outLabel, durationSec, target, "black@0.0");
}

function pushOpaqueBlackCanvas(parts, outLabel, durationSec, target) {
  pushRgbaCanvas(parts, outLabel, durationSec, target, getProjectBackgroundColorValue(target, 1));
}

function pushPlacedTransparentVideoSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, target, options = {}) {
  const { slice, visualPlan, rgbaLabel } = pushTransparentVideoSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, target, options);
  const canvasLabel = `${outLabel}_canvas`;
  const placedLabel = `${outLabel}_placed`;
  const segmentTimelineStart = Number.isFinite(Number(options.segmentTimelineStart))
    ? Number(options.segmentTimelineStart)
    : Math.max(0, Number(clip?.start || 0));
  const motionOffsetExpr = buildMotionPathOffsetExprForClip(options.project || activeOverlayProject, clip, segmentTimelineStart, target);
  pushTransparentCanvas(parts, canvasLabel, requestedDuration, target);
  parts.push(
    `[${canvasLabel}][${rgbaLabel}]overlay=x='${fmtNumber(visualPlan.overlayX)}${motionOffsetExpr ? `+(${motionOffsetExpr.xExpr})` : ""}':y='${fmtNumber(visualPlan.overlayY)}${motionOffsetExpr ? `+(${motionOffsetExpr.yExpr})` : ""}':eval=frame:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${placedLabel}]`
  );
  return { slice, visualPlan, rgbaLabel: placedLabel };
}

function pushVideoSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, target, options = {}) {
  const { slice, rgbaLabel } = pushPlacedTransparentVideoSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, target, options);
  const baseLabel = `${outLabel}_base`;
  pushOpaqueBlackCanvas(parts, baseLabel, Math.max(0.02, requestedDuration || 0.02), target);
  parts.push(
    `[${baseLabel}][${rgbaLabel}]overlay=eof_action=pass:repeatlast=0:format=auto:alpha=straight,fps=${fmtNumber(Math.max(1, Number(target.fps || 30)))},format=yuv420p[${outLabel}]`
  );
  return slice;
}

function pushAudioSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, gainExpr = "1", options = {}) {
  const audioStream = getAudioStream(meta || {});
  const slice = clampSliceWindow(clip, localStart, localEnd, requestedDuration, meta);
  const safeGainExpr = guardRuntimeUnitExpr(gainExpr, "1");
  if (audioStream) {
    const filters = [
      `atrim=start=${fmtNumber(slice.start)}:end=${fmtNumber(slice.end)}`,
      "asetpts=PTS-STARTPTS",
      ...buildAtempoFilters(Math.max(0.01, slice.actualDuration / Math.max(0.02, Number(requestedDuration || slice.actualDuration)))),
      "aformat=sample_rates=48000:channel_layouts=stereo",
      "aresample=48000",
      `volume='${safeGainExpr}'`
    ];
    if (!options.skipManualFade) filters.push(...buildManualFadeFilters("audio", clip, localStart, localEnd, requestedDuration));
    if (slice.freezeDuration > 0.001) {
      filters.push(`apad=pad_dur=${fmtNumber(slice.freezeDuration)}`, `atrim=duration=${fmtNumber(requestedDuration)}`);
    }
    parts.push(`[${inputIndex}:a:0]${filters.join(",")}[${outLabel}]`);
    return slice;
  }
  pushSilentAudioSource(parts, outLabel, requestedDuration, gainExpr);
  return slice;
}

function clampMotionPathDelta(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(-1.5, Math.min(1.5, num));
}

function buildEaseInOutQuadExpr(progressExpr) {
  const p = `(${progressExpr})`;
  return `if(lt(${p},0.5),2*${p}*${p},1-pow(-2*${p}+2,2)/2)`;
}

function buildMotionPathEaseExpr(progressExpr, easing = "easeInOutQuad") {
  const value = String(easing || "easeInOutQuad");
  if (value === "easeOutCubic") {
    const p = clampExpr(progressExpr);
    return `(1-pow(1-(${p}),3))`;
  }
  if (value === "easeInOutQuad") {
    return buildEaseInOutQuadExpr(progressExpr);
  }
  return clampExpr(progressExpr);
}

function getClipMotionPathOverlays(project, clip) {
  if (!project || !clip?.id) return [];
  return (project.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((overlay) => overlay.overlayType === "motion_path_move" && overlay.targetClipId === clip.id)
    .sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
}

function buildMotionPathOffsetExprForClip(project, clip, segmentTimelineStart, target) {
  const overlays = getClipMotionPathOverlays(project, clip);
  if (!overlays.length) return null;
  const frameW = Math.max(1, Number(target?.w || 1920));
  const frameH = Math.max(1, Number(target?.h || 1080));
  const absoluteSegmentStart = Number.isFinite(Number(segmentTimelineStart))
    ? Number(segmentTimelineStart)
    : Math.max(0, Number(clip?.start || 0));
  const xParts = [];
  const yParts = [];
  overlays.forEach((overlay) => {
    const snappedWindow = snapRenderWindowToFrames(
      Number(overlay.start || 0),
      Number(overlay.start || 0) + Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.2)),
      target
    );
    const duration = Math.max(MIN_OVERLAY_CLIP_SEC, snappedWindow.duration);
    const start = snappedWindow.start;
    const progressExpr = clampExpr(`(t+${fmtNumber(absoluteSegmentStart)}-${fmtNumber(start)})/${fmtNumber(duration)}`);
    const easedExpr = buildMotionPathEaseExpr(progressExpr, overlay.easing || "easeInOutQuad");
    xParts.push(`(${fmtNumber(frameW * clampMotionPathDelta(overlay.deltaX, 0))}*(${easedExpr}))`);
    yParts.push(`(${fmtNumber(frameH * clampMotionPathDelta(overlay.deltaY, 0))}*(${easedExpr}))`);
  });
  return {
    xExpr: xParts.join("+") || "0",
    yExpr: yParts.join("+") || "0"
  };
}

function pushTimelineClipAudioSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, gainExpr = "1", options = {}) {
  if (!getClipAudioEnabled(clip)) {
    pushSilentAudioSource(parts, outLabel, requestedDuration, gainExpr);
    return clampSliceWindow(clip, localStart, localEnd, requestedDuration, meta);
  }
  return pushAudioSlice(parts, inputIndex, outLabel, clip, localStart, localEnd, requestedDuration, meta, gainExpr, options);
}

function buildTransitionOpacityExpr(segment, progressExpr, mode = "out") {
  const transition = segment?.transition || {};
  const scope = segment?.transitionScope || transition.scope || (mode === "in" ? "intro" : "outro");
  const type = String(segment?.transitionType || transition.type || "").toLowerCase();
  const effectiveMode = scope === "intro" ? "in" : (scope === "outro" ? "out" : mode);
  if (type === "sun_glitter_flash" && transitionMotion?.computeSunGlitterStateExpr) {
    return transitionMotion.computeSunGlitterStateExpr(
      progressExpr,
      fmtNumber(Number(transition.strength ?? 1)),
      {
        mode: effectiveMode
      }
    ).opacityExpr;
  }
  if (type === "focus_pull_in" && transitionMotion?.computeFocusPullTransformExpr) {
    return transitionMotion.computeFocusPullTransformExpr(
      progressExpr,
      Number(transition.anchorX ?? 0.5),
      Number(transition.anchorY ?? 0.5),
      fmtNumber(Number(transition.strength ?? 1)),
      "1",
      "1",
      {
        mode: effectiveMode,
        easingPreset: transition.easingPreset || "dynamic"
      }
    ).opacityExpr;
  }
  if (type === "cyber_mosaic_burst" && transitionMotion?.computeCyberMosaicStateExpr) {
    return transitionMotion.computeCyberMosaicStateExpr(progressExpr, {
      mode: effectiveMode,
      intensity: Number(transition.intensity ?? 1),
      tileDensity: Number(transition.tileDensity ?? 0.68),
      sizeVariance: Number(transition.sizeVariance ?? 0.72),
      clusterCount: Number(transition.clusterCount ?? 4),
      clusterSpread: Number(transition.clusterSpread ?? 0.46),
      jitterSpeed: Number(transition.jitterSpeed ?? 1.2),
      seed: Number(transition.seed ?? 17),
      edgeSoftness: Number(transition.edgeSoftness ?? 0.024)
    }).opacityExpr;
  }
  if (type.startsWith("blur_slide_") && transitionMotion?.computeDirectionalBlurStateExpr) {
    const direction = transition.direction || type.replace("blur_slide_", "");
    return transitionMotion.computeDirectionalBlurStateExpr(
      progressExpr,
      direction,
      fmtNumber(Number(transition.strength ?? 1)),
      "1",
      "1",
      {
        mode: effectiveMode
      }
    ).opacityExpr;
  }
  return effectiveMode === "in"
    ? `max(0,min(1,${progressExpr}))`
    : `max(0,min(1,1-(${progressExpr})))`;
}

function getTransitionStaticBlurSigma(type, transition) {
  const normalizedType = String(type || transition?.type || "").toLowerCase();
  const strength = clampFinite(
    transition?.strength ?? transition?.intensity ?? 1,
    0.2,
    1.6,
    1
  );
  if (normalizedType === "focus_pull_in") {
    return fmtNumber(Math.max(0.6, Math.min(18, 6 + (strength * 6.5))));
  }
  if (normalizedType.startsWith("blur_slide_")) {
    return fmtNumber(Math.max(0.8, Math.min(22, 7 + (strength * 7))));
  }
  return "0";
}

function getSunGlitterExportSigmas(transition) {
  const strength = clampFinite(
    transition?.strength ?? 1,
    0.2,
    1.6,
    1
  );
  return {
    flash: fmtNumber(Math.max(1.4, Math.min(6.2, 1.6 + (strength * 1.8)))),
    glow: fmtNumber(Math.max(6, Math.min(24, 7 + (strength * 8))))
  };
}

function applySunGlitterFlashExportEffect(parts, inputLabel, outLabel, progressExpr, transition, target, options = {}) {
  if (!transitionMotion?.computeSunGlitterStateExpr) {
    parts.push(`[${inputLabel}]null[${outLabel}]`);
    return "1";
  }
  const canvasDuration = Math.max(0.02, Number(options.canvasDuration || 0.02));
  const motion = transitionMotion.computeSunGlitterStateExpr(
    progressExpr,
    fmtNumber(Number(transition?.strength ?? 1)),
    {
      mode: options.mode === "in" ? "in" : "out"
    }
  );
  const sigmas = getSunGlitterExportSigmas(transition);
  const baseLabel = `${outLabel}_base`;
  const flashSource = `${outLabel}_flashsrc`;
  const flashLabel = `${outLabel}_flash`;
  const glowSource = `${outLabel}_glowsrc`;
  const glowLabel = `${outLabel}_glow`;
  const canvasLabel = `${outLabel}_canvas`;
  const mixA = `${outLabel}_mix0`;
  const mixB = `${outLabel}_mix1`;

  parts.push(
    `[${inputLabel}]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${motion.opacityExpr})'[${baseLabel}]`
  );
  parts.push(
    `[${inputLabel}]format=rgba,gblur=sigma=${sigmas.flash}[${flashSource}]`
  );
  parts.push(
    `[${flashSource}]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${motion.flashOpacityExpr})'[${flashLabel}]`
  );
  parts.push(
    `[${inputLabel}]format=rgba,gblur=sigma=${sigmas.glow},colorchannelmixer=rr=1.08:rg=0.04:rb=0.01:gr=0.03:gg=1.01:gb=0.01:br=0.02:bg=0.04:bb=0.82:aa=1[${glowSource}]`
  );
  parts.push(
    `[${glowSource}]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${motion.glowOpacityExpr})'[${glowLabel}]`
  );
  pushTransparentCanvas(parts, canvasLabel, canvasDuration, target);
  parts.push(`[${canvasLabel}][${baseLabel}]overlay=eof_action=pass:repeatlast=0:format=auto[${mixA}]`);
  parts.push(`[${mixA}][${flashLabel}]overlay=eof_action=pass:repeatlast=0:format=auto[${mixB}]`);
  parts.push(`[${mixB}][${glowLabel}]overlay=eof_action=pass:repeatlast=0:format=auto[${outLabel}]`);
  return motion.opacityExpr;
}

function getCyberMosaicExportConfig(transition, mode) {
  if (!transitionMotion?.normalizeCyberMosaicOptions) return null;
  return transitionMotion.normalizeCyberMosaicOptions({
    mode,
    intensity: Number(transition?.intensity ?? 1),
    tileDensity: Number(transition?.tileDensity ?? 0.68),
    sizeVariance: Number(transition?.sizeVariance ?? 0.72),
    clusterCount: Number(transition?.clusterCount ?? 4),
    clusterSpread: Number(transition?.clusterSpread ?? 0.46),
    jitterSpeed: Number(transition?.jitterSpeed ?? 1.2),
    seed: Number(transition?.seed ?? 17),
    edgeSoftness: Number(transition?.edgeSoftness ?? 0.024)
  });
}

function getCyberMosaicExportRects(transition, target, mode) {
  if (!transitionMotion?.buildCyberMosaicRectSet) return [];
  const cfg = getCyberMosaicExportConfig(transition, mode);
  if (!cfg) return [];
  const frameW = Math.max(2, Math.round(Number(target?.w || 1920)));
  const frameH = Math.max(2, Math.round(Number(target?.h || 1080)));
  const rects = transitionMotion.buildCyberMosaicRectSet(cfg) || [];
  return rects.map((rect, index) => {
    let w = Math.max(2, Math.round(frameW * clampFinite(rect?.w, 0.01, 1, 0.08)));
    let h = Math.max(2, Math.round(frameH * clampFinite(rect?.h, 0.01, 1, 0.08)));
    w = Math.min(frameW, w);
    h = Math.min(frameH, h);
    let x = Math.round(frameW * clampFinite(rect?.x, 0, 1, 0.1));
    let y = Math.round(frameH * clampFinite(rect?.y, 0, 1, 0.1));
    x = Math.max(0, Math.min(frameW - w, x));
    y = Math.max(0, Math.min(frameH - h, y));
    return {
      index,
      x,
      y,
      w,
      h,
      revealAt: clampFinite(rect?.revealAt, 0, 1, 0.2),
      revealSoftness: clampFinite(rect?.revealSoftness, 0.01, 0.2, 0.04)
    };
  });
}

function getCyberMosaicSettleStart(transition) {
  const cfg = getCyberMosaicExportConfig(transition, "out");
  const intensity = clampFinite(cfg?.intensity ?? 1, 0.35, 1.6, 1);
  return clampFinite(0.76 - ((intensity - 1) * 0.05), 0.68, 0.84, 0.76);
}

function applyCyberMosaicBurstExportEffect(parts, inputLabel, outLabel, transition, target, options = {}) {
  const mode = options.mode === "in" ? "in" : "out";
  const canvasDuration = Math.max(0.02, Number(options.canvasDuration || 0.02));
  const rects = getCyberMosaicExportRects(transition, target, mode);
  const settleStart = getCyberMosaicSettleStart(transition);
  const settleDuration = Math.max(0.02, canvasDuration * Math.max(0.08, 1 - settleStart));
  const settleStartTime = Math.max(0, canvasDuration - settleDuration);

  if (!rects.length) {
    const fadeType = mode === "in" ? "in" : "out";
    parts.push(
      `[${inputLabel}]fade=t=${fadeType}:st=${fmtNumber(settleStartTime)}:d=${fmtNumber(settleDuration)}:alpha=1[${outLabel}]`
    );
    return;
  }

  if (mode === "out") {
    let currentLabel = inputLabel;
    rects.forEach((rect) => {
      const nextLabel = rect.index === rects.length - 1 ? outLabel : `${outLabel}_box${rect.index}`;
      const revealTime = fmtNumber(canvasDuration * rect.revealAt);
      const boxFilters = [
        `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.w}:h=${rect.h}:t=fill:color=black@0.0:replace=1:enable='gte(t,${revealTime})'`
      ];
      if (rect.index === rects.length - 1) {
        boxFilters.push(`fade=t=out:st=${fmtNumber(settleStartTime)}:d=${fmtNumber(settleDuration)}:alpha=1`);
      }
      parts.push(`[${currentLabel}]${boxFilters.join(",")}[${nextLabel}]`);
      currentLabel = nextLabel;
    });
    return;
  }

  const splitLabels = rects.map((rect) => `${outLabel}_src${rect.index}`);
  const fullLabel = `${outLabel}_full`;
  const splitTargets = [...splitLabels.map((label) => `[${label}]`), `[${fullLabel}]`].join("");
  const canvasLabel = `${outLabel}_canvas`;
  pushTransparentCanvas(parts, canvasLabel, canvasDuration, target);
  parts.push(`[${inputLabel}]split=${rects.length + 1}${splitTargets}`);

  let currentLabel = canvasLabel;
  rects.forEach((rect) => {
    const cropLabel = `${outLabel}_crop${rect.index}`;
    const nextLabel = `${outLabel}_patch${rect.index}`;
    const revealTime = fmtNumber(canvasDuration * rect.revealAt);
    parts.push(`[${splitLabels[rect.index]}]crop=${rect.w}:${rect.h}:${rect.x}:${rect.y}[${cropLabel}]`);
    parts.push(
      `[${currentLabel}][${cropLabel}]overlay=x=${rect.x}:y=${rect.y}:enable='gte(t,${revealTime})':eof_action=pass:repeatlast=0:format=auto[${nextLabel}]`
    );
    currentLabel = nextLabel;
  });

  const fadeLabel = `${outLabel}_fade`;
  parts.push(
    `[${fullLabel}]fade=t=in:st=${fmtNumber(settleStartTime)}:d=${fmtNumber(settleDuration)}:alpha=1[${fadeLabel}]`
  );
  parts.push(`[${currentLabel}][${fadeLabel}]overlay=eof_action=pass:repeatlast=0:format=auto[${outLabel}]`);
}

function applyTransitionVideoEffect(parts, inputLabel, outLabel, segment, progressExpr, target, options = {}) {
  const transition = segment?.transition || {};
  const type = String(segment?.transitionType || transition.type || "").toLowerCase();
  const scope = segment?.transitionScope || transition.scope || (options.mode === "in" ? "intro" : "outro");
  const mode = scope === "intro" ? "in" : (options.mode || "out");
  const motionProgressExpr = String(options.motionProgressExpr || progressExpr || "0");
  const pixelProgressExpr = String(options.pixelProgressExpr || motionProgressExpr).replace(/\bt\b/g, "T");
  const targetWidthExpr = fmtNumber(Math.max(2, Number(target.w || 1920)));
  const targetHeightExpr = fmtNumber(Math.max(2, Number(target.h || 1080)));
  const canvasDuration = Math.max(0.02, Number(options.canvasDuration || segment?.duration || 0.02));
  if (type === "sun_glitter_flash" && transitionMotion?.computeSunGlitterStateExpr) {
    return applySunGlitterFlashExportEffect(parts, inputLabel, outLabel, pixelProgressExpr, transition, target, {
      mode,
      canvasDuration
    });
  }
  if (type === "cyber_mosaic_burst" && transitionMotion?.computeCyberMosaicStateExpr) {
    applyCyberMosaicBurstExportEffect(parts, inputLabel, outLabel, transition, target, {
      mode,
      canvasDuration
    });
    return buildTransitionOpacityExpr(segment, pixelProgressExpr, mode);
  }
  if (type === "focus_pull_in" && transitionMotion?.computeFocusPullTransformExpr) {
    const motion = transitionMotion.computeFocusPullTransformExpr(
      motionProgressExpr,
      Number(transition.anchorX ?? 0.5),
      Number(transition.anchorY ?? 0.5),
      fmtNumber(Number(transition.strength ?? 1)),
      targetWidthExpr,
      targetHeightExpr,
      {
        mode,
        easingPreset: transition.easingPreset || "dynamic"
      }
    );
    const alphaMotion = transitionMotion.computeFocusPullTransformExpr(
      pixelProgressExpr,
      Number(transition.anchorX ?? 0.5),
      Number(transition.anchorY ?? 0.5),
      fmtNumber(Number(transition.strength ?? 1)),
      targetWidthExpr,
      targetHeightExpr,
      {
        mode,
        easingPreset: transition.easingPreset || "dynamic"
      }
    );
    const frameWidth = Math.max(2, Math.round(Number(target.w || 1920)));
    const frameHeight = Math.max(2, Math.round(Number(target.h || 1080)));
    const anchorPx = frameWidth * Math.max(0, Math.min(1, Number(transition.anchorX ?? 0.5)));
    const anchorPy = frameHeight * Math.max(0, Math.min(1, Number(transition.anchorY ?? 0.5)));
    const padWidth = Math.max(frameWidth * 4, 8);
    const padHeight = Math.max(frameHeight * 4, 8);
    const padCenterX = padWidth / 2;
    const padCenterY = padHeight / 2;
    const cropX = Math.max(0, Math.round(padCenterX - anchorPx));
    const cropY = Math.max(0, Math.round(padCenterY - anchorPy));
    const scaledLabel = `${outLabel}_scaled`;
    const canvasLabel = `${outLabel}_canvas`;
    const placedLabel = `${outLabel}_placed`;
    const rotatedLabel = `${outLabel}_rotated`;
    const croppedLabel = `${outLabel}_cropped`;
    const blurredLabel = `${outLabel}_blurred`;
    const alphaLabel = `${outLabel}_alpha`;
    const blurSigma = getTransitionStaticBlurSigma(type, transition);
    const alphaExpr = options.keepOpaque ? "1" : alphaMotion.opacityExpr;
    const scaledWidthExpr = `max(2,ceil((${targetWidthExpr})*(${motion.scaleXExpr})/2)*2)`;
    const scaledHeightExpr = `max(2,ceil((${targetHeightExpr})*(${motion.scaleYExpr})/2)*2)`;
    const padXExpr = `(${fmtNumber(padCenterX)}-((${fmtNumber(anchorPx)})*(${motion.scaleXExpr})))`;
    const padYExpr = `(${fmtNumber(padCenterY)}-((${fmtNumber(anchorPy)})*(${motion.scaleYExpr})))`;
    parts.push(
      `[${inputLabel}]scale=w='${scaledWidthExpr}':h='${scaledHeightExpr}':eval=frame:flags=lanczos,format=rgba[${scaledLabel}]`
    );
    parts.push(
      `color=c=black@0.0:s=${padWidth}x${padHeight}:r=${fmtNumber(Math.max(1, Number(target.fps || 30)))}:d=${fmtNumber(Math.max(TIMELINE_TIME_STEP_SEC, Number(canvasDuration || TIMELINE_TIME_STEP_SEC)))},format=rgba[${canvasLabel}]`
    );
    // `pad` proved brittle with the long focus-pull expressions on Windows/FFmpeg.
    // Place the scaled layer on a transparent canvas via `overlay`, then rotate/crop it.
    parts.push(
      `[${canvasLabel}][${scaledLabel}]overlay=x='${padXExpr}':y='${padYExpr}':eval=frame:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${placedLabel}]`
    );
    parts.push(
      `[${placedLabel}]rotate='${motion.angleRadExpr}':ow=${padWidth}:oh=${padHeight}:c=black@0[${rotatedLabel}]`
    );
    parts.push(
      `[${rotatedLabel}]crop=${frameWidth}:${frameHeight}:${cropX}:${cropY},gblur=sigma=${blurSigma},format=rgba[${blurredLabel}]`
    );
    parts.push(
      `[${blurredLabel}]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${alphaExpr})'[${alphaLabel}]`
    );
    parts.push(
      `[${alphaLabel}]null[${outLabel}]`
    );
    return alphaExpr;
  }
  if (type.startsWith("blur_slide_") && transitionMotion?.computeDirectionalBlurStateExpr) {
    const motion = transitionMotion.computeDirectionalBlurStateExpr(
      motionProgressExpr,
      transition.direction || type.replace("blur_slide_", ""),
      fmtNumber(Number(transition.strength ?? 1)),
      targetWidthExpr,
      targetHeightExpr,
      {
        mode
      }
    );
    const alphaMotion = transitionMotion.computeDirectionalBlurStateExpr(
      pixelProgressExpr,
      transition.direction || type.replace("blur_slide_", ""),
      fmtNumber(Number(transition.strength ?? 1)),
      targetWidthExpr,
      targetHeightExpr,
      {
        mode
      }
    );
    const movedLabel = `${outLabel}_moved`;
    const alphaLabel = `${outLabel}_alpha`;
    const canvasLabel = `${outLabel}_canvas`;
    const blurSigma = getTransitionStaticBlurSigma(type, transition);
    parts.push(
      `[${inputLabel}]gblur=sigma=${blurSigma},format=rgba[${movedLabel}]`
    );
    parts.push(
      `[${movedLabel}]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${alphaMotion.opacityExpr})'[${alphaLabel}]`
    );
    pushTransparentCanvas(parts, canvasLabel, canvasDuration, target);
    parts.push(
      `[${canvasLabel}][${alphaLabel}]overlay=x='${motion.translateXExpr}':y='${motion.translateYExpr}':eof_action=pass:repeatlast=0:format=auto:eval=frame[${outLabel}]`
    );
    return alphaMotion.opacityExpr;
  }
  const alphaExpr = buildTransitionOpacityExpr(segment, pixelProgressExpr, mode);
  parts.push(
    `[${inputLabel}]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${alphaExpr})'[${outLabel}]`
  );
  return alphaExpr;
}

function buildProgressExpr(segmentDuration, fromProgress, toProgress, varName) {
  const len = Math.max(0.001, finiteNumber(segmentDuration, 0.001));
  const start = finiteNumber(fromProgress, 0);
  const delta = finiteNumber(toProgress, 1) - start;
  return `${fmtNumber(start)}+(${fmtNumber(delta)}*${varName}/${fmtNumber(len)})`;
}

function appendDetachedAudioMix(parts, project, rangeStart, rangeEnd, ensureInput, probeByPath, baseAudioLabel) {
  const durationSec = Math.max(0.02, Number(rangeEnd || 0) - Number(rangeStart || 0));
  const detachedItems = (project.audioItems || [])
    .filter((audio) => String(audio?.linkMode || "detached") !== "linked")
    .map((audio) => normalizeAudioItemForRender(audio))
    .filter((audio) => {
      const start = Number(audio.start || 0);
      const end = start + Math.max(MIN_AUDIO_CLIP_SEC, Number(audio.duration || MIN_AUDIO_CLIP_SEC));
      return end > Number(rangeStart || 0) + 1e-6 && start < Number(rangeEnd || 0) - 1e-6;
    })
    .sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
  if (!detachedItems.length) return baseAudioLabel;

  const mixLabels = [`[${baseAudioLabel}]`];
  let seq = 0;
  detachedItems.forEach((audio) => {
    const sourcePath = getAudioItemSourcePath(audio);
    if (!sourcePath) return;
    const inputIndex = ensureInput(audio);
    if (inputIndex < 0) return;
    const activeStart = Math.max(Number(rangeStart || 0), Number(audio.start || 0));
    const activeEnd = Math.min(Number(rangeEnd || 0), Number(audio.start || 0) + Math.max(MIN_AUDIO_CLIP_SEC, Number(audio.duration || MIN_AUDIO_CLIP_SEC)));
    if (activeEnd <= activeStart + 1e-6) return;

    const clipOffset = activeStart - Number(audio.start || 0);
    const localStart = getAudioItemSourceIn(audio) + Math.max(0, clipOffset);
    const localEnd = Math.min(getAudioItemSourceOut(audio), localStart + (activeEnd - activeStart));
    const duration = Math.max(0.02, activeEnd - activeStart);
    const sliceLabel = `adet${seq}`;
    const meta = probeByPath.get(sourcePath) || null;
    pushAudioSlice(parts, inputIndex, sliceLabel, audio, localStart, localEnd, duration, meta, fmtGain(audio.gain ?? 1));

    const delaySec = Math.max(0, activeStart - Number(rangeStart || 0));
    let delayedLabel = sliceLabel;
    if (delaySec > 0.0005) {
      delayedLabel = `adetd${seq}`;
      const delayMs = Math.max(0, Math.round(delaySec * 1000));
      parts.push(`[${sliceLabel}]adelay=${delayMs}|${delayMs}[${delayedLabel}]`);
    }
    mixLabels.push(`[${delayedLabel}]`);
    seq += 1;
  });

  if (mixLabels.length === 1) return baseAudioLabel;
  const mixedLabel = `${baseAudioLabel}_detached`;
  parts.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:normalize=0:duration=longest,atrim=duration=${fmtNumber(durationSec)},asetpts=PTS-STARTPTS[${mixedLabel}]`);
  return mixedLabel;
}

function buildTimelineSegmentFilter(project, rangeStart, rangeEnd, probeByPath, target, options = {}) {
  activeOverlayProject = project || null;
  const audioOnly = !!options.audioOnly;
  const videoOnly = !!options.videoOnly;
  const analysis = renderGraph.analyzeProject(project);
  const segments = renderGraph.collectVisibleIntervals(analysis, rangeStart, rangeEnd, {
    fps: Math.max(1, Number(target?.fps || 30))
  });
  const inputMap = new Map();
  const inputs = [];
  const parts = [];
  const pairLabels = [];
  const audioLabels = [];

  const ensureInput = (clip) => {
    const sourcePath = getClipSourcePath(clip);
    if (!sourcePath) return -1;
    if (!inputMap.has(sourcePath)) {
      inputMap.set(sourcePath, inputs.length);
      inputs.push(sourcePath);
    }
    return inputMap.get(sourcePath);
  };

  if (!segments.length) {
    const durationSec = Math.max(0.02, Number(rangeEnd || 0) - Number(rangeStart || 0));
    const silentLabel = "asilence0";
    if (!audioOnly) pushBlackVideoSource(parts, "vout", durationSec, target);
    if (!videoOnly) pushSilentAudioSource(parts, silentLabel, durationSec);
    const mixedAudioLabel = videoOnly
      ? null
      : appendDetachedAudioMix(parts, project, rangeStart, rangeEnd, ensureInput, probeByPath, silentLabel);
    return {
      inputs,
      filter: parts.join(";"),
      map: audioOnly ? { a: mixedAudioLabel } : (videoOnly ? { v: "vout" } : { v: "vout", a: mixedAudioLabel }),
      durationSec
    };
  }

  segments.forEach((segment, idx) => {
    const duration = Math.max(0.02, Number(segment.duration || 0.02));
    const vLabel = `vseg${idx}`;
    const aLabel = `aseg${idx}`;

    if (segment.kind === "empty") {
      if (!audioOnly) pushBlackVideoSource(parts, vLabel, duration, target);
      if (!videoOnly) pushSilentAudioSource(parts, aLabel, duration);
    } else if (segment.kind === "single") {
      const inputIndex = ensureInput(segment.clip);
      const meta = probeByPath.get(getClipSourcePath(segment.clip)) || null;
      const gainExpr = fmtGain(segment.clip?.gain ?? 1);
      if (!audioOnly) {
        pushVideoSlice(parts, inputIndex, vLabel, segment.clip, segment.localStart, segment.localEnd, duration, meta, target, {
          segmentTimelineStart: Number(segment.start || segment.clip?.start || 0)
        });
      }
      if (!videoOnly) pushTimelineClipAudioSlice(parts, inputIndex, aLabel, segment.clip, segment.localStart, segment.localEnd, duration, meta, gainExpr);
    } else if (segment.kind === "single_transition") {
      const inputIndex = ensureInput(segment.clip);
      const meta = probeByPath.get(getClipSourcePath(segment.clip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const clipVideo = `vstclip${idx}`;
      const effectVideo = `vsteff${idx}`;
      const blackVideo = `vstblack${idx}`;
      const clipAudio = `astclip${idx}`;
      const opacityExpr = buildTransitionOpacityExpr(segment, audioProgressExpr, segment.transitionScope === "intro" ? "in" : "out");
      if (!audioOnly) {
        const placed = pushPlacedTransparentVideoSlice(parts, inputIndex, clipVideo, segment.clip, segment.localStart, segment.localEnd, duration, meta, target, {
          skipManualFade: true,
          segmentTimelineStart: Number(segment.start || segment.clip?.start || 0)
        });
        applyTransitionVideoEffect(parts, placed.rgbaLabel, effectVideo, segment, videoProgressExpr, target, {
          mode: segment.transitionScope === "intro" ? "in" : "out"
        });
        pushTransparentCanvas(parts, blackVideo, duration, target);
        parts.push(`[${blackVideo}][${effectVideo}]overlay=eof_action=pass:repeatlast=0:format=auto,fps=${fmtNumber(Math.max(1, Number(target.fps || 30)))},format=yuv420p[${vLabel}]`);
      }
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, inputIndex, clipAudio, segment.clip, segment.localStart, segment.localEnd, duration, meta, "1", { skipManualFade: true });
        parts.push(`[${clipAudio}]volume='${buildVolumeExpr(segment.clip?.gain ?? 1, opacityExpr)}'[${aLabel}]`);
      }
    } else if (segment.kind === "stacked_transition") {
      const baseIndex = ensureInput(segment.baseClip);
      const overlayIndex = ensureInput(segment.overlayClip);
      const baseMeta = probeByPath.get(getClipSourcePath(segment.baseClip)) || null;
      const overlayMeta = probeByPath.get(getClipSourcePath(segment.overlayClip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const baseVideo = `vstbase${idx}`;
      const overlayPlaced = `vstover${idx}`;
      const overlayEffect = `vstfx${idx}`;
      const baseEffect = `vstbasefx${idx}`;
      const baseAudio = `astbase${idx}`;
      const overlayAudio = `astover${idx}`;
      const baseAudioMix = `astbmix${idx}`;
      const overlayAudioMix = `astomix${idx}`;
      const baseOpacityExpr = buildTransitionOpacityExpr(segment, audioProgressExpr, "in");
      const overlayOpacityExpr = buildTransitionOpacityExpr(segment, audioProgressExpr, "out");
      if (!audioOnly) {
        pushVideoSlice(parts, baseIndex, baseVideo, segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, target, {
          skipManualFade: true,
          segmentTimelineStart: Number(segment.start || segment.baseClip?.start || 0)
        });
        const placed = pushPlacedTransparentVideoSlice(parts, overlayIndex, overlayPlaced, segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, target, {
          skipManualFade: true,
          segmentTimelineStart: Number(segment.start || segment.overlayClip?.start || 0)
        });
        applyTransitionVideoEffect(parts, placed.rgbaLabel, overlayEffect, segment, videoProgressExpr, target, { mode: "out" });
        applyTransitionVideoEffect(parts, baseVideo, baseEffect, segment, videoProgressExpr, target, { mode: "in" });
        parts.push(`[${baseEffect}][${overlayEffect}]overlay=eof_action=pass:repeatlast=0:format=auto,fps=${fmtNumber(Math.max(1, Number(target.fps || 30)))},format=yuv420p[${vLabel}]`);
      }
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, baseIndex, baseAudio, segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, "1", { skipManualFade: true });
        pushTimelineClipAudioSlice(parts, overlayIndex, overlayAudio, segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, "1", { skipManualFade: true });
        parts.push(`[${baseAudio}]volume='${buildVolumeExpr(segment.baseClip?.gain ?? 1, baseOpacityExpr)}'[${baseAudioMix}]`);
        parts.push(`[${overlayAudio}]volume='${buildVolumeExpr(segment.overlayClip?.gain ?? 1, overlayOpacityExpr)}'[${overlayAudioMix}]`);
        parts.push(`[${baseAudioMix}][${overlayAudioMix}]amix=inputs=2:normalize=0:duration=longest,atrim=duration=${fmtNumber(duration)},asetpts=PTS-STARTPTS[${aLabel}]`);
      }
    } else if (segment.kind === "cross") {
      const baseIndex = ensureInput(segment.baseClip);
      const overlayIndex = ensureInput(segment.overlayClip);
      const baseMeta = probeByPath.get(getClipSourcePath(segment.baseClip)) || null;
      const overlayMeta = probeByPath.get(getClipSourcePath(segment.overlayClip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const baseVideo = `vbase${idx}`;
      const overVideo = `vover${idx}`;
      const baseAudio = `abase${idx}`;
      const overAudio = `aover${idx}`;
      const baseAudioMix = `abmix${idx}`;
      const overAudioMix = `aomix${idx}`;
      // Cross/overlap already blends opacity itself, so edge fade filters would briefly dim toward black.
      if (!audioOnly) {
        pushVideoSlice(parts, baseIndex, baseVideo, segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, target, {
          skipManualFade: true,
          segmentTimelineStart: Number(segment.start || segment.baseClip?.start || 0)
        });
        pushVideoSlice(parts, overlayIndex, overVideo, segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, target, {
          skipManualFade: true,
          segmentTimelineStart: Number(segment.start || segment.overlayClip?.start || 0)
        });
        parts.push(`[${baseVideo}][${overVideo}]blend=all_expr='A*(1-(${videoProgressExpr}))+B*(${videoProgressExpr})'[${vLabel}]`);
      }
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, baseIndex, baseAudio, segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, "1", { skipManualFade: true });
        pushTimelineClipAudioSlice(parts, overlayIndex, overAudio, segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, "1", { skipManualFade: true });
        parts.push(`[${baseAudio}]volume='${buildVolumeExpr(segment.baseClip?.gain ?? 1, `max(0,min(1,1-(${audioProgressExpr})))`)}'[${baseAudioMix}]`);
        parts.push(`[${overAudio}]volume='${buildVolumeExpr(segment.overlayClip?.gain ?? 1, `max(0,min(1,(${audioProgressExpr})))`)}'[${overAudioMix}]`);
        parts.push(`[${baseAudioMix}][${overAudioMix}]amix=inputs=2:normalize=0:duration=longest,atrim=duration=${fmtNumber(duration)},asetpts=PTS-STARTPTS[${aLabel}]`);
      }
    } else if (segment.kind === "fade_out_black" || segment.kind === "fade_in_black") {
      const inputIndex = ensureInput(segment.clip);
      const meta = probeByPath.get(getClipSourcePath(segment.clip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const clipVideo = `vfclip${idx}`;
      const clipAudio = `afclip${idx}`;
      const blackVideo = `vfblack${idx}`;
      if (!audioOnly) {
        pushVideoSlice(parts, inputIndex, clipVideo, segment.clip, segment.localStart, segment.localEnd, duration, meta, target, {
          segmentTimelineStart: Number(segment.start || segment.clip?.start || 0)
        });
        pushBlackVideoSource(parts, blackVideo, duration, target);
        if (segment.kind === "fade_out_black") {
          parts.push(`[${clipVideo}][${blackVideo}]blend=all_expr='A*(1-(${videoProgressExpr}))+B*(${videoProgressExpr})'[${vLabel}]`);
        } else {
          parts.push(`[${blackVideo}][${clipVideo}]blend=all_expr='A*(1-(${videoProgressExpr}))+B*(${videoProgressExpr})'[${vLabel}]`);
        }
      }
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, inputIndex, clipAudio, segment.clip, segment.localStart, segment.localEnd, duration, meta, "1");
        if (segment.kind === "fade_out_black") {
          parts.push(`[${clipAudio}]volume='${buildVolumeExpr(segment.clip?.gain ?? 1, `max(0,min(1,1-(${audioProgressExpr})))`)}'[${aLabel}]`);
        } else {
          parts.push(`[${clipAudio}]volume='${buildVolumeExpr(segment.clip?.gain ?? 1, `max(0,min(1,(${audioProgressExpr})))`)}'[${aLabel}]`);
        }
      }
    }

    if (audioOnly) {
      audioLabels.push(`[${aLabel}]`);
    } else if (videoOnly) {
      pairLabels.push(`[${vLabel}]`);
    } else {
      pairLabels.push(`[${vLabel}][${aLabel}]`);
    }
  });

  if (audioOnly) {
    parts.push(`${audioLabels.join("")}concat=n=${audioLabels.length}:v=0:a=1[aout]`);
  } else if (videoOnly) {
    parts.push(`${pairLabels.join("")}concat=n=${pairLabels.length}:v=1:a=0[vout]`);
  } else {
    parts.push(`${pairLabels.join("")}concat=n=${pairLabels.length}:v=1:a=1[vout][aout]`);
  }
  if (!audioOnly) {
    const targetFps = fmtNumber(Math.max(1, Number(target?.fps || 30)));
    parts.push(`[vout]fps=${targetFps},settb=AVTB,setpts=N/(${targetFps}*TB)[vout_norm]`);
  }

  const mixedAudioLabel = videoOnly
    ? null
    : appendDetachedAudioMix(parts, project, rangeStart, rangeEnd, ensureInput, probeByPath, "aout");

  return {
    inputs,
    filter: parts.join(";"),
    map: audioOnly ? { a: mixedAudioLabel } : (videoOnly ? { v: "vout_norm" } : { v: "vout_norm", a: mixedAudioLabel }),
    durationSec: segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.duration || 0)), 0)
  };
}

function createSharedInputRegistry() {
  return {
    inputMap: new Map(),
    inputs: []
  };
}

function getRenderableItemSourcePath(item) {
  if (!item) return "";
  if (Number.isFinite(Number(item.out)) || Number.isFinite(Number(item.in)) || item.meta || item.linkedAudioId != null) {
    return getClipSourcePath(item);
  }
  return getAudioItemSourcePath(item);
}

function ensureSharedInputIndex(shared, item) {
  const sourcePath = getRenderableItemSourcePath(item);
  if (!sourcePath) return -1;
  if (!shared.inputMap.has(sourcePath)) {
    shared.inputMap.set(sourcePath, shared.inputs.length);
    shared.inputs.push(sourcePath);
  }
  return shared.inputMap.get(sourcePath);
}

function buildSectionTransparentTimelineFilter(project, section, rangeStart, rangeEnd, probeByPath, target, sharedInputs, options = {}) {
  activeOverlayProject = project || null;
  const labelPrefix = String(options.labelPrefix || `sec${section}_`);
  const videoOnly = !!options.videoOnly;
  const label = (name) => `${labelPrefix}${name}`;
  const filteredProject = {
    ...project,
    videoClips: (project.videoClips || []).filter((clip) => Math.max(1, Number(clip.section || 1)) === section),
    audioItems: []
  };
  const analysis = renderGraph.analyzeProject(filteredProject);
  const segments = renderGraph.collectVisibleIntervals(analysis, rangeStart, rangeEnd, {
    fps: Math.max(1, Number(target?.fps || 30))
  });
  const parts = [];
  const pairLabels = [];
  const durationSec = Math.max(0.02, Number(rangeEnd || 0) - Number(rangeStart || 0));

  if (!segments.length) {
    pushTransparentCanvas(parts, label("vout"), durationSec, target);
    if (!videoOnly) pushSilentAudioSource(parts, label("aout"), durationSec);
    return {
      filter: parts.join(";"),
      map: videoOnly ? { v: label("vout") } : { v: label("vout"), a: label("aout") },
      durationSec
    };
  }

  segments.forEach((segment, idx) => {
    const duration = Math.max(0.02, Number(segment.duration || 0.02));
    const vLabel = label(`vseg${idx}`);
    const aLabel = label(`aseg${idx}`);

    if (segment.kind === "empty") {
      pushTransparentCanvas(parts, vLabel, duration, target);
      if (!videoOnly) pushSilentAudioSource(parts, aLabel, duration);
      pairLabels.push(videoOnly ? `[${vLabel}]` : `[${vLabel}][${aLabel}]`);
      return;
    }

    if (segment.kind === "single") {
      const inputIndex = ensureSharedInputIndex(sharedInputs, segment.clip);
      const meta = probeByPath.get(getClipSourcePath(segment.clip)) || null;
      const gainExpr = fmtGain(segment.clip?.gain ?? 1);
      const placed = pushPlacedTransparentVideoSlice(parts, inputIndex, label(`vsingle${idx}`), segment.clip, segment.localStart, segment.localEnd, duration, meta, target, {
        segmentTimelineStart: Number(segment.start || segment.clip?.start || 0)
      });
      parts.push(`[${placed.rgbaLabel}]format=rgba[${vLabel}]`);
      if (!videoOnly) pushTimelineClipAudioSlice(parts, inputIndex, aLabel, segment.clip, segment.localStart, segment.localEnd, duration, meta, gainExpr);
      pairLabels.push(videoOnly ? `[${vLabel}]` : `[${vLabel}][${aLabel}]`);
      return;
    }

    if (segment.kind === "single_transition") {
      const inputIndex = ensureSharedInputIndex(sharedInputs, segment.clip);
      const meta = probeByPath.get(getClipSourcePath(segment.clip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const placed = pushPlacedTransparentVideoSlice(parts, inputIndex, label(`vstclip${idx}`), segment.clip, segment.localStart, segment.localEnd, duration, meta, target, {
        skipManualFade: true,
        segmentTimelineStart: Number(segment.start || segment.clip?.start || 0)
      });
      const effectVideo = label(`vsteff${idx}`);
      const transparentVideo = label(`vsttrans${idx}`);
      const clipAudio = label(`astclip${idx}`);
      const opacityExpr = buildTransitionOpacityExpr(segment, audioProgressExpr, segment.transitionScope === "intro" ? "in" : "out");
      applyTransitionVideoEffect(parts, placed.rgbaLabel, effectVideo, segment, videoProgressExpr, target, {
        mode: segment.transitionScope === "intro" ? "in" : "out"
      });
      pushTransparentCanvas(parts, transparentVideo, duration, target);
      parts.push(`[${transparentVideo}][${effectVideo}]overlay=eof_action=pass:repeatlast=0:format=auto:alpha=straight,format=rgba[${vLabel}]`);
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, inputIndex, clipAudio, segment.clip, segment.localStart, segment.localEnd, duration, meta, "1", { skipManualFade: true });
        parts.push(`[${clipAudio}]volume='${buildVolumeExpr(segment.clip?.gain ?? 1, opacityExpr)}'[${aLabel}]`);
      }
      pairLabels.push(videoOnly ? `[${vLabel}]` : `[${vLabel}][${aLabel}]`);
      return;
    }

    if (segment.kind === "stacked_transition") {
      const baseIndex = ensureSharedInputIndex(sharedInputs, segment.baseClip);
      const overlayIndex = ensureSharedInputIndex(sharedInputs, segment.overlayClip);
      const baseMeta = probeByPath.get(getClipSourcePath(segment.baseClip)) || null;
      const overlayMeta = probeByPath.get(getClipSourcePath(segment.overlayClip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const basePlaced = pushPlacedTransparentVideoSlice(parts, baseIndex, label(`vstbase${idx}`), segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, target, {
        skipManualFade: true,
        segmentTimelineStart: Number(segment.start || segment.baseClip?.start || 0)
      });
      const overlayPlaced = pushPlacedTransparentVideoSlice(parts, overlayIndex, label(`vstover${idx}`), segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, target, {
        skipManualFade: true,
        segmentTimelineStart: Number(segment.start || segment.overlayClip?.start || 0)
      });
      const overlayEffect = label(`vstfx${idx}`);
      const baseEffect = label(`vstbasefx${idx}`);
      const baseAudio = label(`astbase${idx}`);
      const overlayAudio = label(`astover${idx}`);
      const baseAudioMix = label(`astbmix${idx}`);
      const overlayAudioMix = label(`astomix${idx}`);
      const baseOpacityExpr = buildTransitionOpacityExpr(segment, audioProgressExpr, "in");
      const overlayOpacityExpr = buildTransitionOpacityExpr(segment, audioProgressExpr, "out");
      applyTransitionVideoEffect(parts, overlayPlaced.rgbaLabel, overlayEffect, segment, videoProgressExpr, target, { mode: "out" });
      applyTransitionVideoEffect(parts, basePlaced.rgbaLabel, baseEffect, segment, videoProgressExpr, target, { mode: "in" });
      parts.push(`[${baseEffect}][${overlayEffect}]overlay=eof_action=pass:repeatlast=0:format=auto:alpha=straight,format=rgba[${vLabel}]`);
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, baseIndex, baseAudio, segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, "1", { skipManualFade: true });
        pushTimelineClipAudioSlice(parts, overlayIndex, overlayAudio, segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, "1", { skipManualFade: true });
        parts.push(`[${baseAudio}]volume='${buildVolumeExpr(segment.baseClip?.gain ?? 1, baseOpacityExpr)}'[${baseAudioMix}]`);
        parts.push(`[${overlayAudio}]volume='${buildVolumeExpr(segment.overlayClip?.gain ?? 1, overlayOpacityExpr)}'[${overlayAudioMix}]`);
        parts.push(`[${baseAudioMix}][${overlayAudioMix}]amix=inputs=2:normalize=0:duration=longest,atrim=duration=${fmtNumber(duration)},asetpts=PTS-STARTPTS[${aLabel}]`);
      }
      pairLabels.push(videoOnly ? `[${vLabel}]` : `[${vLabel}][${aLabel}]`);
      return;
    }

    if (segment.kind === "cross") {
      const baseIndex = ensureSharedInputIndex(sharedInputs, segment.baseClip);
      const overlayIndex = ensureSharedInputIndex(sharedInputs, segment.overlayClip);
      const baseMeta = probeByPath.get(getClipSourcePath(segment.baseClip)) || null;
      const overlayMeta = probeByPath.get(getClipSourcePath(segment.overlayClip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "T");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const basePlaced = pushPlacedTransparentVideoSlice(parts, baseIndex, label(`vbase${idx}`), segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, target, {
        skipManualFade: true,
        segmentTimelineStart: Number(segment.start || segment.baseClip?.start || 0)
      });
      const overPlaced = pushPlacedTransparentVideoSlice(parts, overlayIndex, label(`vover${idx}`), segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, target, {
        skipManualFade: true,
        segmentTimelineStart: Number(segment.start || segment.overlayClip?.start || 0)
      });
      const baseAudio = label(`abase${idx}`);
      const overAudio = label(`aover${idx}`);
      const baseAudioMix = label(`abmix${idx}`);
      const overAudioMix = label(`aomix${idx}`);
      parts.push(`[${basePlaced.rgbaLabel}][${overPlaced.rgbaLabel}]blend=all_expr='A*(1-(${videoProgressExpr}))+B*(${videoProgressExpr})',format=rgba[${vLabel}]`);
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, baseIndex, baseAudio, segment.baseClip, segment.baseLocalStart, segment.baseLocalEnd, duration, baseMeta, "1", { skipManualFade: true });
        pushTimelineClipAudioSlice(parts, overlayIndex, overAudio, segment.overlayClip, segment.overlayLocalStart, segment.overlayLocalEnd, duration, overlayMeta, "1", { skipManualFade: true });
        parts.push(`[${baseAudio}]volume='${buildVolumeExpr(segment.baseClip?.gain ?? 1, `max(0,min(1,1-(${audioProgressExpr})))`)}'[${baseAudioMix}]`);
        parts.push(`[${overAudio}]volume='${buildVolumeExpr(segment.overlayClip?.gain ?? 1, `max(0,min(1,(${audioProgressExpr})))`)}'[${overAudioMix}]`);
        parts.push(`[${baseAudioMix}][${overAudioMix}]amix=inputs=2:normalize=0:duration=longest,atrim=duration=${fmtNumber(duration)},asetpts=PTS-STARTPTS[${aLabel}]`);
      }
      pairLabels.push(videoOnly ? `[${vLabel}]` : `[${vLabel}][${aLabel}]`);
      return;
    }

    if (segment.kind === "fade_out_black" || segment.kind === "fade_in_black") {
      const inputIndex = ensureSharedInputIndex(sharedInputs, segment.clip);
      const meta = probeByPath.get(getClipSourcePath(segment.clip)) || null;
      const videoProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "T");
      const audioProgressExpr = buildProgressExpr(duration, segment.progressFrom, segment.progressTo, "t");
      const clipPlaced = pushPlacedTransparentVideoSlice(parts, inputIndex, label(`vfclip${idx}`), segment.clip, segment.localStart, segment.localEnd, duration, meta, target, {
        segmentTimelineStart: Number(segment.start || segment.clip?.start || 0)
      });
      const blackVideo = label(`vfblack${idx}`);
      const clipAudio = label(`afclip${idx}`);
      pushTransparentCanvas(parts, blackVideo, duration, target);
      if (segment.kind === "fade_out_black") {
        parts.push(`[${clipPlaced.rgbaLabel}][${blackVideo}]blend=all_expr='A*(1-(${videoProgressExpr}))+B*(${videoProgressExpr})',format=rgba[${vLabel}]`);
      } else {
        parts.push(`[${blackVideo}][${clipPlaced.rgbaLabel}]blend=all_expr='A*(1-(${videoProgressExpr}))+B*(${videoProgressExpr})',format=rgba[${vLabel}]`);
      }
      if (!videoOnly) {
        pushTimelineClipAudioSlice(parts, inputIndex, clipAudio, segment.clip, segment.localStart, segment.localEnd, duration, meta, "1");
        if (segment.kind === "fade_out_black") {
          parts.push(`[${clipAudio}]volume='${buildVolumeExpr(segment.clip?.gain ?? 1, `max(0,min(1,1-(${audioProgressExpr})))`)}'[${aLabel}]`);
        } else {
          parts.push(`[${clipAudio}]volume='${buildVolumeExpr(segment.clip?.gain ?? 1, `max(0,min(1,(${audioProgressExpr})))`)}'[${aLabel}]`);
        }
      }
      pairLabels.push(videoOnly ? `[${vLabel}]` : `[${vLabel}][${aLabel}]`);
      return;
    }
  });

  const concatVideoLabel = label("vconcat");
  if (videoOnly) {
    parts.push(`${pairLabels.join("")}concat=n=${pairLabels.length}:v=1:a=0[${concatVideoLabel}]`);
  } else {
    parts.push(`${pairLabels.join("")}concat=n=${pairLabels.length}:v=1:a=1[${concatVideoLabel}][${label("aout")}]`);
  }
  const targetFps = fmtNumber(Math.max(1, Number(target?.fps || 30)));
  parts.push(`[${concatVideoLabel}]fps=${targetFps},settb=AVTB,setpts=N/(${targetFps}*TB),format=rgba[${label("vout")}]`);
  return {
    filter: parts.join(";"),
    map: videoOnly ? { v: label("vout") } : { v: label("vout"), a: label("aout") },
    durationSec: segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.duration || 0)), 0)
  };
}

function buildLayeredTimelineSegmentFilter(project, rangeStart, rangeEnd, probeByPath, target, options = {}) {
  activeOverlayProject = project || null;
  const videoOnly = !!options.videoOnly;
  const sharedInputs = createSharedInputRegistry();
  const durationSec = Math.max(0.02, Number(rangeEnd || 0) - Number(rangeStart || 0));
  const sections = [...new Set((project.videoClips || []).map((clip) => Math.max(1, Number(clip.section || 1))))].sort((a, b) => a - b);
  const sectionBuilds = sections.map((section) => ({
    section,
    ...buildSectionTransparentTimelineFilter(project, section, rangeStart, rangeEnd, probeByPath, target, sharedInputs, {
      labelPrefix: `sec${section}_`,
      videoOnly
    })
  }));

  const parts = sectionBuilds.map((built) => built.filter).filter(Boolean);
  const compositeBase = "vlayer_base";
  pushOpaqueBlackCanvas(parts, compositeBase, durationSec, target);
  let currentVideo = compositeBase;
  sections.slice().sort((a, b) => b - a).forEach((section, idx) => {
    const built = sectionBuilds.find((item) => item.section === section);
    if (!built?.map?.v) return;
    const nextLabel = `vlayer_mix_${idx}`;
    parts.push(`[${currentVideo}][${built.map.v}]overlay=eof_action=pass:repeatlast=0:format=auto:alpha=straight,format=rgba[${nextLabel}]`);
    currentVideo = nextLabel;
  });
  const finalLayerFps = fmtNumber(Math.max(1, Number(target?.fps || 30)));
  parts.push(`[${currentVideo}]fps=${finalLayerFps},settb=AVTB,setpts=N/(${finalLayerFps}*TB),format=yuv420p[vout]`);

  let mixedAudioLabel = null;
  if (!videoOnly) {
    let sectionAudioBase = "aout_sections";
    if (!sectionBuilds.length) {
      pushSilentAudioSource(parts, sectionAudioBase, durationSec);
    } else if (sectionBuilds.length === 1) {
      parts.push(`[${sectionBuilds[0].map.a}]atrim=duration=${fmtNumber(durationSec)},asetpts=PTS-STARTPTS[${sectionAudioBase}]`);
    } else {
      const sectionAudioInputs = sectionBuilds.map((built) => `[${built.map.a}]`).join("");
      parts.push(`${sectionAudioInputs}amix=inputs=${sectionBuilds.length}:normalize=0:duration=longest,atrim=duration=${fmtNumber(durationSec)},asetpts=PTS-STARTPTS[${sectionAudioBase}]`);
    }
    mixedAudioLabel = appendDetachedAudioMix(
      parts,
      project,
      rangeStart,
      rangeEnd,
      (item) => ensureSharedInputIndex(sharedInputs, item),
      probeByPath,
      sectionAudioBase
    );
  }

  return {
    inputs: sharedInputs.inputs,
    filter: parts.join(";"),
    map: videoOnly ? { v: "vout" } : { v: "vout", a: mixedAudioLabel },
    durationSec
  };
}

function normalizeHexColor(value, fallback = "FFFFFF") {
  const raw = String(value || "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback;
}

function escapeDrawtextText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "\\%")
    .replace(/\r?\n/g, "\\n");
}

function escapeFilterPath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function hasKoreanText(value) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(String(value || ""));
}

function containsNonAsciiText(text) {
  return /[^\x00-\x7F]/.test(String(text || ""));
}

function getTextScriptProfile(text) {
  const value = String(text || "");
  const hasHangul = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(value);
  const hasKana = /[\u3040-\u30FF\u31F0-\u31FF]/.test(value);
  const hasCjk = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(value);
  const hasEmoji = /[\u2600-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDFFF]/.test(value);
  const hasNonAscii = containsNonAsciiText(value);
  return { hasHangul, hasKana, hasCjk, hasEmoji, hasNonAscii };
}

const DRAW_TEXT_FONT_EXT_RE = /\.(ttf|otf|ttc|woff2?)$/i;
const DRAW_TEXT_SFNT_FONT_EXT_RE = /\.(ttf|otf|ttc)$/i;
const FONT_LOOKUP_CACHE = new Map();
const FONT_SUPPORT_CACHE = new Map();

function compactFontName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function isReadableFontFile(filePath) {
  try {
    return DRAW_TEXT_FONT_EXT_RE.test(String(filePath || "")) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function addFontCandidate(list, filePath) {
  if (!filePath) return;
  const normalized = path.normalize(String(filePath));
  if (!list.includes(normalized)) list.push(normalized);
}

function getSystemFontSearchDirs() {
  const homeDir = os.homedir?.() || "";
  if (process.platform === "win32") {
    const windir = process.env.WINDIR || "C:\\Windows";
    return [path.join(windir, "Fonts")];
  }
  if (process.platform === "darwin") {
    return [
      "/System/Library/Fonts",
      "/System/Library/Fonts/Supplemental",
      "/Library/Fonts",
      homeDir ? path.join(homeDir, "Library", "Fonts") : ""
    ].filter(Boolean);
  }
  return [
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    homeDir ? path.join(homeDir, ".fonts") : "",
    homeDir ? path.join(homeDir, ".local", "share", "fonts") : ""
  ].filter(Boolean);
}

function findFontFilesByCompactName(compactName) {
  const needle = compactFontName(compactName);
  if (needle.length < 3) return [];
  const cacheKey = `${process.platform}:${needle}`;
  if (FONT_LOOKUP_CACHE.has(cacheKey)) return FONT_LOOKUP_CACHE.get(cacheKey);
  const results = [];
  const visit = (dirPath, depth = 0) => {
    if (depth > 4 || results.length >= 24) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, depth + 1);
      } else if (entry.isFile() && DRAW_TEXT_FONT_EXT_RE.test(entry.name) && compactFontName(entry.name).includes(needle)) {
        results.push(fullPath);
        if (results.length >= 24) break;
      }
    }
  };
  getSystemFontSearchDirs().forEach((dirPath) => visit(dirPath, 0));
  FONT_LOOKUP_CACHE.set(cacheKey, results);
  return results;
}

function readUInt16Safe(buffer, offset) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : 0;
}

function readInt16Safe(buffer, offset) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readInt16BE(offset) : 0;
}

function readUInt32Safe(buffer, offset) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : 0;
}

function getSfntOffsets(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return [];
  const tag = buffer.toString("ascii", 0, 4);
  if (tag === "ttcf") {
    const count = Math.min(64, readUInt32Safe(buffer, 8));
    const offsets = [];
    for (let i = 0; i < count; i += 1) {
      const offset = readUInt32Safe(buffer, 12 + (i * 4));
      if (offset >= 0 && offset + 12 < buffer.length) offsets.push(offset);
    }
    return offsets;
  }
  if (
    tag === "OTTO"
    || tag === "true"
    || tag === "typ1"
    || (buffer[0] === 0 && buffer[1] === 1 && buffer[2] === 0 && buffer[3] === 0)
  ) {
    return [0];
  }
  return [];
}

function findSfntTable(buffer, sfntOffset, tableTag) {
  const numTables = readUInt16Safe(buffer, sfntOffset + 4);
  const tableStart = sfntOffset + 12;
  for (let i = 0; i < numTables; i += 1) {
    const recordOffset = tableStart + (i * 16);
    if (recordOffset + 16 > buffer.length) break;
    const tag = buffer.toString("ascii", recordOffset, recordOffset + 4);
    if (tag !== tableTag) continue;
    const offset = readUInt32Safe(buffer, recordOffset + 8);
    const length = readUInt32Safe(buffer, recordOffset + 12);
    if (offset > 0 && offset + length <= buffer.length) return { offset, length };
  }
  return null;
}

function cmapFormat0HasCodePoint(buffer, offset, codePoint) {
  if (codePoint < 0 || codePoint > 255) return false;
  const glyphOffset = offset + 6 + codePoint;
  return glyphOffset < buffer.length && buffer[glyphOffset] > 0;
}

function cmapFormat4HasCodePoint(buffer, offset, codePoint) {
  if (codePoint < 0 || codePoint > 0xffff) return false;
  const length = readUInt16Safe(buffer, offset + 2);
  const segCount = readUInt16Safe(buffer, offset + 6) / 2;
  if (!Number.isFinite(segCount) || segCount <= 0) return false;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + (segCount * 2) + 2;
  const idDeltaOffset = startCodeOffset + (segCount * 2);
  const idRangeOffsetOffset = idDeltaOffset + (segCount * 2);
  for (let i = 0; i < segCount; i += 1) {
    const endCode = readUInt16Safe(buffer, endCodeOffset + (i * 2));
    if (codePoint > endCode) continue;
    const startCode = readUInt16Safe(buffer, startCodeOffset + (i * 2));
    if (codePoint < startCode) return false;
    const idDelta = readInt16Safe(buffer, idDeltaOffset + (i * 2));
    const idRangeOffset = readUInt16Safe(buffer, idRangeOffsetOffset + (i * 2));
    if (idRangeOffset === 0) return ((codePoint + idDelta) & 0xffff) !== 0;
    const glyphOffset = idRangeOffsetOffset + (i * 2) + idRangeOffset + ((codePoint - startCode) * 2);
    if (glyphOffset < offset || glyphOffset + 2 > offset + length || glyphOffset + 2 > buffer.length) return false;
    const glyphId = readUInt16Safe(buffer, glyphOffset);
    if (glyphId === 0) return false;
    return ((glyphId + idDelta) & 0xffff) !== 0;
  }
  return false;
}

function cmapFormat6HasCodePoint(buffer, offset, codePoint) {
  if (codePoint < 0 || codePoint > 0xffff) return false;
  const firstCode = readUInt16Safe(buffer, offset + 6);
  const entryCount = readUInt16Safe(buffer, offset + 8);
  const index = codePoint - firstCode;
  if (index < 0 || index >= entryCount) return false;
  return readUInt16Safe(buffer, offset + 10 + (index * 2)) > 0;
}

function cmapFormat12Or13HasCodePoint(buffer, offset, codePoint) {
  const groupCount = readUInt32Safe(buffer, offset + 12);
  const groupsOffset = offset + 16;
  for (let i = 0; i < groupCount; i += 1) {
    const groupOffset = groupsOffset + (i * 12);
    if (groupOffset + 12 > buffer.length) break;
    const startChar = readUInt32Safe(buffer, groupOffset);
    const endChar = readUInt32Safe(buffer, groupOffset + 4);
    if (codePoint < startChar) return false;
    if (codePoint <= endChar) {
      const startGlyph = readUInt32Safe(buffer, groupOffset + 8);
      return startGlyph + (codePoint - startChar) > 0;
    }
  }
  return false;
}

function cmapSubtableHasCodePoint(buffer, offset, codePoint) {
  const format = readUInt16Safe(buffer, offset);
  if (format === 0) return cmapFormat0HasCodePoint(buffer, offset, codePoint);
  if (format === 4) return cmapFormat4HasCodePoint(buffer, offset, codePoint);
  if (format === 6) return cmapFormat6HasCodePoint(buffer, offset, codePoint);
  if (format === 12 || format === 13) return cmapFormat12Or13HasCodePoint(buffer, offset, codePoint);
  return false;
}

function sfntSupportsCodePoints(buffer, sfntOffset, codePoints) {
  const cmap = findSfntTable(buffer, sfntOffset, "cmap");
  if (!cmap) return null;
  const tableOffset = cmap.offset;
  const numTables = readUInt16Safe(buffer, tableOffset + 2);
  const subtables = [];
  for (let i = 0; i < numTables; i += 1) {
    const recordOffset = tableOffset + 4 + (i * 8);
    if (recordOffset + 8 > buffer.length) break;
    const platformId = readUInt16Safe(buffer, recordOffset);
    const encodingId = readUInt16Safe(buffer, recordOffset + 2);
    const subtableOffset = tableOffset + readUInt32Safe(buffer, recordOffset + 4);
    const format = readUInt16Safe(buffer, subtableOffset);
    const priority = format === 12 ? 0 : (format === 4 ? 1 : 2);
    subtables.push({ offset: subtableOffset, platformId, encodingId, format, priority });
  }
  subtables.sort((a, b) => a.priority - b.priority || b.platformId - a.platformId || b.encodingId - a.encodingId);
  return subtables.some((subtable) => (
    codePoints.every((codePoint) => cmapSubtableHasCodePoint(buffer, subtable.offset, codePoint))
  ));
}

function getKoreanCodePoints(value) {
  return [...new Set(
    [...String(value || "")]
      .map((char) => char.codePointAt(0))
      .filter((codePoint) => (
        (codePoint >= 0x3131 && codePoint <= 0x318e)
        || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
      ))
  )];
}

function getRenderableTextCodePoints(value) {
  return [...new Set(
    [...String(value || "")]
      .map((char) => char.codePointAt(0))
      .filter((codePoint) => (
        Number.isFinite(codePoint)
        && codePoint > 0x20
        && codePoint !== 0x7f
        && !(codePoint >= 0xfe00 && codePoint <= 0xfe0f)
        && !(codePoint >= 0xe0100 && codePoint <= 0xe01ef)
      ))
  )].slice(0, 96);
}

function fontSupportsText(fontPath, sampleText = "") {
  const codePoints = getRenderableTextCodePoints(sampleText);
  if (!codePoints.length) return true;
  if (!DRAW_TEXT_SFNT_FONT_EXT_RE.test(String(fontPath || ""))) return null;
  const cacheKey = `text:${fontPath}:${codePoints.join(",")}`;
  if (FONT_SUPPORT_CACHE.has(cacheKey)) return FONT_SUPPORT_CACHE.get(cacheKey);
  let result = null;
  try {
    const buffer = fs.readFileSync(fontPath);
    const offsets = getSfntOffsets(buffer);
    if (offsets.length) {
      result = offsets.some((offset) => sfntSupportsCodePoints(buffer, offset, codePoints) === true);
    }
  } catch {
    result = null;
  }
  FONT_SUPPORT_CACHE.set(cacheKey, result);
  return result;
}

function fontSupportsKoreanText(fontPath, sampleText = "") {
  const codePoints = getKoreanCodePoints(sampleText);
  if (!codePoints.length) return true;
  if (!DRAW_TEXT_SFNT_FONT_EXT_RE.test(String(fontPath || ""))) return null;
  const cacheKey = `${fontPath}:${codePoints.join(",")}`;
  if (FONT_SUPPORT_CACHE.has(cacheKey)) return FONT_SUPPORT_CACHE.get(cacheKey);
  let result = null;
  try {
    const buffer = fs.readFileSync(fontPath);
    const offsets = getSfntOffsets(buffer);
    if (offsets.length) {
      result = offsets.some((offset) => sfntSupportsCodePoints(buffer, offset, codePoints) === true);
    }
  } catch {
    result = null;
  }
  FONT_SUPPORT_CACHE.set(cacheKey, result);
  return result;
}

function chooseExistingDrawtextFont(candidates, sampleText = "") {
  const profile = getTextScriptProfile(sampleText);
  const needsGlyphVerification = profile.hasNonAscii || String(sampleText || "").trim().length > 0;
  for (const filePath of candidates) {
    if (!isReadableFontFile(filePath)) continue;
    if (profile.hasHangul && fontSupportsKoreanText(filePath, sampleText) === false) continue;
    if (needsGlyphVerification && profile.hasNonAscii && fontSupportsText(filePath, sampleText) !== true) continue;
    return filePath;
  }
  return "";
}

function resolveDrawtextFontFile(fontFamily, fontWeight, fontFile = "", sampleText = "") {
  const customPath = String(fontFile || "").trim();
  const profile = getTextScriptProfile(sampleText);
  try {
    if (
      customPath
      && isReadableFontFile(customPath)
      && (!profile.hasHangul || fontSupportsKoreanText(customPath, sampleText) !== false)
      && (!profile.hasNonAscii || fontSupportsText(customPath, sampleText) === true)
    ) {
      return customPath;
    }
  } catch {
    // fall back to system font lookup
  }
  const family = String(fontFamily || "Malgun Gothic").toLowerCase();
  const compactFamily = compactFontName(family);
  const bold = Number(fontWeight || 400) >= 700;
  const candidates = [];
  const add = (filePath) => addFontCandidate(candidates, filePath);
  const addSystemFile = (fileName) => {
    getSystemFontSearchDirs().forEach((dirPath) => add(path.join(dirPath, fileName)));
  };
  const addFamilyMatches = (name) => {
    findFontFilesByCompactName(name).forEach(add);
  };
  const wantsKorean = profile.hasHangul
    || /korean|hangul|malgun|pretendard|apple\s*sd|noto\s*sans\s*cjk|nanum|gothic|고딕/i.test(family);
  const wantsCjk = wantsKorean || profile.hasKana || profile.hasCjk;

  if (family.includes("pretendard")) addFamilyMatches("pretendard");
  if (family.includes("apple") || family.includes("sd gothic")) addFamilyMatches("AppleSDGothicNeo");
  if (family.includes("noto")) {
    addFamilyMatches("NotoSansCJK");
    addFamilyMatches("NotoSansKR");
  }
  if (family.includes("nanum")) addFamilyMatches("NanumGothic");

  if (process.platform === "win32") {
    const fontsDir = path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
    if (wantsKorean) add(path.join(fontsDir, bold ? "malgunbd.ttf" : "malgun.ttf"));
    if (family.includes("georgia")) add(path.join(fontsDir, bold ? "georgiab.ttf" : "georgia.ttf"));
    if (family.includes("arial") || !candidates.length) add(path.join(fontsDir, bold ? "arialbd.ttf" : "arial.ttf"));
    add(path.join(fontsDir, "malgunbd.ttf"));
    add(path.join(fontsDir, "malgun.ttf"));
    add(path.join(fontsDir, "arialuni.ttf"));
    add(path.join(fontsDir, "arialbd.ttf"));
    add(path.join(fontsDir, "arial.ttf"));
    add(path.join(fontsDir, "segoeuib.ttf"));
    add(path.join(fontsDir, "segoeui.ttf"));
  } else if (process.platform === "darwin") {
    if (wantsCjk) {
      add("/System/Library/Fonts/AppleSDGothicNeo.ttc");
      add("/System/Library/Fonts/Supplemental/AppleGothic.ttf");
      add("/System/Library/Fonts/Supplemental/Arial Unicode.ttf");
    }
    if (family.includes("georgia")) add(`/System/Library/Fonts/Supplemental/${bold ? "Georgia Bold.ttf" : "Georgia.ttf"}`);
    if (family.includes("arial") || !candidates.length) add(`/System/Library/Fonts/Supplemental/${bold ? "Arial Bold.ttf" : "Arial.ttf"}`);
    add("/System/Library/Fonts/AppleSDGothicNeo.ttc");
    add("/System/Library/Fonts/Supplemental/AppleGothic.ttf");
    add("/System/Library/Fonts/Supplemental/Arial Unicode.ttf");
    add("/System/Library/Fonts/Supplemental/Arial.ttf");
    add("/System/Library/Fonts/Supplemental/Georgia.ttf");
  } else {
    if (wantsCjk) {
      addSystemFile("opentype/noto/NotoSansCJK-Bold.ttc");
      addSystemFile("opentype/noto/NotoSansCJK-Regular.ttc");
      addSystemFile("truetype/noto/NotoSansCJK-Bold.ttc");
      addSystemFile("truetype/noto/NotoSansCJK-Regular.ttc");
      addSystemFile("truetype/nanum/NanumGothicBold.ttf");
      addSystemFile("truetype/nanum/NanumGothic.ttf");
      addFamilyMatches("NotoSansCJK");
      addFamilyMatches("NanumGothic");
    }
    if (family.includes("georgia")) addFamilyMatches("Georgia");
    if (family.includes("arial")) addFamilyMatches("Arial");
    if (!wantsCjk) {
      addSystemFile("truetype/dejavu/DejaVuSans-Bold.ttf");
      addSystemFile("truetype/dejavu/DejaVuSans.ttf");
    }
  }
  if (compactFamily) addFamilyMatches(compactFamily);
  return chooseExistingDrawtextFont(candidates, sampleText);
}

function resolveVerifiedRenderFont(overlay = {}, debugSession = null) {
  const sampleText = String(overlay.text ?? "");
  const profile = getTextScriptProfile(sampleText);
  const customPath = String(overlay.fontFile || "").trim();
  const fontFile = resolveDrawtextFontFile(overlay.fontFamily, overlay.fontWeight, customPath, sampleText);
  const result = {
    fontFile,
    profile,
    usedFallback: !!(customPath && fontFile && path.normalize(customPath) !== path.normalize(fontFile)),
    canUseDrawtext: true,
    requiresCanvasFallback: false,
    reason: ""
  };

  if (customPath) {
    if (!isReadableFontFile(customPath)) {
      result.reason = "custom_font_unreadable";
    } else if (!DRAW_TEXT_SFNT_FONT_EXT_RE.test(customPath)) {
      result.reason = "custom_font_not_drawtext_sfnt";
    } else if (sampleText && fontSupportsText(customPath, sampleText) === false) {
      result.reason = "custom_font_missing_glyphs";
    }
  }

  if (profile.hasEmoji) {
    result.canUseDrawtext = false;
    result.requiresCanvasFallback = true;
    result.reason = result.reason || "emoji_or_complex_glyph";
  } else if (profile.hasNonAscii) {
    const supports = fontFile ? fontSupportsText(fontFile, sampleText) : false;
    if (!fontFile || supports !== true) {
      result.canUseDrawtext = false;
      result.requiresCanvasFallback = true;
      result.reason = result.reason || (fontFile ? "font_glyph_support_unverified" : "verified_font_not_found");
    }
  }

  if (result.usedFallback || !result.canUseDrawtext) {
    debugSession?.write?.("Text font verification", [
      `overlayId=${String(overlay.id || "")}`,
      `fontFamily=${String(overlay.fontFamily || "")}`,
      `customFont=${customPath}`,
      `resolvedFont=${fontFile}`,
      `canUseDrawtext=${result.canUseDrawtext}`,
      `requiresCanvasFallback=${result.requiresCanvasFallback}`,
      `reason=${result.reason || ""}`,
      `profile=${JSON.stringify(profile)}`
    ].join("\n"));
  }
  return result;
}

function buildOverlayXExpr(overlay, targetWidth) {
  const anchorX = Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const base = `${fmtNumber(targetWidth)}*${fmtNumber(anchorX)}`;
  const align = String(overlay.textAlign || "center");
  if (align === "left") return base;
  if (align === "right") return `(${base}-text_w)`;
  return `(${base}-text_w/2)`;
}

function clampExpr(expr) {
  return `max(0,min(1,${expr}))`;
}

function minExpr(...exprs) {
  const parts = exprs.map((expr) => String(expr || "").trim()).filter(Boolean);
  if (!parts.length) return "0";
  return parts.reduce((acc, expr) => (acc ? `min(${acc},${expr})` : expr), "");
}

function maxExpr(...exprs) {
  const parts = exprs.map((expr) => String(expr || "").trim()).filter(Boolean);
  if (!parts.length) return "0";
  return parts.reduce((acc, expr) => (acc ? `max(${acc},${expr})` : expr), "");
}

function clampRangeExpr(expr, minValue, maxValue) {
  return maxExpr(String(minValue), minExpr(String(maxValue), String(expr)));
}

function smoothstepExpr(unitExpr) {
  const u = clampExpr(unitExpr);
  return `((${u})*(${u})*(3-(2*(${u}))))`;
}

function mixExpr(aExpr, bExpr, tExpr) {
  const a = String(aExpr || "0");
  const b = String(bExpr || "0");
  const t = String(tExpr || "0");
  return `((${a})+(((${b})-(${a}))*(${t})))`;
}

function overlayActiveWindow(overlay, rangeStart, rangeEnd, target) {
  const originalStart = Math.max(0, Number(overlay.start || 0));
  const originalDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC));
  const originalEnd = originalStart + originalDuration;
  const visibleStart = Math.max(rangeStart, originalStart);
  const visibleEnd = Math.min(rangeEnd, originalEnd);
  if (visibleEnd <= visibleStart + 1e-6) return null;
  const phaseOffsetSec = Math.max(0, visibleStart - originalStart);
  return {
    // Keep enough phase information for partial renders, but clamp the visible
    // start to the render window so ffmpeg fade/draw filters never receive
    // negative `st` values.
    start: Math.max(0, visibleStart - rangeStart),
    end: Math.max(0, visibleEnd - rangeStart),
    duration: originalDuration,
    originalStart,
    originalEnd,
    visibleStart: visibleStart - rangeStart,
    visibleEnd: visibleEnd - rangeStart,
    visibleDuration: Math.max(0, visibleEnd - visibleStart),
    phaseOffsetSec
  };
}

function getOverlayPhaseTimeExpr(overlay, timeVar = "t") {
  const phaseOffsetSec = Math.max(0, Number(overlay?.phaseOffsetSec || 0));
  if (phaseOffsetSec <= 1e-6) return String(timeVar || "t");
  return `(${String(timeVar || "t")}+${fmtNumber(phaseOffsetSec)})`;
}

function normalizeTextOverlayTransitionType(type) {
  const value = String(type || "none").toLowerCase();
  return [
    "none",
    "fade",
    "cross",
    "sun_glitter_flash",
    "focus_pull_in",
    "cyber_mosaic_burst",
    "blur_slide_left",
    "blur_slide_right",
    "blur_slide_up",
    "blur_slide_down"
  ].includes(value)
    ? value
    : "none";
}

function getTextOverlayTransitionDefaultDuration(type) {
  const normalized = normalizeTextOverlayTransitionType(type);
  if (normalized === "fade" || normalized === "cross") return 0.5;
  if (normalized === "sun_glitter_flash") return 0.7;
  if (normalized === "focus_pull_in") return 0.65;
  if (normalized === "cyber_mosaic_burst") return 0.6;
  if (normalized.startsWith("blur_slide_")) return 0.55;
  return 0;
}

function getTextOverlayAnchorX(overlay) {
  const align = String(overlay?.textAlign || "center").toLowerCase();
  if (align === "left") return 0;
  if (align === "right") return 1;
  return 0.5;
}

function getTextOverlayTransitionSettingsForRender(overlay) {
  const totalDuration = Math.max(MIN_OVERLAY_CLIP_SEC, finiteNumber(overlay?.duration, 2));
  const introType = normalizeTextOverlayTransitionType(overlay?.transitionInType);
  const outroType = normalizeTextOverlayTransitionType(overlay?.transitionOutType);
  const budget = Math.max(0, totalDuration - TIMELINE_TIME_STEP_SEC);
  let introDuration = introType === "none"
    ? 0
    : clampFinite(
        overlay?.transitionInDurationSec ?? getTextOverlayTransitionDefaultDuration(introType),
        0,
        budget,
        getTextOverlayTransitionDefaultDuration(introType)
      );
  let outroDuration = outroType === "none"
    ? 0
    : clampFinite(
        overlay?.transitionOutDurationSec ?? getTextOverlayTransitionDefaultDuration(outroType),
        0,
        budget,
        getTextOverlayTransitionDefaultDuration(outroType)
      );
  if ((introDuration + outroDuration) > budget && (introDuration + outroDuration) > 1e-6) {
    const scale = budget / (introDuration + outroDuration);
    introDuration *= scale;
    outroDuration *= scale;
  }
  return {
    totalDuration,
    intro: {
      type: introType,
      duration: introType === "none" ? 0 : introDuration
    },
    outro: {
      type: outroType,
      duration: outroType === "none" ? 0 : outroDuration
    },
    strength: clampFinite(overlay?.transitionStrength ?? 1, 0.4, 1.6, 1),
    anchorX: getTextOverlayAnchorX(overlay),
    anchorY: 0.5,
    seed: hashString(`${overlay?.id || "overlay"}:${overlay?.text || ""}`)
  };
}

function buildTextOverlayTransitionPreset(type, cfg) {
  const normalized = normalizeTextOverlayTransitionType(type);
  if (normalized === "none") return null;
  if (normalized === "sun_glitter_flash") {
    return {
      type: normalized,
      strength: cfg.strength
    };
  }
  if (normalized === "focus_pull_in") {
    return {
      type: normalized,
      anchorX: cfg.anchorX,
      anchorY: cfg.anchorY,
      strength: cfg.strength,
      easingPreset: "dynamic"
    };
  }
  if (normalized === "cyber_mosaic_burst") {
    return {
      type: normalized,
      intensity: cfg.strength,
      tileDensity: 0.68,
      sizeVariance: 0.72,
      clusterCount: 4,
      clusterSpread: 0.46,
      jitterSpeed: 1.2 + ((cfg.strength - 1) * 0.25),
      seed: cfg.seed,
      edgeSoftness: 0.024
    };
  }
  if (normalized.startsWith("blur_slide_")) {
    return {
      type: normalized,
      direction: normalized.replace("blur_slide_", ""),
      strength: cfg.strength
    };
  }
  return { type: normalized };
}

function appendTextOverlayTransitionLabel(parts, inputLabel, labelBase, overlay, totalDuration, target) {
  const cfg = getTextOverlayTransitionSettingsForRender(overlay);
  let current = inputLabel;
  const start = Number(overlay.start || 0);
  if (cfg.intro.type !== "none" && cfg.intro.duration > 0.001) {
    const introLabel = `${labelBase}_intro`;
    const introSegment = {
      duration: totalDuration,
      transitionType: cfg.intro.type,
      transitionScope: "intro",
      transition: buildTextOverlayTransitionPreset(cfg.intro.type, cfg)
    };
    const introProgressExpr = clampExpr(`(t-${fmtNumber(start)})/${fmtNumber(cfg.intro.duration)}`);
    applyTransitionVideoEffect(parts, current, introLabel, introSegment, introProgressExpr, target, {
      mode: "in",
      canvasDuration: totalDuration
    });
    current = introLabel;
  }
  if (cfg.outro.type !== "none" && cfg.outro.duration > 0.001) {
    const outroLabel = `${labelBase}_outro`;
    const outroStart = Math.max(start, (start + cfg.totalDuration) - cfg.outro.duration);
    const outroSegment = {
      duration: totalDuration,
      transitionType: cfg.outro.type,
      transitionScope: "outro",
      transition: buildTextOverlayTransitionPreset(cfg.outro.type, cfg)
    };
    const outroProgressExpr = clampExpr(`(t-${fmtNumber(outroStart)})/${fmtNumber(cfg.outro.duration)}`);
    applyTransitionVideoEffect(parts, current, outroLabel, outroSegment, outroProgressExpr, target, {
      mode: "out",
      canvasDuration: totalDuration
    });
    current = outroLabel;
  }
  return current;
}

function normalizeOverlayItemForRender(raw) {
  if (!raw || typeof raw !== "object") return null;
  const overlayType = String(raw.overlayType || "text");
  const durationFromMs = overlayType === "point_pop_line"
    ? (Number(raw.durationMs || 520) / 1000)
    : (overlayType === "checkpoint_pop" ? (Number(raw.durationMs || 680) / 1000) : 0);
  const duration = Math.max(
    MIN_OVERLAY_CLIP_SEC,
    Number(raw.duration || durationFromMs || MIN_OVERLAY_CLIP_SEC)
  );
  const opacityFloor = overlayType === "soft_spotlight" || overlayType === "highlight_bar_sweep" ? 0.05 : 0.1;
  return {
    ...raw,
    overlayType,
    start: Math.max(0, Number(raw.start || 0)),
    duration,
    manualFadeInSec: Math.max(0, Number(raw.manualFadeInSec || 0)),
    manualFadeOutSec: Math.max(0, Number(raw.manualFadeOutSec || 0)),
    opacity: Math.max(opacityFloor, Math.min(1, Number(raw.opacity ?? 1))),
    transitionInType: overlayType === "text"
      ? normalizeTextOverlayTransitionType(raw.transitionInType)
      : raw.transitionInType,
    transitionInDurationSec: overlayType === "text"
      ? Math.max(0, finiteNumber(raw.transitionInDurationSec, getTextOverlayTransitionDefaultDuration(raw.transitionInType)))
      : raw.transitionInDurationSec,
    transitionOutType: overlayType === "text"
      ? normalizeTextOverlayTransitionType(raw.transitionOutType)
      : raw.transitionOutType,
    transitionOutDurationSec: overlayType === "text"
      ? Math.max(0, finiteNumber(raw.transitionOutDurationSec, getTextOverlayTransitionDefaultDuration(raw.transitionOutType)))
      : raw.transitionOutDurationSec,
    transitionStrength: overlayType === "text"
      ? clampFinite(raw.transitionStrength ?? 1, 0.4, 1.6, 1)
      : raw.transitionStrength
  };
}

function appendOverlayFadeLabel(parts, inputLabel, labelBase, overlay, start, duration, naturalFadeStart = 0, naturalFadeDuration = 0, target = null) {
  const filters = [];
  appendOverlayAlphaFades(filters, overlay, start, duration, naturalFadeStart, naturalFadeDuration, target);
  if (!filters.length) return inputLabel;
  const outputLabel = `${labelBase}_fade`;
  parts.push(`[${inputLabel}]${filters.join(",")}[${outputLabel}]`);
  return outputLabel;
}

function buildCircleFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(duration, Number(overlay.drawDuration || 1)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.3)));
  const holdDuration = Math.max(0, Math.min(Number(overlay.holdDuration || 0), duration - drawDuration - fadeDuration));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const minSize = Math.max(2, Math.min(w, h));
  const cx = w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const cy = h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.5)));
  const radius = minSize * Math.max(0.03, Number(overlay.radius || overlay.size || 0.11));
  const strokeWidth = Math.max(2, Number(overlay.strokeWidth || 6));
  const opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 1)));
  const color = `0x${normalizeHexColor(overlay.color, "FFDB4D")}@${fmtGain(opacity)}`;
  const startExpr = fmtNumber(start);
  const drawExpr = fmtNumber(drawDuration);
  const holdExpr = fmtNumber(holdDuration);
  const fadeExpr = fmtNumber(fadeDuration);
  const drawProgress = `(if(lte(T,${startExpr}),0,if(lt(T,${startExpr}+${drawExpr}),1-pow(1-${clampExpr(`(T-${startExpr})/${drawExpr}`)},3),1)))`;
  const alphaExpr = `(if(lte(T,${startExpr}),0,if(lt(T,${startExpr}+${drawExpr}+${holdExpr}),${fmtNumber(opacity)},if(lt(T,${startExpr}+${drawExpr}+${holdExpr}+${fadeExpr}),${fmtNumber(opacity)}*(1-((T-${startExpr}-${drawExpr}-${holdExpr})/${fadeExpr})),0))))`;
  const angleExpr = `(mod(atan2(Y-${fmtNumber(cy)},X-${fmtNumber(cx)})+PI/2+2*PI,2*PI)/(2*PI))`;
  const ringExpr = `if(lt(abs(hypot(X-${fmtNumber(cx)},Y-${fmtNumber(cy)})-${fmtNumber(radius)}),${fmtNumber(strokeWidth / 2)}),1,0)`;
  const alphaChannel = `255*${alphaExpr}*${ringExpr}*if(lte(${angleExpr},${drawProgress}),1,0)`;
  const baseLabel = `fxcircle${index}`;
  const parts = [
    `color=c=${color}:s=${w}x${h}:r=${fmtNumber(Math.max(1, Number(target.fps || 30)))}:d=${fmtNumber(totalDuration)},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alphaChannel}'[${baseLabel}]`
  ];
  const sparkleCount = Math.max(2, Math.round(Number(overlay.sparkleCount || 8)));
  const sparkleDistance = minSize * Math.max(0.01, Number(overlay.sparkleDistance || 0.06));
  let currentLabel = baseLabel;
  for (let i = 0; i < sparkleCount; i++) {
    const angle = ((Math.PI * 2) / sparkleCount) * i;
    const sx = cx + Math.cos(angle) * (radius + sparkleDistance);
    const sy = cy + Math.sin(angle) * (radius + sparkleDistance);
    const sparkleSize = Math.max(3, strokeWidth * 0.45);
    const next = `fxcircle${index}_${i}`;
    const sparkleStart = start + (i * 0.04);
    const sparkleEnd = Math.min(start + drawDuration + holdDuration, sparkleStart + 0.42);
    parts.push(`[${currentLabel}]drawbox=x=${fmtNumber(sx - sparkleSize / 2)}:y=${fmtNumber(sy - sparkleSize / 2)}:w=${fmtNumber(sparkleSize)}:h=${fmtNumber(sparkleSize)}:t=fill:color=${color}:enable='between(t,${fmtNumber(sparkleStart)},${fmtNumber(sparkleEnd)})'[${next}]`);
    currentLabel = next;
  }
  currentLabel = appendOverlayFadeLabel(parts, currentLabel, `fxcircle${index}`, overlay, start, duration, 0, 0, target);
  return { parts, outputLabel: currentLabel };
}

function buildUnderlineFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || MIN_OVERLAY_CLIP_SEC));
  const phaseDuration = Math.max(duration, Number(overlay.originalDurationSec || duration || MIN_OVERLAY_CLIP_SEC));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(phaseDuration, Number(overlay.drawDuration || 1.1)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(phaseDuration, Number(overlay.fadeOutDuration || 0.35)));
  const holdDuration = Math.max(0, phaseDuration - drawDuration - fadeDuration);
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const lineWidth = w * Math.max(0.08, Number(overlay.width || overlay.size || 0.24));
  const thickness = Math.max(4, Number(overlay.lineThickness || 10));
  const centerX = w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const lineStart = centerX - (lineWidth / 2);
  const y = h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.8)));
  const opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 1)));
  const color = `0x${normalizeHexColor(overlay.color, "38BDF8")}@${fmtGain(opacity)}`;
  const accentColor = `0x${normalizeHexColor(overlay.accentColor, "FFFFFF")}@${fmtGain(Math.min(1, opacity * 0.95))}`;
  const shadowColor = `0x000000@${fmtGain(Math.min(0.42, Math.max(0.16, opacity * 0.3)))}`;
  const startExpr = fmtNumber(start);
  const drawExpr = fmtNumber(drawDuration);
  const holdExpr = fmtNumber(holdDuration);
  const fadeExpr = fmtNumber(fadeDuration);
  const phaseTimeExpr = getOverlayPhaseTimeExpr(overlay, "t");
  const drawProgress = `(if(lte(${phaseTimeExpr},${startExpr}),0,if(lt(${phaseTimeExpr},${startExpr}+${drawExpr}),1-pow(1-${clampExpr(`(${phaseTimeExpr}-${startExpr})/${drawExpr}`)},3),1)))`;
  const wipeProgress = `(if(lte(${phaseTimeExpr},${startExpr}+${drawExpr}+${holdExpr}),0,if(lt(${phaseTimeExpr},${startExpr}+${drawExpr}+${holdExpr}+${fadeExpr}),${clampExpr(`(${phaseTimeExpr}-${startExpr}-${drawExpr}-${holdExpr})/${fadeExpr}`)},1)))`;
  const visibleWidth = `max(2,(${fmtNumber(lineWidth)}*${drawProgress})-(${fmtNumber(lineWidth)}*${wipeProgress}))`;
  const visibleX = `${fmtNumber(lineStart)}+(${fmtNumber(lineWidth)}*${wipeProgress})`;
  const accentWidth = Math.max(12, Math.min(48, lineWidth * 0.12));
  const accentX = `${fmtNumber(lineStart)}+(${fmtNumber(lineWidth)}*${drawProgress})-${fmtNumber(accentWidth * 0.6)}`;
  const shadowY = fmtNumber(y - (thickness * 0.5) + Math.max(1, thickness * 0.35));
  const baseY = fmtNumber(y - (thickness * 0.5));
  const accentY = fmtNumber(y - (thickness * 0.22));
  const baseLabel = `fxunder${index}`;
  const accentLabel = `fxunder${index}_accent`;
  const parts = [
    `color=c=black@0.0:s=${w}x${h}:r=${fmtNumber(Math.max(1, Number(target.fps || 30)))}:d=${fmtNumber(totalDuration)},format=rgba,drawbox=x='${visibleX}':y=${shadowY}:w='${visibleWidth}':h=${fmtNumber(Math.max(3.5, thickness * 1.3))}:t=fill:replace=1:color=${shadowColor}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})',drawbox=x='${visibleX}':y=${baseY}:w='${visibleWidth}':h=${fmtNumber(thickness)}:t=fill:replace=1:color=${color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'[${baseLabel}]`,
    `[${baseLabel}]drawbox=x='${accentX}':y=${accentY}:w=${fmtNumber(accentWidth)}:h=${fmtNumber(Math.max(2.8, thickness * 0.48))}:t=fill:replace=1:color=${accentColor}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'[${accentLabel}]`
  ];
  const outputLabel = appendOverlayFadeLabel(parts, accentLabel, `fxunder${index}`, overlay, start, duration, 0, 0, target);
  return { parts, outputLabel };
}

function buildPointPopLineFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || (Number(overlay.durationMs || 520) / 1000) || 0.52));
  const phaseDuration = Math.max(duration, Number(overlay.originalDurationSec || duration || (Number(overlay.durationMs || 520) / 1000) || 0.52));
  const count = Math.max(8, Math.min(14, Math.round(Number(overlay.lineCount || 10))));
  const spread = Math.max(0, Math.min(1, Number(overlay.spreadAmount ?? overlay.jitter ?? 0.18)));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const minSize = Math.max(2, Math.min(w, h));
  const baseRadius = Math.max(2, minSize * Math.max(0.01, Number(overlay.radius || 0.07)));
  const baseLength = Math.max(10, minSize * Math.max(0.01, Number(overlay.lineLength || 0.045)));
  const strokeWidth = Math.max(4, Number(overlay.strokeWidth || 5));
  const opacity = Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96)));
  const seed = hashString(`${overlay.id || "point_pop_line"}:${count}`);
  const lineCanvasSize = Math.max(48, Math.ceil((baseRadius + (baseLength * 1.8) + (strokeWidth * 4)) * 2));
  const lineCenter = lineCanvasSize / 2;
  const overlayX = Math.round((w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)))) - lineCenter);
  const overlayY = Math.round((h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.5)))) - lineCenter);
  const color = `0x${normalizeHexColor(overlay.color, "38BDF8")}@${fmtGain(opacity)}`;
  const echoColor = `0xFFFFFF@${fmtGain(opacity * 0.96)}`;
  const shadowColor = `0x000000@${fmtGain(Math.min(0.4, Math.max(0.14, opacity * 0.28)))}`;
  const phaseTimeExpr = getOverlayPhaseTimeExpr(overlay, "t");
  const echoOffset = Math.max(TIMELINE_TIME_STEP_SEC, Math.min(phaseDuration * 0.34, Math.max(TIMELINE_TIME_STEP_SEC, phaseDuration - TIMELINE_TIME_STEP_SEC)));
  const burstPasses = [
    {
      labelSuffix: "a",
      startOffset: 0,
      burstDuration: Math.max(TIMELINE_TIME_STEP_SEC, phaseDuration * 0.48),
      color
    },
    {
      labelSuffix: "b",
      startOffset: echoOffset,
      burstDuration: Math.max(TIMELINE_TIME_STEP_SEC, phaseDuration - echoOffset),
      color: echoColor
    }
  ];

  const parts = [
    `color=c=black@0.0:s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)},format=rgba[fxpop${index}_base]`
  ];
  let currentLabel = `fxpop${index}_base`;

  burstPasses.forEach((burst) => {
    for (let i = 0; i < count; i++) {
      const delay = burst.burstDuration * 0.12 * spread * seededUnit(seed, i, 17);
      const lineDuration = Math.max(0.06, burst.burstDuration - delay);
      const attack = Math.max(0.04, Math.min(lineDuration * 0.34, lineDuration * 0.78));
      const lineStart = start + burst.startOffset + delay;
      const attackEnd = lineStart + attack;
      const fadeWindow = Math.max(0.01, lineDuration - attack);
      const fadeExpr = clampExpr(`(${phaseTimeExpr}-${fmtNumber(attackEnd)})/${fmtNumber(fadeWindow)}`);
      const revealExpr = `1-pow(1-${clampExpr(`(${phaseTimeExpr}-${fmtNumber(lineStart)})/${fmtNumber(attack)}`)},3)`;
      const lengthFactorExpr = `max(0,(${revealExpr})*(1-(0.6*(${fadeExpr}))))`;
      const travelFactorExpr = `(${revealExpr})*(1-(0.24*(${fadeExpr})))`;
      const angle = (((Math.PI * 2) / count) * i) + ((((seededUnit(seed, i, 3) - 0.5) * 2) * ((Math.PI / Math.max(count, 1)) * 0.75 * spread)));
      const lineLength = baseLength * (0.72 + (seededUnit(seed, i, 29) * 0.42));
      const inner = baseRadius * (0.88 + (seededUnit(seed, i, 53) * 0.12));
      const lineLabel = `fxpop${index}_${burst.labelSuffix}_${i}`;
      const nextLabel = `fxpop${index}_${burst.labelSuffix}_m${i}`;
      const xExpr = `${fmtNumber(lineCenter + inner)}+(${fmtNumber(baseLength * 0.14)}*${travelFactorExpr})`;
      const wExpr = `max(1,${fmtNumber(lineLength)}*${lengthFactorExpr})`;
      const lineFilters = [
        `color=c=black@0.0:s=${lineCanvasSize}x${lineCanvasSize}:r=${fps}:d=${fmtNumber(totalDuration)}`,
        "format=rgba",
        `drawbox=x='${xExpr}':y='${fmtNumber(lineCenter - (strokeWidth * 0.5) + Math.max(1, strokeWidth * 0.35))}':w='${wExpr}':h=${fmtNumber(Math.max(3.5, strokeWidth * 1.34))}:t=fill:replace=1:color=${shadowColor}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
        `drawbox=x='${xExpr}':y='${fmtNumber(lineCenter - (strokeWidth / 2))}':w='${wExpr}':h=${fmtNumber(strokeWidth)}:t=fill:replace=1:color=${burst.color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
        `rotate=a=${fmtNumber(angle)}:ow=iw:oh=ih:c=black@0.0`
      ];

      parts.push(
        `${lineFilters.join(",")}[${lineLabel}]`
      );
      parts.push(`[${currentLabel}][${lineLabel}]overlay=x=${overlayX}:y=${overlayY}:eof_action=pass:repeatlast=0:format=auto[${nextLabel}]`);
      currentLabel = nextLabel;
    }
  });

  currentLabel = appendOverlayFadeLabel(parts, currentLabel, `fxpop${index}`, overlay, start, duration, 0, 0, target);
  return { parts, outputLabel: currentLabel };
}

function appendOverlayAlphaFades(filters, overlay, start, duration, naturalFadeStart, naturalFadeDuration, target) {
  const frameDuration = getRenderFrameDuration(target);
  const phaseOffsetSec = Math.max(0, Number(overlay?.phaseOffsetSec || 0));
  let manualFadeInSec = Math.max(0, Math.min(duration, Number(overlay.manualFadeInSec || 0)));
  let manualFadeOutSec = Math.max(0, Math.min(duration, Number(overlay.manualFadeOutSec || 0)));
  let snappedNaturalFadeDuration = Math.max(0, Math.min(duration, Number(naturalFadeDuration || 0)));
  let snappedNaturalFadeStart = Math.max(0, Number(naturalFadeStart || start));
  if (frameDuration > 1e-6) {
    if (manualFadeInSec > 0.001) {
      manualFadeInSec = Math.max(frameDuration, snapRenderTimeToFrame(manualFadeInSec, target, "nearest"));
      manualFadeInSec = Math.min(duration, manualFadeInSec);
    }
    if (manualFadeOutSec > 0.001) {
      manualFadeOutSec = Math.max(frameDuration, snapRenderTimeToFrame(manualFadeOutSec, target, "nearest"));
      manualFadeOutSec = Math.min(duration, manualFadeOutSec);
    }
    if (snappedNaturalFadeDuration > 0.001) {
      snappedNaturalFadeDuration = Math.max(frameDuration, snapRenderTimeToFrame(snappedNaturalFadeDuration, target, "nearest"));
      snappedNaturalFadeDuration = Math.min(duration, snappedNaturalFadeDuration);
      snappedNaturalFadeStart = snapRenderTimeToFrame(snappedNaturalFadeStart, target, "nearest");
    }
  }
  snappedNaturalFadeStart = Math.max(0, Math.min(start + duration, snappedNaturalFadeStart));
  if (manualFadeInSec > 0.001 && phaseOffsetSec <= 1e-6) {
    filters.push(`fade=t=in:st=${fmtNumber(Math.max(0, start))}:d=${fmtNumber(manualFadeInSec)}:alpha=1`);
  }
  if (snappedNaturalFadeDuration > 0.001) {
    filters.push(`fade=t=out:st=${fmtNumber(snappedNaturalFadeStart)}:d=${fmtNumber(snappedNaturalFadeDuration)}:alpha=1`);
  }
  if (manualFadeOutSec > 0.001) {
    filters.push(`fade=t=out:st=${fmtNumber(Math.max(0, start + duration - manualFadeOutSec))}:d=${fmtNumber(manualFadeOutSec)}:alpha=1`);
  }
  return filters;
}

function buildFocusBoxDrawFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.42));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(duration, Number(overlay.drawDuration || 0.58)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.28)));
  const holdDuration = Math.max(0, Math.min(Number(overlay.holdDuration || 0.46), duration - drawDuration - fadeDuration));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const boxWidth = Math.max(24, w * Math.max(0.08, Number(overlay.boxWidth || 0.28)));
  const boxHeight = Math.max(16, h * Math.max(0.06, Number(overlay.boxHeight || 0.18)));
  const cx = w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const cy = h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.44)));
  const x = cx - (boxWidth / 2);
  const y = cy - (boxHeight / 2);
  const strokeWidth = Math.max(2, Number(overlay.strokeWidth || 6));
  const color = `0x${normalizeHexColor(overlay.color, "38BDF8")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96))))}`;
  const p = `1-pow(1-${clampExpr(`(t-${fmtNumber(start)})/${fmtNumber(drawDuration)}`)},3)`;
  const perimeter = fmtNumber((boxWidth * 2) + (boxHeight * 2));
  const topLen = `max(0,min(${fmtNumber(boxWidth)},(${perimeter})*${p}))`;
  const rightLen = `max(0,min(${fmtNumber(boxHeight)},((${perimeter})*${p})-${fmtNumber(boxWidth)}))`;
  const bottomLen = `max(0,min(${fmtNumber(boxWidth)},((${perimeter})*${p})-${fmtNumber(boxWidth + boxHeight)}))`;
  const leftLen = `max(0,min(${fmtNumber(boxHeight)},((${perimeter})*${p})-${fmtNumber((boxWidth * 2) + boxHeight)}))`;
  const filters = [
    `color=c=black@0.0:s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)}`,
    "format=rgba",
    `drawbox=x=${fmtNumber(x)}:y=${fmtNumber(y)}:w='${topLen}':h=${fmtNumber(strokeWidth)}:t=fill:color=${color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `drawbox=x=${fmtNumber(x + boxWidth - strokeWidth)}:y=${fmtNumber(y)}:w=${fmtNumber(strokeWidth)}:h='${rightLen}':t=fill:color=${color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `drawbox=x='${fmtNumber(x + boxWidth)}-${fmtNumber(strokeWidth)}-(${bottomLen})':y=${fmtNumber(y + boxHeight - strokeWidth)}:w='${bottomLen}':h=${fmtNumber(strokeWidth)}:t=fill:color=${color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `drawbox=x=${fmtNumber(x)}:y='${fmtNumber(y + boxHeight)}-${fmtNumber(strokeWidth)}-(${leftLen})':w=${fmtNumber(strokeWidth)}:h='${leftLen}':t=fill:color=${color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`
  ];
  appendOverlayAlphaFades(filters, overlay, start, duration, start + drawDuration + holdDuration, fadeDuration, target);
  return { parts: [`${filters.join(",")}[fxbox${index}]`], outputLabel: `fxbox${index}` };
}

function buildCalloutLineDrawFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.18));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(duration, Number(overlay.drawDuration || 0.52)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.24)));
  const holdDuration = Math.max(0, Math.min(Number(overlay.holdDuration || 0.42), duration - drawDuration - fadeDuration));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const minSize = Math.max(2, Math.min(w, h));
  const lineLength = Math.max(24, minSize * Math.max(0.04, Number(overlay.lineLength || 0.22)));
  const strokeWidth = Math.max(2, Number(overlay.strokeWidth || 6));
  const color = `0x${normalizeHexColor(overlay.color, "38BDF8")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96))))}`;
  const accentColor = `0x${normalizeHexColor(overlay.accentColor, "FFFFFF")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96)) * 0.92))}`;
  const canvasSize = Math.max(64, Math.ceil(lineLength + (strokeWidth * 8)));
  const lineCenter = canvasSize / 2;
  const overlayX = Math.round((w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.38)))) - lineCenter);
  const overlayY = Math.round((h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.44)))) - lineCenter);
  const progressExpr = `1-pow(1-${clampExpr(`(t-${fmtNumber(start)})/${fmtNumber(drawDuration)}`)},3)`;
  const filters = [
    `color=c=black@0.0:s=${canvasSize}x${canvasSize}:r=${fps}:d=${fmtNumber(totalDuration)}`,
    "format=rgba",
    `drawbox=x=${fmtNumber(lineCenter)}:y=${fmtNumber(lineCenter - (strokeWidth / 2))}:w='max(1,${fmtNumber(lineLength)}*${progressExpr})':h=${fmtNumber(strokeWidth)}:t=fill:color=${color}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `drawbox=x=${fmtNumber(lineCenter + 2)}:y=${fmtNumber(lineCenter - (strokeWidth * 0.2))}:w='max(1,${fmtNumber(lineLength)}*${progressExpr})':h=${fmtNumber(Math.max(1, strokeWidth * 0.34))}:t=fill:color=${accentColor}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `rotate=a=${fmtNumber(Number(overlay.lineAngle ?? -18) * (Math.PI / 180))}:ow=iw:oh=ih:c=black@0.0`
  ];
  appendOverlayAlphaFades(filters, overlay, start, duration, start + drawDuration + holdDuration, fadeDuration, target);
  return {
    parts: [`${filters.join(",")}[fxcall${index}]`],
    outputLabel: `fxcall${index}`,
    overlayX,
    overlayY
  };
}

function buildSoftSpotlightFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.44));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.38)));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const cx = w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const cy = h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.48)));
  const rx = Math.max(24, (w * Math.max(0.08, Number(overlay.boxWidth || 0.26))) / 2);
  const ry = Math.max(18, (h * Math.max(0.05, Number(overlay.boxHeight || 0.16))) / 2);
  const opacity = Math.max(0.05, Math.min(1, Number(overlay.opacity ?? 0.42)));
  const softness = Math.max(0.18, Math.min(0.94, Number(overlay.softness ?? 0.56)));
  const filters = [
    `color=c=0x${normalizeHexColor(overlay.color, "FFFFFF")}@0.0:s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)}`,
    "format=rgba",
    `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*${fmtGain(opacity)}*pow(max(0,1-${clampExpr(`(sqrt(pow((X-${fmtNumber(cx)})/${fmtNumber(rx)},2)+pow((Y-${fmtNumber(cy)})/${fmtNumber(ry)},2))-${fmtNumber(softness * 0.24)})/${fmtNumber(Math.max(0.05, 1 - (softness * 0.24)))}`)}),2)'`
  ];
  appendOverlayAlphaFades(filters, overlay, start, duration, start + Math.max(MIN_OVERLAY_CLIP_SEC, duration - fadeDuration), fadeDuration, target);
  return { parts: [`${filters.join(",")}[fxspot${index}]`], outputLabel: `fxspot${index}` };
}

function buildHighlightBarSweepFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.18));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(duration, Number(overlay.drawDuration || 0.42)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.24)));
  const holdDuration = Math.max(0, Math.min(Number(overlay.holdDuration || 0.52), duration - drawDuration - fadeDuration));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const totalWidth = Math.max(48, w * Math.max(0.08, Number(overlay.width || 0.34)));
  const barHeight = Math.max(16, h * Math.max(0.03, Number(overlay.boxHeight || 0.12)));
  const x = (w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)))) - (totalWidth / 2);
  const y = (h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.42)))) - (barHeight / 2);
  const progressExpr = `1-pow(1-${clampExpr(`(t-${fmtNumber(start)})/${fmtNumber(drawDuration)}`)},3)`;
  const accentWidth = Math.max(10, Math.min(44, totalWidth * 0.14));
  const filters = [
    `color=c=black@0.0:s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)}`,
    "format=rgba",
    `drawbox=x=${fmtNumber(x)}:y=${fmtNumber(y)}:w='max(2,${fmtNumber(totalWidth)}*${progressExpr})':h=${fmtNumber(barHeight)}:t=fill:color=0x${normalizeHexColor(overlay.color, "FDE68A")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.44))))}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `drawbox=x='${fmtNumber(x)}+max(0,(${fmtNumber(totalWidth)}*${progressExpr})-${fmtNumber(accentWidth)})':y=${fmtNumber(y + Math.max(2, barHeight * 0.18))}:w=${fmtNumber(accentWidth)}:h=${fmtNumber(Math.max(4, barHeight * 0.22))}:t=fill:color=0x${normalizeHexColor(overlay.accentColor, "FFFFFF")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.44)) * 0.82))}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`
  ];
  appendOverlayAlphaFades(filters, overlay, start, duration, start + drawDuration + holdDuration, fadeDuration, target);
  return { parts: [`${filters.join(",")}[fxbar${index}]`], outputLabel: `fxbar${index}` };
}

function buildSectionDividerSlideFxFilter(overlay, index, totalDuration, target) {
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || 1.22));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(duration, Number(overlay.drawDuration || 0.48)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.24)));
  const holdDuration = Math.max(0, Math.min(Number(overlay.holdDuration || 0.5), duration - drawDuration - fadeDuration));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const totalWidth = Math.max(80, w * Math.max(0.16, Number(overlay.width || 0.78)));
  const thickness = Math.max(2, Number(overlay.lineThickness || 4));
  const centerX = w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const y = (h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.24)))) - (thickness / 2);
  const slideTravel = Math.min(80, totalWidth * 0.18);
  const progressExpr = `1-pow(1-${clampExpr(`(t-${fmtNumber(start)})/${fmtNumber(drawDuration)}`)},3)`;
  const filters = [
    `color=c=black@0.0:s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)}`,
    "format=rgba",
    `drawbox=x='${fmtNumber(centerX - (totalWidth / 2))}-((1-${progressExpr})*${fmtNumber(slideTravel)})':y=${fmtNumber(y)}:w='max(2,${fmtNumber(totalWidth)}*(0.34+(0.66*${progressExpr})))':h=${fmtNumber(thickness)}:t=fill:color=0x${normalizeHexColor(overlay.color, "CBD5E1")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96))))}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`,
    `drawbox=x='${fmtNumber(centerX - (totalWidth / 2))}-((1-${progressExpr})*${fmtNumber(slideTravel)})+max(8,(${fmtNumber(totalWidth)}*(0.34+(0.66*${progressExpr})))*0.18)':y=${fmtNumber(y - Math.max(1, thickness * 0.45))}:w=${fmtNumber(Math.max(24, totalWidth * 0.16))}:h=${fmtNumber(Math.max(2, thickness * 0.9))}:t=fill:color=0x${normalizeHexColor(overlay.accentColor, "38BDF8")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.96))))}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'`
  ];
  appendOverlayAlphaFades(filters, overlay, start, duration, start + drawDuration + holdDuration, fadeDuration, target);
  return { parts: [`${filters.join(",")}[fxdiv${index}]`], outputLabel: `fxdiv${index}` };
}

function buildCheckpointPopFxFilter(overlay, index, totalDuration, target) {
  const built = buildPointPopLineFxFilter({
    ...overlay,
    lineCount: overlay.lineCount || 8,
    radius: overlay.radius || 0.052,
    lineLength: overlay.lineLength || 0.032,
    strokeWidth: overlay.strokeWidth || 4.5,
    duration: overlay.duration || (Number(overlay.durationMs || 680) / 1000) || 0.68
  }, index, totalDuration, target);
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const start = Number(overlay.start || 0);
  const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(overlay.duration || (Number(overlay.durationMs || 680) / 1000) || 0.68));
  const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(duration, Number(overlay.drawDuration || 0.22)));
  const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(duration, Number(overlay.fadeOutDuration || 0.22)));
  const holdDuration = Math.max(0, Math.min(Number(overlay.holdDuration || 0.18), Math.max(0, duration - drawDuration - fadeDuration)));
  const size = Math.max(16, Math.min(w, h) * Math.max(0.012, Number(overlay.radius || 0.052)) * 1.4);
  const progressExpr = `0.82+(0.18*(1-pow(1-${clampExpr(`(t-${fmtNumber(start)})/${fmtNumber(drawDuration)}`)},3)))`;
  const cx = w * Math.max(0, Math.min(1, Number(overlay.x ?? 0.5)));
  const cy = h * Math.max(0, Math.min(1, Number(overlay.y ?? 0.48)));
  const next = `fxcheckpoint${index}`;
  built.parts.push(
    `[${built.outputLabel}]drawbox=x='${fmtNumber(cx)}-((${fmtNumber(size)}*${progressExpr})/2)':y='${fmtNumber(cy)}-(((${fmtNumber(size)}*0.74)*${progressExpr})/2)':w='${fmtNumber(size)}*${progressExpr}':h='(${fmtNumber(size)}*0.74)*${progressExpr}':t=fill:color=0x${normalizeHexColor(overlay.color, "22C55E")}@${fmtGain(Math.max(0.1, Math.min(1, Number(overlay.opacity ?? 0.98))))}:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'[${next}]`
  );
  built.parts.push(
    `[${next}]drawbox=x='${fmtNumber(cx)}-((${fmtNumber(size)}*0.18)/2)':y='${fmtNumber(cy)}-((${fmtNumber(size)}*0.08)/2)':w='${fmtNumber(size)}*0.18':h='${fmtNumber(size)}*0.08':t=fill:color=0xFFFFFF@1:enable='between(t,${fmtNumber(start)},${fmtNumber(start + duration)})'[${next}a]`
  );
  const outputLabel = appendOverlayFadeLabel(
    built.parts,
    `${next}a`,
    next,
    overlay,
    start,
    duration,
    start + drawDuration + holdDuration,
    fadeDuration,
    target
  );
  return { parts: built.parts, outputLabel };
}

function getZoomFocusScaleForRender(overlay) {
  const boxWidth = Math.max(0.08, Math.min(1, Number(overlay.boxWidth || overlay.width || 0.34)));
  const boxHeight = Math.max(0.08, Math.min(1, Number(overlay.boxHeight || overlay.height || 0.24)));
  return Math.max(1, Math.min(8, 1 / Math.max(boxWidth, boxHeight)));
}

function buildZoomFocusChain(project, rangeStart, rangeEnd, inputLabel, target) {
  const overlayItems = (project.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((item) => item.overlayType === "zoom_focus" || item.overlayType === "zoom_out_focus")
    .sort((a, b) => (
      Number(b.section || 1) - Number(a.section || 1)
      || Number(a.start || 0) - Number(b.start || 0)
    ));
  if (!overlayItems.length) return { parts: [], outputLabel: inputLabel };

  const parts = [];
  let current = inputLabel;
  let seq = 0;
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));

  overlayItems.forEach((overlay) => {
    const win = overlayActiveWindow(overlay, rangeStart, rangeEnd, target);
    if (!win) return;
    const normalized = {
      ...overlay,
      start: win.start,
      duration: win.visibleDuration,
      originalDurationSec: win.duration,
      phaseOffsetSec: win.phaseOffsetSec
    };
    const focusScale = getZoomFocusScaleForRender(normalized);
    if (focusScale <= 1.001) return;
    const isZoomOut = normalized.overlayType === "zoom_out_focus";
    const startScale = 1;
    const endScale = isZoomOut ? Math.max(0.125, 1 / focusScale) : focusScale;
    const strengthBaseScaleExpr = fmtNumber(startScale);

    const start = Number(normalized.start || 0);
    const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(normalized.duration || 1.8));
    const phaseDuration = Math.max(duration, Number(normalized.originalDurationSec || duration || 1.8));
    const end = start + duration;
    const fadeInSec = Math.max(0, Math.min(duration, Number(normalized.manualFadeInSec || 0)));
    const fadeOutSec = Math.max(0, Math.min(duration, Number(normalized.manualFadeOutSec || 0)));
    const centerX = Math.max(0, Math.min(1, Number(normalized.x ?? 0.5)));
    const centerY = Math.max(0, Math.min(1, Number(normalized.y ?? 0.46)));
    const phaseTimeExpr = getOverlayPhaseTimeExpr(normalized, "t");
    const strengthInExpr = fadeInSec > 0.001 ? clampExpr(`(${phaseTimeExpr}-${fmtNumber(start)})/${fmtNumber(fadeInSec)}`) : "1";
    const strengthOutExpr = fadeOutSec > 0.001 ? clampExpr(`(${fmtNumber(start + phaseDuration)}-${phaseTimeExpr})/${fmtNumber(fadeOutSec)}`) : "1";
    const strengthExpr = (fadeInSec > 0.001 || fadeOutSec > 0.001)
      ? `min(${strengthInExpr},${strengthOutExpr})`
      : "1";
    const transformStrengthExpr = isZoomOut ? "1" : strengthExpr;
    const progressExpr = clampExpr(`(${phaseTimeExpr}-${fmtNumber(start)})/${fmtNumber(phaseDuration)}`);
    const transformExpr = zoomMotion.computeAnchorZoomTransformExpr(
      progressExpr,
      centerX,
      centerY,
      startScale,
      endScale,
      fmtNumber(w),
      fmtNumber(h),
      { strengthExpr: transformStrengthExpr, strengthBaseScaleExpr }
    );
    const baseLabel = `zoombase${seq}`;
    const srcLabel = `zoomsrc${seq}`;
    const zoomedLabel = `zoomfx${seq}`;
    const nextLabel = `zoommix${seq}`;
    parts.push(`[${current}]split=2[${baseLabel}][${srcLabel}]`);
    parts.push(
      `[${srcLabel}]scale=w='${fmtNumber(w)}*(${transformExpr.scaleExpr})':h='${fmtNumber(h)}*(${transformExpr.scaleExpr})':eval=frame:flags=lanczos,format=rgba[${zoomedLabel}]`
    );
    if (isZoomOut) {
      const canvasLabel = `zoomcanvas${seq}`;
      const placedLabel = `zoompad${seq}`;
      const fadedLabel = `zoomfade${seq}`;
      const activeExpr = `between(T,${fmtNumber(start)},${fmtNumber(end)})`;
      const totalDuration = Math.max(0.02, Number(rangeEnd || 0) - Number(rangeStart || 0) || Number(project?.duration || 0) || Number(end || 0));
      let zoomOutLabel = placedLabel;
      parts.push(
        `color=c=black@0.0:s=${Math.max(2, w)}x${Math.max(2, h)}:r=${fmtNumber(Math.max(1, Number(target.fps || 30)))}:d=${fmtNumber(totalDuration)},format=rgba[${canvasLabel}]`
      );
      parts.push(
        `[${canvasLabel}][${zoomedLabel}]overlay=x='${transformExpr.translateXExpr}':y='${transformExpr.translateYExpr}':eval=frame:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${placedLabel}]`
      );
      {
        const alphaFilters = appendOverlayAlphaFades(["format=rgba"], normalized, start, duration, start, duration, target);
        parts.push(`[${placedLabel}]${alphaFilters.join(",")}[${fadedLabel}]`);
        zoomOutLabel = fadedLabel;
      }
      parts.push(
        `[${baseLabel}][${zoomOutLabel}]blend=all_expr='A*(1-(${activeExpr}))+B*(${activeExpr})',format=rgba[${nextLabel}]`
      );
    } else {
      parts.push(
        `[${baseLabel}][${zoomedLabel}]overlay=x='${transformExpr.translateXExpr}':y='${transformExpr.translateYExpr}':enable='between(t,${fmtNumber(start)},${fmtNumber(end)})':eof_action=pass:repeatlast=0:format=auto:alpha=straight[${nextLabel}]`
      );
    }
    current = nextLabel;
    seq += 1;
  });

  return { parts, outputLabel: current };
}

function buildDropWaveTemporalExpr(localTimeExpr, drawDuration, holdDuration, fadeDuration) {
  const introExpr = drawDuration > 0.001
    ? smoothstepExpr(`(${localTimeExpr})/${fmtNumber(drawDuration)}`)
    : "1";
  const fadeStart = Math.max(0, drawDuration + holdDuration);
  const outroExpr = fadeDuration > 0.001
    ? `(1-${smoothstepExpr(`((${localTimeExpr})-${fmtNumber(fadeStart)})/${fmtNumber(fadeDuration)}`)})`
    : "1";
  return clampExpr(`(${introExpr})*(${outroExpr})`);
}

function buildDropWaveSpatialExpr(distExpr, reachExpr, softnessExpr) {
  const baseSpatialExpr = clampExpr(`1-((${distExpr})/(${reachExpr}))`);
  const softenedExpr = smoothstepExpr(baseSpatialExpr);
  return clampExpr(mixExpr(baseSpatialExpr, softenedExpr, softnessExpr));
}

function buildDropWaveRemapChain(project, rangeStart, rangeEnd, inputLabel, target, debugSession = null) {
  const overlayItems = (project.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((item) => item.overlayType === "drop_wave")
    .filter((item) => !item._renderDisabled)
    .sort((a, b) => (
      Number(b.section || 1) - Number(a.section || 1)
      || Number(a.start || 0) - Number(b.start || 0)
      || String(a.id || "").localeCompare(String(b.id || ""))
    ));
  if (!overlayItems.length) return { parts: [], outputLabel: inputLabel };

  const totalDuration = Math.max(MIN_OVERLAY_CLIP_SEC, rangeEnd - rangeStart);
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));
  const minSize = Math.max(2, Math.min(w, h));
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const useDisplaceFallback = String(project?._dropWaveRenderMode || process.env.VIDEOSMITH_DROP_WAVE_FILTER || "").trim().toLowerCase() === "displace";
  const mapMode = useDisplaceFallback ? "displace" : "remap";
  const parts = [];
  let current = inputLabel;
  let seq = 0;
  const overlaySummaries = [];

  overlayItems.forEach((overlay) => {
    const win = overlayActiveWindow(overlay, rangeStart, rangeEnd, target);
    if (!win) return;
    const normalized = {
      ...overlay,
      start: win.start,
      duration: win.visibleDuration,
      originalDurationSec: win.duration,
      phaseOffsetSec: win.phaseOffsetSec
    };
    const start = Number(normalized.start || 0);
    const phaseDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(normalized.originalDurationSec || normalized.duration || 1.24));
    const drawDuration = Math.max(MIN_OVERLAY_CLIP_SEC, Math.min(phaseDuration, Number(normalized.drawDuration || 0.18)));
    const fadeDuration = Math.max(MIN_OVERLAY_CLIP_SEC / 2, Math.min(phaseDuration, Number(normalized.fadeOutDuration || 0.32)));
    const holdDuration = Math.max(0, Math.min(Number(normalized.holdDuration || 0.74), Math.max(0, phaseDuration - drawDuration - fadeDuration)));
    const centerX = clampFinite(normalized.x ?? 0.5, 0, 1, 0.5);
    const centerY = clampFinite(normalized.y ?? 0.46, 0, 1, 0.46);
    const waveCount = Math.max(1, Math.min(10, Math.round(Number(normalized.waveCount || 4))));
    const waveSpacing = Math.max(0.01, Number(normalized.waveSpacing || 0.055));
    const reachPx = (minSize * Math.max(0.03, Number(normalized.radius || 0.12))) + (minSize * waveSpacing * waveCount);
    const waveLenPx = Math.max(8, minSize * waveSpacing);
    const strengthPx = Math.max(0, minSize * Math.max(0, Number(normalized.amplitude || 0.032)) * 0.65);
    const speed = Math.max(0.1, Number(normalized.speed || 1.2));
    const softness = clampFinite(normalized.softness ?? 0.64, 0.05, 1, 0.64);
    if (reachPx <= 0.001 || strengthPx <= 0.001) return;

    const phaseTimeExpr = getOverlayPhaseTimeExpr(normalized, "T");
    const localTimeExpr = `(${phaseTimeExpr}-${fmtNumber(start)})`;
    const manualFadeInSec = Math.max(0, Math.min(phaseDuration, Number(normalized.manualFadeInSec || 0)));
    const manualFadeOutSec = Math.max(0, Math.min(phaseDuration, Number(normalized.manualFadeOutSec || 0)));
    const manualStrengthInExpr = manualFadeInSec > 0.001
      ? clampExpr(`(${phaseTimeExpr}-${fmtNumber(start)})/${fmtNumber(manualFadeInSec)}`)
      : "1";
    const manualStrengthOutExpr = manualFadeOutSec > 0.001
      ? clampExpr(`(${fmtNumber(start + phaseDuration)}-${phaseTimeExpr})/${fmtNumber(manualFadeOutSec)}`)
      : "1";
    const temporalExpr = clampExpr(`(${buildDropWaveTemporalExpr(localTimeExpr, drawDuration, holdDuration, fadeDuration)})*(${minExpr(manualStrengthInExpr, manualStrengthOutExpr)})`);
    const cxExpr = fmtNumber(w * centerX);
    const cyExpr = fmtNumber(h * centerY);
    const activeStart = fmtNumber(start);
    const activeEnd = fmtNumber(start + Math.max(MIN_OVERLAY_CLIP_SEC, Number(normalized.visibleDuration || phaseDuration)));
    const activeWindowExpr = `between(T,${activeStart},${activeEnd})`;
    const distExpr = `sqrt(((X-${cxExpr})*(X-${cxExpr}))+((Y-${cyExpr})*(Y-${cyExpr})))`;
    const safeDistExpr = maxExpr("1", distExpr);
    const dirXExpr = `(X-${cxExpr})/(${safeDistExpr})`;
    const dirYExpr = `(Y-${cyExpr})/(${safeDistExpr})`;
    const phase1Expr = `(((${distExpr})/${fmtNumber(waveLenPx)})*${fmtNumber(Math.PI * 2)})-((${localTimeExpr})*${fmtNumber(speed)}*${fmtNumber(Math.PI * 2)})`;
    const phase2Expr = `(((${distExpr})/${fmtNumber(waveLenPx * 0.62)})*${fmtNumber(Math.PI * 2)})-((${localTimeExpr})*${fmtNumber(speed * 1.37)}*${fmtNumber(Math.PI * 2)})`;
    const spatialExpr = buildDropWaveSpatialExpr(distExpr, fmtNumber(reachPx), fmtNumber(softness));
    const offsetExpr = `(${fmtNumber(strengthPx)})*(${temporalExpr})*(${spatialExpr})*((0.74*sin(${phase1Expr}))+(0.26*sin(${phase2Expr})))`;
    const srcXExpr = `if(${activeWindowExpr},${clampRangeExpr(`X+((${dirXExpr})*(${offsetExpr}))`, "0", fmtNumber(w - 1))},X)`;
    const srcYExpr = `if(${activeWindowExpr},${clampRangeExpr(`Y+((${dirYExpr})*(${offsetExpr}))`, "0", fmtNumber(h - 1))},Y)`;
    const sourceTag = `dw${seq}`;
    const xMapLabel = `${sourceTag}xmap`;
    const yMapLabel = `${sourceTag}ymap`;
    const nextLabel = `${sourceTag}fx`;

    overlaySummaries.push(
      `id=${normalized.id || `drop_wave_${seq}`} start=${fmtNumber(start)} phase=${fmtNumber(phaseDuration)} activeWindow=${activeStart}-${activeEnd}/${fmtNumber(totalDuration)} reachPx=${fmtNumber(reachPx)} strengthPx=${fmtNumber(strengthPx)} mode=${mapMode}`
    );

    if (useDisplaceFallback) {
      const vectorScaleExpr = fmtNumber(Math.max(1, strengthPx));
      const xDispExpr = `if(${activeWindowExpr},${clampRangeExpr(`128+(127*(((${dirXExpr})*(${offsetExpr}))/${vectorScaleExpr}))`, "0", "255")},128)`;
      const yDispExpr = `if(${activeWindowExpr},${clampRangeExpr(`128+(127*(((${dirYExpr})*(${offsetExpr}))/${vectorScaleExpr}))`, "0", "255")},128)`;
      parts.push(
        `nullsrc=s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)},format=gray,geq=lum='${xDispExpr}'[${xMapLabel}]`
      );
      parts.push(
        `nullsrc=s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)},format=gray,geq=lum='${yDispExpr}'[${yMapLabel}]`
      );
      parts.push(`[${current}][${xMapLabel}][${yMapLabel}]displace[${nextLabel}]`);
    } else {
      // `remap` distorts the already-composited picture before drawtext / canvas FX,
      // so the ripple affects the video surface itself instead of drawing rings on top.
      const xCoordExpr = `round(((${srcXExpr})*65535)/${fmtNumber(Math.max(1, w - 1))})`;
      const yCoordExpr = `round(((${srcYExpr})*65535)/${fmtNumber(Math.max(1, h - 1))})`;
      parts.push(
        `nullsrc=s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)},format=gray16le,geq=lum='${xCoordExpr}'[${xMapLabel}]`
      );
      parts.push(
        `nullsrc=s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)},format=gray16le,geq=lum='${yCoordExpr}'[${yMapLabel}]`
      );
      parts.push(`[${current}][${xMapLabel}][${yMapLabel}]remap[${nextLabel}]`);
    }
    current = nextLabel;
    seq += 1;
  });

  if (overlaySummaries.length) {
    debugSession?.write?.("Drop wave remap chain active", [
      `mode=${mapMode}`,
      `count=${overlaySummaries.length}`,
      ...overlaySummaries
    ].join("\n"));
  }

  return { parts, outputLabel: current };
}

function buildFxOverlayChain(project, rangeStart, rangeEnd, inputLabel, target) {
  const overlayItems = (project.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((item) => [
      "circle",
      "underline",
      "point_pop_line",
      "focus_box_draw",
      "callout_line_draw",
      "soft_spotlight",
      "highlight_bar_sweep",
      "checkpoint_pop",
      "section_divider_slide"
    ].includes(item.overlayType))
    .sort((a, b) => (
      Number(b.section || 1) - Number(a.section || 1)
      || Number(a.start || 0) - Number(b.start || 0)
    ));
  if (!overlayItems.length) return { parts: [], outputLabel: inputLabel };

  const parts = [];
  let current = inputLabel;
  let seq = 0;
  const totalDuration = Math.max(MIN_OVERLAY_CLIP_SEC, rangeEnd - rangeStart);

  overlayItems.forEach((overlay) => {
    const win = overlayActiveWindow(overlay, rangeStart, rangeEnd, target);
    if (!win) return;
    const normalizedOverlay = {
      ...overlay,
      start: win.start,
      duration: win.visibleDuration,
      originalDurationSec: win.duration,
      phaseOffsetSec: win.phaseOffsetSec
    };
    let built = null;
    if (normalizedOverlay.overlayType === "circle") built = buildCircleFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "underline") built = buildUnderlineFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "point_pop_line") built = buildPointPopLineFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "focus_box_draw") built = buildFocusBoxDrawFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "callout_line_draw") built = buildCalloutLineDrawFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "soft_spotlight") built = buildSoftSpotlightFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "highlight_bar_sweep") built = buildHighlightBarSweepFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "checkpoint_pop") built = buildCheckpointPopFxFilter(normalizedOverlay, seq, totalDuration, target);
    else if (normalizedOverlay.overlayType === "section_divider_slide") built = buildSectionDividerSlideFxFilter(normalizedOverlay, seq, totalDuration, target);
    if (!built) return;
    parts.push(...built.parts);
    const next = `vfxmix${seq}`;
    parts.push(`[${current}][${built.outputLabel}]overlay=x=${fmtNumber(Number(built.overlayX || 0))}:y=${fmtNumber(Number(built.overlayY || 0))}:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${next}]`);
    current = next;
    seq += 1;
  });

  return { parts, outputLabel: current };
}

function buildOverlayDrawtextChain(project, rangeStart, rangeEnd, inputLabel, target, context = {}) {
  const overlayItems = (project.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((item) => String(item.overlayType || "text") === "text")
    .filter((item) => String(item._renderTextMode || "drawtext") !== "canvas")
    .filter((item) => {
      const start = Number(item.start || 0);
      const end = start + Math.max(MIN_OVERLAY_CLIP_SEC, Number(item.duration || MIN_OVERLAY_CLIP_SEC));
      return end > rangeStart + 1e-6 && start < rangeEnd - 1e-6;
    })
    .sort((a, b) => (
      Number(b.section || 1) - Number(a.section || 1)
      || Number(a.start || 0) - Number(b.start || 0)
    ));

  if (!overlayItems.length) return { parts: [], outputLabel: inputLabel };

  const parts = [];
  let current = inputLabel;
  let seq = 0;
  const totalDuration = Math.max(MIN_OVERLAY_CLIP_SEC, rangeEnd - rangeStart);
  const fps = fmtNumber(Math.max(1, Number(target.fps || 30)));
  const w = Math.max(2, Number(target.w || 1920));
  const h = Math.max(2, Number(target.h || 1080));

  overlayItems.forEach((overlay) => {
    const win = overlayActiveWindow(overlay, rangeStart, rangeEnd, target);
    if (!win) return;
    const start = win.start;
    const end = win.end;
    const duration = win.duration;
    const fontOpacity = overlay.noFill ? 0 : Number(overlay.opacity ?? 1);
    const strokeOpacity = overlay.noStroke ? 0 : Number(overlay.opacity ?? 1);
    if (fontOpacity <= 0.001 && strokeOpacity <= 0.001) return;
    const idx = seq++;
    const base = `txtbase${idx}`;
    const drawn = `txtdraw${idx}`;
    const mixed = `vtxt${idx}`;
    const verification = overlay._renderFontFile
      ? { fontFile: overlay._renderFontFile, canUseDrawtext: true }
      : resolveVerifiedRenderFont(overlay, context.debugSession || null);
    if (!verification.canUseDrawtext) {
      context.debugSession?.write?.("Skipping drawtext overlay for canvas fallback", [
        `overlayId=${String(overlay.id || "")}`,
        `reason=${String(verification.reason || "")}`
      ].join("\n"));
      return;
    }
    const fontFile = verification.fontFile || "";
    const fontFileArg = fontFile ? `fontfile='${escapeFilterPath(fontFile)}':` : "";
    const textFile = typeof context.writeTextFile === "function"
      ? context.writeTextFile(overlay.text ?? "", overlay.id || `overlay_${idx}`)
      : "";
    const textArg = textFile
      ? `textfile='${escapeFilterPath(textFile)}'`
      : `text='${escapeDrawtextText(overlay.text ?? "")}'`;
    const fontColor = `0x${normalizeHexColor(overlay.color, "FFFFFF")}@${fmtGain(fontOpacity)}`;
    const strokeColor = `0x${normalizeHexColor(overlay.strokeColor, "000000")}@${fmtGain(strokeOpacity)}`;
    const yExpr = `${fmtNumber(h)}*${fmtNumber(Math.max(0, Math.min(1, Number(overlay.y ?? 0.82))))}`;
    parts.push(
      `color=c=black@0.0:s=${w}x${h}:r=${fps}:d=${fmtNumber(totalDuration)},format=rgba[${base}]`
    );
    parts.push(
      `[${base}]drawtext=${fontFileArg}${textArg}:fontsize=${Math.max(18, Math.round(Number(overlay.fontSize || 64)))}:fontcolor=${fontColor}:x='${buildOverlayXExpr(overlay, w)}':y='${yExpr}':borderw=${fmtNumber(overlay.noStroke ? 0 : Math.max(0, Number(overlay.strokeWidth || 0)))}:bordercolor=${strokeColor}:line_spacing=8:enable='between(t,${fmtNumber(start)},${fmtNumber(end)})'[${drawn}]`
    );
    const transitioned = appendTextOverlayTransitionLabel(parts, drawn, `txtdraw${idx}`, {
      ...overlay,
      start,
      duration
    }, totalDuration, target);
    const faded = appendOverlayFadeLabel(parts, transitioned, `txtdraw${idx}`, overlay, start, duration, 0, 0, target);
    parts.push(`[${current}][${faded}]overlay=x=0:y=0:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${mixed}]`);
    current = mixed;
  });

  return { parts, outputLabel: current };
}

function clampBuiltRenderDuration(built, durationSec, renderMode = "video", target = {}) {
  if (!built?.filter || !built?.map) return built;
  const fps = getRenderFps(target);
  const expectedFrameCount = renderMode === "video"
    ? getExpectedRenderFrameCount(durationSec, target)
    : 0;
  const safeDuration = renderMode === "video"
    ? Math.max(1 / fps, expectedFrameCount / fps)
    : Math.max(0.02, Number(durationSec || 0.02));
  const parts = [built.filter];
  const nextMap = { ...built.map };
  if (renderMode === "audio") {
    if (built.map.a) {
      const trimmedAudio = `${String(built.map.a)}_dur`;
      parts.push(`[${built.map.a}]atrim=duration=${fmtNumber(safeDuration)},asetpts=PTS-STARTPTS[${trimmedAudio}]`);
      nextMap.a = trimmedAudio;
    }
  } else {
    if (built.map.v) {
      const trimmedVideo = `${String(built.map.v)}_dur`;
      const padDuration = Math.max(1 / fps, Math.min(1, 8 / fps));
      parts.push(`[${built.map.v}]tpad=stop_mode=clone:stop_duration=${fmtNumber(padDuration)},trim=start_frame=0:end_frame=${expectedFrameCount},setpts=N/(${fmtNumber(fps)}*TB)[${trimmedVideo}]`);
      nextMap.v = trimmedVideo;
    }
    if (built.map.a) {
      const trimmedAudio = `${String(built.map.a)}_dur`;
      parts.push(`[${built.map.a}]atrim=duration=${fmtNumber(safeDuration)},asetpts=PTS-STARTPTS[${trimmedAudio}]`);
      nextMap.a = trimmedAudio;
    } else {
      delete nextMap.a;
    }
  }
  return {
    ...built,
    filter: parts.filter(Boolean).join(";"),
    map: nextMap,
    durationSec: safeDuration
  };
}

function normalizeBuiltVideoOutput(built, target, renderMode = "video") {
  if (renderMode !== "video" || !built?.filter || !built?.map?.v) return built;
  const safeFps = fmtNumber(Math.max(1, Number(target?.fps || 30)));
  const parts = [built.filter];
  const normalizedLabel = `${String(built.map.v)}_cfr`;
  parts.push(
    `[${built.map.v}]fps=${safeFps},settb=AVTB,setpts=N/(${safeFps}*TB),format=yuv420p[${normalizedLabel}]`
  );
  return {
    ...built,
    filter: parts.join(";"),
    map: {
      ...built.map,
      v: normalizedLabel
    }
  };
}

function getFilterScriptDir() {
  return path.join(getShortRuntimeWorkRoot(), "fs");
}

function getFxRenderStageDir() {
  return path.join(getShortRuntimeWorkRoot(), "fx");
}

function getDrawtextStageDir() {
  return path.join(getShortRuntimeWorkRoot(), "txt");
}

function writeComplexFilterScript(filterText) {
  const scriptDir = getFilterScriptDir();
  ensureDir(scriptDir);
  const filePath = path.join(scriptDir, `f_${randomUUID().slice(0, 6)}.txt`);
  fs.writeFileSync(filePath, String(filterText || ""), "utf8");
  return filePath;
}

function writeDrawtextTextFile(text, sessionDir, id = "") {
  ensureDir(sessionDir);
  const safeId = String(id || randomUUID())
    .replace(/[^a-z0-9_-]/gi, "_")
    .slice(0, 80) || randomUUID().slice(0, 8);
  const filePath = path.join(sessionDir, `txt_${safeId}_${randomUUID().slice(0, 6)}.txt`);
  fs.writeFileSync(filePath, String(text || ""), "utf8");
  return filePath;
}

function cleanupTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup failures
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || "operation timed out")), Math.max(1, Number(timeoutMs || 1)));
    })
  ]);
}

function closeFxRenderHostWindow() {
  try {
    if (fxRenderHostWindow && !fxRenderHostWindow.isDestroyed()) {
      fxRenderHostWindow.close();
    }
  } catch {
    // ignore host cleanup failures
  } finally {
    fxRenderHostWindow = null;
    fxRenderHostReady = null;
  }
}

async function getFxRenderHostWindow() {
  if (fxRenderHostWindow && !fxRenderHostWindow.isDestroyed()) {
    if (fxRenderHostReady) await fxRenderHostReady;
    return fxRenderHostWindow;
  }
  fxRenderHostWindow = new BrowserWindow({
    show: false,
    width: 640,
    height: 360,
    frame: false,
    backgroundColor: "#000000",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  fxRenderHostWindow.on("closed", () => {
    fxRenderHostWindow = null;
    fxRenderHostReady = null;
  });
  const hostPath = path.join(__dirname, "renderer", "fx_render_host.html");
  fxRenderHostReady = fxRenderHostWindow.loadFile(hostPath).then(async () => {
    await fxRenderHostWindow.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const startedAt = Date.now();
        (function waitReady() {
          if (window.VideoSmithFxRenderHost?.ready) {
            resolve(true);
            return;
          }
          if ((Date.now() - startedAt) > 10000) {
            reject(new Error("FX render host timed out."));
            return;
          }
          setTimeout(waitReady, 25);
        })();
      })
    `, true);
    return fxRenderHostWindow;
  });
  await fxRenderHostReady;
  return fxRenderHostWindow;
}

function getRenderableCanvasFxOverlays(project, rangeStart, rangeEnd) {
  return (project?.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((item) => CANVAS_FX_OVERLAY_TYPES.has(item.overlayType))
    .filter((item) => {
      const start = Number(item.start || 0);
      const end = start + Math.max(MIN_OVERLAY_CLIP_SEC, Number(item.duration || MIN_OVERLAY_CLIP_SEC));
      return end > rangeStart + 1e-6 && start < rangeEnd - 1e-6;
    })
    .sort((a, b) => (
      Number(b.section || 1) - Number(a.section || 1)
      || Number(a.start || 0) - Number(b.start || 0)
      || String(a.id || "").localeCompare(String(b.id || ""))
    ));
}

async function renderCanvasFxOverlaySource(project, rangeStart, rangeEnd, target, debugSession = null, renderHooks = {}) {
  const isCancelled = typeof renderHooks.isCancelled === "function" ? renderHooks.isCancelled : () => false;
  const throwIfCancelled = typeof renderHooks.throwIfCancelled === "function"
    ? renderHooks.throwIfCancelled
    : () => {
        if (isCancelled()) throw createRenderCancelError();
      };
  const overlays = getRenderableCanvasFxOverlays(project, rangeStart, rangeEnd);
  if (!overlays.length) return null;
  throwIfCancelled();
  const fps = Math.max(1, Number(target?.fps || 30));
  const durationSec = Math.max(1 / fps, Number(rangeEnd || 0) - Number(rangeStart || 0));
  const rootDir = getFxRenderStageDir();
  ensureDir(rootDir);
  const sessionDir = path.join(rootDir, `fx_${randomUUID().slice(0, 6)}`);
  const framesDir = path.join(sessionDir, "frames");
  ensureDir(framesDir);
  const outputPath = path.join(sessionDir, "fx_overlay.mov");
  const cleanupSession = () => {
    try {
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // ignore fx cleanup failures
    }
  };
  const payload = {
    framesDir,
    overlays,
    width: Math.max(2, Number(target?.w || 1920)),
    height: Math.max(2, Number(target?.h || 1080)),
    resolutionName: target?.resolutionName || "FHD",
    fps,
    startTime: Number(rangeStart || 0),
    durationSec
  };
  debugSession?.write?.("Canvas FX prerender", [
    `count=${overlays.length}`,
    `durationSec=${durationSec}`,
    `fps=${fps}`,
    `outputPath=${outputPath}`
  ].join("\n"));
  const host = await getFxRenderHostWindow();
  if (isCancelled()) {
    cleanupSession();
    throwIfCancelled();
  }
  const escapedPayload = JSON.stringify(payload).replace(/`/g, "\\`");
  const hostResult = await withTimeout(
    host.webContents.executeJavaScript(
      `window.VideoSmithFxRenderHost.renderFxSequenceToDir(${escapedPayload})`,
      true
    ),
    CANVAS_PRERENDER_TIMEOUT_MS,
    "Canvas FX prerender timed out."
  );
  if (isCancelled()) {
    cleanupSession();
    throwIfCancelled();
  }
  debugSession?.write?.("Canvas FX frames ready", JSON.stringify(hostResult || {}));
  try {
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg()
        .input(path.join(framesDir, "fx_%06d.png"))
        .inputOptions([`-framerate ${fps}`])
        .outputOptions([
          "-y",
          `-t ${fmtNumber(durationSec)}`,
          "-c:v qtrle",
          "-pix_fmt argb"
        ]);
      cmd = cmd
        .on("start", (line) => renderHooks.onStart?.(`[canvas-fx] ${line}`, cmd))
        .on("error", (err) => {
          if (isCancelled()) reject(createRenderCancelError("render cancelled"));
          else reject(err);
        })
        .on("end", resolve);
      throwIfCancelled();
      cmd.save(outputPath);
    });
  } catch (err) {
    cleanupSession();
    throw err;
  }
  if (isCancelled()) {
    cleanupSession();
    throwIfCancelled();
  }
  debugSession?.write?.("Canvas FX source ready", outputPath);
  return {
    inputPath: outputPath,
    cleanup: cleanupSession
  };
}

function getRenderableCanvasTextOverlays(project, rangeStart, rangeEnd, debugSession = null) {
  return (project?.overlayItems || [])
    .map((item) => normalizeOverlayItemForRender(item))
    .filter(Boolean)
    .filter((item) => String(item.overlayType || "text") === "text")
    .filter((item) => {
      if (String(item._renderTextMode || "") === "canvas") return true;
      if (hasRichTextRuns(item)) return true;
      return resolveVerifiedRenderFont(item, debugSession).requiresCanvasFallback;
    })
    .filter((item) => {
      const start = Number(item.start || 0);
      const end = start + Math.max(MIN_OVERLAY_CLIP_SEC, Number(item.duration || MIN_OVERLAY_CLIP_SEC));
      return end > rangeStart + 1e-6 && start < rangeEnd - 1e-6;
    })
    .sort((a, b) => (
      Number(b.section || 1) - Number(a.section || 1)
      || Number(a.start || 0) - Number(b.start || 0)
      || String(a.id || "").localeCompare(String(b.id || ""))
    ));
}

async function renderCanvasTextOverlaySource(project, rangeStart, rangeEnd, target, debugSession = null, renderHooks = {}) {
  const isCancelled = typeof renderHooks.isCancelled === "function" ? renderHooks.isCancelled : () => false;
  const throwIfCancelled = typeof renderHooks.throwIfCancelled === "function"
    ? renderHooks.throwIfCancelled
    : () => {
        if (isCancelled()) throw createRenderCancelError();
      };
  const overlays = getRenderableCanvasTextOverlays(project, rangeStart, rangeEnd, debugSession);
  if (!overlays.length) return null;
  throwIfCancelled();
  const fps = Math.max(1, Number(target?.fps || 30));
  const durationSec = Math.max(1 / fps, Number(rangeEnd || 0) - Number(rangeStart || 0));
  const rootDir = getDrawtextStageDir();
  ensureDir(rootDir);
  const sessionDir = path.join(rootDir, `canvas_${randomUUID().slice(0, 6)}`);
  const framesDir = path.join(sessionDir, "frames");
  ensureDir(framesDir);
  const outputPath = path.join(sessionDir, "text_overlay.mov");
  const cleanupSession = () => {
    try {
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // ignore text cleanup failures
    }
  };
  const payload = {
    framesDir,
    overlays,
    width: Math.max(2, Number(target?.w || 1920)),
    height: Math.max(2, Number(target?.h || 1080)),
    resolutionName: target?.resolutionName || "FHD",
    aspectRatio: target?.aspectRatio || "16:9",
    fps,
    startTime: Number(rangeStart || 0),
    durationSec
  };
  debugSession?.write?.("Canvas text prerender", [
    `count=${overlays.length}`,
    `durationSec=${durationSec}`,
    `fps=${fps}`,
    `outputPath=${outputPath}`,
    `overlays=${overlays.map((overlay) => String(overlay.id || "")).join(",")}`
  ].join("\n"));
  renderHooks.onStage?.("preflight_canvas_text", { count: overlays.length });
  const host = await getFxRenderHostWindow();
  if (isCancelled()) {
    cleanupSession();
    throwIfCancelled();
  }
  const escapedPayload = JSON.stringify(payload).replace(/`/g, "\\`");
  const hostResult = await withTimeout(
    host.webContents.executeJavaScript(
      `window.VideoSmithFxRenderHost.renderTextSequenceToDir(${escapedPayload})`,
      true
    ),
    CANVAS_PRERENDER_TIMEOUT_MS,
    "Canvas text prerender timed out."
  );
  if (isCancelled()) {
    cleanupSession();
    throwIfCancelled();
  }
  debugSession?.write?.("Canvas text frames ready", JSON.stringify(hostResult || {}));
  try {
    await withTimeout(new Promise((resolve, reject) => {
      let cmd = ffmpeg()
        .input(path.join(framesDir, "txt_%06d.png"))
        .inputOptions([`-framerate ${fps}`])
        .outputOptions([
          "-y",
          `-t ${fmtNumber(durationSec)}`,
          "-c:v qtrle",
          "-pix_fmt argb"
        ]);
      cmd = cmd
        .on("start", (line) => renderHooks.onStart?.(`[canvas-text] ${line}`, cmd))
        .on("error", (err) => {
          if (isCancelled()) reject(createRenderCancelError("render cancelled"));
          else reject(err);
        })
        .on("end", resolve);
      throwIfCancelled();
      cmd.save(outputPath);
    }), CANVAS_PRERENDER_TIMEOUT_MS, "Canvas text source encode timed out.");
  } catch (err) {
    cleanupSession();
    throw err;
  }
  if (isCancelled()) {
    cleanupSession();
    throwIfCancelled();
  }
  debugSession?.write?.("Canvas text source ready", outputPath);
  return {
    inputPath: outputPath,
    cleanup: cleanupSession
  };
}

function getRenderPathStageDir() {
  return path.join(getShortRuntimeWorkRoot(), "rp");
}

function isExistingFilePath(filePath) {
  try {
    return !!filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function getStageFileExt(filePath, fallbackExt = "") {
  const ext = String(path.extname(String(filePath || "")) || fallbackExt || "").toLowerCase();
  if (!ext) return "";
  if (ext.length > 12) return String(fallbackExt || "");
  return ext;
}

function shouldStageRenderOutput(outputPath = "") {
  if (process.platform !== "win32") return false;
  const normalized = String(outputPath || "");
  if (!normalized) return true;
  if (/onedrive/i.test(normalized)) return true;
  return normalized.length >= OUTPUT_STAGE_PATH_THRESHOLD;
}

function isFfmpegProgressStderrLine(line = "") {
  const s = String(line || "").trim();
  if (!s) return false;
  return /^(frame=\s*\d+|size=\s*\d+kB|time=\d{2}:\d{2}:\d{2}(?:\.\d+)?|bitrate=|speed=)/i.test(s);
}

function summarizeFfmpegStderr(stderrLines = []) {
  const lines = Array.isArray(stderrLines) ? stderrLines.map((line) => String(line || "").trim()).filter(Boolean) : [];
  if (!lines.length) return "";
  const meaningful = lines.filter((line) => !isFfmpegProgressStderrLine(line));
  return (meaningful.length ? meaningful : lines).slice(-12).join(" | ");
}

function shouldAttemptGenericCompatibilityFallback(message = "") {
  const msg = String(message || "");
  if (!/ffmpeg exited with code 1|Conversion failed/i.test(msg)) return false;
  if (/Error opening output file|Invalid argument|No such file|Permission denied|Unknown encoder|Unknown decoder/i.test(msg)) {
    return false;
  }
  return true;
}

function shouldAttemptDropWaveDisplaceFallback(message = "") {
  const msg = String(message || "");
  if (!/remap/i.test(msg)) return false;
  return /(No such filter|Unknown filter|not found|Error initializing filter|Option not found|Failed to configure input pad)/i.test(msg);
}

function createRenderPathStage(inputs = [], outputPath = "") {
  const rootDir = getRenderPathStageDir();
  ensureDir(rootDir);
  const sessionDir = path.join(rootDir, `s_${randomUUID().slice(0, 6)}`);
  ensureDir(sessionDir);

  const aliasedInputs = new Map();
  const stagedInputs = inputs.map((inputPath) => {
    const rawInput = String(inputPath || "");
    if (!isExistingFilePath(rawInput)) return rawInput;
    if (aliasedInputs.has(rawInput)) return aliasedInputs.get(rawInput);
    const stagedPath = path.join(
      sessionDir,
      `i${aliasedInputs.size}${getStageFileExt(rawInput, ".bin")}`
    );
    try {
      fs.linkSync(rawInput, stagedPath);
      aliasedInputs.set(rawInput, stagedPath);
      return stagedPath;
    } catch {
      try {
        fs.copyFileSync(rawInput, stagedPath);
        aliasedInputs.set(rawInput, stagedPath);
        return stagedPath;
      } catch {
        aliasedInputs.set(rawInput, rawInput);
        return rawInput;
      }
    }
  });

  const finalOutputPath = String(outputPath || "");
  const outputStaged = shouldStageRenderOutput(finalOutputPath);
  const stagedOutputPath = outputStaged
    ? path.join(sessionDir, `r${getStageFileExt(finalOutputPath, ".out")}`)
    : finalOutputPath;
  let finalized = false;

  const cleanup = (preserveOutput = false) => {
    try {
      const shouldRemoveOutput = !preserveOutput && !(finalized && stagedOutputPath === finalOutputPath);
      if (shouldRemoveOutput) cleanupTempFile(stagedOutputPath);
      for (const stagedPath of aliasedInputs.values()) {
        if (stagedPath !== finalOutputPath && stagedPath !== stagedOutputPath && stagedPath.startsWith(sessionDir)) {
          cleanupTempFile(stagedPath);
        }
      }
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  };

  const finalizeOutput = async () => {
    if (finalized) return finalOutputPath;
    if (!outputStaged || stagedOutputPath === finalOutputPath) {
      finalized = true;
      cleanup(true);
      return finalOutputPath;
    }
    ensureDir(path.dirname(finalOutputPath));
    try {
      await fs.promises.unlink(finalOutputPath);
    } catch {
      // ignore stale output cleanup failures
    }
    try {
      await fs.promises.rename(stagedOutputPath, finalOutputPath);
    } catch {
      await fs.promises.copyFile(stagedOutputPath, finalOutputPath);
      try {
        await fs.promises.unlink(stagedOutputPath);
      } catch {
        // ignore staged output cleanup failures
      }
    }
    finalized = true;
    cleanup(true);
    return finalOutputPath;
  };

  return {
    inputs: stagedInputs,
    outputPath: stagedOutputPath,
    outputStaged,
    finalizeOutput,
    cleanup
  };
}

function createBlackGapClip(outPath, durationSec, w, h, fps, backgroundColor = "#000000") {
  return new Promise((resolve, reject) => {
    const colorValue = `0x${normalizeHexColor(backgroundColor, "000000")}`;
    ffmpeg()
      .input(`color=c=${colorValue}:s=${w}x${h}:r=${fps}:d=${durationSec}`)
      .inputFormat("lavfi")
      .input(`anullsrc=r=48000:cl=stereo:d=${durationSec}`)
      .inputFormat("lavfi")
      .outputOptions([
        "-shortest",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-c:v libx264",
        "-preset veryfast",
        "-crf 18",
        "-c:a aac",
        "-b:a 160k"
      ])
      .on("error", reject)
      .on("end", resolve)
      .save(outPath);
  });
}

function createSilentGapAudioClip(outPath, durationSec) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`anullsrc=r=48000:cl=stereo:d=${durationSec}`)
      .inputFormat("lavfi")
      .outputOptions([
        "-vn",
        "-c:a pcm_s16le"
      ])
      .on("error", reject)
      .on("end", resolve)
      .save(outPath);
  });
}

function execFileWithTimeout(filePath, args = [], timeoutMs = 10000, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      filePath,
      args,
      {
        timeout: Math.max(1, Number(timeoutMs || 1)),
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        ...options
      },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
          return;
        }
        resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
      }
    );
  });
}

function parseFfmpegFilterList(output = "") {
  const filters = new Set();
  String(output || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*[TSCAVN\.|]{2,}\s+([a-z0-9_]+)\s+/i);
    if (match?.[1]) filters.add(match[1]);
  });
  return filters;
}

function parseFfmpegEncoderList(output = "") {
  const encoders = new Set();
  String(output || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*[VAS\.]{1}[A-Z\.]{5}\s+([a-z0-9_]+)\s+/i);
    if (match?.[1]) encoders.add(match[1]);
  });
  return encoders;
}

async function getFfmpegCapabilities(debugSession = null) {
  ensureRuntimeBinaryPaths();
  if (FFMPEG_CAPABILITY_CACHE.filters && FFMPEG_CAPABILITY_CACHE.encoders) {
    return {
      filters: FFMPEG_CAPABILITY_CACHE.filters,
      encoders: FFMPEG_CAPABILITY_CACHE.encoders
    };
  }
  if (!FFMPEG_CAPABILITY_CACHE.promise) {
    FFMPEG_CAPABILITY_CACHE.promise = (async () => {
      const [filtersResult, encodersResult] = await Promise.all([
        execFileWithTimeout(runtimeFfmpegPath, ["-hide_banner", "-filters"], 8000),
        execFileWithTimeout(runtimeFfmpegPath, ["-hide_banner", "-encoders"], 8000)
      ]);
      const filters = parseFfmpegFilterList(`${filtersResult.stdout}\n${filtersResult.stderr}`);
      const encoders = parseFfmpegEncoderList(`${encodersResult.stdout}\n${encodersResult.stderr}`);
      FFMPEG_CAPABILITY_CACHE.filters = filters;
      FFMPEG_CAPABILITY_CACHE.encoders = encoders;
      debugSession?.write?.("FFmpeg capability cache", [
        `ffmpegPath=${runtimeFfmpegPath}`,
        `filterCount=${filters.size}`,
        `encoderCount=${encoders.size}`
      ].join("\n"));
      return { filters, encoders };
    })().finally(() => {
      FFMPEG_CAPABILITY_CACHE.promise = null;
    });
  }
  return FFMPEG_CAPABILITY_CACHE.promise;
}

function projectUsesDropWave(project = {}) {
  return (project.overlayItems || []).some((item) => String(item?.overlayType || "") === "drop_wave" && !item?._renderDisabled);
}

function projectUsesCanvasFx(project = {}) {
  return (project.overlayItems || []).some((item) => CANVAS_FX_OVERLAY_TYPES.has(String(item?.overlayType || "")));
}

function projectUsesText(project = {}) {
  return (project.overlayItems || []).some((item) => String(item?.overlayType || "text") === "text" && String(item?.text || "").trim());
}

function hasRichTextRuns(item = {}) {
  return Array.isArray(item.richTextRuns)
    && item.richTextRuns.some((run) => {
      const start = finiteNumber(run?.start, 0);
      const end = finiteNumber(run?.end, 0);
      return end > start && (
        String(run?.color || "").trim()
        || String(run?.fontFamily || "").trim()
        || String(run?.fontFile || "").trim()
        || String(run?.fontWeight || "").trim()
      );
    });
}

function sanitizeMediaClipForRender(clip = {}, warnings = []) {
  const next = { ...clip };
  const id = String(next.id || "clip");
  next.start = Math.max(0, finiteNumber(next.start, 0));
  const sourceDuration = finiteNumber(next.timelineDuration ?? next.duration ?? next.meta?.duration ?? 0, 0);
  const safeDuration = Math.max(TIMELINE_TIME_STEP_SEC, sourceDuration);
  if (sourceDuration <= 0 || !Number.isFinite(sourceDuration)) {
    warnings.push(`clip_duration_clamped:${id}`);
  }
  next.timelineDuration = safeDuration;
  next.duration = Math.max(TIMELINE_TIME_STEP_SEC, finiteNumber(next.duration, safeDuration));
  next.in = Math.max(0, finiteNumber(next.in, 0));
  next.out = Math.max(next.in + TIMELINE_TIME_STEP_SEC, finiteNumber(next.out, next.in + safeDuration));
  next.manualFadeInSec = Math.max(0, Math.min(finiteNumber(next.manualFadeInSec ?? next.fadeInSec, 0), safeDuration));
  next.manualFadeOutSec = Math.max(0, Math.min(finiteNumber(next.manualFadeOutSec ?? next.fadeOutSec, 0), safeDuration));
  next.opacity = clampFinite(next.opacity ?? 1, 0, 1, 1);
  next.section = Math.max(1, Math.round(finiteNumber(next.section, 1)));
  return next;
}

function sanitizeAudioItemForRender(audio = {}, warnings = []) {
  const next = { ...audio };
  const id = String(next.id || "audio");
  const rawDuration = finiteNumber(next.duration, 0);
  next.start = Math.max(0, finiteNumber(next.start, 0));
  next.duration = Math.max(MIN_AUDIO_CLIP_SEC, rawDuration);
  if (rawDuration <= 0 || !Number.isFinite(rawDuration)) warnings.push(`audio_duration_clamped:${id}`);
  next.gain = clampFinite(next.gain ?? 1, 0, 1, 1);
  next.manualFadeInSec = Math.max(0, Math.min(finiteNumber(next.manualFadeInSec ?? next.fadeInSec, 0), next.duration));
  next.manualFadeOutSec = Math.max(0, Math.min(finiteNumber(next.manualFadeOutSec ?? next.fadeOutSec, 0), next.duration));
  return next;
}

function sanitizeOverlayForRender(overlay = {}, warnings = []) {
  const next = { ...overlay };
  const id = String(next.id || "overlay");
  const overlayType = String(next.overlayType || "text");
  const rawDuration = finiteNumber(next.duration, overlayType === "text" ? 2 : MIN_OVERLAY_CLIP_SEC);
  next.overlayType = overlayType;
  next.start = Math.max(0, finiteNumber(next.start, 0));
  next.duration = Math.max(MIN_OVERLAY_CLIP_SEC, rawDuration);
  if (rawDuration <= 0 || !Number.isFinite(rawDuration)) warnings.push(`overlay_duration_clamped:${id}`);
  next.opacity = clampFinite(next.opacity ?? 1, 0, 1, 1);
  next.strokeWidth = Math.max(0, Math.min(96, finiteNumber(next.strokeWidth, 0)));
  next.blur = Math.max(0, Math.min(160, finiteNumber(next.blur, 0)));
  next.radius = Math.max(0, Math.min(1, finiteNumber(next.radius, next.radius == null ? 0.1 : next.radius)));
  next.x = clampFinite(next.x ?? 0.5, 0, 1, 0.5);
  next.y = clampFinite(next.y ?? (overlayType === "text" ? 0.82 : 0.5), 0, 1, overlayType === "text" ? 0.82 : 0.5);
  next.boxWidth = clampFinite(next.boxWidth ?? 0.26, 0.08, 1, 0.26);
  next.boxHeight = clampFinite(next.boxHeight ?? 0.18, 0.05, 1, 0.18);
  next.fontSize = Math.max(8, Math.min(420, finiteNumber(next.fontSize, 64)));
  next.manualFadeInSec = Math.max(0, Math.min(finiteNumber(next.manualFadeInSec, 0), next.duration));
  next.manualFadeOutSec = Math.max(0, Math.min(finiteNumber(next.manualFadeOutSec, 0), next.duration));
  next.transitionInDurationSec = Math.max(0, Math.min(finiteNumber(next.transitionInDurationSec, 0), next.duration));
  next.transitionOutDurationSec = Math.max(0, Math.min(finiteNumber(next.transitionOutDurationSec, 0), next.duration));
  if (overlayType === "text") {
    const textLength = String(next.text || "").length;
    next.richTextRuns = Array.isArray(next.richTextRuns)
      ? next.richTextRuns.map((run) => {
          const start = Math.max(0, Math.min(textLength, Math.floor(finiteNumber(run?.start, 0))));
          const end = Math.max(start, Math.min(textLength, Math.ceil(finiteNumber(run?.end, start))));
          return {
            start,
            end,
            color: String(run?.color || "").trim(),
            fontFamily: String(run?.fontFamily || "").trim(),
            fontFile: String(run?.fontFile || "").trim(),
            fontWeight: String(run?.fontWeight || "").trim()
          };
        }).filter((run) => run.end > run.start && (run.color || run.fontFamily || run.fontFile || run.fontWeight))
      : [];
  }
  if ((next.transitionInDurationSec + next.transitionOutDurationSec) > next.duration - MIN_OVERLAY_CLIP_SEC) {
    const budget = Math.max(0, next.duration - MIN_OVERLAY_CLIP_SEC);
    const total = Math.max(1e-6, next.transitionInDurationSec + next.transitionOutDurationSec);
    next.transitionInDurationSec = (next.transitionInDurationSec / total) * budget;
    next.transitionOutDurationSec = (next.transitionOutDurationSec / total) * budget;
    warnings.push(`overlay_transition_clamped:${id}`);
  }
  next._renderSafeLabel = String(id).replace(/[^a-z0-9_]/gi, "_").slice(0, 64) || "overlay";
  return next;
}

function sanitizeRenderProjectForFfmpeg(project = {}, target = {}, debugSession = null) {
  const warnings = [];
  const fatalErrors = [];
  const next = cloneRenderPayload(project || {});
  next.videoClips = (next.videoClips || []).map((clip) => sanitizeMediaClipForRender(clip, warnings));
  next.audioItems = (next.audioItems || []).map((audio) => sanitizeAudioItemForRender(audio, warnings));
  next.overlayItems = (next.overlayItems || []).map((overlay) => sanitizeOverlayForRender(overlay, warnings));
  if (renderGraph?.normalizeProjectTransitions) {
    const normalizedTransitionProject = renderGraph.normalizeProjectTransitions(next);
    next.transitions = normalizedTransitionProject.transitions || [];
    if (normalizedTransitionProject.orphanedTransitions?.length) {
      next.orphanedTransitions = normalizedTransitionProject.orphanedTransitions;
      warnings.push(`orphaned_transitions:${normalizedTransitionProject.orphanedTransitions.length}`);
      debugSession?.write?.("Transition migration warning", JSON.stringify(normalizedTransitionProject.orphanedTransitions));
    }
  }
  next.videoClips.forEach((clip) => {
    const sourcePath = getRenderableClipSourcePath(clip);
    const generated = clip?.type === "color" || clip?.isGeneratedBackground || clip?.backgroundColor || clip?.color;
    if (!sourcePath && generated) return;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      fatalErrors.push(`미디어 파일을 찾을 수 없습니다: ${String(clip?.name || clip?.id || sourcePath || "video clip")}`);
    }
  });
  next.audioItems.forEach((audio) => {
    const sourcePath = getAudioItemSourcePath(audio);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      fatalErrors.push(`오디오 파일을 찾을 수 없습니다: ${String(audio?.name || audio?.id || sourcePath || "audio clip")}`);
    }
  });
  const { w, h } = target || {};
  debugSession?.write?.("Render project sanitize", [
    `target=${Number(w || 0)}x${Number(h || 0)}@${Number(target?.fps || 0)}`,
    `warnings=${warnings.join(",") || "none"}`,
    `fatalErrors=${fatalErrors.join(" | ") || "none"}`
  ].join("\n"));
  return { project: next, warnings, fatalErrors };
}

function collectPreflightSampleTimes(project = {}, target = {}) {
  const audioEnd = Math.max(0, ...(project.audioItems || []).map((a) => Number(a.start || 0) + Number(a.duration || 0)));
  const videoEnd = Math.max(0, ...(project.videoClips || []).map((clip) => Number(clip.start || 0) + getVideoClipTimelineDuration(clip)));
  const overlayEnd = Math.max(0, ...(project.overlayItems || []).map((item) => Number(item.start || 0) + Number(item.duration || 0)));
  const projectEnd = Math.max(MIN_OVERLAY_CLIP_SEC, audioEnd, videoEnd, overlayEnd);
  const candidates = [
    { time: 0, priority: 20, reason: "start" },
    { time: projectEnd / 2, priority: 18, reason: "middle" }
  ];
  (project.overlayItems || []).forEach((item) => {
    const start = Math.max(0, Number(item.start || 0));
    const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(item.duration || MIN_OVERLAY_CLIP_SEC));
    const type = String(item.overlayType || "text");
    let priority = type === "text" ? 40 : 24;
    if (type === "text" && containsNonAsciiText(item.text)) priority += 20;
    if (type === "text" && item.fontFile) priority += 12;
    if (type === "drop_wave" || CANVAS_FX_OVERLAY_TYPES.has(type)) priority += 10;
    candidates.push({ time: start + Math.min(0.1, duration / 2), priority, reason: `${type}:start` });
    candidates.push({ time: start + (duration / 2), priority: priority - 2, reason: `${type}:middle` });
  });
  Object.values(project.transitions || {}).forEach((transition) => {
    if (!transition) return;
    const start = Math.max(0, Number(transition.start || transition.at || 0));
    const duration = Math.max(MIN_OVERLAY_CLIP_SEC, Number(transition.duration || transition.durationSec || 0.35));
    candidates.push({ time: start + (duration / 2), priority: 28, reason: "transition:middle" });
  });
  const fps = Math.max(1, Number(target?.fps || 30));
  const seen = new Set();
  return candidates
    .map((entry) => ({
      ...entry,
      time: Math.max(0, Math.min(projectEnd, Math.round(Number(entry.time || 0) * fps) / fps))
    }))
    .sort((a, b) => b.priority - a.priority || a.time - b.time)
    .filter((entry) => {
      const key = entry.time.toFixed(3);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

async function testFfmpegDrawtextFont({ fontFile = "", sampleText = "", debugSession = null } = {}) {
  ensureRuntimeBinaryPaths();
  const profile = getTextScriptProfile(sampleText);
  const profileKey = Object.entries(profile).filter(([, value]) => value).map(([key]) => key).join("+") || "ascii";
  const cacheKey = `${runtimeFfmpegPath}:${fontFile || "fontconfig"}:${profileKey}`;
  if (DRAWTEXT_SELF_TEST_CACHE.has(cacheKey)) return DRAWTEXT_SELF_TEST_CACHE.get(cacheKey);
  const sessionDir = path.join(getDrawtextStageDir(), `self_${randomUUID().slice(0, 6)}`);
  let textFile = "";
  try {
    textFile = writeDrawtextTextFile(sampleText || "VideoSmith", sessionDir, "selftest");
    const fontArg = fontFile ? `fontfile='${escapeFilterPath(fontFile)}':` : "";
    const vf = `drawtext=${fontArg}textfile='${escapeFilterPath(textFile)}':fontsize=32:fontcolor=white:x=10:y=80`;
    await execFileWithTimeout(runtimeFfmpegPath, [
      "-hide_banner",
      "-f", "lavfi",
      "-i", "color=c=black:s=320x180:d=0.1",
      "-vf", vf,
      "-frames:v", "1",
      "-f", "null",
      "-"
    ], 7000);
    const ok = { ok: true };
    DRAWTEXT_SELF_TEST_CACHE.set(cacheKey, ok);
    return ok;
  } catch (err) {
    const result = {
      ok: false,
      error: String(err?.stderr || err?.message || err || "drawtext self-test failed")
    };
    debugSession?.write?.("FFmpeg drawtext self-test failed", [
      `fontFile=${fontFile}`,
      `profile=${profileKey}`,
      `error=${result.error}`
    ].join("\n"));
    DRAWTEXT_SELF_TEST_CACHE.set(cacheKey, result);
    return result;
  } finally {
    try {
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // ignore self-test cleanup failures
    }
  }
}

async function runPreflightBasicFrameTest(debugSession = null) {
  ensureRuntimeBinaryPaths();
  try {
    await execFileWithTimeout(runtimeFfmpegPath, [
      "-hide_banner",
      "-f", "lavfi",
      "-i", "color=c=black:s=320x180:r=15:d=0.1",
      "-vf", "format=rgba,fps=15,scale=320:180",
      "-frames:v", "1",
      "-f", "null",
      "-"
    ], 5000);
    return { ok: true };
  } catch (err) {
    const error = String(err?.stderr || err?.message || err || "preflight frame test failed");
    debugSession?.write?.("Preflight 1-frame test failed", error);
    return { ok: false, error };
  }
}

async function preflightRenderProject(payload, token = null, debugSession = null, hooks = {}) {
  const throwIfCancelled = () => {
    if (token?.cancelled) throw createRenderCancelError(token.reason || "render cancelled");
  };
  const emitStage = (message, extra = {}) => {
    hooks.onStage?.(message, extra);
    debugSession?.write?.("Preflight stage", `${message}${Object.keys(extra || {}).length ? ` ${JSON.stringify(extra)}` : ""}`);
  };

  const run = async () => {
    throwIfCancelled();
    emitStage("preflight_project");
    const settings = {
      fps: 30,
      resolutionName: "FHD",
      aspectRatio: "16:9",
      renderMode: "video",
      ...(payload?.settings || {})
    };
    const { w, h } = resToWH(settings.resolutionName, settings.aspectRatio || "16:9");
    const target = {
      w,
      h,
      fps: Math.max(1, Number(settings.fps || 30)),
      resolutionName: settings.resolutionName,
      aspectRatio: settings.aspectRatio || "16:9"
    };
    const sanitized = sanitizeRenderProjectForFfmpeg(payload?.project || {}, target, debugSession);
    const nextPayload = {
      ...payload,
      project: sanitized.project,
      settings: { ...settings }
    };
    const warnings = [...sanitized.warnings];
    const fatalErrors = [...sanitized.fatalErrors];
    const samples = collectPreflightSampleTimes(nextPayload.project, target);
    debugSession?.write?.("Preflight sample plan", samples.map((sample) => `${fmtNumber(sample.time)} ${sample.reason}`).join("\n") || "none");
    if (fatalErrors.length) {
      return { ok: false, payload: nextPayload, warnings, error: fatalErrors.join("\n") };
    }

    throwIfCancelled();
    emitStage("preflight_effects");
    let capabilities = null;
    try {
      capabilities = await getFfmpegCapabilities(debugSession);
    } catch (err) {
      return {
        ok: false,
        payload: nextPayload,
        warnings,
        error: `FFmpeg 실행 환경을 확인하지 못했습니다: ${String(err?.message || err)}`
      };
    }
    const filters = capabilities.filters || new Set();
    const encoders = capabilities.encoders || new Set();
    const requiredFilters = ["overlay", "format", "fps", "scale", "trim", "setpts", "atrim", "asetpts", "concat", "color", "nullsrc"];
    const missingRequired = requiredFilters.filter((name) => !filters.has(name));
    if (missingRequired.length) {
      return {
        ok: false,
        payload: nextPayload,
        warnings,
        error: `FFmpeg 필수 필터를 사용할 수 없습니다: ${missingRequired.join(", ")}`
      };
    }
    if (projectHasComplexTransitions(nextPayload.project) && !filters.has("xfade")) {
      warnings.push("xfade filter missing; transition fallback may be simplified");
      debugSession?.write?.("Preflight warning", "xfade filter missing");
    }
    if (projectUsesCanvasFx(nextPayload.project) && !encoders.has("qtrle")) {
      fatalErrors.push("캔버스 효과 합성에 필요한 qtrle 인코더를 사용할 수 없습니다.");
    }
    if (projectUsesDropWave(nextPayload.project)) {
      if (!filters.has("remap") && filters.has("displace")) {
        nextPayload.settings._dropWaveDisplaceFallback = true;
        warnings.push("특수효과 필터 remap을 사용할 수 없어 displace fallback을 적용합니다.");
        debugSession?.write?.("Preflight warning", "drop_wave remap missing; displace fallback enabled");
      } else if (!filters.has("remap") && !filters.has("displace")) {
        nextPayload.project.overlayItems = (nextPayload.project.overlayItems || []).map((item) => (
          String(item?.overlayType || "") === "drop_wave"
            ? { ...item, _renderDisabled: true, _renderDisabledReason: "missing_remap_displace" }
            : item
        ));
        warnings.push("drop_wave 필터를 지원하지 않아 해당 특수효과를 비활성화했습니다.");
        debugSession?.write?.("Preflight warning", "drop_wave disabled: remap/displace missing");
      }
    }
    if (fatalErrors.length) {
      return { ok: false, payload: nextPayload, warnings, error: fatalErrors.join("\n") };
    }

    throwIfCancelled();
    emitStage("preflight_fonts");
    const drawtextAvailable = filters.has("drawtext");
    const textOverlays = (nextPayload.project.overlayItems || [])
      .filter((item) => String(item?.overlayType || "text") === "text" && String(item?.text || "").trim());
    nextPayload.project.overlayItems = (nextPayload.project.overlayItems || []).map((item) => {
      if (String(item?.overlayType || "text") !== "text" || !String(item?.text || "").trim()) return item;
      const verification = resolveVerifiedRenderFont(item, debugSession);
      if (hasRichTextRuns(item)) {
        return {
          ...item,
          _renderTextMode: "canvas",
          _renderFontFile: verification.fontFile || "",
          _renderTextReason: "rich_text_runs"
        };
      }
      if (!drawtextAvailable || verification.requiresCanvasFallback || !verification.canUseDrawtext) {
        return {
          ...item,
          _renderTextMode: "canvas",
          _renderFontFile: verification.fontFile || "",
          _renderTextReason: drawtextAvailable ? verification.reason : "drawtext_filter_missing"
        };
      }
      return {
        ...item,
        _renderTextMode: "drawtext",
        _renderFontFile: verification.fontFile || "",
        _renderTextReason: verification.usedFallback ? "verified_font_fallback" : ""
      };
    });
    if (!drawtextAvailable && textOverlays.length) {
      warnings.push("FFmpeg drawtext 필터가 없어 안전한 텍스트 렌더링으로 전환합니다.");
      emitStage("preflight_canvas_text", { reason: "drawtext_filter_missing" });
    }
    const needsCanvasText = (nextPayload.project.overlayItems || []).some((item) => String(item?._renderTextMode || "") === "canvas");
    if (needsCanvasText && !encoders.has("qtrle")) {
      return {
        ok: false,
        payload: nextPayload,
        warnings,
        error: "안전한 텍스트 렌더링에 필요한 qtrle 인코더를 사용할 수 없습니다."
      };
    }

    throwIfCancelled();
    emitStage("preflight_drawtext");
    const drawtextCandidates = (nextPayload.project.overlayItems || [])
      .filter((item) => String(item?._renderTextMode || "") === "drawtext")
      .filter((item) => containsNonAsciiText(item.text) || item.fontFile || item._renderFontFile)
      .slice(0, 2);
    for (const overlay of drawtextCandidates) {
      throwIfCancelled();
      const selfTest = await testFfmpegDrawtextFont({
        fontFile: overlay._renderFontFile || overlay.fontFile || "",
        sampleText: overlay.text,
        debugSession
      });
      if (!selfTest.ok) {
        nextPayload.project.overlayItems = (nextPayload.project.overlayItems || []).map((item) => (
          item?.id === overlay.id
            ? {
                ...item,
                _renderTextMode: "canvas",
                _renderTextReason: "drawtext_self_test_failed"
              }
            : item
        ));
        warnings.push("선택한 글꼴을 FFmpeg가 직접 처리하지 못해 안전한 텍스트 렌더링 방식으로 전환합니다.");
        emitStage("preflight_canvas_text", { overlayId: overlay.id || "" });
      }
    }

    throwIfCancelled();
    emitStage("preflight_frame");
    const frameTest = await runPreflightBasicFrameTest(debugSession);
    if (!frameTest.ok) {
      return {
        ok: false,
        payload: nextPayload,
        warnings,
        error: `1프레임 렌더 검사에 실패했습니다: ${frameTest.error}`
      };
    }
    emitStage("actual_render_start", { warnings: warnings.length });
    return { ok: true, payload: nextPayload, warnings, samples };
  };

  try {
    return await withTimeout(run(), RENDER_PREFLIGHT_TIMEOUT_MS, "preflight timed out");
  } catch (err) {
    if (isRenderCancelledError(err)) throw err;
    const message = /preflight timed out/i.test(String(err?.message || ""))
      ? "렌더링 사전 검사가 시간 초과되었습니다. 실제 렌더링을 시작하지 않았습니다."
      : String(err?.message || err || "preflight failed");
    debugSession?.write?.("Preflight failed", message);
    return { ok: false, payload, warnings: [], error: message };
  }
}

async function renderProject({ project, settings, region, outputPath }, hooks = {}) {
  ensureRuntimeBinaryPaths();
  const debugSession = hooks.debugSession || null;
  const isCancelled = typeof hooks.isCancelled === "function" ? hooks.isCancelled : () => false;
  const throwIfCancelled = typeof hooks.throwIfCancelled === "function"
    ? hooks.throwIfCancelled
    : () => {
        if (isCancelled()) throw createRenderCancelError();
      };
  throwIfCancelled();
  // region: {start,end} in seconds OR null for full
  // project.clips: timeline sequence already contiguous; each clip has internalPath, in/out, start
  const renderMode = settings?.renderMode === "audio" ? "audio" : "video";
  const hasRegion = !!(region && region.enabled);
  const rawRegionStart = hasRegion ? Number(region.start || 0) : null;
  const rawRegionEnd = hasRegion ? Number(region.end || 0) : null;
  const renderStart = hasRegion ? Math.min(rawRegionStart, rawRegionEnd) : null;
  const renderEnd = hasRegion ? Math.max(rawRegionStart, rawRegionEnd) : null;

  // Build clip list in render order, cut by region if set.
  const clips = [];
  const audioGainById = new Map((project.audioItems || []).map((a) => [a.id, Math.max(0, Math.min(1, Number(a.gain ?? 1)))]));
  const audioItemById = new Map((project.audioItems || []).map((a) => [a.id, a]));
  const sourceClips = renderMode === "audio"
    ? ((project.videoClips || []).length
      ? [...(project.videoClips || [])].map((c) => ({
          ...c,
          internalPath: getRenderableClipSourcePath(c),
          gain: c.linkedAudioId && audioGainById.has(c.linkedAudioId)
            ? audioGainById.get(c.linkedAudioId)
            : Math.max(0, Math.min(1, Number(c.gain ?? 1))),
          fadeInSec: c.linkedAudioId && audioItemById.has(c.linkedAudioId)
            ? Number(audioItemById.get(c.linkedAudioId)?.manualFadeInSec || 0)
            : Number(c.manualFadeInSec || c.fadeInSec || 0),
          fadeOutSec: c.linkedAudioId && audioItemById.has(c.linkedAudioId)
            ? Number(audioItemById.get(c.linkedAudioId)?.manualFadeOutSec || 0)
            : Number(c.manualFadeOutSec || c.fadeOutSec || 0)
        }))
      : (project.audioItems || []).map((a) => ({
          id: a.id,
          internalPath: a.sourcePath || a.originalPath || a.internalPath,
          in: 0,
          out: Number(a.duration || 0),
          start: Number(a.start || 0),
          gain: Math.max(0, Math.min(1, Number(a.gain ?? 1))),
          fadeInSec: Number(a.manualFadeInSec || a.fadeInSec || 0),
          fadeOutSec: Number(a.manualFadeOutSec || a.fadeOutSec || 0)
        })))
    : (project.videoClips || []).map((c) => ({
        ...c,
        internalPath: getRenderableClipSourcePath(c),
        gain: c.linkedAudioId && audioGainById.has(c.linkedAudioId)
          ? audioGainById.get(c.linkedAudioId)
          : Math.max(0, Math.min(1, Number(c.gain ?? 1))),
        audioManualFadeInSec: c.linkedAudioId
          ? Math.max(0, Math.min(Number(audioItemById.get(c.linkedAudioId)?.manualFadeInSec || 0), getVideoClipTimelineDuration(c)))
          : Math.max(0, Number(c.manualFadeInSec || 0)),
        audioManualFadeOutSec: c.linkedAudioId
          ? Math.max(0, Math.min(Number(audioItemById.get(c.linkedAudioId)?.manualFadeOutSec || 0), getVideoClipTimelineDuration(c)))
          : Math.max(0, Number(c.manualFadeOutSec || 0))
      }));
  const sorted = sourceClips.sort((a, b) => a.start - b.start);
  for (const clip of sorted) {
    const clipStart = clip.start;
    const clipEnd = clip.start + getVideoClipTimelineDuration(clip);

    // no region => include entire clip
    if (renderStart == null || renderEnd == null) {
      clips.push({ ...clip });
      continue;
    }

    // intersect [clipStart, clipEnd] with [renderStart, renderEnd]
    const s = Math.max(clipStart, renderStart);
    const e = Math.min(clipEnd, renderEnd);
    if (e <= s) continue;

    const deltaS = s - clipStart;
    const deltaE = e - clipStart;
    clips.push({
      ...clip,
      in: mapVideoClipTimelineOffsetToSourceTime(clip, deltaS),
      out: mapVideoClipTimelineOffsetToSourceTime(clip, deltaE),
      timelineDuration: Math.max(0.02, e - s),
      start: s
    });
  }

  const { w, h } = resToWH(settings.resolutionName, settings.aspectRatio || "16:9");
  const fps = Number(settings.fps);
  const renderTarget = {
    w,
    h,
    fps,
    resolutionName: settings.resolutionName,
    aspectRatio: settings.aspectRatio || "16:9",
    backgroundColor: `#${normalizeHexColor(settings?.backgroundColor, "000000")}`
  };
  const videoFmt = (settings.container || "mp4").toLowerCase();
  const audioFmt = (settings.audioContainer || "mp3").toLowerCase();
  const { vcodec, acodec, extra } = codecForContainer(videoFmt);
  const audioCodecCfg = audioCodecForContainer(audioFmt);

  const audioEnd = Math.max(0, ...(project.audioItems || []).map((a) => Number(a.start || 0) + Number(a.duration || 0)));
  const videoEnd = Math.max(0, ...sourceClips.map((c) => Number(c.start || 0) + getVideoClipTimelineDuration(c)));
  const overlayEnd = Math.max(0, ...(project.overlayItems || []).map((item) => Number(item.start || 0) + Number(item.duration || 0)));
  const projectEnd = Math.max(audioEnd, videoEnd, overlayEnd);
  const rawRangeStart = hasRegion ? Math.max(0, renderStart) : 0;
  const rawRangeEnd = hasRegion ? Math.max(rawRangeStart, renderEnd) : projectEnd;
  const snappedRange = snapRenderWindowToFrames(rawRangeStart, rawRangeEnd, renderTarget, {
    startMode: hasRegion ? "nearest" : "floor",
    endMode: "ceil"
  });
  const rangeStart = snappedRange.start;
  const rangeEnd = snappedRange.end;
  const hasRenderableAudio = renderMode === "video"
    ? projectHasRenderableAudio(project, clips)
    : true;
  const fastVideoConcatEligible = renderMode === "video" && canUseFastVideoConcatRender(project, clips);
  const fastAudioConcatEligible = renderMode === "audio"
    && !(project.videoClips || []).length
    && canUseFastAudioConcatRender(project, clips, rangeStart, rangeEnd);

  let built = null;
  let durationSec = Math.max(0.001, snappedRange.duration);
  const tempArtifactCleanupFns = [];
  const cleanupPreFfmpegTempArtifacts = () => {
    while (tempArtifactCleanupFns.length) {
      const cleanup = tempArtifactCleanupFns.pop();
      try {
        cleanup?.();
      } catch {
        // ignore temp artifact cleanup failures
      }
    }
  };
  throwIfCancelled();
  if (renderMode === "audio" && !(project.videoClips || []).length) {
    const graphProject = {
      ...project,
      videoClips: []
    };
    const uniquePaths = [...new Set((project.audioItems || []).map((audio) => getAudioItemSourcePath(audio)).filter(Boolean))];
    throwIfCancelled();
    const probeResults = await Promise.all(uniquePaths.map((sourcePath) => probe(sourcePath).catch(() => null)));
    throwIfCancelled();
    const probeByPath = new Map(uniquePaths.map((sourcePath, idx) => [sourcePath, probeResults[idx]]));
    if (fastAudioConcatEligible) {
      const fastProbeMetas = clips.map((clip) => probeByPath.get(getAudioItemSourcePath(clip)) || null);
      built = buildAudioConcatFilter(clips, fastProbeMetas);
    } else {
      built = buildTimelineSegmentFilter(
        graphProject,
        rangeStart,
        rangeEnd,
        probeByPath,
        renderTarget,
        { audioOnly: true }
      );
    }
    durationSec = Math.max(0.001, Number(built.durationSec || (rangeEnd - rangeStart) || 0.001));
  } else {
    const graphProject = {
      ...project,
      _dropWaveRenderMode: settings?._dropWaveDisplaceFallback ? "displace" : "remap",
      videoClips: clips.map((clip) => ({
        ...clip,
        internalPath: getClipSourcePath(clip)
      }))
    };
    const uniquePaths = [...new Set([
      ...graphProject.videoClips.map((clip) => getClipSourcePath(clip)),
      ...(project.audioItems || []).map((audio) => getAudioItemSourcePath(audio))
    ].filter(Boolean))];
    throwIfCancelled();
    const probeResults = await Promise.all(uniquePaths.map((sourcePath) => probe(sourcePath).catch(() => null)));
    throwIfCancelled();
    const probeByPath = new Map(uniquePaths.map((sourcePath, idx) => [sourcePath, probeResults[idx]]));
      if (fastVideoConcatEligible) {
        const fastProbeMetas = clips.map((clip) => probeByPath.get(getClipSourcePath(clip)) || null);
        built = buildConcatFilter(clips, fastProbeMetas, {
          ...renderTarget,
          includeAudio: hasRenderableAudio,
          timelineStart: rangeStart,
          timelineEnd: rangeEnd
        });
        built.durationSec = Math.max(0.001, rangeEnd - rangeStart);
      } else {
        const layeredVideoSections = [...new Set((graphProject.videoClips || []).map((clip) => Math.max(1, Number(clip.section || 1))))];
        const useLayeredVideoComposite = renderMode === "video" && layeredVideoSections.length > 1;
        built = useLayeredVideoComposite
          ? buildLayeredTimelineSegmentFilter(
            graphProject,
            rangeStart,
            rangeEnd,
            probeByPath,
            renderTarget,
            { videoOnly: !hasRenderableAudio }
          )
          : buildTimelineSegmentFilter(
            graphProject,
            rangeStart,
            rangeEnd,
            probeByPath,
            renderTarget,
            { audioOnly: renderMode === "audio", videoOnly: renderMode === "video" && !hasRenderableAudio }
          );
      }
    durationSec = Math.max(0.001, Number(built.durationSec || (rangeEnd - rangeStart) || 0.001));
    if (renderMode === "video" && !fastVideoConcatEligible) {
      // Keep preview-like alpha/color semantics for all special-FX passes.
      // Without this, thin or semi-transparent FX can get flattened too early
      // and look missing or inconsistent after the final encode.
      if (built?.map?.v) {
        const fxSourceLabel = `${String(built.map.v)}_rgba_fxsrc`;
        built.filter = `${built.filter};[${built.map.v}]format=rgba[${fxSourceLabel}]`;
        built.map = { ...built.map, v: fxSourceLabel };
      }
      const zoomChain = buildZoomFocusChain(graphProject, rangeStart, rangeEnd, built.map.v, renderTarget);
      if (zoomChain.parts.length) {
        built.filter = `${built.filter};${zoomChain.parts.join(";")}`;
        built.map = { ...built.map, v: zoomChain.outputLabel };
      }
      const dropWaveChain = buildDropWaveRemapChain(graphProject, rangeStart, rangeEnd, built.map.v, renderTarget, debugSession);
      if (dropWaveChain.parts.length) {
        built.filter = `${built.filter};${dropWaveChain.parts.join(";")}`;
        built.map = { ...built.map, v: dropWaveChain.outputLabel };
      }
      // Order stays aligned with preview:
      // clip composition -> zoom focus -> drop-wave distortion -> drawtext/canvas text -> other FX.
      const drawtextSessionDir = path.join(getDrawtextStageDir(), `draw_${randomUUID().slice(0, 6)}`);
      let drawtextTextFilesUsed = false;
      const drawtext = buildOverlayDrawtextChain(graphProject, rangeStart, rangeEnd, built.map.v, renderTarget, {
        debugSession,
        writeTextFile: (text, id) => {
          drawtextTextFilesUsed = true;
          return writeDrawtextTextFile(text, drawtextSessionDir, id);
        }
      });
      if (drawtextTextFilesUsed) {
        tempArtifactCleanupFns.push(() => {
          try {
            if (fs.existsSync(drawtextSessionDir)) fs.rmSync(drawtextSessionDir, { recursive: true, force: true });
          } catch {
            // ignore drawtext temp cleanup failures
          }
        });
      }
      if (drawtext.parts.length) {
        built.filter = `${built.filter};${drawtext.parts.join(";")}`;
        built.map = { ...built.map, v: drawtext.outputLabel };
      }
      throwIfCancelled();
      const prerenderedText = await renderCanvasTextOverlaySource(graphProject, rangeStart, rangeEnd, renderTarget, debugSession, hooks);
      if (isCancelled()) {
        try {
          prerenderedText?.cleanup?.();
        } catch {
          // ignore cancellation cleanup failures
        }
        throwIfCancelled();
      }
      if (prerenderedText?.inputPath) {
        tempArtifactCleanupFns.push(() => prerenderedText.cleanup?.());
        const textInputIndex = built.inputs.length;
        const textInputLabel = `txtcanvas${textInputIndex}`;
        const textMixedLabel = `vtxtcanvas${textInputIndex}`;
        built.inputs.push(prerenderedText.inputPath);
        built.filter = `${built.filter};[${textInputIndex}:v]setpts=PTS-STARTPTS,format=rgba[${textInputLabel}];[${built.map.v}][${textInputLabel}]overlay=x=0:y=0:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${textMixedLabel}]`;
        built.map = { ...built.map, v: textMixedLabel };
      }
      throwIfCancelled();
      const prerenderedFx = await renderCanvasFxOverlaySource(graphProject, rangeStart, rangeEnd, renderTarget, debugSession, hooks);
      if (isCancelled()) {
        try {
          prerenderedFx?.cleanup?.();
        } catch {
          // ignore cancellation cleanup failures
        }
        throwIfCancelled();
      }
      if (prerenderedFx?.inputPath) {
        tempArtifactCleanupFns.push(() => prerenderedFx.cleanup?.());
        const fxInputIndex = built.inputs.length;
        const fxInputLabel = `fxcanvas${fxInputIndex}`;
        const fxMixedLabel = `vfxcanvas${fxInputIndex}`;
        built.inputs.push(prerenderedFx.inputPath);
        built.filter = `${built.filter};[${fxInputIndex}:v]setpts=PTS-STARTPTS,format=rgba[${fxInputLabel}];[${built.map.v}][${fxInputLabel}]overlay=x=0:y=0:eof_action=pass:repeatlast=0:format=auto:alpha=straight[${fxMixedLabel}]`;
        built.map = { ...built.map, v: fxMixedLabel };
      } else {
        const fxChain = buildFxOverlayChain(graphProject, rangeStart, rangeEnd, built.map.v, renderTarget);
        if (fxChain.parts.length) {
          built.filter = `${built.filter};${fxChain.parts.join(";")}`;
          built.map = { ...built.map, v: fxChain.outputLabel };
        }
      }
    }
  }

  if (isCancelled()) {
    cleanupPreFfmpegTempArtifacts();
    throwIfCancelled();
  }
  built = normalizeBuiltVideoOutput(built, renderTarget, renderMode);
  built = clampBuiltRenderDuration(built, durationSec, renderMode, renderTarget);
  durationSec = Math.max(0.001, Number(built?.durationSec || durationSec));
  if (isCancelled()) {
    cleanupPreFfmpegTempArtifacts();
    throwIfCancelled();
  }

  const { inputs, filter, map } = built;

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    const filterThreadCount = Math.max(1, Math.min(FILTER_THREAD_CAP, os.cpus().length || 2));
    const outExt = path.extname(outputPath).replace(".", "").toLowerCase();
    const outFmt = ffmpegFormatForExt(outExt);
    const stderrTail = [];
    let filterScriptPath = "";
    let watchdogTimer = null;
    let watchdogWarned = false;
    let watchdogTimedOut = false;
    let lastActivityAt = Date.now();
    const renderPathStage = process.platform === "win32"
      ? createRenderPathStage(inputs, outputPath)
      : null;
    const ffmpegInputs = renderPathStage ? renderPathStage.inputs : inputs;
    const syntheticLavfiInput = ffmpegInputs.length
      ? null
      : `color=c=black@0.0:s=${Math.max(2, Number(renderTarget?.w || 1920))}x${Math.max(2, Number(renderTarget?.h || 1080))}:r=${fmtNumber(Math.max(1, Number(renderTarget?.fps || 30)))}:d=${fmtNumber(durationSec)}`;
    const ffmpegOutputPath = renderPathStage ? renderPathStage.outputPath : outputPath;
    hooks.onPrepared?.({
      durationSec,
      hasRenderableAudio,
      inputCount: ffmpegInputs.length + (syntheticLavfiInput ? 1 : 0),
      outputPath: ffmpegOutputPath,
      finalOutputPath: outputPath,
      outputStaged: !!renderPathStage?.outputStaged
    });
    const finalizeTempArtifacts = () => {
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      cleanupTempFile(filterScriptPath);
      filterScriptPath = "";
      renderPathStage?.cleanup?.();
      while (tempArtifactCleanupFns.length) {
        const cleanup = tempArtifactCleanupFns.pop();
        try {
          cleanup?.();
        } catch {
          // ignore temp artifact cleanup failures
        }
      }
    };
    const touchWatchdog = () => {
      lastActivityAt = Date.now();
    };
    const startWatchdog = () => {
      if (watchdogTimer) return;
      watchdogTimer = setInterval(() => {
        if (isCancelled() || watchdogTimedOut) return;
        const idleFor = Date.now() - lastActivityAt;
        if (idleFor >= RENDER_NO_PROGRESS_HARD_TIMEOUT_MS) {
          watchdogTimedOut = true;
          hooks.onWatchdog?.("render_watchdog_timeout", { idleForMs: idleFor });
          try {
            if (cmd?.ffmpegProc?.pid) {
              void killPidTree(cmd.ffmpegProc.pid);
            } else {
              cmd.kill?.("SIGKILL");
            }
          } catch {
            // ignore kill failures; the error event will surface if the process exits.
          }
        } else if (!watchdogWarned && idleFor >= RENDER_NO_PROGRESS_WARNING_MS) {
          watchdogWarned = true;
          hooks.onWatchdog?.("render_no_progress_warning", { idleForMs: idleFor });
        }
      }, 5000);
    };

    try {
      throwIfCancelled();
    } catch (cancelErr) {
      finalizeTempArtifacts();
      reject(cancelErr);
      return;
    }

    if (syntheticLavfiInput) {
      cmd = cmd.input(syntheticLavfiInput).inputFormat("lavfi");
    }
    ffmpegInputs.forEach((p) => {
      cmd = cmd.input(p);
      if (isStillImageClipSource(p)) {
        // Render still images from the alpha-preserving original image path.
        cmd = cmd.inputOptions(["-loop 1"]);
      }
    });

    const useFilterScript = process.platform === "win32"
      && !settings?._forceInlineFilter
      && String(filter || "").trim().length > 0;
    if (useFilterScript) {
      filterScriptPath = writeComplexFilterScript(filter);
      cmd = cmd.outputOptions(["-filter_complex_script", toFfmpegOutputPath(filterScriptPath)]);
    } else {
      cmd = cmd.complexFilter(filter);
    }
    // Some ffmpeg builds on Windows fail with "Error opening output file ... Invalid argument"
    // when forcing -f with certain option combinations; prefer extension-driven muxer for video.
    if (renderMode === "audio" && outFmt) cmd = cmd.format(outFmt);

    if (renderMode === "audio") {
      cmd = cmd.outputOptions([
        "-y",
        `-map [${map.a}]`,
        "-vn",
        `-t ${fmtNumber(durationSec)}`,
        `-c:a ${audioCodecCfg.acodec}`,
        ...(audioCodecCfg.extra || []),
        `-filter_threads ${filterThreadCount}`,
        `-filter_complex_threads ${filterThreadCount}`,
        "-max_muxing_queue_size 4096",
        `-threads ${Math.max(2, os.cpus().length)}`
      ]);
    } else {
      const safeNoVf = !!settings?._safeNoVf;
      const safeCodec = !!settings?._safeCodec;
      const hasAudioMap = !!map?.a;
      const vOut = safeCodec ? "mpeg4" : vcodec;
      const aOut = safeCodec
        ? ((outExt === "mp4" || outExt === "mov") ? "aac" : "pcm_s16le")
        : acodec;
      const opts = [
        "-y",
        `-map [${map.v}]`,
        ...(hasAudioMap ? [`-map [${map.a}]`] : ["-an"]),
        `-t ${fmtNumber(durationSec)}`,
        "-fps_mode cfr",
        `-c:v ${vOut}`,
        ...(hasAudioMap ? [`-c:a ${aOut}`] : []),
        ...(!safeCodec && (outExt === "mp4" || outExt === "mov") ? ["-movflags +faststart"] : []),
        ...(safeCodec ? ["-q:v 5"] : []),
        ...(!safeCodec && vcodec === "libx264" ? ["-preset ultrafast", "-crf 23"] : []),
        `-filter_threads ${filterThreadCount}`,
        `-filter_complex_threads ${filterThreadCount}`,
        "-max_muxing_queue_size 4096",
        ...(!safeCodec ? [`-threads ${Math.max(2, os.cpus().length)}`] : []),
        ...(safeCodec ? [] : (extra || []))
      ];
      if (!safeNoVf) {
        // Normalization is already done per-clip in filter_complex before concat.
      }
      cmd = cmd.outputOptions(opts);
    }

    cmd = cmd
      .on("stderr", (line) => {
        touchWatchdog();
        const s = String(line || "").trim();
        if (!s) return;
        stderrTail.push(s);
        if (stderrTail.length > 60) stderrTail.shift();
        hooks.onStderr?.(s);
      })
      .on("start", (line) => {
        touchWatchdog();
        startWatchdog();
        hooks.onStart?.(line, cmd);
      })
      .on("progress", (p) => {
        if (isCancelled()) return;
        touchWatchdog();
        // p.percent is sometimes undefined; renderer estimates too.
        mainWindow?.webContents.send("render-progress", { ...p, jobId: hooks.jobId || 0 });
        hooks.onProgress?.(p);
      })
      .on("error", (e) => {
        finalizeTempArtifacts();
        if (isCancelled()) {
          reject(createRenderCancelError("render cancelled"));
          return;
        }
        const tail = summarizeFfmpegStderr(stderrTail.slice(-40));
        hooks.onError?.(e, { stderrTail: [...stderrTail], stderrSummary: tail });
        if (watchdogTimedOut) {
          reject(new Error("응답 없음 감지, 렌더 프로세스 중단"));
          return;
        }
        const msg = String(e?.message || e);
        reject(new Error(tail ? `${msg} | stderr_tail: ${tail}` : msg));
      })
      .on("end", async () => {
        let finalOutputPath = "";
        try {
          throwIfCancelled();
          hooks.onFinalizing?.({
            outputStaged: !!renderPathStage?.outputStaged,
            message: "encoder_finished",
            outputPath,
            stagedOutputPath: ffmpegOutputPath
          });
          throwIfCancelled();
          hooks.onFinalizing?.({
            outputStaged: !!renderPathStage?.outputStaged,
            message: renderPathStage?.outputStaged ? "moving_output" : "finalizing_output",
            outputPath,
            stagedOutputPath: ffmpegOutputPath
          });
          throwIfCancelled();
          finalOutputPath = renderPathStage?.finalizeOutput
            ? await renderPathStage.finalizeOutput()
            : outputPath;
          if (isCancelled()) {
            cleanupTempFile(finalOutputPath);
            throwIfCancelled();
          }
          hooks.onFinalizing?.({
            outputStaged: !!renderPathStage?.outputStaged,
            message: "cleaning_up_render",
            outputPath: finalOutputPath,
            stagedOutputPath: ffmpegOutputPath
          });
          finalizeTempArtifacts();
          hooks.onEnd?.(finalOutputPath);
          resolve({ outputPath: finalOutputPath });
        } catch (moveErr) {
          if (isRenderCancelledError(moveErr)) cleanupTempFile(finalOutputPath || outputPath);
          finalizeTempArtifacts();
          reject(moveErr);
        }
      });

    cmd.save(toFfmpegOutputPath(ffmpegOutputPath));
  });
}

let mainWindow;
let mainWindowCloseApproved = false;
let mainWindowCloseInFlight = false;

async function requestMainWindowCloseApproval() {
  if (!mainWindow || mainWindow.isDestroyed()) return true;
  try {
    return await mainWindow.webContents.executeJavaScript(
      "window.__VIDEOSMITH_APP__?.handleAppCloseRequest ? window.__VIDEOSMITH_APP__.handleAppCloseRequest() : true",
      true
    );
  } catch {
    return true;
  }
}

function broadcastRenderState() {
  const pub = {
    jobId: activeRender.jobId || 0,
    sessionId: activeRender.sessionId || "",
    status: activeRender.status,
    percent: activeRender.percent,
    timemark: activeRender.timemark,
    durationSec: activeRender.durationSec || 0,
    message: activeRender.message,
    errorDetail: activeRender.errorDetail || "",
    debugLogPath: activeRender.debugLogPath || "",
    outputPath: activeRender.outputPath
  };
  mainWindow?.webContents.send("render-state", pub);
  renderWindow?.webContents.send("render-state", pub);
}

async function showRenderFailureDialog(message, debugLogPath = "") {
  const detail = debugLogPath
    ? `${String(message || "")}\n\n디버그 로그:\n${String(debugLogPath)}`
    : String(message || "");
  try {
    await dialog.showMessageBox(renderWindow && !renderWindow.isDestroyed() ? renderWindow : mainWindow, {
      type: "error",
      title: "Render Error",
      message: "렌더링 중 오류가 발생했습니다.",
      detail,
      buttons: ["확인"],
      defaultId: 0,
      noLink: true
    });
  } catch {
    // ignore dialog failures
  }
}

function createRenderWindow() {
  if (renderWindow && !renderWindow.isDestroyed()) {
    renderWindow.focus();
    return renderWindow;
  }
  renderWindow = new BrowserWindow({
    width: 720,
    height: 500,
    minWidth: 680,
    minHeight: 460,
    resizable: true,
    title: "렌더링",
    backgroundColor: "#090d12",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  renderWindow.on("closed", () => {
    renderWindow = null;
  });
  renderWindow.loadFile(path.join(__dirname, "renderer", "render_window.html"));
  return renderWindow;
}

function closeRenderWindow() {
  if (!renderWindow || renderWindow.isDestroyed()) {
    renderWindow = null;
    return;
  }
  renderWindow.close();
}

function suspendPid(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve(false);
    if (process.platform === "win32") {
      exec(`powershell -NoProfile -Command "Suspend-Process -Id ${Number(pid)} -ErrorAction Stop"`, (err) => resolve(!err));
      return;
    }
    try {
      process.kill(pid, "SIGSTOP");
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

function resumePid(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve(false);
    if (process.platform === "win32") {
      exec(`powershell -NoProfile -Command "Resume-Process -Id ${Number(pid)} -ErrorAction Stop"`, (err) => resolve(!err));
      return;
    }
    try {
      process.kill(pid, "SIGCONT");
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

function killPidTree(pid) {
  return new Promise((resolve) => {
    const safePid = Number(pid);
    if (!Number.isFinite(safePid) || safePid <= 0) {
      resolve({ pid, ok: false, error: "invalid pid" });
      return;
    }
    if (process.platform === "win32") {
      exec(`taskkill /PID ${Math.round(safePid)} /T /F`, (err, stdout, stderr) => {
        resolve({
          pid: safePid,
          ok: !err,
          error: err ? String(stderr || stdout || err.message || err) : ""
        });
      });
      return;
    }
    try {
      process.kill(safePid, "SIGKILL");
      resolve({ pid: safePid, ok: true, error: "" });
    } catch (err) {
      resolve({ pid: safePid, ok: false, error: String(err?.message || err || "") });
    }
  });
}

async function stopActiveRender(reset = true, options = {}) {
  const purgeOutputs = !!options?.purgeOutputs;
  const finalStatus = options?.finalStatus || "stopped";
  const finalMessage = options?.finalMessage || finalStatus;
  const reason = options?.reason || finalMessage;
  const token = activeRender.cancelToken;
  if (token) {
    token.cancelled = true;
    token.reason = reason;
  }
  logActiveRenderDiagnostic("Render cancellation requested", [
    `jobId=${activeRender.jobId || 0}`,
    `status=${activeRender.status || ""}`,
    `reason=${reason}`
  ].join("\n"));

  const pids = new Set([
    ...((activeRender.childPids instanceof Set) ? activeRender.childPids : []),
    activeRender.pid,
    activeRender.command?.ffmpegProc?.pid
  ].filter(Boolean));
  if (pids.size) {
    const killResults = await Promise.all([...pids].map((pid) => killPidTree(pid)));
    const failures = killResults.filter((result) => !result.ok);
    logActiveRenderDiagnostic("Render child process kill results", killResults.map((result) => (
      `pid=${result.pid} ok=${result.ok}${result.error ? ` error=${result.error}` : ""}`
    )).join("\n"));
    if (failures.length) {
      console.warn("[VideoSmith] Failed to kill one or more render child processes", failures);
    }
  }
  clearActiveRenderProcessRefs();
  if (purgeOutputs) purgeActiveRenderOutputs();
  if (reset) {
    activeRender.status = finalStatus;
    activeRender.percent = 0;
    activeRender.timemark = "";
    activeRender.durationSec = 0;
    activeRender.message = finalMessage;
    activeRender.errorDetail = "";
  }
  broadcastRenderState();
}

async function startRenderFromPayload(payload, options = {}) {
  if (!payload?.project || !payload?.settings) return { ok: false, error: "invalid payload" };
  if (activeRender.status === "running" || activeRender.status === "paused") {
    return { ok: false, error: "already running" };
  }
  payload = cloneRenderPayload(payload);
  payload.settings = {
    fps: 30,
    resolutionName: "FHD",
    aspectRatio: "16:9",
    container: "MP4",
    renderMode: "video",
    audioContainer: "MP3",
    backgroundColor: "#000000",
    ...(payload.settings || {})
  };

  let outPath = options.outputPath;
  if (!outPath) {
    const ext = outputExtFromSettings(payload.settings);
    const dir = options.outputFolder || outputFolder || app.getPath("videos");
    const name = `render_${Date.now()}.${ext}`;
    outPath = path.join(dir, name);
  }
  outPath = normalizeOutPath(outPath, payload.settings);
  outPath = ensureWritableOutputPath(outPath, payload.settings);
  const debugSession = createRenderDebugSession(payload, outPath);
  const jobId = ++nextRenderJobId;
  const sessionId = randomUUID();
  const cancelToken = createRenderCancelToken(jobId, sessionId);
  const isCurrentJob = () => isCurrentRenderJob(jobId, cancelToken);
  const throwIfCancelled = () => requireCurrentRenderJob(jobId, cancelToken);
  const isCancelledOrStale = (err = null) => (
    isRenderCancelledError(err)
    || cancelToken.cancelled
    || !isCurrentJob()
  );
  const finishCancelled = (err = null) => {
    debugSession.write("Render cancelled or stale", [
      `jobId=${jobId}`,
      `reason=${cancelToken.reason || ""}`,
      `detail=${String(err?.message || err || "")}`
    ].join("\n"));
    debugSession.close();
    return { ok: false, error: cancelToken.reason || "render cancelled" };
  };
  const setJobState = (fields = {}) => updateActiveRenderForJob(jobId, cancelToken, fields);
  const completeRender = async (finalOutputPath, attemptLabel = "render") => {
    throwIfCancelled();
    debugSession.write("Final output validation starting", `attempt=${attemptLabel}\noutputPath=${String(finalOutputPath || "")}`);
    setJobState({
      message: "validating_output",
      percent: Math.max(activeRender.percent, getRenderFinalizingPercent("validating_output"))
    });
    const validatedPath = await validateFinalOutputPath(finalOutputPath, debugSession, attemptLabel);
    throwIfCancelled();
    debugSession.write("Render completed", `finalOutputPath=${validatedPath}`);
    debugSession.close();
    if (!setJobState({
      outputPath: validatedPath,
      status: "done",
      percent: 100,
      message: "done",
      errorDetail: "",
      durationSec: activeRender.durationSec || 0,
      command: null,
      pid: null,
      childPids: new Set(),
      cancelToken: null,
      debugSession: null
    })) {
      return finishCancelled("completion state was stale");
    }
    if (activeRender.openFolderAfter && validatedPath) shell.showItemInFolder(validatedPath);
    return { ok: true, filePath: validatedPath };
  };
  const failCurrentJob = async (stateMessage, dialogMessage, errorResult) => {
    if (!isCurrentJob()) return finishCancelled(stateMessage);
    debugSession.close();
    setJobState({
      status: "error",
      message: stateMessage,
      errorDetail: String(dialogMessage || errorResult || ""),
      command: null,
      pid: null,
      childPids: new Set(),
      cancelToken: null,
      debugSession: null
    });
    await showRenderFailureDialog(dialogMessage, debugSession.logPath);
    return { ok: false, error: errorResult || dialogMessage };
  };

  activeRender.jobId = jobId;
  activeRender.sessionId = sessionId;
  activeRender.status = "running";
  activeRender.percent = 0;
  activeRender.timemark = "00:00:00.00";
  activeRender.durationSec = 0;
  activeRender.debugLogPath = debugSession.logPath;
  activeRender.outputPath = outPath;
  activeRender.outputPaths = [];
  trackActiveOutputPath(outPath);
  activeRender.message = "preflight_project";
  activeRender.errorDetail = "";
  activeRender.payload = payload;
  activeRender.openFolderAfter = !!options.openFolderAfter;
  activeRender.command = null;
  activeRender.pid = null;
  activeRender.childPids = new Set();
  activeRender.cancelToken = cancelToken;
  activeRender.debugSession = debugSession;
  broadcastRenderState();

  const buildRenderHooks = (attemptLabel = "primary") => ({
    jobId,
    debugSession,
    isCancelled: () => cancelToken.cancelled || !isCurrentJob(),
    throwIfCancelled,
    onPrepared: ({ durationSec, hasRenderableAudio, inputCount, outputPath: preparedOutputPath, finalOutputPath, outputStaged }) => {
      if (!isCurrentJob()) return;
      debugSession.write(`Attempt prepared: ${attemptLabel}`, [
        `durationSec=${Number(durationSec) || 0}`,
        `hasRenderableAudio=${hasRenderableAudio !== false}`,
        `inputCount=${Number(inputCount) || 0}`,
        `outputStaged=${!!outputStaged}`,
        `preparedOutputPath=${String(preparedOutputPath || "")}`,
        `finalOutputPath=${String(finalOutputPath || "")}`
      ].join("\n"));
      trackActiveOutputPath(preparedOutputPath);
      trackActiveOutputPath(finalOutputPath);
      setJobState({ durationSec: Number(durationSec) || 0 });
    },
    onStart: (line, cmd) => {
      if (!isCurrentJob()) return;
      debugSession.write(`Attempt started: ${attemptLabel}`, String(line || ""));
      const pid = cmd?.ffmpegProc?.pid || null;
      const childPids = activeRender.childPids instanceof Set ? new Set(activeRender.childPids) : new Set();
      if (pid) childPids.add(pid);
      setJobState({
        command: cmd,
        pid,
        childPids,
        message: line || activeRender.message
      });
    },
    onStderr: (line) => {
      debugSession.write(`ffmpeg stderr: ${attemptLabel}`, line);
    },
    onProgress: (p) => {
      if (!isCurrentJob()) return;
      const pr = Number(p?.percent);
      const tm = p?.timemark || activeRender.timemark;
      let nextPercent = activeRender.percent;
      if (Number.isFinite(pr) && pr > 0) {
        nextPercent = Math.max(0, Math.min(100, pr));
      } else if (activeRender.durationSec > 0) {
        const sec = parseTimemarkToSec(tm);
        const est = (sec / activeRender.durationSec) * 100;
        if (Number.isFinite(est)) nextPercent = Math.max(activeRender.percent, Math.min(99.5, est));
      }
      setJobState({ timemark: tm, percent: nextPercent });
    },
    onFinalizing: ({ outputStaged, message }) => {
      if (!isCurrentJob()) return;
      const finalizingMessage = String(message || (outputStaged ? "finalizing_output" : "wrapping_up_render"));
      debugSession.write(`Attempt finalizing: ${attemptLabel}`, [
        `stage=${finalizingMessage}`,
        `outputStaged=${!!outputStaged}`
      ].join("\n"));
      setJobState({
        message: finalizingMessage,
        percent: Math.max(activeRender.percent, getRenderFinalizingPercent(finalizingMessage, outputStaged))
      });
    },
    onError: (err, extra = {}) => {
      const summary = extra?.stderrSummary || String(err?.message || err || "");
      debugSession.write(`Attempt failed: ${attemptLabel}`, [
        `error=${String(err?.message || err || "")}`,
        `stderrSummary=${summary}`
      ].join("\n"));
    },
    onStage: (message, extra = {}) => {
      if (!isCurrentJob()) return;
      debugSession.write(`Attempt stage: ${attemptLabel}`, `${String(message || "")} ${JSON.stringify(extra || {})}`);
      setJobState({ message: String(message || activeRender.message) });
    },
    onWatchdog: (message, extra = {}) => {
      if (!isCurrentJob()) return;
      debugSession.write(`Attempt watchdog: ${attemptLabel}`, `${String(message || "")} ${JSON.stringify(extra || {})}`);
      setJobState({ message: String(message || "render_no_progress_warning") });
    }
  });

  const runVideoCompatibilityFallbacks = async (baseMsg, statusMessage = "retrying_with_generic_compatibility_fallback") => {
    let mkvFailMsg = "";
    try {
      const mkvPayload = {
        ...payload,
        settings: {
          ...(payload.settings || {}),
          container: "MKV",
          _safeNoVf: true,
          _safeCodec: true
        }
      };
      const mkvPath = ensureWritableOutputPath(
        path.join(path.dirname(makeSafeFallbackOutPath(mkvPayload.settings)), `render_${Date.now()}.mkv`),
        mkvPayload.settings
      );
      throwIfCancelled();
      trackActiveOutputPath(mkvPath);
      setJobState({ outputPath: mkvPath, message: statusMessage });
      await renderProject(
        { project: mkvPayload.project, settings: mkvPayload.settings, region: mkvPayload.region, outputPath: mkvPath },
        buildRenderHooks("generic_compatibility_mkv")
      );
      return completeRender(mkvPath, "generic_compatibility_mkv");
    } catch (compatErr) {
      if (isCancelledOrStale(compatErr)) return finishCancelled(compatErr);
      mkvFailMsg = String(compatErr?.message || compatErr);
      debugSession.write("Generic compatibility MKV fallback failed", mkvFailMsg);
    }

    try {
      const localPayload = {
        ...payload,
        settings: {
          ...(payload.settings || {}),
          container: "MKV",
          _safeNoVf: true,
          _safeCodec: true
        }
      };
      const localTmp = `pearl_compat_${Date.now()}.mkv`;
      throwIfCancelled();
      trackActiveOutputPath(path.resolve(localTmp));
      setJobState({
        outputPath: path.resolve(localTmp),
        message: "retrying_with_local_relative_output"
      });
      await renderProject(
        { project: localPayload.project, settings: localPayload.settings, region: localPayload.region, outputPath: localTmp },
        buildRenderHooks("generic_compatibility_local")
      );
      const localAbs = path.resolve(localTmp);
      return completeRender(localAbs, "generic_compatibility_local");
    } catch (localCompatErr) {
      if (isCancelledOrStale(localCompatErr)) return finishCancelled(localCompatErr);
      const localFailMsg = String(localCompatErr?.message || localCompatErr);
      debugSession.write("Render failed", [
        `primary=${baseMsg}`,
        `compatibilityMkv=${mkvFailMsg}`,
        `compatibilityLocal=${localFailMsg}`
      ].join("\n"));
      return failCurrentJob(
        `${baseMsg} | debug_log: ${debugSession.logPath}`,
        `${baseMsg}\n[compatibility mkv failed] ${mkvFailMsg}\n[compatibility local failed] ${localFailMsg}`,
        `${baseMsg}\n[compatibility mkv failed] ${mkvFailMsg}\n[compatibility local failed] ${localFailMsg}`
      );
    }
  };

  let preflightResult = null;
  try {
    preflightResult = await preflightRenderProject(payload, cancelToken, debugSession, {
      onStage: (message, extra = {}) => {
        if (!isCurrentJob()) return;
        setJobState({
          message: String(message || "preflight_project"),
          percent: Math.max(activeRender.percent, 0)
        });
        if (extra?.warnings) debugSession.write("Preflight stage warnings", JSON.stringify(extra.warnings));
      }
    });
  } catch (preflightErr) {
    if (isCancelledOrStale(preflightErr)) return finishCancelled(preflightErr);
    return failCurrentJob(
      "preflight_failed",
      String(preflightErr?.message || preflightErr || "렌더링 사전 검사에 실패했습니다."),
      String(preflightErr?.message || preflightErr || "preflight failed")
    );
  }
  if (!preflightResult?.ok) {
    const reason = String(preflightResult?.error || "렌더링 사전 검사에 실패했습니다.");
    debugSession.write("Preflight blocked render", [
      `error=${reason}`,
      `warnings=${(preflightResult?.warnings || []).join(" | ")}`
    ].join("\n"));
    return failCurrentJob("preflight_failed", reason, reason);
  }
  payload = preflightResult.payload || payload;
  activeRender.payload = payload;
  if (preflightResult?.warnings?.length) {
    debugSession.write("Preflight warnings", preflightResult.warnings.join("\n"));
  }
  setJobState({
    message: "actual_render_start",
    percent: Math.max(activeRender.percent, 0)
  });

  const runPromise = renderProject(
    { project: payload.project, settings: payload.settings, region: payload.region, outputPath: outPath },
    buildRenderHooks("primary")
  );

  try {
    const runResult = await runPromise;
    const finalOutputPath = runResult?.outputPath || outPath;
    return completeRender(finalOutputPath, "primary");
  } catch (e) {
    if (isCancelledOrStale(e)) return finishCancelled(e);
    const msg = String(e?.message || e);
    if (/filter_complex_script/i.test(msg) && !payload.settings?._forceInlineFilter) {
      try {
        const inlinePayload = {
          ...payload,
          settings: {
            ...(payload.settings || {}),
            _forceInlineFilter: true
          }
        };
        throwIfCancelled();
        setJobState({ message: "retrying_with_inline_filter_complex" });
        const inlineResult = await renderProject(
          { project: inlinePayload.project, settings: inlinePayload.settings, region: inlinePayload.region, outputPath: outPath },
          buildRenderHooks("inline_filter_fallback")
        );
        return completeRender(inlineResult?.outputPath || outPath, "inline_filter_fallback");
      } catch (inlineError) {
        if (isCancelledOrStale(inlineError)) return finishCancelled(inlineError);
        const inlineMsg = String(inlineError?.message || inlineError);
        if (!/ENAMETOOLONG/i.test(inlineMsg)) {
          debugSession.write("Render failed", [
            `primary=${msg}`,
            `inline=${inlineMsg}`
          ].join("\n"));
          return failCurrentJob(
            `${msg} | debug_log: ${debugSession.logPath}`,
            `${msg}\n[inline fallback failed] ${inlineMsg}`,
            `${msg}\n[inline fallback failed] ${inlineMsg}`
          );
        }
      }
    }
    if (shouldAttemptDropWaveDisplaceFallback(msg) && !payload.settings?._dropWaveDisplaceFallback) {
      try {
        const displacePayload = {
          ...payload,
          settings: {
            ...(payload.settings || {}),
            _dropWaveDisplaceFallback: true
          }
        };
        debugSession.write("Drop wave displace fallback triggered", `primary=${msg}`);
        throwIfCancelled();
        setJobState({ message: "retrying_with_drop_wave_displace_fallback" });
        const displaceResult = await renderProject(
          { project: displacePayload.project, settings: displacePayload.settings, region: displacePayload.region, outputPath: outPath },
          buildRenderHooks("drop_wave_displace_fallback")
        );
        return completeRender(displaceResult?.outputPath || outPath, "drop_wave_displace_fallback");
      } catch (displaceErr) {
        if (isCancelledOrStale(displaceErr)) return finishCancelled(displaceErr);
        const displaceMsg = String(displaceErr?.message || displaceErr);
        debugSession.write("Drop wave displace fallback failed", displaceMsg);
      }
    }
    if ((payload.settings?.renderMode || "video") === "video" && shouldAttemptGenericCompatibilityFallback(msg)) {
      debugSession.write("Generic compatibility fallback triggered", `primary=${msg}`);
      return runVideoCompatibilityFallbacks(msg, "retrying_with_generic_compatibility_fallback");
    }
    if (/Error opening output file/i.test(msg) || /Invalid argument/i.test(msg)) {
      const fallbackPath = makeSafeFallbackOutPath(payload.settings);
      try {
        throwIfCancelled();
        trackActiveOutputPath(fallbackPath);
        setJobState({
          outputPath: fallbackPath,
          message: "retrying_with_safe_output_path"
        });
        await renderProject(
          { project: payload.project, settings: payload.settings, region: payload.region, outputPath: fallbackPath },
          buildRenderHooks("safe_output_fallback")
        );
        return completeRender(fallbackPath, "safe_output_fallback");
      } catch (e2) {
        if (isCancelledOrStale(e2)) return finishCancelled(e2);
        const msg2 = String(e2?.message || e2);
        // One more compatibility fallback: switch to Matroska container for video renders.
        if ((payload.settings?.renderMode || "video") === "video") {
          let mkvFailMsg = "";
          try {
            const mkvPayload = {
              ...payload,
              settings: {
                ...(payload.settings || {}),
                container: "MKV",
                _safeNoVf: true,
                _safeCodec: true
              }
            };
            const mkvPath = ensureWritableOutputPath(
              path.join(path.dirname(fallbackPath), `render_${Date.now()}.mkv`),
              mkvPayload.settings
            );
            throwIfCancelled();
            trackActiveOutputPath(mkvPath);
            setJobState({
              outputPath: mkvPath,
              message: "retrying_with_mkv_fallback"
            });
            await renderProject(
              { project: mkvPayload.project, settings: mkvPayload.settings, region: mkvPayload.region, outputPath: mkvPath },
              buildRenderHooks("mkv_fallback")
            );
            return completeRender(mkvPath, "mkv_fallback");
          } catch (e3) {
            if (isCancelledOrStale(e3)) return finishCancelled(e3);
            mkvFailMsg = String(e3?.message || e3);
            debugSession.write("MKV fallback failed", mkvFailMsg);
          }
          // Last resort for path parsing issues: render to local relative file first,
          // then copy/move to desired absolute output path.
          try {
            const ext = (payload.settings?.renderMode || "video") === "audio"
              ? outputExtFromSettings(payload.settings)
              : "mkv";
            const localTmp = `pearl_local_${Date.now()}.${ext}`;
            const localPayload = {
              ...payload,
              settings: {
                ...(payload.settings || {}),
                ...(ext === "mkv" ? { container: "MKV" } : {}),
                _safeNoVf: true,
                _safeCodec: true
              }
            };
            throwIfCancelled();
            trackActiveOutputPath(path.resolve(localTmp));
            setJobState({
              outputPath: path.resolve(localTmp),
              message: "retrying_with_local_relative_output"
            });
            await renderProject(
              { project: localPayload.project, settings: localPayload.settings, region: localPayload.region, outputPath: localTmp },
              buildRenderHooks("local_relative_fallback")
            );
            const localAbs = path.resolve(localTmp);
            let finalOut = localAbs;
            try {
              ensureDir(path.dirname(outPath));
              fs.copyFileSync(localAbs, outPath);
              fs.unlinkSync(localAbs);
              finalOut = outPath;
            } catch (copyErr) {
              debugSession.write("Local fallback copy failed", [
                `local=${localAbs}`,
                `target=${outPath}`,
                `error=${String(copyErr?.message || copyErr || "")}`
              ].join("\n"));
              throw copyErr;
            }
            trackActiveOutputPath(finalOut);
            return completeRender(finalOut, "local_relative_fallback");
          } catch (e4) {
            if (isCancelledOrStale(e4)) return finishCancelled(e4);
            const localFailMsg = String(e4?.message || e4);
            debugSession.write("Render failed", [
              `primary=${msg}`,
              `safeOutput=${msg2}`,
              `mkv=${mkvFailMsg}`,
              `local=${localFailMsg}`
            ].join("\n"));
            return failCurrentJob(
              `${msg} | debug_log: ${debugSession.logPath}`,
              `${msg}\n[fallback failed] ${msg2}\n[mkv failed] ${mkvFailMsg}\n[local failed] ${localFailMsg}`,
              `${msg}\n[fallback failed] ${msg2}\n[mkv failed] ${mkvFailMsg}\n[local failed] ${localFailMsg}`
            );
          }
          if (mkvFailMsg) {
            debugSession.write("Render failed", [
              `primary=${msg}`,
              `safeOutput=${msg2}`,
              `mkv=${mkvFailMsg}`
            ].join("\n"));
            return failCurrentJob(
              `${msg} | debug_log: ${debugSession.logPath}`,
              `${msg}\n[fallback failed] ${msg2}\n[mkv failed] ${mkvFailMsg}`,
              `${msg}\n[fallback failed] ${msg2}\n[mkv failed] ${mkvFailMsg}`
            );
          }
        }
        debugSession.write("Render failed", [
          `primary=${msg}`,
          `safeOutput=${msg2}`
        ].join("\n"));
        return failCurrentJob(
          `${msg} | debug_log: ${debugSession.logPath}`,
          `${msg}\n[fallback failed] ${msg2}`,
          `${msg}\n[fallback failed] ${msg2}`
        );
      }
    }
    if (isCancelledOrStale()) return finishCancelled(msg);
    debugSession.write("Render failed", `primary=${msg}`);
    return failCurrentJob(
      `${msg} | debug_log: ${debugSession.logPath}`,
      msg,
      msg
    );
  }
}

function createWindow() {
  const appIconPath = process.platform === "win32"
    ? path.join(__dirname, "Icon.ico")
    : path.join(__dirname, "Icon.png");
  const appIconImage = electronNativeImage.createFromPath(appIconPath);
  const appIcon = appIconImage && !appIconImage.isEmpty() ? appIconImage : appIconPath;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "VideoS",
    icon: appIcon,
    backgroundColor: "#090d12",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", async (event) => {
    if (mainWindowCloseApproved) return;
    event.preventDefault();
    if (mainWindowCloseInFlight) return;
    mainWindowCloseInFlight = true;
    try {
      const approved = await requestMainWindowCloseApproval();
      if (!approved) return;
      mainWindowCloseApproved = true;
      mainWindow.close();
    } finally {
      mainWindowCloseInFlight = false;
    }
  });

  mainWindow.on("closed", () => {
    void stopActiveRender(true, {
      purgeOutputs: true,
      finalStatus: "idle",
      finalMessage: "idle",
      reason: "main window closed"
    });
    closeRenderWindow();
    closeFxRenderHostWindow();
    mainWindow = null;
    mainWindowCloseApproved = false;
    mainWindowCloseInFlight = false;
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.videosmith.app");
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  closeRenderWindow();
  closeFxRenderHostWindow();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void stopActiveRender(true, {
    purgeOutputs: true,
    finalStatus: "idle",
    finalMessage: "idle",
    reason: "app quit"
  });
  closeRenderWindow();
  closeFxRenderHostWindow();
});

ipcMain.handle("pick-media-files", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "미디어 파일 선택",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "All Files", extensions: ["*"] },
      { name: "Media", extensions: [...SUPPORTED_EXT] },
      { name: "Images", extensions: [...SUPPORTED_IMAGE_EXT] }
    ]
  });
  if (res.canceled) return [];
  return res.filePaths || [];
});

ipcMain.handle("read-file-buffer", async (_evt, filePath) => {
  return fs.promises.readFile(filePath);
});

ipcMain.handle("save-project", async (_evt, projectJson, preferredPath = "") => {
  const preferred = String(preferredPath || "").replace(/\.json$/i, "");
  const defaultPath = preferred ? ensureVsmExtension(preferred) : `untitled.${VIDEOSMITH_PROJECT_EXT}`;
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "프로젝트 저장",
    defaultPath,
    filters: [{ name: "VideoSmith Project", extensions: [VIDEOSMITH_PROJECT_EXT] }]
  });
  if (res.canceled || !res.filePath) return { ok: false };
  const filePath = ensureVsmExtension(res.filePath);
  await fs.promises.writeFile(filePath, encodeVideoSmithProjectFile(projectJson));
  return { ok: true, filePath };
});

ipcMain.handle("save-project-to-path", async (_evt, projectJson, targetPath = "") => {
  const rawPath = String(targetPath || "").trim();
  if (!rawPath) return { ok: false, error: "missing file path" };
  const filePath = ensureVsmExtension(rawPath.replace(/\.json$/i, ""));
  await fs.promises.writeFile(filePath, encodeVideoSmithProjectFile(projectJson));
  return { ok: true, filePath };
});

ipcMain.handle("load-project", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "프로젝트 불러오기",
    properties: ["openFile"],
    filters: [{ name: "VideoSmith Project", extensions: [VIDEOSMITH_PROJECT_EXT] }]
  });
  if (res.canceled || !res.filePaths?.[0]) return { ok: false };
  try {
    const buffer = await fs.promises.readFile(res.filePaths[0]);
    const json = decodeVideoSmithProjectFile(buffer);
    return { ok: true, json, filePath: res.filePaths[0] };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "Invalid VideoSmith project file.")
    };
  }
});

ipcMain.handle("save-autosave-cache", async (_evt, payload) => {
  const cachePath = getAutosaveCachePath();
  ensureDir(path.dirname(cachePath));
  const record = {
    projectJson: String(payload?.projectJson || ""),
    manualSaveSignature: String(payload?.manualSaveSignature || ""),
    projectFilePath: String(payload?.projectFilePath || ""),
    savedAtMs: Date.now()
  };
  await fs.promises.writeFile(cachePath, JSON.stringify(record, null, 2), "utf-8");
  return { ok: true, filePath: cachePath, savedAtMs: record.savedAtMs };
});

ipcMain.handle("load-autosave-cache", async () => {
  const cachePath = getAutosaveCachePath();
  try {
    if (!fs.existsSync(cachePath)) return { ok: false };
    const raw = await fs.promises.readFile(cachePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed?.projectJson) {
      await fs.promises.unlink(cachePath).catch(() => {});
      return { ok: false };
    }
    return {
      ok: true,
      projectJson: String(parsed.projectJson || ""),
      manualSaveSignature: String(parsed.manualSaveSignature || ""),
      projectFilePath: String(parsed.projectFilePath || ""),
      savedAtMs: Number(parsed.savedAtMs || 0)
    };
  } catch {
    await fs.promises.unlink(cachePath).catch(() => {});
    return { ok: false };
  }
});

ipcMain.handle("clear-autosave-cache", async () => {
  const cachePath = getAutosaveCachePath();
  await fs.promises.unlink(cachePath).catch(() => {});
  return { ok: true };
});

ipcMain.handle("show-unsaved-close-dialog", async () => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: "저장 확인",
    message: "진행과정이 저장되지 않았습니다. 저장하시겠습니까?"
  });
  return { ok: true, action: res.response === 0 ? "save" : "discard" };
});

ipcMain.handle("show-autosave-restore-dialog", async () => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: "자동 저장 복구",
    message: "자동 저장된 항목이 있습니다. 불러오시겠습니까?"
  });
  return { ok: true, action: res.response === 0 ? "restore" : "discard" };
});

ipcMain.handle("show-image-cutout-close-dialog", async () => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: "누끼 편집 종료",
    message: "진행 내역을 잃습니다. 닫으시겠습니까?"
  });
  return { ok: true, action: res.response === 0 ? "close" : "stay" };
});

async function importMediaPaths(paths) {
  const userData = app.getPath("userData");
  const mediaDir = path.join(userData, "media");
  ensureDir(mediaDir);

  const results = [];

  function diagnoseImportFailure(err, originalPath) {
    const msg = String(err?.message || err || "");
    const lower = msg.toLowerCase();
    if (lower.includes("spawn") && lower.includes("ffprobe") && lower.includes("enoent")) {
      return {
        reason: "미디어 분석 도구(ffprobe) 실행 파일을 찾지 못했습니다.",
        solution: `앱을 재설치하고, 백신/보안 프로그램의 격리 목록에서 VideoSmith 폴더를 제외한 뒤 다시 시도하세요. (현재 ffprobe 경로: ${runtimeFfprobePath || "unknown"})`
      };
    }
    if (lower.includes("spawn") && lower.includes("ffmpeg") && lower.includes("enoent")) {
      return {
        reason: "인코딩 도구(ffmpeg) 실행 파일을 찾지 못했습니다.",
        solution: `앱을 재설치하고, 백신/보안 프로그램의 격리 목록에서 VideoSmith 폴더를 제외한 뒤 다시 시도하세요. (현재 ffmpeg 경로: ${runtimeFfmpegPath || "unknown"})`
      };
    }
    if (lower.includes("permission denied") || lower.includes("eacces") || lower.includes("eperm")) {
      return {
        reason: "파일 접근 권한이 없어 읽지 못했습니다.",
        solution: "파일이 다른 프로그램에서 사용 중인지 확인하고, 읽기 권한이 있는 위치로 파일을 옮긴 뒤 다시 시도하세요."
      };
    }
    if (lower.includes("invalid data found") || lower.includes("moov atom not found") || lower.includes("could not find codec")) {
      return {
        reason: "파일 헤더/코덱 정보가 손상되었거나 현재 환경에서 해석할 수 없습니다.",
        solution: "원본 파일 재복사 또는 다른 플레이어에서 재생 확인 후, 필요하면 MP4(H.264/AAC)로 한 번 변환해서 가져오세요."
      };
    }
    const ext = extOf(originalPath || "");
    return {
      reason: "파일 메타데이터 분석 중 오류가 발생했습니다.",
      solution: `파일 형식(.${ext || "unknown"})이 표준 인코딩인지 확인하고, 계속 실패하면 다른 저장 위치에서 다시 가져와 보세요.`
    };
  }

  for (const p of (paths || [])) {
    try {
      const ext = extOf(p);
      const id = makeId();
      const out = path.join(mediaDir, `${id}.internal.mp4`);

      if (await looksLikeStillImageFile(p)) {
        results.push(await buildStillImageImportResult(p, id, out));
        continue;
      }

      const meta = await probe(p);
      if (isStillImageMeta(meta)) {
        results.push(await buildStillImageImportResult(p, id, out));
        continue;
      }
      const v = getVideoStream(meta);
      const a = getAudioStream(meta);
      if (!v && !a) {
        results.push({
          ok: false,
          originalPath: p,
          error: SUPPORTED_EXT.has(ext)
            ? "파일 형식을 판별하지 못했습니다."
            : "이미지/영상/오디오 파일 형식을 자동 판별하지 못했습니다."
        });
        continue;
      }

      const fps = v ? parseFps(v) : 0;
      const sourceWidth = v ? Number(v.width || 0) : 0;
      const sourceHeight = v ? Number(v.height || 0) : 0;
      const effectiveDims = v && clipVisuals?.getMediaDimensions
        ? clipVisuals.getMediaDimensions({
            width: sourceWidth,
            height: sourceHeight,
            rotation: clipVisuals.extractMediaRotation ? clipVisuals.extractMediaRotation(v) : Number(v?.tags?.rotate || v?.rotation || 0),
            side_data_list: Array.isArray(v?.side_data_list) ? v.side_data_list : []
          }, sourceWidth || 2, sourceHeight || 2)
        : { width: sourceWidth, height: sourceHeight, rotation: 0 };
      const width = Number(effectiveDims.width || sourceWidth || 0);
      const height = Number(effectiveDims.height || sourceHeight || 0);
      const duration = Number(meta.format?.duration || 0);

      const warnings = [];
      if (width > MAX_W || height > MAX_H) {
        warnings.push("현재 최대 지원 해상도를 초과한 파일은 자동으로 4K로 변환됩니다.");
      }
      if (fps > MAX_FPS) {
        warnings.push("현재 최대 지원 프레임을 초과한 파일은 자동으로 60fps로 변환됩니다.");
      }

      if (!v && a) {
        results.push({
          ok: true,
          id,
          kind: "audio",
          originalPath: p,
          internalPath: p,
          meta: {
            duration,
            fps: 0,
            width: 0,
            height: 0,
            hasAudio: true
          },
          warnings
        });
        continue;
      }

      results.push({
        ok: true,
        id,
        kind: v ? "video" : "audio",
        originalPath: p,
        // Fast import path: avoid heavyweight transcode on upload.
        // Render stage already normalizes resolution/fps.
        internalPath: p,
        meta: {
          duration,
          fps,
          width,
          height,
          displayWidth: width,
          displayHeight: height,
          sourceWidth,
          sourceHeight,
          rotation: Number(effectiveDims.rotation || 0),
          hasAudio: !!a
        },
        warnings
      });
    } catch (e) {
      const diag = diagnoseImportFailure(e, p);
      results.push({
        ok: false,
        originalPath: p,
        error: String(e?.message || e),
        reason: diag.reason,
        solution: diag.solution
      });
    }
  }

  return results;
}

ipcMain.handle("import-media", async (_evt, paths) => {
  return importMediaPaths(paths);
});

ipcMain.handle("create-background-color-clip", async (_evt, payload = {}) => {
  try {
    const userData = app.getPath("userData");
    const mediaDir = path.join(userData, "media");
    ensureDir(mediaDir);
    const id = makeId();
    const color = `#${normalizeHexColor(payload.color, "FFFFFF")}`;
    const out = path.join(mediaDir, `${id}.background.mp4`);
    const built = await createBackgroundColorClipMP4(out, {
      color,
      durationSec: Number(payload.durationSec || 5),
      fps: Number(payload.fps || 30),
      resolutionName: payload.resolutionName || "FHD",
      aspectRatio: payload.aspectRatio || "16:9"
    });
    return {
      ok: true,
      id,
      kind: "video",
      name: `Background ${color.toUpperCase()}`,
      color,
      originalPath: out,
      internalPath: out,
      meta: {
        duration: Number(built.durationSec || 5),
        fps: Number(built.fps || 30),
        width: Number(built.width || 1920),
        height: Number(built.height || 1080),
        hasAudio: false,
        isBackgroundColor: true
      }
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e?.message || e || "background clip generation failed")
    };
  }
});

ipcMain.handle("save-image-cutout-asset", async (_evt, payload = {}) => {
  try {
    const userData = app.getPath("userData");
    const mediaDir = path.join(userData, "media");
    ensureDir(mediaDir);
    const id = String(payload.clipId || makeId());
    const stamp = Date.now();
    const pngPath = path.join(mediaDir, `${id}.${stamp}.cutout.png`);
    const previewPath = path.join(mediaDir, `${id}.${stamp}.cutout.webm`);
    const buffer = dataUrlToBuffer(payload.dataUrl || "");
    await fs.promises.writeFile(pngPath, buffer);
    const durationSec = Math.max(TIMELINE_TIME_STEP_SEC, Number(payload.durationSec || 5));
    await transcodeStillImageToAlphaWebM(pngPath, previewPath, durationSec);
    return {
      ok: true,
      pngPath,
      previewPath,
      meta: {
        width: Math.max(1, Number(payload.width || 0)),
        height: Math.max(1, Number(payload.height || 0)),
        duration: durationSec
      }
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e?.message || e || "image cutout save failed")
    };
  }
});

ipcMain.handle("import-dropped-files", async (_evt, files) => {
  const dropDir = path.join(app.getPath("userData"), "dropped");
  ensureDir(dropDir);
  const saved = [];
  let idx = 0;
  for (const f of (files || [])) {
    try {
      const rawName = String(f?.name || `dropped_${Date.now()}_${idx}`);
      const safeName = rawName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
      const p = path.join(dropDir, `${Date.now()}_${idx}_${safeName}`);
      const data = f?.data;
      let buf = null;
      if (data instanceof ArrayBuffer) {
        buf = Buffer.from(new Uint8Array(data));
      } else if (ArrayBuffer.isView(data)) {
        buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      } else if (Array.isArray(data)) {
        buf = Buffer.from(data);
      }
      if (!buf || !buf.length) continue;
      await fs.promises.writeFile(p, buf);
      saved.push(p);
      idx += 1;
    } catch {
      // skip broken dropped item
    }
  }
  if (!saved.length) return [];
  return importMediaPaths(saved);
});

ipcMain.handle("probe-media-durations", async (_evt, paths) => {
  const out = [];
  for (const p of (paths || [])) {
    try {
      if (await looksLikeStillImageFile(p)) {
        out.push({ path: p, duration: 5, kind: "video" });
        continue;
      }
      const meta = await probe(p);
      if (isStillImageMeta(meta)) {
        out.push({ path: p, duration: 5, kind: "video" });
        continue;
      }
      const v = getVideoStream(meta);
      const a = getAudioStream(meta);
      out.push({
        path: p,
        duration: Number(meta.format?.duration || 0),
        kind: v ? "video" : (a ? "audio" : "unknown")
      });
    } catch {
      out.push({ path: p, duration: 0, kind: "unknown" });
    }
  }
  return out;
});

ipcMain.handle("pick-output-folder", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "출력 폴더 선택",
    properties: ["openDirectory", "createDirectory"]
  });
  if (res.canceled || !res.filePaths?.[0]) return { ok: false };
  outputFolder = res.filePaths[0];
  return { ok: true, dirPath: outputFolder };
});

ipcMain.handle("get-output-folder", async () => {
  return { ok: true, dirPath: outputFolder || "" };
});

ipcMain.handle("set-output-folder", async (_evt, dirPath) => {
  outputFolder = String(dirPath || "");
  return { ok: true, dirPath: outputFolder };
});

ipcMain.handle("open-render-window", async (_evt, config) => {
  const renderActive = activeRender.status === "running" || activeRender.status === "paused";
  if (!renderActive) {
    activeRender.payload = config?.payload ? cloneRenderPayload(config.payload) : null;
    activeRender.openFolderAfter = !!config?.openFolderAfter;
  }
  if (config?.outputFolder) outputFolder = config.outputFolder;
  createRenderWindow();
  broadcastRenderState();
  return { ok: true };
});

ipcMain.handle("get-render-state", async () => {
  return {
    jobId: activeRender.jobId || 0,
    sessionId: activeRender.sessionId || "",
    status: activeRender.status,
    percent: activeRender.percent,
    timemark: activeRender.timemark,
    durationSec: activeRender.durationSec || 0,
    message: activeRender.message,
    debugLogPath: activeRender.debugLogPath || "",
    outputPath: activeRender.outputPath,
    settings: activeRender.payload?.settings || null
  };
});

ipcMain.handle("render-control", async (_evt, action, payload) => {
  switch (action) {
    case "start": {
      if (activeRender.status === "running" || activeRender.status === "paused") return { ok: false, error: "already running" };
      const cfg = payload || {};
      const pld = cfg.payload || activeRender.payload;
      if (!pld) return { ok: false, error: "no payload" };
      activeRender.payload = pld;
      if (cfg.outputFolder) outputFolder = cfg.outputFolder;
      activeRender.openFolderAfter = !!cfg.openFolderAfter;
      void startRenderFromPayload(pld, { outputFolder, openFolderAfter: activeRender.openFolderAfter });
      return { ok: true };
    }
    case "update-settings": {
      const next = payload?.settings;
      if (!next || !activeRender.payload) return { ok: false, error: "no active payload" };
      if (activeRender.status === "running" || activeRender.status === "paused") {
        return { ok: false, error: "render active" };
      }
      activeRender.payload.settings = {
        ...(activeRender.payload.settings || {}),
        ...next
      };
      broadcastRenderState();
      return { ok: true };
    }
    case "pause": {
      if (activeRender.status !== "running") return { ok: false, error: "not running" };
      const jobId = activeRender.jobId;
      const token = activeRender.cancelToken;
      const pid = activeRender.pid || activeRender.command?.ffmpegProc?.pid;
      const ok = await suspendPid(pid);
      if (!ok) {
        logActiveRenderDiagnostic("Render pause failed", `jobId=${jobId}\npid=${pid || ""}`);
        return { ok: false, error: "pause unsupported" };
      }
      if (!isCurrentRenderJob(jobId, token) || activeRender.status !== "running") return { ok: false, error: "render job changed" };
      activeRender.status = "paused";
      activeRender.message = "paused";
      broadcastRenderState();
      return { ok: true };
    }
    case "resume": {
      if (activeRender.status !== "paused") return { ok: false, error: "not paused" };
      const jobId = activeRender.jobId;
      const token = activeRender.cancelToken;
      const pid = activeRender.pid || activeRender.command?.ffmpegProc?.pid;
      const ok = await resumePid(pid);
      if (!ok) {
        logActiveRenderDiagnostic("Render resume failed", `jobId=${jobId}\npid=${pid || ""}`);
        return { ok: false, error: "resume unsupported" };
      }
      if (!isCurrentRenderJob(jobId, token) || activeRender.status !== "paused") return { ok: false, error: "render job changed" };
      activeRender.status = "running";
      activeRender.message = "running";
      broadcastRenderState();
      return { ok: true };
    }
    case "stop": {
      if (activeRender.status !== "running" && activeRender.status !== "paused") {
        return { ok: false, error: "not active" };
      }
      await stopActiveRender(true, { purgeOutputs: true, finalStatus: "stopped", finalMessage: "stopped", reason: "stopped" });
      return { ok: true };
    }
    case "cancel": {
      if (activeRender.status === "running" || activeRender.status === "paused") {
        await stopActiveRender(true, { purgeOutputs: true, finalStatus: "idle", finalMessage: "idle", reason: "cancelled" });
      } else {
        activeRender.status = "idle";
        activeRender.percent = 0;
        activeRender.timemark = "";
        activeRender.durationSec = 0;
        activeRender.message = "idle";
        broadcastRenderState();
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown action" };
  }
});

ipcMain.handle("render", async (_evt, payload) => {
  const { project, settings, region } = payload;
  const mode = settings?.renderMode === "audio" ? "audio" : "video";
  const ext = outputExtFromSettings(settings || {});

  const res = await dialog.showSaveDialog(mainWindow, {
    title: "렌더 결과 저장",
    defaultPath: `render.${ext}`,
    filters: [
      { name: mode === "audio" ? "Audio" : "Video", extensions: [ext] }
    ]
  });
  if (res.canceled || !res.filePath) return { ok: false };

  const debugSession = createRenderDebugSession({ project, settings, region }, res.filePath);
  try {
    const preflight = await preflightRenderProject({ project, settings, region }, null, debugSession);
    if (!preflight?.ok) {
      debugSession.close();
      return { ok: false, error: String(preflight?.error || "렌더링 사전 검사에 실패했습니다.") };
    }
    await renderProject({
      project: preflight.payload?.project || project,
      settings: preflight.payload?.settings || settings,
      region: preflight.payload?.region || region,
      outputPath: res.filePath
    }, { debugSession });
    await validateFinalOutputPath(res.filePath, null, "dialog_render");
    debugSession.close();
    return { ok: true, filePath: res.filePath };
  } catch (e) {
    debugSession.write("Dialog render failed", String(e?.message || e));
    debugSession.close();
    return { ok: false, error: String(e?.message || e) };
  }
});

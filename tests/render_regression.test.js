const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFile } = require("node:child_process");
const { createRequire } = require("node:module");
const { promisify } = require("node:util");
const test = require("node:test");
const ffmpegPath = require("ffmpeg-static");

const repoRoot = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);

function makeDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function assertPlainObject(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}

function loadMainHarness() {
  const mainPath = path.join(repoRoot, "main.js");
  const realRequire = createRequire(mainPath);
  const ipcHandlers = new Map();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "videosmith-render-main-"));
  const sent = [];
  const app = {
    getPath(name) {
      const p = path.join(tempRoot, name);
      fs.mkdirSync(p, { recursive: true });
      return p;
    },
    whenReady() {
      return { then() { return { catch() {} }; } };
    },
    on() {},
    quit() {},
    setName() {},
    setAppUserModelId() {}
  };
  class BrowserWindow {
    constructor() {
      this.webContents = { send: (...args) => sent.push(args), executeJavaScript: async () => true };
    }
    static getAllWindows() { return []; }
    loadFile() {}
    on() {}
    focus() {}
    isDestroyed() { return false; }
    close() {}
  }
  const electron = {
    app,
    BrowserWindow,
    dialog: {
      showMessageBox: async () => ({ response: 0 }),
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: true, filePath: "" })
    },
    ipcMain: {
      handle(name, fn) {
        ipcHandlers.set(name, fn);
      }
    },
    shell: { showItemInFolder() {} },
    nativeImage: { createFromPath: () => ({ isEmpty: () => true }) }
  };
  const sandbox = {
    console,
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    process,
    __ipcHandlers: ipcHandlers,
    __sent: sent,
    __dirname: repoRoot,
    __filename: mainPath,
    module: { exports: {} },
    exports: {},
    require(id) {
      if (id === "electron") return electron;
      return realRequire(id);
    }
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  const expose = `
globalThis.__renderRegression = {
  ipcHandlers: globalThis.__ipcHandlers,
  tempRoot: ${JSON.stringify(tempRoot)},
  sent: globalThis.__sent,
  get activeRender() { return activeRender; },
  setActiveRender(fields = {}) {
    Object.assign(activeRender, {
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
    }, fields);
  },
  startRenderFromPayload,
  stopActiveRender,
  renderProject,
  preflightRenderProject,
  sanitizeRenderProjectForFfmpeg,
  resolveVerifiedRenderFont,
  containsNonAsciiText,
  getTextScriptProfile,
  collectPreflightSampleTimes,
  resToWH,
  getRenderFinalizingPercent,
  getExpectedRenderFrameCount,
  clampBuiltRenderDuration,
  validateFinalOutputPath,
  setMainWindow(win) { mainWindow = win; },
  setRenderWindow(win) { renderWindow = win; },
  setRenderProject(fn) { renderProject = fn; },
  setPreflightRenderProject(fn) { preflightRenderProject = fn; },
  setCreateRenderDebugSession(fn) { createRenderDebugSession = fn; },
  setSuspendPid(fn) { suspendPid = fn; },
  setResumePid(fn) { resumePid = fn; }
};`;
  vm.runInNewContext(`${fs.readFileSync(mainPath, "utf8")}\n${expose}`, sandbox, { filename: mainPath });
  const api = sandbox.__renderRegression;
  const win = { webContents: { send: (...args) => sent.push(args) }, isDestroyed: () => false };
  api.setMainWindow(win);
  api.setRenderWindow(win);
  api.setCreateRenderDebugSession(() => ({
    logPath: path.join(tempRoot, "render-debug.txt"),
    write() {},
    close() {}
  }));
  api.setPreflightRenderProject(async (payload) => ({ ok: true, payload, warnings: [] }));
  return api;
}

function makePayload() {
  return {
    project: {
      media: [],
      clips: [{ id: "c1", type: "color", start: 0, duration: 8.9, color: "#000000" }],
      overlayItems: []
    },
    settings: { fps: 30, resolutionName: "FHD", aspectRatio: "16:9", container: "MP4", renderMode: "video" }
  };
}

test("render target dimensions honor selected aspect ratio presets", () => {
  const api = loadMainHarness();
  assertPlainObject(api.resToWH("FHD", "16:9"), { w: 1920, h: 1080 });
  assertPlainObject(api.resToWH("FHD", "9:16"), { w: 1080, h: 1920 });
  assertPlainObject(api.resToWH("HD", "1:1"), { w: 720, h: 720 });
  assertPlainObject(api.resToWH("FHD", "20:9"), { w: 2400, h: 1080 });
  assertPlainObject(api.resToWH("FHD", "16:10"), { w: 1728, h: 1080 });
});

test("editor UI wires aspect ratio and timeline section controls", () => {
  const html = fs.readFileSync(path.join(repoRoot, "renderer", "index.html"), "utf8");
  const appSource = fs.readFileSync(path.join(repoRoot, "renderer", "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(repoRoot, "renderer", "styles.css"), "utf8");

  assert.match(html, /id="btnPreviewAspectRatio"/);
  assert.match(html, /id="aspectRatioModal"/);
  assert.match(html, /id="btnAddVideoSection"/);
  assert.match(html, /id="btnAddAudioSection"/);
  assert.match(appSource, /aspectRatio:\s*state\.settings\.aspectRatio/);
  assert.match(appSource, /createBackgroundColorClip\(\{[\s\S]*aspectRatio:/);
  assert.match(appSource, /handlePreviewBackgroundSelection/);
  assert.match(styles, /--aspect-modal-bg:/);
  assert.match(styles, /\.aspectRatioPresetBtn\.active[\s\S]*--aspect-card-active-ring/);
  assert.match(styles, /button,[\s\S]*user-select:none/);
});

test("new render publishes job/session identity and starts at 0%", async () => {
  const api = loadMainHarness();
  const deferred = makeDeferred();
  let captured;
  api.setRenderProject(async (args, hooks) => {
    captured = { args, hooks };
    return deferred.promise;
  });
  const outputPath = path.join(api.tempRoot, "start.mp4");
  const run = api.startRenderFromPayload(makePayload(), { outputPath });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(api.activeRender.status, "running");
  assert.equal(api.activeRender.percent, 0);
  assert.ok(api.activeRender.jobId > 0);
  assert.match(api.activeRender.sessionId, /^[0-9a-f-]{36}$/i);
  assert.ok(captured, "renderProject was started");
  const stateEvents = api.sent.filter(([channel]) => channel === "render-state").map(([, state]) => state);
  assert.ok(stateEvents.some((state) => (
    state.status === "running"
    && state.percent === 0
    && state.jobId === api.activeRender.jobId
    && state.sessionId === api.activeRender.sessionId
  )));

  await api.ipcHandlers.get("render-control")(null, "cancel", {});
  deferred.resolve({ outputPath });
  await assert.rejects(run, /cancelled|render job is no longer active/);
  assert.notEqual(api.activeRender.status, "done");
});

test("render controls are job-aware and stale progress cannot mutate a newer render", async () => {
  const api = loadMainHarness();
  const calls = [];
  api.setRenderProject(async (args, hooks) => {
    const deferred = makeDeferred();
    calls.push({ args, hooks, deferred });
    return deferred.promise;
  });

  const firstRun = api.startRenderFromPayload(makePayload(), { outputPath: path.join(api.tempRoot, "first.mp4") });
  await new Promise((resolve) => setImmediate(resolve));
  const firstHooks = calls[0].hooks;
  await api.ipcHandlers.get("render-control")(null, "cancel", {});

  const secondRun = api.startRenderFromPayload(makePayload(), { outputPath: path.join(api.tempRoot, "second.mp4") });
  await new Promise((resolve) => setImmediate(resolve));
  const secondJobId = api.activeRender.jobId;
  firstHooks.onProgress({ percent: 88, timemark: "00:00:07.80" });
  firstHooks.onFinalizing({ outputStaged: true });

  assert.equal(api.activeRender.jobId, secondJobId);
  assert.equal(api.activeRender.percent, 0);
  assert.equal(api.activeRender.message, "actual_render_start");

  api.setActiveRender({
    jobId: 11,
    status: "running",
    command: { ffmpegProc: { pid: 1234 } },
    pid: 1234,
    cancelToken: { cancelled: false }
  });
  api.setSuspendPid(async () => {
    api.activeRender.jobId = 12;
    return true;
  });
  const pauseResult = await api.ipcHandlers.get("render-control")(null, "pause", {});
  assertPlainObject(pauseResult, { ok: false, error: "render job changed" });
  assert.notEqual(api.activeRender.status, "paused");

  api.setActiveRender({
    jobId: 21,
    status: "paused",
    command: { ffmpegProc: { pid: 2345 } },
    pid: 2345,
    cancelToken: { cancelled: false }
  });
  api.setResumePid(async () => {
    api.activeRender.jobId = 22;
    return true;
  });
  const resumeResult = await api.ipcHandlers.get("render-control")(null, "resume", {});
  assertPlainObject(resumeResult, { ok: false, error: "render job changed" });
  assert.notEqual(api.activeRender.status, "running");

  api.setActiveRender({ status: "idle" });
  calls[0].deferred.resolve({ outputPath: path.join(api.tempRoot, "first.mp4") });
  calls[1].deferred.resolve({ outputPath: path.join(api.tempRoot, "second.mp4") });
  await Promise.allSettled([firstRun, secondRun]);
});

test("stop/cancel reset UI state, and terminal cancel does not purge final output", async () => {
  const api = loadMainHarness();
  const handler = api.ipcHandlers.get("render-control");
  const activeOutput = path.join(api.tempRoot, "active.mp4");
  fs.writeFileSync(activeOutput, "partial");
  api.setActiveRender({
    jobId: 1,
    status: "running",
    percent: 43,
    message: "running",
    outputPath: activeOutput,
    outputPaths: [activeOutput],
    cancelToken: { cancelled: false }
  });
  const cancelActive = await handler(null, "cancel", {});
  assertPlainObject(cancelActive, { ok: true });
  assert.equal(api.activeRender.status, "idle");
  assert.equal(api.activeRender.percent, 0);
  assert.equal(api.activeRender.message, "idle");
  assert.equal(fs.existsSync(activeOutput), false);
  assert.notEqual(api.activeRender.status, "done");

  const stoppedOutput = path.join(api.tempRoot, "stopped.mp4");
  fs.writeFileSync(stoppedOutput, "partial");
  api.setActiveRender({
    jobId: 2,
    status: "running",
    percent: 77,
    message: "running",
    outputPath: stoppedOutput,
    outputPaths: [stoppedOutput],
    cancelToken: { cancelled: false }
  });
  const stopResult = await handler(null, "stop", {});
  assertPlainObject(stopResult, { ok: true });
  assert.equal(api.activeRender.status, "stopped");
  assert.equal(api.activeRender.percent, 0);
  assert.equal(api.activeRender.message, "stopped");
  assert.equal(fs.existsSync(stoppedOutput), false);

  const finalOutput = path.join(api.tempRoot, "final.mp4");
  fs.writeFileSync(finalOutput, "final");
  api.setActiveRender({
    jobId: 3,
    status: "done",
    percent: 100,
    message: "done",
    outputPath: finalOutput,
    outputPaths: [finalOutput]
  });
  const cancelDone = await handler(null, "cancel", {});
  assertPlainObject(cancelDone, { ok: true });
  assert.equal(api.activeRender.status, "idle");
  assert.equal(api.activeRender.percent, 0);
  assert.equal(fs.existsSync(finalOutput), true);
  assert.equal(api.activeRender.outputPath, finalOutput);
});

test("update-settings rejects active renders and allows idle payload edits", async () => {
  const api = loadMainHarness();
  const handler = api.ipcHandlers.get("render-control");
  api.setActiveRender({
    status: "running",
    payload: { settings: { fps: 24, container: "MP4" } }
  });
  const activeResult = await handler(null, "update-settings", { settings: { fps: 60 } });
  assertPlainObject(activeResult, { ok: false, error: "render active" });
  assert.equal(api.activeRender.payload.settings.fps, 24);

  api.activeRender.status = "idle";
  const idleResult = await handler(null, "update-settings", { settings: { fps: 60 } });
  assertPlainObject(idleResult, { ok: true });
  assert.equal(api.activeRender.payload.settings.fps, 60);
});

test("frame-count clamp produces 267 frames for 8.9s at 30fps", () => {
  const api = loadMainHarness();
  assert.equal(api.getExpectedRenderFrameCount(8.9, { fps: 30 }), 267);
  const built = api.clampBuiltRenderDuration({
    filter: "[0:v]null[v0]",
    map: { v: "v0", a: "a0" }
  }, 8.9, "video", { fps: 30 });
  assert.match(built.filter, /tpad=stop_mode=clone:stop_duration=/);
  assert.match(built.filter, /trim=start_frame=0:end_frame=267/);
  assert.match(built.filter, /setpts=N\/\(30\*TB\)/);
});

test("finalizing stages are surfaced before Done", async () => {
  const api = loadMainHarness();
  const outputPath = path.join(api.tempRoot, "finalizing.mp4");
  api.setRenderProject(async (_args, hooks) => {
    hooks.onFinalizing({ message: "encoder_finished", outputStaged: false });
    hooks.onFinalizing({ message: "finalizing_output", outputStaged: false });
    hooks.onFinalizing({ message: "cleaning_up_render", outputStaged: false });
    fs.writeFileSync(outputPath, "final");
    return { outputPath };
  });

  const result = await api.startRenderFromPayload(makePayload(), { outputPath });
  assertPlainObject(result, { ok: true, filePath: outputPath });
  const states = api.sent.filter(([channel]) => channel === "render-state").map(([, state]) => state);
  const messages = states.map((state) => state.message);
  assert.ok(messages.includes("encoder_finished"));
  assert.ok(messages.includes("finalizing_output"));
  assert.ok(messages.includes("cleaning_up_render"));
  assert.ok(messages.includes("validating_output"));
  assert.equal(states.at(-1).status, "done");
  assert.equal(states.at(-1).percent, 100);
  assert.equal(api.getRenderFinalizingPercent("validating_output"), 99.9);
});

test("done path depends on non-empty final output validation", async () => {
  const api = loadMainHarness();
  const missing = path.join(api.tempRoot, "missing.mp4");
  await assert.rejects(
    () => api.validateFinalOutputPath(missing, null, "unit"),
    /missing output/
  );

  const empty = path.join(api.tempRoot, "empty.mp4");
  fs.closeSync(fs.openSync(empty, "w"));
  await assert.rejects(
    () => api.validateFinalOutputPath(empty, null, "unit"),
    /output is empty/
  );

  const valid = path.join(api.tempRoot, "valid.mp4");
  fs.writeFileSync(valid, "not empty");
  assert.equal(await api.validateFinalOutputPath(valid, null, "unit"), valid);
});

test("drop-wave render path keeps active-window diagnostics and gated expressions", () => {
  const source = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");
  assert.match(source, /function buildDropWaveRemapChain/);
  assert.match(source, /const activeWindowExpr = `between\(T,\$\{activeStart\},\$\{activeEnd\}\)`/);
  assert.match(source, /if\(\$\{activeWindowExpr\},\$\{clampRangeExpr/);
  assert.match(source, /Drop wave remap chain active/);
  assert.match(source, /activeWindow=\$\{activeStart\}-\$\{activeEnd\}/);
});

test("combined render pipeline keeps background, chroma, subtitles, and FX in render order", () => {
  const source = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");
  assert.match(source, /getProjectBackgroundColorValue/);
  assert.match(source, /colorkey=0x/);
  assert.match(source, /function buildOverlayDrawtextChain/);
  assert.match(source, /drawtext=/);
  assert.match(source, /ipcMain\.handle\("create-background-color-clip"/);
  assert.match(source, /const prerenderedFx = await renderCanvasFxOverlaySource/);
  assert.match(source, /const fxChain = buildFxOverlayChain/);

  const order = [
    "const zoomChain = buildZoomFocusChain",
    "const dropWaveChain = buildDropWaveRemapChain",
    "const drawtext = buildOverlayDrawtextChain",
    "const prerenderedFx = await renderCanvasFxOverlaySource",
    "const fxChain = buildFxOverlayChain"
  ].map((needle) => source.indexOf(needle));
  order.forEach((idx, i) => assert.ok(idx > -1, `missing render pipeline marker ${i}`));
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i - 1] < order[i], `render pipeline order regressed at index ${i}`);
  }
});

test("preview aspect frame and custom font picker stay wired", () => {
  const appSource = fs.readFileSync(path.join(repoRoot, "renderer", "app.js"), "utf8");
  const htmlSource = fs.readFileSync(path.join(repoRoot, "renderer", "index.html"), "utf8");
  const cssSource = fs.readFileSync(path.join(repoRoot, "renderer", "styles.css"), "utf8");
  const mainSource = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");

  assert.match(htmlSource, /id="customFontModal"/);
  assert.match(htmlSource, /id="customFontTermsCheck"/);
  assert.match(appSource, /const ADD_CUSTOM_FONT_VALUE = "__add_custom_font__"/);
  assert.match(appSource, /backdrop\.id = "previewFrameBackdrop"/);
  assert.match(appSource, /function applyPreviewFrameLayout/);
  assert.match(appSource, /stage\.style\.setProperty\("--preview-frame-width"/);
  assert.match(appSource, /schedulePreviewFrameRefresh\(\);/);
  assert.match(appSource, /fontFile: String\(defaults\.fontFile \|\| ""\)/);
  assert.match(appSource, /overlay\.fontFile = font\.path/);
  assert.match(appSource, /const SUPPORTED_FONT_EXTS = new Set\(\["ttf", "otf", "ttc", "woff", "woff2"\]\)/);
  assert.match(cssSource, /#previewFrameBackdrop/);
  assert.match(cssSource, /white-space:nowrap/);
  assert.match(mainSource, /function resolveDrawtextFontFile\(fontFamily, fontWeight, fontFile = "", sampleText = ""\)/);
  assert.match(mainSource, /resolveVerifiedRenderFont\(overlay/);
});

test("VideoSmith project files, preview resize, and compact timeline controls stay wired", () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");
  const appSource = fs.readFileSync(path.join(repoRoot, "renderer", "app.js"), "utf8");
  const overlaySource = fs.readFileSync(path.join(repoRoot, "renderer", "overlay_engine.js"), "utf8");
  const timelineSource = fs.readFileSync(path.join(repoRoot, "renderer", "timeline.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(repoRoot, "renderer", "styles.css"), "utf8");
  const koSource = fs.readFileSync(path.join(repoRoot, "renderer", "i18n", "ko.js"), "utf8");
  const enSource = fs.readFileSync(path.join(repoRoot, "renderer", "i18n", "en.js"), "utf8");

  assert.match(mainSource, /const zlib = require\("zlib"\)/);
  assert.match(mainSource, /VIDEOSMITH_PROJECT_EXT = "vsm"/);
  assert.match(mainSource, /VIDEOSMITH_PROJECT_MAGIC = Buffer\.from\("VSM1\\n", "utf8"\)/);
  assert.match(mainSource, /zlib\.gzipSync/);
  assert.match(mainSource, /zlib\.gunzipSync/);
  assert.match(mainSource, /extensions: \[VIDEOSMITH_PROJECT_EXT\]/);
  assert.match(mainSource, /defaultPath,\s*[\r\n]\s*filters: \[\{ name: "VideoSmith Project"/);

  assert.match(appSource, /function initPreviewResizeObserver/);
  assert.match(appSource, /new ResizeObserver/);
  assert.match(appSource, /function renderPreviewOverlays\(timeSec = state\.ui\.currentTime\)/);
  assert.match(appSource, /initPreviewResizeObserver\(\);/);
  assert.match(appSource, /프로젝트 파일을 불러오지 못했습니다/);
  assert.match(appSource, /프로젝트 저장 완료/);

  assert.match(overlaySource, /function updatePreviewTextElementLayout/);
  assert.match(overlaySource, /Number\(overlay\.fontSize \|\| 64\) \* Number\(frame\.scale \|\| 1\)/);
  assert.match(overlaySource, /updatePreviewTextElementLayout\(el, overlay, frame\)/);

  assert.match(timelineSource, /const clipOptionsIcon = `/);
  assert.match(timelineSource, /class="clipOptionsIcon"/);
  assert.match(timelineSource, /dataset\.dropKind/);
  assert.match(timelineSource, /--drop-preview-color/);
  assert.doesNotMatch(timelineSource, /innerHTML = "<span><\/span><span><\/span><span><\/span>"/);
  assert.match(appSource, /function createPaletteDragImage/);
  assert.match(appSource, /setDragImage\(dragImage, 18, 18\)/);
  assert.match(appSource, /kind: "background"[\s\S]*color: previewColor/);
  assert.match(cssSource, /\.clipOptionsIcon/);
  assert.match(cssSource, /--clip-option-bg/);
  assert.match(cssSource, /\.dragPreviewGhost/);
  assert.match(cssSource, /--drop-preview-border/);
  assert.match(cssSource, /\.dropTargetHighlight\[data-drop-kind="background"\]::before/);
  assert.match(cssSource, /\.previewOverlayHandle\[data-handle="n"\][\s\S]*width:18px/);
  assert.match(cssSource, /\.previewOverlayHandle\[data-handle="e"\][\s\S]*height:18px/);
  assert.match(koSource, /프로젝트 저장 \(Ctrl\+S\)/);
  assert.match(koSource, /프로젝트 불러오기/);
  assert.match(enSource, /Save Project \(Ctrl\+S\)/);
  assert.match(enSource, /Load Project/);
});

test("korean drawtext subtitles prefer a Korean-capable font", () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");
  const appSource = fs.readFileSync(path.join(repoRoot, "renderer", "app.js"), "utf8");
  const effectSource = fs.readFileSync(path.join(repoRoot, "renderer", "effect_defs.js"), "utf8");
  const htmlSource = fs.readFileSync(path.join(repoRoot, "renderer", "index.html"), "utf8");
  assert.match(mainSource, /function hasKoreanText/);
  assert.match(mainSource, /getTextScriptProfile\(sampleText\)/);
  assert.match(mainSource, /function fontSupportsKoreanText/);
  assert.match(mainSource, /function fontSupportsText/);
  assert.match(mainSource, /fontSupportsText\(customPath, sampleText\) === true/);
  assert.match(mainSource, /AppleSDGothicNeo\.ttc/);
  assert.match(mainSource, /malgunbd\.ttf/);
  assert.match(mainSource, /function resolveVerifiedRenderFont/);
  assert.match(appSource, /const BASE_FONT_FAMILIES = \["Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK KR"/);
  assert.match(appSource, /fontFamily: String\(defaults\.fontFamily \|\| "Malgun Gothic"\)/);
  assert.match(appSource, /strokeWidth: Math\.max\(0, Number\(defaults\.strokeWidth \?\? 0\)\)/);
  assert.match(effectSource, /fontFamily: "Malgun Gothic"/);
  assert.match(effectSource, /strokeWidth: 0/);
  assert.match(htmlSource, /value="0" \/>[\s\S]*?<span id="overlayStrokeWidthValue" class="miniValue">0px<\/span>/);
});

test("render preflight, textfile drawtext, canvas text fallback, and preview shell tokens stay wired", () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");
  const appSource = fs.readFileSync(path.join(repoRoot, "renderer", "app.js"), "utf8");
  const overlaySource = fs.readFileSync(path.join(repoRoot, "renderer", "overlay_engine.js"), "utf8");
  const hostSource = fs.readFileSync(path.join(repoRoot, "renderer", "fx_render_host.js"), "utf8");
  const renderWindowSource = fs.readFileSync(path.join(repoRoot, "renderer", "render_window.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(repoRoot, "renderer", "styles.css"), "utf8");

  assert.match(mainSource, /const RENDER_PREFLIGHT_TIMEOUT_MS = 15000/);
  assert.match(mainSource, /const RENDER_NO_PROGRESS_HARD_TIMEOUT_MS = 120000/);
  assert.match(mainSource, /async function preflightRenderProject/);
  assert.match(mainSource, /function sanitizeRenderProjectForFfmpeg/);
  assert.match(mainSource, /function collectPreflightSampleTimes/);
  assert.match(mainSource, /function getFfmpegCapabilities/);
  assert.match(mainSource, /function testFfmpegDrawtextFont/);
  assert.match(mainSource, /function writeDrawtextTextFile/);
  assert.match(mainSource, /textfile='\$\{escapeFilterPath\(textFile\)\}'/);
  assert.match(mainSource, /function renderCanvasTextOverlaySource/);
  assert.match(mainSource, /renderTextSequenceToDir/);
  assert.match(mainSource, /_dropWaveDisplaceFallback/);
  assert.match(mainSource, /render_watchdog_timeout/);

  assert.match(overlaySource, /function renderTextFrameToDataUrl/);
  assert.match(hostSource, /async function renderTextSequenceToDir/);
  assert.match(hostSource, /new FontFace/);
  assert.match(renderWindowSource, /preflight_project: "프로젝트 검사 중"/);
  assert.match(renderWindowSource, /preflight_canvas_text: "안전한 텍스트 렌더링으로 전환 중"/);
  assert.match(renderWindowSource, /render_watchdog_timeout: "응답 없음 감지, 렌더 프로세스 중단"/);
  assert.match(cssSource, /--preview-stage-bg:#f5f7fa/);
  assert.match(cssSource, /--preview-monitor-bg:#0b0f14/);
  assert.match(cssSource, /#panelRight\{[\s\S]*background:var\(--preview-shell-bg\)/);
  assert.match(appSource, /renderHints/);
  assert.match(appSource, /hasNonAsciiText/);
});

test("render sanitize and Korean font verification produce a safe render plan", () => {
  const api = loadMainHarness();
  assert.equal(api.containsNonAsciiText("안녕하세요"), true);
  const profile = api.getTextScriptProfile("안녕하세요");
  assert.equal(profile.hasHangul, true);
  assert.equal(profile.hasNonAscii, true);

  const target = { ...api.resToWH("FHD", "16:9"), fps: 30, resolutionName: "FHD", aspectRatio: "16:9" };
  const sanitized = api.sanitizeRenderProjectForFfmpeg({
    videoClips: [{
      id: "color",
      type: "color",
      color: "#ffffff",
      start: -1,
      duration: 0,
      timelineDuration: 0,
      in: 0,
      out: 0,
      section: 1
    }],
    audioItems: [],
    overlayItems: [{
      id: "txt",
      overlayType: "text",
      text: "안녕하세요",
      start: -3,
      duration: 0,
      opacity: 2,
      strokeWidth: Number.NaN,
      x: 2,
      y: -1,
      transitionInDurationSec: 2,
      transitionOutDurationSec: 2
    }]
  }, target);

  assert.equal(sanitized.fatalErrors.length, 0);
  assert.ok(sanitized.warnings.some((warning) => warning.includes("duration_clamped")));
  assert.equal(sanitized.project.videoClips[0].start, 0);
  assert.ok(sanitized.project.videoClips[0].timelineDuration >= 0.01);
  assert.equal(sanitized.project.overlayItems[0].start, 0);
  assert.equal(sanitized.project.overlayItems[0].opacity, 1);
  assert.equal(sanitized.project.overlayItems[0].strokeWidth, 0);
  assert.equal(sanitized.project.overlayItems[0].x, 1);
  assert.equal(sanitized.project.overlayItems[0].y, 0);
  assert.ok(
    sanitized.project.overlayItems[0].transitionInDurationSec
      + sanitized.project.overlayItems[0].transitionOutDurationSec
      <= sanitized.project.overlayItems[0].duration
  );

  const samples = api.collectPreflightSampleTimes(sanitized.project, target);
  assert.ok(samples.length <= 12);
  assert.ok(samples.some((sample) => /text:start/.test(sample.reason)));

  const font = api.resolveVerifiedRenderFont({
    id: "korean",
    overlayType: "text",
    text: "안녕하세요",
    fontFamily: "Definitely Missing Sans",
    fontFile: path.join(api.tempRoot, "missing.ttf")
  });
  assert.equal(font.profile.hasHangul, true);
  assert.ok(font.canUseDrawtext ? !!font.fontFile : font.requiresCanvasFallback);
});

test("tiny combined render with background, chroma, subtitles, and drop-wave finalizes", { timeout: 45000 }, async () => {
  const api = loadMainHarness();
  const inputPath = path.join(api.tempRoot, "green-source.mp4");
  const outputPath = path.join(api.tempRoot, "combined-output.mp4");
  await execFileAsync(ffmpegPath, [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=0x00ff00:s=160x120:r=10:d=0.5",
    "-an",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    inputPath
  ], { timeout: 15000 });

  const project = {
    videoClips: [{
      id: "green",
      internalPath: inputPath,
      originalPath: inputPath,
      in: 0,
      out: 0.5,
      start: 0,
      timelineDuration: 0.5,
      section: 1,
      audioEnabled: false,
      meta: { duration: 0.5, fps: 10, width: 160, height: 120, hasAudio: false },
      chromaKeyEnabled: true,
      chromaKeyColor: "#00FF00",
      chromaKeySimilarity: 0.22,
      chromaKeyBlend: 0.06
    }],
    audioItems: [],
    overlayItems: [
      {
        id: "subtitle",
        overlayType: "text",
        text: "Smoke",
        start: 0,
        duration: 0.5,
        x: 0.5,
        y: 0.5,
        fontSize: 42,
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 2,
        opacity: 1
      },
      {
        id: "wave",
        overlayType: "drop_wave",
        start: 0.05,
        duration: 0.3,
        x: 0.5,
        y: 0.5,
        radius: 0.08,
        amplitude: 0.012,
        waveCount: 2,
        waveSpacing: 0.04,
        speed: 1,
        opacity: 1
      }
    ]
  };
  const settings = {
    fps: 10,
    resolutionName: "SD",
    aspectRatio: "9:16",
    container: "MP4",
    renderMode: "video",
    backgroundColor: "#123456"
  };

  const result = await api.renderProject({ project, settings, region: null, outputPath }, {});
  assert.equal(result.outputPath, outputPath);
  assert.equal(await api.validateFinalOutputPath(outputPath, null, "combined_smoke"), outputPath);
});

test("timeline UI and render paths use 0.01 second time granularity", () => {
  const appSource = fs.readFileSync(path.join(repoRoot, "renderer", "app.js"), "utf8");
  const htmlSource = fs.readFileSync(path.join(repoRoot, "renderer", "index.html"), "utf8");
  const mainSource = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");
  const overlayEngineSource = fs.readFileSync(path.join(repoRoot, "renderer", "overlay_engine.js"), "utf8");

  assert.match(appSource, /const MIN_TIMELINE_CLIP_SEC = 0\.01;/);
  assert.match(appSource, /const TIMELINE_TIME_STEP_SEC = 0\.01;/);
  assert.match(appSource, /return snapTimelineTimeSec\(safe\)\.toFixed\(2\);/);
  assert.match(htmlSource, /id="curTime">0\.00</);
  assert.match(htmlSource, /id="durTime">0\.00</);
  assert.match(htmlSource, /id="videoSourceInInput"[^>]*step="0\.01"/);
  assert.match(htmlSource, /id="overlayFadeInInput"[^>]*step="0\.01"/);
  assert.match(mainSource, /const TIMELINE_TIME_STEP_SEC = 0\.01;/);
  assert.match(mainSource, /const MIN_AUDIO_CLIP_SEC = TIMELINE_TIME_STEP_SEC;/);
  assert.match(mainSource, /const FAST_RENDER_EPSILON = TIMELINE_TIME_STEP_SEC;/);
  assert.match(overlayEngineSource, /const MIN_OVERLAY_CLIP_SEC = 0\.01;/);
});

test("timeline modules snap and bound edit times at 0.01 seconds", () => {
  const transportApi = require(path.join(repoRoot, "lib", "timeline_transport"));
  const graph = require(path.join(repoRoot, "lib", "render_graph"));
  const clipVisuals = require(path.join(repoRoot, "lib", "clip_visuals"));

  const seen = [];
  const transport = transportApi.createTransport({
    getDuration: () => 1,
    onTime: (time) => seen.push(time)
  });
  transport.seek(0.056);
  assert.equal(transport.getCurrentTime(), 0.06);
  assert.equal(seen.at(-1), 0.06);

  assert.equal(graph.normalizeTransition({ type: "fade", duration: 0.005 }).duration, 0.01);
  assert.equal(clipVisuals.MIN_SOURCE_DURATION, 0.01);

  const analysis = graph.analyzeProject({
    videoClips: [
      { id: "a", start: 0, in: 0, out: 0.5, timelineDuration: 0.5, section: 1 },
      { id: "b", start: 0.51, in: 0, out: 0.5, timelineDuration: 0.5, section: 1 }
    ],
    transitions: {}
  });
  assert.equal(analysis.boundaries[0].transitionEligible, true);

  const tooWideGap = graph.analyzeProject({
    videoClips: [
      { id: "a", start: 0, in: 0, out: 0.5, timelineDuration: 0.5, section: 1 },
      { id: "b", start: 0.52, in: 0, out: 0.5, timelineDuration: 0.5, section: 1 }
    ],
    transitions: {}
  });
  assert.equal(tooWideGap.boundaries[0].transitionEligible, false);
});

function makeElement(id) {
  return {
    id,
    value: "",
    textContent: "",
    checked: false,
    disabled: false,
    style: {},
    options: [],
    classList: {
      values: new Set(),
      toggle(name, force) {
        const enabled = force === undefined ? !this.values.has(name) : !!force;
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      }
    },
    appendChild(child) {
      this.options.push(child);
    },
    addEventListener(type, fn) {
      this[`on${type}`] = fn;
    },
    closest() {
      return makeElement(`${id}-closest`);
    }
  };
}

function loadRenderWindowHarness(initialState = { status: "idle", percent: 0, jobId: 0 }) {
  const elements = new Map();
  const ids = [
    "btnRenderSettings",
    "btnRenderModeSwitch",
    "renderSettingsPanel",
    "rwFps",
    "rwRes",
    "rwAspect",
    "rwFmt",
    "audioFmtRow",
    "rwAudioFmt",
    "renderDots",
    "barFill",
    "meta",
    "chkOpenFolder",
    "btnResume",
    "btnPause",
    "btnStop",
    "btnStart",
    "btnCancel"
  ];
  ids.forEach((id) => elements.set(id, makeElement(id)));
  let renderStateCallback = null;
  const calls = [];
  const sandbox = {
    console,
    Promise,
    setInterval: () => 1,
    clearInterval() {},
    confirm: () => true,
    document: {
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement(tag) {
        return makeElement(tag);
      }
    },
    window: {
      pearl: {
        renderControl: async (...args) => {
          calls.push(args);
          return { ok: true };
        },
        getRenderState: async () => initialState,
        onRenderState(fn) {
          renderStateCallback = fn;
        }
      },
      close() {
        calls.push(["close"]);
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(repoRoot, "renderer", "render_window.js"), "utf8"),
    sandbox,
    { filename: path.join(repoRoot, "renderer", "render_window.js") }
  );
  return {
    elements,
    calls,
    async flush() {
      await Promise.resolve();
      await Promise.resolve();
    },
    applyState(state) {
      assert.equal(typeof renderStateCallback, "function");
      renderStateCallback(state);
    }
  };
}

test("render window ignores stale job state and resets idle cancel latch", async () => {
  const ui = loadRenderWindowHarness({ status: "idle", percent: 0, jobId: 0 });
  await ui.flush();

  ui.applyState({ jobId: 1, status: "running", percent: 42, timemark: "00:00:03.70" });
  assert.equal(ui.elements.get("barFill").style.width, "42%");
  assert.equal(ui.elements.get("btnCancel").disabled, false);

  ui.applyState({ jobId: 2, status: "running", percent: 10, timemark: "00:00:00.90" });
  assert.equal(ui.elements.get("barFill").style.width, "10%");
  ui.applyState({ jobId: 1, status: "done", percent: 100, timemark: "00:00:08.90" });
  assert.equal(ui.elements.get("barFill").style.width, "10%");
  assert.notEqual(ui.elements.get("renderDots").textContent, "Done!");

  ui.applyState({ jobId: 2, status: "idle", percent: 0, timemark: "" });
  assert.equal(ui.elements.get("barFill").style.width, "0%");
  assert.equal(ui.elements.get("btnCancel").disabled, true);
  assert.equal(ui.elements.get("renderDots").textContent, "");
});

test("render window shows granular finalizing stage labels", async () => {
  const ui = loadRenderWindowHarness({ status: "idle", percent: 0, jobId: 0 });
  await ui.flush();

  ui.applyState({
    jobId: 3,
    status: "running",
    percent: 99.4,
    timemark: "00:00:04.26",
    durationSec: 4.3,
    message: "moving_output"
  });
  assert.equal(ui.elements.get("renderDots").textContent, "출력 파일 이동 중...");
  assert.match(ui.elements.get("meta").textContent, /출력 파일 이동 중/);
  assert.equal(ui.elements.get("barFill").style.width, "99.65%");

  ui.applyState({
    jobId: 3,
    status: "running",
    percent: 99.8,
    timemark: "00:00:04.26",
    durationSec: 4.3,
    message: "validating_output"
  });
  assert.equal(ui.elements.get("renderDots").textContent, "최종 파일 확인 중...");
  assert.match(ui.elements.get("meta").textContent, /최종 파일 확인 중/);
  assert.equal(ui.elements.get("barFill").style.width, "99.9%");
});
test("render window syncs aspect ratio setting changes", async () => {
  const ui = loadRenderWindowHarness({ status: "idle", percent: 0, jobId: 0 });
  await ui.flush();

  ui.applyState({
    jobId: 4,
    status: "idle",
    percent: 0,
    settings: {
      fps: 30,
      resolutionName: "FHD",
      aspectRatio: "9:16",
      container: "MP4",
      renderMode: "video",
      audioContainer: "MP3"
    }
  });
  assert.equal(ui.elements.get("rwAspect").value, "9:16");

  ui.elements.get("rwAspect").value = "20:9";
  await ui.elements.get("rwAspect").onchange();
  const updateCall = ui.calls.find(([action]) => action === "update-settings");
  assert.equal(updateCall?.[1]?.settings?.aspectRatio, "20:9");
});

const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("pearl", {
  pickMediaFiles: () => ipcRenderer.invoke("pick-media-files"),
  importMedia: (paths) => ipcRenderer.invoke("import-media", paths),
  importDroppedFiles: (files) => ipcRenderer.invoke("import-dropped-files", files),
  createBackgroundColorClip: (payload) => ipcRenderer.invoke("create-background-color-clip", payload),
  probeMediaDurations: (paths) => ipcRenderer.invoke("probe-media-durations", paths),
  saveProject: (projectJson, preferredPath = "") => ipcRenderer.invoke("save-project", projectJson, preferredPath),
  saveProjectToPath: (projectJson, filePath) => ipcRenderer.invoke("save-project-to-path", projectJson, filePath),
  loadProject: () => ipcRenderer.invoke("load-project"),
  saveAutosaveCache: (payload) => ipcRenderer.invoke("save-autosave-cache", payload),
  loadAutosaveCache: () => ipcRenderer.invoke("load-autosave-cache"),
  clearAutosaveCache: () => ipcRenderer.invoke("clear-autosave-cache"),
  showUnsavedCloseDialog: () => ipcRenderer.invoke("show-unsaved-close-dialog"),
  showAutosaveRestoreDialog: () => ipcRenderer.invoke("show-autosave-restore-dialog"),
  showImageCutoutCloseDialog: () => ipcRenderer.invoke("show-image-cutout-close-dialog"),
  saveImageCutoutAsset: (payload) => ipcRenderer.invoke("save-image-cutout-asset", payload),
  render: (payload) => ipcRenderer.invoke("render", payload),
  openRenderWindow: (config) => ipcRenderer.invoke("open-render-window", config),
  renderControl: (action, payload) => ipcRenderer.invoke("render-control", action, payload),
  getRenderState: () => ipcRenderer.invoke("get-render-state"),
  pickOutputFolder: () => ipcRenderer.invoke("pick-output-folder"),
  getOutputFolder: () => ipcRenderer.invoke("get-output-folder"),
  setOutputFolder: (dirPath) => ipcRenderer.invoke("set-output-folder", dirPath),
  readFileBuffer: (filePath) => ipcRenderer.invoke("read-file-buffer", filePath),
  getPathForFile: (file) => {
    try {
      if (!file || !webUtils?.getPathForFile) return "";
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  },
  onRenderProgress: (fn) => ipcRenderer.on("render-progress", (_e, p) => fn(p)),
  onRenderState: (fn) => ipcRenderer.on("render-state", (_e, s) => fn(s))
});

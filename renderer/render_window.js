(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    btnRenderSettings: $("btnRenderSettings"),
    btnRenderModeSwitch: $("btnRenderModeSwitch"),
    settingsPanel: $("renderSettingsPanel"),
    rwFps: $("rwFps"),
    rwRes: $("rwRes"),
    rwAspect: $("rwAspect"),
    rwFmt: $("rwFmt"),
    audioFmtRow: $("audioFmtRow"),
    rwAudioFmt: $("rwAudioFmt"),
    dots: $("renderDots"),
    statusChip: $("renderStatusChip"),
    percentReadout: $("percentReadout"),
    fill: $("barFill"),
    meta: $("meta"),
    chk: $("chkOpenFolder"),
    btnResume: $("btnResume"),
    btnPause: $("btnPause"),
    btnStop: $("btnStop"),
    btnStart: $("btnStart"),
    btnCancel: $("btnCancel"),
  };

  let tick = 0;
  let dotsTimer = null;
  let pseudoTimer = null;
  let uiPercent = 0;
  let renderStarted = false;
  let currentJobId = 0;
  let renderMode = "video";
  const fpsOptions = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  const resOptions = ["SD", "HD", "FHD", "QHD", "UHD / 4K"];
  const aspectRatioOptions = [
    ["16:9", "16:9 - 기본 와이드"],
    ["16:10", "16:10 - 노트북/태블릿"],
    ["4:3", "4:3 - 클래식"],
    ["1:1", "1:1 - 정사각형"],
    ["9:16", "9:16 - 모바일 세로"],
    ["10:16", "10:16 - 태블릿 세로"],
    ["20:9", "20:9 - 모바일 와이드"],
    ["21:9", "21:9 - 시네마 와이드"]
  ];
  const fmtOptions = ["MP4", "MOV", "AVI", "MKV", "WMV", "WebM"];
  const audioFmtOptions = ["WAV", "AIFF", "FLAC", "MP3", "AAC"];
  const renderStageLabels = {
    encoder_finished: "인코더 종료 확인 중",
    moving_output: "출력 파일 이동 중",
    wrapping_up_render: "마무리 중",
    finalizing_output: "저장 마무리 중",
    cleaning_up_render: "임시 파일 정리 중",
    validating_output: "최종 파일 확인 중"
  };

  function getRenderStageLabel(message) {
    return renderStageLabels[String(message || "")] || "";
  }

  function fillRenderSettingSelects() {
    if (els.rwFps?.options?.length) return;
    fpsOptions.forEach(v => {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = `${v}fps`;
      els.rwFps?.appendChild(o);
    });
    resOptions.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      els.rwRes?.appendChild(o);
    });
    aspectRatioOptions.forEach(([value, label]) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      els.rwAspect?.appendChild(o);
    });
    fmtOptions.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      els.rwFmt?.appendChild(o);
    });
    audioFmtOptions.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      els.rwAudioFmt?.appendChild(o);
    });
  }

  function refreshModeUI() {
    const isAudio = renderMode === "audio";
    els.audioFmtRow?.classList.toggle("hidden", !isAudio);
    els.rwFps?.closest(".settingRow")?.classList.toggle("hidden", isAudio);
    els.rwRes?.closest(".settingRow")?.classList.toggle("hidden", isAudio);
    els.rwAspect?.closest(".settingRow")?.classList.toggle("hidden", isAudio);
    els.rwFmt?.closest(".settingRow")?.classList.toggle("hidden", isAudio);
    if (els.btnRenderModeSwitch) {
      els.btnRenderModeSwitch.textContent = isAudio ? "Switch to Video Render" : "Switch to Audio Render";
    }
  }

  function applySettingValues(settings) {
    if (!settings) return;
    renderMode = (settings.renderMode === "audio") ? "audio" : "video";
    if (els.rwFps) els.rwFps.value = String(settings.fps ?? 30);
    if (els.rwRes) els.rwRes.value = settings.resolutionName ?? "FHD";
    if (els.rwAspect) els.rwAspect.value = settings.aspectRatio ?? "16:9";
    if (els.rwFmt) els.rwFmt.value = settings.container ?? "MP4";
    if (els.rwAudioFmt) els.rwAudioFmt.value = settings.audioContainer ?? "MP3";
    refreshModeUI();
  }

  async function pushSettingsToMain() {
    const settings = {
      fps: Number(els.rwFps?.value || 30),
      resolutionName: els.rwRes?.value || "FHD",
      aspectRatio: els.rwAspect?.value || "16:9",
      container: els.rwFmt?.value || "MP4",
      renderMode,
      audioContainer: els.rwAudioFmt?.value || "MP3"
    };
    await window.pearl.renderControl("update-settings", { settings });
  }

  function stopDots() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  function startDots() {
    if (dotsTimer) return;
    dotsTimer = setInterval(() => {
      tick = (tick + 1) % 4;
      els.dots.textContent = "렌더링" + ".".repeat(tick);
    }, 200);
  }

  function stopPseudoProgress() {
    if (pseudoTimer) {
      clearInterval(pseudoTimer);
      pseudoTimer = null;
    }
  }

  function startPseudoProgress() {
    if (pseudoTimer) return;
    pseudoTimer = setInterval(() => {
      if (uiPercent >= 92) return;
      uiPercent = Math.min(92, uiPercent + 0.35);
      els.fill.style.width = `${uiPercent.toFixed(2)}%`;
    }, 120);
  }

  function applyState(s) {
    const jobId = Number(s?.jobId || 0);
    if (jobId && currentJobId && jobId < currentJobId) return;
    if (jobId !== currentJobId) {
      currentJobId = jobId;
      uiPercent = 0;
      renderStarted = false;
      stopPseudoProgress();
      stopDots();
    }
    const pct = Number(s?.percent || 0);
    const message = String(s?.message || "");
    const status = s?.status || "idle";
    if (document.body?.dataset) document.body.dataset.renderStatus = status;
    if ((status === "idle" || status === "stopped") && pct <= 0) {
      uiPercent = 0;
      if (status === "idle") renderStarted = false;
    } else {
      uiPercent = Math.max(uiPercent, Math.max(0, Math.min(100, pct)));
    }
    if (message === "encoder_finished") uiPercent = Math.max(uiPercent, 99.35);
    if (message === "moving_output") uiPercent = Math.max(uiPercent, 99.65);
    if (message === "wrapping_up_render") uiPercent = Math.max(uiPercent, 99.6);
    if (message === "finalizing_output") uiPercent = Math.max(uiPercent, 99.8);
    if (message === "cleaning_up_render") uiPercent = Math.max(uiPercent, 99.75);
    if (message === "validating_output") uiPercent = Math.max(uiPercent, 99.9);
    if (status === "done") uiPercent = 100;
    els.fill.style.width = `${uiPercent}%`;
    if (els.percentReadout) els.percentReadout.textContent = `${uiPercent.toFixed(1)}%`;
    if (els.statusChip) {
      const chipLabels = {
        idle: "Idle",
        running: "Running",
        paused: "Paused",
        done: "Done",
        error: "Error",
        stopped: "Stopped"
      };
      els.statusChip.textContent = chipLabels[status] || String(status || "Idle");
    }
    const tm = s?.timemark || "";
    const durationSec = Number(s?.durationSec || 0);
    const debugLogPath = String(s?.debugLogPath || "");
    const durText = durationSec > 0 ? ` / ${durationSec.toFixed(1)}s` : "";
    const stageLabel = getRenderStageLabel(message);
    const stageText = stageLabel ? ` · ${stageLabel}` : "";
    els.meta.textContent = `${pct.toFixed(1)}% ${tm}${durText}${stageText}`;

    const running = s?.status === "running";
    const paused = s?.status === "paused";
    const active = running || paused;
    const hasProgress = pct > 0 || active || status === "done" || status === "error" || status === "stopped";
    if (hasProgress) renderStarted = true;

    els.btnStart.disabled = active;
    els.btnPause.disabled = !running;
    els.btnResume.disabled = !paused;
    els.btnStop.disabled = !active;
    els.btnCancel.disabled = !renderStarted;

    // Requested latched visual behavior:
    // running  -> Resume looks pressed/disabled
    // paused   -> Pause looks pressed/disabled
    els.btnResume.classList.toggle("latched", running);
    els.btnPause.classList.toggle("latched", paused);

    if (status === "done") {
      stopPseudoProgress();
      stopDots();
      els.dots.textContent = "완료";
    } else if (status === "error") {
      stopPseudoProgress();
      stopDots();
      els.dots.textContent = "렌더 실패";
      els.meta.textContent = debugLogPath
        ? `오류 로그: ${debugLogPath}`
        : (s?.message || "렌더 오류");
    } else if (status === "stopped") {
      stopPseudoProgress();
      stopDots();
      els.dots.textContent = "Stopped";
    } else if (stageLabel) {
      stopPseudoProgress();
      stopDots();
      els.dots.textContent = `${stageLabel}...`;
    } else if (running || paused) {
      if (running) startPseudoProgress();
      if (renderStarted) startDots();
    } else {
      stopPseudoProgress();
      stopDots();
      els.dots.textContent = renderStarted ? "렌더링" : "";
    }
    applySettingValues(s?.settings || null);
  }

  els.btnStart.onclick = async () => {
    renderStarted = true;
    uiPercent = 0;
    els.fill.style.width = "0%";
    els.btnCancel.disabled = false;
    startPseudoProgress();
    startDots();
    await pushSettingsToMain();
    await window.pearl.renderControl("start", { openFolderAfter: !!els.chk.checked });
  };
  els.btnPause.onclick = async () => { await window.pearl.renderControl("pause"); };
  els.btnResume.onclick = async () => { await window.pearl.renderControl("resume"); };
  els.btnStop.onclick = async () => { await window.pearl.renderControl("stop"); };
  els.btnCancel.onclick = async () => {
    const st = await window.pearl.getRenderState();
    const pct = Number(st?.percent || 0);
    const status = st?.status || "idle";
    const hasProgress = pct > 0 || status === "running" || status === "paused" || status === "done" || status === "error" || status === "stopped";
    if (hasProgress) {
      const ok = confirm("현재 모든 진행상황을 잃습니다. 진행하시겠습니까?");
      if (!ok) return;
    }
    await window.pearl.renderControl("cancel");
    stopPseudoProgress();
    window.close();
  };

  els.btnRenderSettings?.addEventListener("click", () => {
    els.settingsPanel?.classList.toggle("hidden");
  });
  els.btnRenderModeSwitch?.addEventListener("click", async () => {
    renderMode = renderMode === "audio" ? "video" : "audio";
    refreshModeUI();
    await pushSettingsToMain();
  });
  els.rwFps?.addEventListener("change", pushSettingsToMain);
  els.rwRes?.addEventListener("change", pushSettingsToMain);
  els.rwAspect?.addEventListener("change", pushSettingsToMain);
  els.rwFmt?.addEventListener("change", pushSettingsToMain);
  els.rwAudioFmt?.addEventListener("change", pushSettingsToMain);

  fillRenderSettingSelects();
  refreshModeUI();
  window.pearl.onRenderState((s) => applyState(s));
  window.pearl.getRenderState().then(applyState);
})();

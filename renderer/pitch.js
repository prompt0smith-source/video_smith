/*
  Pitch graph (very lightweight):
  - decode audio via Web Audio
  - run pitchfinder.YIN on small windows
  - draw polyline on canvas
*/
(() => {
  const Pitchfinder = window.Pitchfinder || requirePitchfinderFallback();

  function requirePitchfinderFallback() {
    // In Electron renderer with CSP, we can't require directly.
    // This fallback exists only to avoid hard crash if bundling changes.
    return null;
  }

  async function computePitchSeriesFromArrayBuffer(arrayBuffer, opts = {}) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

    const data = audioBuf.getChannelData(0);
    const sampleRate = audioBuf.sampleRate;

    const winSize = opts.winSize || 2048;
    const hop = opts.hop || 512;

    // pitchfinder in browser global is not guaranteed; we attach via preload? we won't.
    // Instead, we use a tiny YIN implementation embedded here if Pitchfinder not present.
    const yin = (Pitchfinder && Pitchfinder.YIN) ? Pitchfinder.YIN({ sampleRate }) : makeSimpleYin(sampleRate);

    const series = [];
    for (let i = 0; i + winSize < data.length; i += hop) {
      const slice = data.subarray(i, i + winSize);
      const f0 = yin(slice) || 0;
      const t = i / sampleRate;
      series.push({ t, f0 });
    }
    audioCtx.close();
    return { series, duration: audioBuf.duration };
  }

  function drawPitch(canvas, series, duration) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background grid
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fbfbfb";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(17,24,39,.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = (h * i) / 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Determine pitch range (ignore zeros)
    const vals = series.map(p => p.f0).filter(v => v > 0);
    if (!vals.length) return;

    const minF = Math.max(50, Math.min(...vals));
    const maxF = Math.min(1000, Math.max(...vals));

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;

    for (const p of series) {
      const x = (p.t / duration) * w;
      if (p.f0 <= 0) { started = false; continue; }
      const y = h - ((p.f0 - minF) / (maxF - minF)) * h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // labels
    ctx.fillStyle = "rgba(17,24,39,.55)";
    ctx.font = "8px Pretendard, 'Noto Sans KR', ui-sans-serif, system-ui";
    ctx.fillText(`${Math.round(minF)}Hz`, 8, h - 8);
    ctx.fillText(`${Math.round(maxF)}Hz`, 8, 14);
  }

  // Simple fallback YIN (not as accurate as pitchfinder)
  function makeSimpleYin(sampleRate) {
    return function yin(buf) {
      // Autocorrelation-based rough estimate
      const n = buf.length;
      let bestLag = -1;
      let best = 0;
      const minLag = Math.floor(sampleRate / 1000); // 1000Hz
      const maxLag = Math.floor(sampleRate / 50);   // 50Hz

      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
          sum += buf[i] * buf[i + lag];
        }
        if (sum > best) {
          best = sum;
          bestLag = lag;
        }
      }
      if (bestLag <= 0) return 0;
      return sampleRate / bestLag;
    };
  }

  window.PearlPitch = { computePitchSeriesFromArrayBuffer, drawPitch };
})();

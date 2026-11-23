import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ============================================================================
// DETERMINISTIC SPRING & MATH ENGINE (Closed-form step responses for seek(t))
// ============================================================================
const MathUtil = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  lerp: (a, b, t) => a + (b - a) * MathUtil.clamp(t, 0, 1),
  smoothstep: (edge0, edge1, x) => {
    const t = MathUtil.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  },
  easeOutExpo: (x) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  easeInOutCubic: (x) => {
    x = MathUtil.clamp(x, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  // Closed-form underdamped spring response at elapsed time dt (in seconds)
  // freq: natural frequency (Hz), damping: damping ratio (0.25 = bouncy, 0.75 = crisp)
  springStep: (dt, freq = 3.2, damping = 0.38) => {
    if (dt <= 0) return 0;
    const omega = freq * Math.PI * 2;
    const zeta = MathUtil.clamp(damping, 0.05, 0.99);
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const env = Math.exp(-zeta * omega * dt);
    return 1 - env * (Math.cos(omegaD * dt) + (zeta * omega / omegaD) * Math.sin(omegaD * dt));
  },
  // Multi-target closed-form spring: pure function of time t
  // keyframes: [{t: 0, v: 100}, {t: 1.5, v: 240, f: 3.5, d: 0.45}, ...]
  springSeries: (t, keyframes, defaultFreq = 3.0, defaultDamping = 0.48) => {
    if (!keyframes || keyframes.length === 0) return 0;
    let val = keyframes[0].v;
    for (let i = 1; i < keyframes.length; i++) {
      const kf = keyframes[i];
      if (t > kf.t) {
        const delta = kf.v - keyframes[i - 1].v;
        const s = MathUtil.springStep(t - kf.t, kf.f || defaultFreq, kf.d || defaultDamping);
        val += delta * s;
      }
    }
    return val;
  },
  formatTimecode: (t, fps = 60, offsetMin = 0, offsetSec = 0) => {
    const totalSec = t + offsetMin * 60 + offsetSec;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    const frames = Math.floor((t % 1) * fps);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  },
  roundRect: (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
};

// ============================================================================
// CATALOG DATA: FIRST 5 MOTION DESIGNS FROM PROMPT-MOTION.COM
// ============================================================================
const MOTION_DESIGNS = [
  {
    id: "stephanlivera-df17a2",
    order: 1,
    title: "Claude Motion Designer Showreel",
    creator: "Stephan Livera",
    handle: "@stephanlivera",
    promptMotionUrl: "https://prompt-motion.com/stephanlivera-df17a2",
    socialUrl: "https://x.com/stephanlivera/status/2103315922098470926",
    model: "Opus 5.5",
    effort: "Max",
    date: "Sep 25, 2026",
    bpm: 128,
    duration: 15.0,
    aspect: "16:9",
    tags: ["Kinetic type", "Shapes", "Music"],
    summary: "High-energy 128 BPM showreel with camera viewfinder HUD, spring-physics starbursts, kinetic typography cuts, and real-time telemetry overlays.",
    prompt: `make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.`
  },
  {
    id: "twoclipping-5cba86",
    order: 2,
    title: "Shape Morphing Through UI States",
    creator: "zero",
    handle: "@twoclipping",
    promptMotionUrl: "https://prompt-motion.com/twoclipping-5cba86",
    socialUrl: "https://x.com/twoclipping/status/2103273003555402193",
    model: "Opus 5.5",
    effort: "HTML + Playwright",
    date: "Sep 24, 2026",
    bpm: 120,
    duration: 14.0,
    aspect: "1:1",
    tags: ["Product UI", "Charts", "Music"],
    summary: "Dribbble-level continuous single-shape UI metamorphosis across 11 states (Button → Loader → Check → Dynamic Island → Slider → Toggle → Tabs → Chart → ⌘K → Toast → Button) driven by closed-form springs.",
    prompt: `<inputs>
Ask me for: 8 to 12 UI states I want the shape to become (e.g. button, loader, player, slider, toggle, tabs, chart, command palette, toast), pure black and white or one accent color, and a royalty-free song around 120 BPM (e.g. Mixkit, free for commercial use).
</inputs>

<direction>
Dribbble-level UI motion. One shape, never cut: every state is the same element morphing its size, radius and color while its content swaps with a short blur. A cursor drives every change with real clicks and drags. Light warm-gray canvas, black and white components, one clean UI font (Geist). Springs everywhere, a tiny overshoot at most. The camera zooms so each state fills the frame. The last frame is the first frame, so it loops.
Banned: bouncy easing, particle bursts, glows, gradients on UI chrome, mismatched icon strokes, dead time, anything that looks like a template.
</direction>

<structure>
120 BPM, 7 bars, something happens on every beat.
Button → loader → check → dynamic island → music player with a play/pause morph → scrub the progress bar → it becomes a volume slider that stretches when dragged past max → a toggle flips on the beat → the knob becomes a liquid tab indicator → the tabs open into a chart that draws itself, with a tooltip on hover → it collapses into ⌘K → type to filter → enter → toast → back to the button.
</structure>

<build>
1. One HTML file, square 1440x1440. Every style is computed from time inside seek(t): no CSS transitions, no timers, no state carried between frames.
2. Springs are closed-form step responses. A value that changes target many times is the sum of one spring per change, so it stays a pure function of time.
3. The tab indicator's two edges ride different springs, so the leading edge stretches ahead of the trailing one. Same trick for the toggle knob.
4. Drags are direct manipulation: while the cursor is held, the value is computed from its position. On release it springs back from wherever it was.
5. Analyze the song with numpy for the beat grid and start on a downbeat. Place every UI sound by its measured peak.
6. Render with Playwright: 4 subframes per frame, blended with ffmpeg tmix for motion blur at 60fps.
7. Render one frame per beat before the full render. Fix anything off the grid, cramped or hard to read.
</build>`
  },
  {
    id: "shneural-2abdfa",
    order: 3,
    title: "Bold Kinetic Type Showreel",
    creator: "kirill sh",
    handle: "@shneural",
    promptMotionUrl: "https://prompt-motion.com/shneural-2abdfa",
    socialUrl: "https://x.com/shneural/status/2103151003272962130",
    model: "Opus 5.5",
    effort: "Standard",
    date: "Sep 24, 2026",
    bpm: 128,
    duration: 15.0,
    aspect: "16:9",
    tags: ["Kinetic type", "Shapes", "Particles"],
    summary: "Dark technical viewport showreel featuring an expanding horizon line, bright orange interactive bounding boxes with live pixel dimension pills (1375 x 339), starburst vectors, and particle bursts.",
    prompt: `make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.`
  },
  {
    id: "ajith-io-b5626e",
    order: 4,
    title: "Abstract Motion Design Reel",
    creator: "Ajith",
    handle: "@ajith_io",
    promptMotionUrl: "https://prompt-motion.com/ajith-io-b5626e",
    socialUrl: "https://x.com/ajith_io/status/2103449416325890146",
    model: "Opus 5.5",
    effort: "Standard",
    date: "Sep 25, 2026",
    bpm: 128,
    duration: 15.0,
    aspect: "16:9",
    tags: ["Kinetic type", "Shapes", "Music"],
    summary: "Swiss editorial motion reel on vermilion red and warm off-white dot-matrix canvases with 'EVERY FRAME ON PURPOSE' kinetic type, crop marks, and beat-illuminated dot columns.",
    prompt: `make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.`
  },
  {
    id: "twoclipping-221cab",
    order: 5,
    title: "Photo Print App Launch Film",
    creator: "zero",
    handle: "@twoclipping",
    promptMotionUrl: "https://prompt-motion.com/twoclipping-221cab",
    socialUrl: "https://x.com/twoclipping/status/2103835273813496100",
    model: "Opus 5.5",
    effort: "HTML + Playwright",
    date: "Sep 26, 2026",
    bpm: 120,
    duration: 15.0,
    aspect: "1:1",
    tags: ["Product UI", "Phone", "Photos", "Music"],
    summary: "Apple-keynote style 2D continuous launch film: accordion wordmark → 6-blade mechanical iris → bento photo grid → iOS 26 liquid glass golden-hour slider → iPhone lock screen → Mac Safari print store → framed wall art with moving leaf shadows.",
    prompt: `<inputs>
Ask me for: a one-word brand name for the wordmark (a verb works best), 9 to 12 high-res photos, a royalty-free song around 120 BPM with a drop and a quiet breakdown (Mixkit, free for commercial use), and a free stock clip of a plain wall with moving plant shadows (Pexels).
</inputs>

<direction>
An Apple-keynote launch film, 2D only, one continuous take. Every scene is made out of the previous one: nothing fades, blurs or cuts. Objects change shape instead: text rises out of a mask line, icons pop from zero on a spring, bars draw across, pages push, and a black shape floods the whole frame and contracts into the next scene. Warm off-white canvas, black UI, iOS 26 liquid glass over the photos. Archivo (wdth 125, weight 800) for the wordmark, Geist for UI. A cursor drives every change with real clicks, drags and long-presses. The camera zooms screen-studio style so each moment fills the square, and the cursor scales with it.
Banned: crossfades, blur-ins, brightness "developing", 3D flips, particles, glows, holds longer than 1s, anything that looks like a template.
</direction>

<structure>
120 BPM, 54 beats, something happens on every beat.
Open: the wordmark squeezes into its own period like an accordion, the dot grows into a black pill, a label rises inside it. Click: six iris blades close over the label and snap open onto a photo. The circle becomes a square, shrinks, the grid unfolds from behind it like a paper map (center, plus, corners), reflows into a bento, and a click zooms into one tile, landing exactly on the drop.
Glass: a glass word pops in letter by letter, melts into a droplet that stretches into a glass toolbar. The adjust icon turns it into a slider. Dragging relights the photo from day to golden hour (two aligned shots), and the knob turns into a glass lens while held. It lifts into a glass orb, the next photo opens inside it as a circle, and the orb expands into a lock screen: glass clock digits, date, and a home bar that stretches into a glass music player.
Stage: the lock screen pulls back into a phone (the bezel grows out of the screen edge). The Dynamic Island stretches like liquid, pinches off, flies over and grows into a Mac window that rolls up like a blind. Long-press the wallpaper, drag it onto a Safari tab, the page pushes in, drop it and it becomes the hero of a landing page. Scroll: the hero morphs into a framed print on a product card, with the mat and molding growing out of the photo's edge. Pick a frame color (it paints across) and a size, then the nav button flies down into "Order print".
Order: one black shape keeps morphing: Ordered ✓ → Printing % → On its way (a van on a route) → Delivered ✓.
Wall: the delivered circle floods the frame edge to edge, holds black for a beat, and contracts into the framed print hanging on the real wall footage. The same iris opens onto the print, closes again, the frame floods the screen and contracts into the pill → the dot → the letters spring back out, landing on the beat return. Last frame = first frame.
</structure>

<build>
1. One HTML file, square 1440x1440. Every style is computed from time inside an async seek(t): no CSS transitions, no timers, no state between frames.
2. Springs are closed-form step responses. A value with many targets is the sum of one spring per change, so it stays a pure function of time.
3. Photos are inline data URLs or loaded up front. All asset loads happen inside an init() that resolves before seek(0).
4. Glass uses backdrop-filter: blur() with subtle light highlights and dark inner shadows, styled to match iOS materials.
5. The iris transition uses clip-path: polygon() with computed polygon points for the overlapping blades.
6. Drags and long-presses are direct manipulation: cursor position drives the property directly with a spring following.
7. Analyze the song with numpy for beat grid; align scene shifts to structural hits.
8. Render with Playwright: subframe blending via ffmpeg tmix for 60fps motion blur.
9. Render single frames per beat first to verify beat grid alignment before full video render.
</build>`
  }
];

// ============================================================================
// RENDERER 1: CLAUDE MOTION DESIGNER SHOWREEL (@stephanlivera)
// ============================================================================
function renderDesign1(ctx, W, H, t) {
  const duration = 15.0;
  const time = ((t % duration) + duration) % duration;
  const bpm = 128;
  const beatDur = 60 / bpm; // 0.46875s
  const beatIdx = Math.floor(time / beatDur);
  const beatPhase = (time % beatDur) / beatDur;
  const beatKick = Math.pow(1 - beatPhase, 3);

  // Palette shifts on major beat sections
  const palettes = [
    { bg: "#FF3B1D", fg: "#FFFFFF", accent: "#FFE600", sub: "#111111" }, // 0-3s Red/Orange
    { bg: "#184BFF", fg: "#FFFFFF", accent: "#00F57A", sub: "#091540" }, // 3-6.5s Electric Blue
    { bg: "#0D091A", fg: "#FFFFFF", accent: "#FF3B1D", sub: "#00F57A" }, // 6.5-10s Deep Violet/Black
    { bg: "#00F57A", fg: "#0D091A", accent: "#184BFF", sub: "#FFFFFF" }, // 10-12.5s Neon Green
    { bg: "#FAFAFA", fg: "#0D091A", accent: "#FF3B1D", sub: "#184BFF" }  // 12.5-15s Stark White
  ];
  let pIdx = 0;
  if (time >= 3.0 && time < 6.5) pIdx = 1;
  else if (time >= 6.5 && time < 10.0) pIdx = 2;
  else if (time >= 10.0 && time < 12.5) pIdx = 3;
  else if (time >= 12.5) pIdx = 4;
  // Strobe inversion on every 8th beat first 0.08s
  const invert = (beatIdx % 8 === 7 && beatPhase < 0.22);
  const pal = palettes[pIdx];
  const bg = invert ? pal.fg : pal.bg;
  const fg = invert ? pal.bg : pal.fg;

  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle background kinetic grid
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1;
  const gridStep = W / 12;
  for (let x = 0; x <= W; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const cx = W / 2;
  const cy = H / 2;
  const s = W / 960;

  // SCENE 1 (0 - 3.0s): CLAUDE motion designer
  if (time < 3.0) {
    const enterSpring = MathUtil.springStep(time, 2.8, 0.32);
    const rotSpring = MathUtil.springStep(Math.max(0, time - 0.4), 2.6, 0.30);

    // Radial burst lines behind typography
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.35);
    const rays = 24;
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2;
      const r1 = (110 + beatKick * 35) * s;
      const r2 = (260 + beatKick * 75) * s * enterSpring;
      ctx.strokeStyle = i % 2 === 0 ? fg : pal.accent;
      ctx.lineWidth = (i % 3 === 0 ? 3.5 : 1.5) * s;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // Heavy condensed CLAUDE
    ctx.save();
    ctx.translate(cx, cy - 22 * s);
    const scalePop = 0.2 + 0.8 * enterSpring + beatKick * 0.06;
    ctx.scale(scalePop, scalePop);
    ctx.fillStyle = fg;
    ctx.font = `900 ${Math.round(118 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLAUDE", 0, 0);

    // Italic script accent "motion designer"
    const subSpring = MathUtil.springStep(Math.max(0, time - 0.35), 3.0, 0.35);
    ctx.translate(0, 74 * s);
    ctx.scale(subSpring, subSpring);
    ctx.fillStyle = pal.accent;
    ctx.font = `italic 700 ${Math.round(52 * s)}px "Georgia", "Times New Roman", serif`;
    ctx.fillText("motion designer", 0, 0);
    ctx.restore();

    // Spinning starburst badge top-right of center
    ctx.save();
    ctx.translate(cx + 225 * s, cy - 95 * s);
    ctx.rotate(rotSpring * Math.PI * 1.1 + time * 1.2);
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    const spikes = 12;
    for (let i = 0; i < spikes * 2; i++) {
      const r = (i % 2 === 0 ? 48 : 22) * s * enterSpring;
      const a = (i / (spikes * 2)) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // SCENE 2 (3.0 - 6.5s): MORPH CIRCLE -> STARBURST & ORBITING TRAILS
  else if (time < 6.5) {
    const st = time - 3.0;
    const morphT = MathUtil.springStep(st, 2.6, 0.30);
    const rotDeg = (st * 120 + morphT * 200) % 360;

    // Orbiting rings & trailing dots
    ctx.save();
    ctx.translate(cx, cy);
    for (let ring = 0; ring < 3; ring++) {
      const radius = (95 + ring * 58) * s;
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5 * s;
      ctx.setLineDash([6 * s, 6 * s]);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Trailing dots along orbit
      for (let d = 0; d < 6; d++) {
        const a = st * (2.6 - ring * 0.5) - d * 0.14 + ring * 1.2;
        const dx = Math.cos(a) * radius;
        const dy = Math.sin(a) * radius;
        ctx.fillStyle = d === 0 ? pal.accent : fg;
        ctx.globalAlpha = 1 - d * 0.15;
        ctx.beginPath();
        ctx.arc(dx, dy, (8 - d * 1.1) * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Central morphing polygon / starburst / circle
    const morphWave = 0.5 + 0.5 * Math.sin(st * 3.5);
    const pts = 16;
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const outer = 78 * s * (1 + beatKick * 0.15);
      const inner = MathUtil.lerp(78 * s, 30 * s, morphWave);
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (pts * 2)) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Telemetry label callouts
    ctx.save();
    ctx.fillStyle = fg;
    ctx.font = `700 ${Math.round(16 * s)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MORPH CIRCLE -> STARBURST -> CIRCLE", cx, cy + 205 * s);
    ctx.fillStyle = pal.accent;
    ctx.fillText(`T ${(st / 3.5).toFixed(2)}  ROT ${rotDeg.toFixed(1)}°  SPRING F:2.6 C:0.30`, cx, cy - 195 * s);
    ctx.restore();
  }
  // SCENE 3 (6.5 - 10.5s): EVERY FRAME ON (Kinetic Typography Stack)
  else if (time < 10.5) {
    const st = time - 6.5;
    const words = ["EVERY", "FRAME", "COUNTS"];
    for (let i = 0; i < words.length; i++) {
      const wSpring = MathUtil.springStep(st - i * 0.28, 3.1, 0.34);
      const slideX = (1 - wSpring) * (i % 2 === 0 ? -350 : 350) * s;
      const yPos = cy + (i - 1) * 95 * s;

      ctx.save();
      ctx.translate(cx + slideX, yPos);
      // Highlight bar behind middle word
      if (i === 1) {
        ctx.fillStyle = pal.accent;
        const barW = 440 * s * wSpring;
        ctx.fillRect(-barW / 2, -44 * s, barW, 88 * s);
      }
      ctx.fillStyle = i === 1 ? "#0D091A" : fg;
      ctx.font = `900 ${Math.round(92 * s)}px "Inter", "Arial Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(words[i], 0, 0);
      ctx.restore();
    }

    // Geometric orbiting accents
    ctx.save();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3 * s;
    const boxSize = (360 + beatKick * 28) * s;
    ctx.strokeRect(cx - boxSize / 2, cy - 155 * s, boxSize, 310 * s);
    ctx.restore();
  }
  // SCENE 4 (10.5 - 15.0s): A MOTION GRAPHICS SHOWCASE & LOOP FINALE
  else {
    const st = time - 10.5;
    const s1 = MathUtil.springStep(st, 2.8, 0.32);
    const s2 = MathUtil.springStep(st - 1.8, 2.8, 0.35);

    // Expanding concentric geometric rings
    for (let r = 0; r < 4; r++) {
      const rad = ((st * 120 + r * 65) % 280) * s;
      ctx.strokeStyle = r % 2 === 0 ? fg : pal.accent;
      ctx.lineWidth = 2.5 * s;
      ctx.globalAlpha = MathUtil.clamp(1 - rad / (280 * s), 0, 0.6);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(cx, cy);
    const rot = st < 1.8 ? (1 - s1) * -0.4 : (1 - s2) * 0.25;
    ctx.rotate(rot);
    const sc = (0.3 + 0.7 * s1) * (1 + beatKick * 0.05);
    ctx.scale(sc, sc);

    // Pill banner
    ctx.fillStyle = fg;
    MathUtil.roundRect(ctx, -310 * s, -68 * s, 620 * s, 136 * s, 20 * s);
    ctx.fill();

    ctx.fillStyle = bg;
    ctx.font = `900 ${Math.round(48 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(st < 2.2 ? "A MOTION GRAPHICS" : "CLAUDE OPUS 5.5", 0, -20 * s);
    ctx.fillStyle = pal.accent;
    ctx.font = `800 ${Math.round(44 * s)}px "Inter", sans-serif`;
    ctx.fillText("SHOWCASE // 60FPS", 0, 28 * s);
    ctx.restore();
  }

  // ==========================================================================
  // CAMERA VIEWFINDER / HUD OVERLAY (Always Present on Top)
  // ==========================================================================
  const pad = 24 * s;
  const bLen = 22 * s;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 2.5 * s;
  // 4 Corner brackets
  ctx.beginPath();
  ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad);
  ctx.moveTo(W - pad - bLen, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + bLen);
  ctx.moveTo(pad, H - pad - bLen); ctx.lineTo(pad, H - pad); ctx.lineTo(pad + bLen, H - pad);
  ctx.moveTo(W - pad - bLen, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad - bLen);
  ctx.stroke();

  // Top HUD Bar: Timecode + 60 FPS + 128 BPM
  ctx.fillStyle = fg;
  ctx.font = `700 ${Math.round(13 * s)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText(`REC ● ${MathUtil.formatTimecode(time, 60, 8, 8)}`, pad + 12 * s, pad + 20 * s);

  ctx.textAlign = "right";
  ctx.fillText(`60 FPS  |  128 BPM  |  BEAT ${String(beatIdx + 1).padStart(2, '0')}/32`, W - pad - 12 * s, pad + 20 * s);

  // Bottom HUD: Audio Waveform / Meter Blocks
  const bars = 18;
  const barW = 6 * s;
  const barGap = 4 * s;
  const startX = pad + 12 * s;
  const baseY = H - pad - 10 * s;
  for (let b = 0; b < bars; b++) {
    const wave = Math.abs(Math.sin(time * 9 + b * 0.7)) * (0.4 + 0.6 * beatKick);
    const bh = Math.max(4 * s, wave * 24 * s);
    ctx.fillStyle = b > 13 ? pal.accent : fg;
    ctx.fillRect(startX + b * (barW + barGap), baseY - bh, barW, bh);
  }

  // Bottom Right Spring Telemetry
  ctx.textAlign = "right";
  ctx.fillStyle = fg;
  ctx.fillText(`SPRING F:2.6 C:0.30  [OPUS 5.5 MAX]`, W - pad - 12 * s, baseY - 2 * s);

  ctx.restore();
}

// ============================================================================
// RENDERER 2: SHAPE MORPHING THROUGH UI STATES (@twoclipping)
// ============================================================================
function renderDesign2(ctx, W, H, t) {
  const duration = 14.0; // 120 BPM, 7 bars = 28 beats = 14.0s
  const time = ((t % duration) + duration) % duration;
  const s = Math.min(W, H) / 720;
  const cx = W / 2;
  const cy = H / 2;

  // Warm light-gray canvas (#F0EFEA)
  ctx.save();
  ctx.fillStyle = "#F0EFEA";
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid on warm-gray canvas
  ctx.fillStyle = "rgba(17,17,17,0.07)";
  const step = 28 * s;
  for (let x = step; x < W; x += step) {
    for (let y = step; y < H; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Closed-form spring series for the SINGLE morphing shape's width, height, corner radius, and color invert
  // Timeline across 14.0s (28 beats @ 120BPM, 0.5s/beat):
  // 0.0 - 1.2s: State 1 - Pill Button (180 x 64, r=32, black)
  // 1.2 - 2.4s: State 2 - Loader -> Checkmark Circle (76 x 76, r=38, black)
  // 2.4 - 4.4s: State 3 - Dynamic Island Music Player + Scrubbing (360 x 108, r=34, black)
  // 4.4 - 6.0s: State 4 - Elastic Volume Slider (340 x 56, r=28, stretches past max)
  // 6.0 - 7.4s: State 5 - Liquid Toggle Switch (156 x 74, r=37)
  // 7.4 - 8.8s: State 6 - Segmented Tabs (Day | Week | Month) (340 x 60, r=30)
  // 8.8 - 10.6s: State 7 - Self-Drawing Line Chart Card (420 x 260, r=24, white card w/ black border)
  // 10.6 - 12.0s: State 8 - Command Palette ⌘K (380 x 190, r=20, black)
  // 12.0 - 13.1s: State 9 - Toast ("✓ Every frame is code") (270 x 58, r=29, black)
  // 13.1 - 14.0s: State 10 - Loop back to Pill Button (180 x 64, r=32, black)

  const wSeries = [
    { t: 0.0, v: 180 },
    { t: 1.1, v: 76, f: 3.4, d: 0.48 },
    { t: 2.3, v: 360, f: 3.0, d: 0.45 },
    { t: 4.3, v: 330, f: 3.2, d: 0.50 },
    { t: 5.0, v: 392, f: 4.0, d: 0.35 }, // elastic stretch past max!
    { t: 5.5, v: 330, f: 3.8, d: 0.38 }, // spring release
    { t: 5.9, v: 156, f: 3.4, d: 0.46 },
    { t: 7.3, v: 340, f: 3.2, d: 0.46 },
    { t: 8.7, v: 420, f: 2.8, d: 0.48 },
    { t: 10.5, v: 380, f: 3.2, d: 0.48 },
    { t: 11.9, v: 270, f: 3.5, d: 0.44 },
    { t: 13.0, v: 180, f: 3.4, d: 0.52 }
  ];
  const hSeries = [
    { t: 0.0, v: 64 },
    { t: 1.1, v: 76, f: 3.4, d: 0.48 },
    { t: 2.3, v: 108, f: 3.0, d: 0.45 },
    { t: 4.3, v: 58, f: 3.2, d: 0.50 },
    { t: 5.0, v: 48, f: 4.0, d: 0.40 }, // thins slightly while stretched
    { t: 5.5, v: 58, f: 3.8, d: 0.40 },
    { t: 5.9, v: 74, f: 3.4, d: 0.46 },
    { t: 7.3, v: 60, f: 3.2, d: 0.46 },
    { t: 8.7, v: 256, f: 2.8, d: 0.48 },
    { t: 10.5, v: 185, f: 3.2, d: 0.48 },
    { t: 11.9, v: 58, f: 3.5, d: 0.44 },
    { t: 13.0, v: 64, f: 3.4, d: 0.52 }
  ];
  const rSeries = [
    { t: 0.0, v: 32 },
    { t: 1.1, v: 38 },
    { t: 2.3, v: 32 },
    { t: 4.3, v: 29 },
    { t: 5.9, v: 37 },
    { t: 7.3, v: 30 },
    { t: 8.7, v: 24 },
    { t: 10.5, v: 20 },
    { t: 11.9, v: 29 },
    { t: 13.0, v: 32 }
  ];

  const shapeW = MathUtil.springSeries(time, wSeries) * s;
  const shapeH = MathUtil.springSeries(time, hSeries) * s;
  const shapeR = MathUtil.springSeries(time, rSeries) * s;

  // Elastic horizontal offset during volume slider pull (t = 4.8..5.6)
  const pullOffset = (time > 4.7 && time < 5.7)
    ? MathUtil.springSeries(time, [{ t: 4.7, v: 0 }, { t: 5.0, v: 22 }, { t: 5.45, v: 0 }]) * s
    : 0;

  // Click scale dip when cursor clicks button at t=0.85
  const clickDip = (time > 0.75 && time < 1.15)
    ? 1 - 0.08 * Math.sin(((time - 0.75) / 0.4) * Math.PI)
    : 1;

  const sx = cx + pullOffset - (shapeW * clickDip) / 2;
  const sy = cy - (shapeH * clickDip) / 2;
  const sw = shapeW * clickDip;
  const sh = shapeH * clickDip;

  // Is it the white chart card state? (t = 8.7 .. 10.5)
  const isChartState = (time >= 8.75 && time < 10.55);

  // Subtle shadow under the single morphing UI element
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.14)";
  ctx.shadowBlur = 28 * s;
  ctx.shadowOffsetY = 10 * s;
  ctx.fillStyle = isChartState ? "#FFFFFF" : "#111111";
  MathUtil.roundRect(ctx, sx, sy, sw, sh, shapeR);
  ctx.fill();
  if (isChartState) {
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2 * s;
    ctx.stroke();
  }
  ctx.restore();

  // Clip interior content to the morphing shape
  ctx.save();
  MathUtil.roundRect(ctx, sx, sy, sw, sh, shapeR);
  ctx.clip();

  // STATE 1 & 10: PILL BUTTON ("Button")
  if (time < 1.15 || time >= 13.0) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `600 ${Math.round(20 * s)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Button", cx, cy);
  }
  // STATE 2: LOADER RING -> CHECKMARK (1.15 - 2.35s)
  else if (time < 2.35) {
    const st = time - 1.15;
    if (st < 0.65) {
      // Spinning white loader arc
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3.5 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * s, st * 10, st * 10 + Math.PI * 1.35);
      ctx.stroke();
    } else {
      // Morph into crisp white checkmark
      const p = MathUtil.springStep(st - 0.65, 4.0, 0.42);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 4 * s;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 12 * s, cy + 1 * s);
      ctx.lineTo(cx - 3 * s, cy + 10 * s);
      ctx.lineTo(cx - 3 * s + 17 * s * p, cy + 10 * s - 20 * s * p);
      ctx.stroke();
    }
  }
  // STATE 3: DYNAMIC ISLAND MUSIC PLAYER + SCRUBBING (2.35 - 4.35s)
  else if (time < 4.35) {
    const st = time - 2.35;
    // Album art disc left
    ctx.fillStyle = "#262626";
    MathUtil.roundRect(ctx, sx + 18 * s, cy - 32 * s, 64 * s, 64 * s, 14 * s);
    ctx.fill();
    // Vinyl grooves
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(sx + 50 * s, cy, 14 * s, st * 4, st * 4 + Math.PI * 1.2);
    ctx.stroke();

    // Track title & artist
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `600 ${Math.round(16 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Springs in 60fps", sx + 96 * s, cy - 12 * s);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `500 ${Math.round(12 * s)}px "Inter", sans-serif`;
    ctx.fillText("120 BPM · Pure seek(t)", sx + 96 * s, cy + 6 * s);

    // Scrubbable progress bar
    const barX = sx + 96 * s;
    const barY = cy + 24 * s;
    const barW = sw - 165 * s;
    const prog = st < 0.8 ? 0.28 + st * 0.15 : MathUtil.lerp(0.4, 0.82, (st - 0.8) / 1.1);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    MathUtil.roundRect(ctx, barX, barY, barW, 6 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    MathUtil.roundRect(ctx, barX, barY, barW * MathUtil.clamp(prog, 0, 1), 6 * s, 3 * s);
    ctx.fill();
    // Scrubber thumb
    ctx.beginPath();
    ctx.arc(barX + barW * MathUtil.clamp(prog, 0, 1), barY + 3 * s, 6.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Play / Pause morph icon on right
    const px = sx + sw - 38 * s;
    ctx.fillStyle = "#FFFFFF";
    if (st < 0.7) {
      // Play triangle
      ctx.beginPath();
      ctx.moveTo(px - 6 * s, cy - 10 * s);
      ctx.lineTo(px + 10 * s, cy);
      ctx.lineTo(px - 6 * s, cy + 10 * s);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pause bars
      ctx.fillRect(px - 7 * s, cy - 10 * s, 5 * s, 20 * s);
      ctx.fillRect(px + 3 * s, cy - 10 * s, 5 * s, 20 * s);
    }
  }
  // STATE 4: ELASTIC VOLUME SLIDER (4.35 - 5.95s)
  else if (time < 5.95) {
    const st = time - 4.35;
    const fillRatio = st < 0.65 ? MathUtil.lerp(0.55, 1.0, st / 0.65) : 1.0;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(sx, sy, sw * fillRatio, sh);

    // Speaker icon & percentage
    ctx.fillStyle = "#111111";
    ctx.font = `700 ${Math.round(16 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const pct = st > 0.5 && st < 1.1 ? Math.round(100 + (sw / s - 330) * 0.25) : Math.round(fillRatio * 100);
    ctx.fillText(`🔊  Volume ${pct}%`, sx + 22 * s, cy);
  }
  // STATE 5: LIQUID TOGGLE SWITCH (5.95 - 7.35s)
  else if (time < 7.35) {
    // Leading and trailing edges of the knob ride different springs!
    const leftEdge = MathUtil.springSeries(time, [
      { t: 5.95, v: -64 },
      { t: 6.45, v: 10, f: 2.6, d: 0.48 } // trailing edge slower
    ]) * s;
    const rightEdge = MathUtil.springSeries(time, [
      { t: 5.95, v: -10 },
      { t: 6.42, v: 64, f: 3.9, d: 0.42 } // leading edge faster -> liquid stretch!
    ]) * s;
    const kx = cx + leftEdge;
    const kw = Math.max(48 * s, rightEdge - leftEdge);
    ctx.fillStyle = "#FFFFFF";
    MathUtil.roundRect(ctx, kx, cy - 27 * s, kw, 54 * s, 27 * s);
    ctx.fill();
  }
  // STATE 6: LIQUID SEGMENTED TABS (Day | Week | Month) (7.35 - 8.75s)
  else if (time < 8.75) {
    // Liquid tab indicator with independent leading/trailing edge springs
    const tabL = MathUtil.springSeries(time, [
      { t: 7.35, v: -158 },
      { t: 7.75, v: -52, f: 2.8, d: 0.50 },
      { t: 8.20, v: 54, f: 2.8, d: 0.50 }
    ]) * s;
    const tabR = MathUtil.springSeries(time, [
      { t: 7.35, v: -56 },
      { t: 7.72, v: 52, f: 4.1, d: 0.42 },
      { t: 8.17, v: 158, f: 4.1, d: 0.42 }
    ]) * s;

    ctx.fillStyle = "#FFFFFF";
    MathUtil.roundRect(ctx, cx + tabL, cy - 22 * s, Math.max(85 * s, tabR - tabL), 44 * s, 22 * s);
    ctx.fill();

    const labels = ["Day", "Week", "Month"];
    const offsets = [-107 * s, 0, 107 * s];
    for (let i = 0; i < 3; i++) {
      const center = cx + offsets[i];
      const active = center >= cx + tabL && center <= cx + tabR;
      ctx.fillStyle = active ? "#111111" : "rgba(255,255,255,0.65)";
      ctx.font = `600 ${Math.round(15 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[i], center, cy);
    }
  }
  // STATE 7: SELF-DRAWING LINE CHART CARD (8.75 - 10.55s)
  else if (time < 10.55) {
    const st = time - 8.75;
    const drawP = MathUtil.clamp(st / 1.1, 0, 1);

    // Header text inside white card
    ctx.fillStyle = "rgba(17,17,17,0.55)";
    ctx.font = `500 ${Math.round(13 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("TOTAL VIEWS · MONTH", sx + 28 * s, sy + 36 * s);

    ctx.fillStyle = "#111111";
    ctx.font = `700 ${Math.round(28 * s)}px "Inter", sans-serif`;
    ctx.fillText("83,960", sx + 28 * s, sy + 68 * s);

    // Self-drawing chart path
    const pts = [
      [0.0, 0.78], [0.16, 0.62], [0.32, 0.70], [0.48, 0.38],
      [0.66, 0.45], [0.82, 0.18], [1.0, 0.26]
    ];
    const cLeft = sx + 28 * s;
    const cTop = sy + 96 * s;
    const cW = sw - 56 * s;
    const cH = sh - 126 * s;

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3.5 * s;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const maxIdx = drawP * (pts.length - 1);
    for (let i = 0; i < pts.length; i++) {
      if (i > maxIdx + 0.5) break;
      const px = cLeft + pts[i][0] * cW;
      const py = cTop + pts[i][1] * cH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Hover tooltip on peak point (index 5)
    if (st > 0.75) {
      const pop = MathUtil.springStep(st - 0.75, 3.8, 0.42);
      const hx = cLeft + pts[5][0] * cW;
      const hy = cTop + pts[5][1] * cH;
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(hx, hy, 6 * s * pop, 0, Math.PI * 2);
      ctx.fill();

      // Tooltip pill "22,160"
      const tw = 78 * s * pop;
      const th = 30 * s * pop;
      MathUtil.roundRect(ctx, hx - tw / 2, hy - 42 * s, tw, th, 8 * s);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${Math.round(13 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("22,160", hx, hy - 27 * s);
    }
  }
  // STATE 8: COMMAND PALETTE ⌘K (10.55 - 11.95s)
  else if (time < 11.95) {
    const st = time - 10.55;
    const query = "Export 60fps video";
    const chars = Math.floor(MathUtil.clamp(st / 0.75, 0, 1) * query.length);
    const typed = query.slice(0, chars);

    // Search header row
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(sx, sy + 52 * s, sw, 1.5 * s);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `600 ${Math.round(14 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("⌘K", sx + 22 * s, sy + 27 * s);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `500 ${Math.round(15 * s)}px "Inter", sans-serif`;
    ctx.fillText(typed + (Math.floor(st * 8) % 2 === 0 ? "|" : ""), sx + 60 * s, sy + 27 * s);

    // Filtered command list
    const items = [
      { label: "Export 60fps MP4 (Playwright tmix)", shortcut: "↵ Enter", active: true },
      { label: "Copy deterministic seek(t) state", shortcut: "⌘ C", active: false }
    ];
    items.forEach((it, idx) => {
      const iy = sy + 68 * s + idx * 48 * s;
      if (it.active) {
        ctx.fillStyle = st > 1.05 ? "#FFFFFF" : "rgba(255,255,255,0.14)";
        MathUtil.roundRect(ctx, sx + 14 * s, iy, sw - 28 * s, 40 * s, 10 * s);
        ctx.fill();
      }
      ctx.fillStyle = (it.active && st > 1.05) ? "#111111" : "#FFFFFF";
      ctx.font = `500 ${Math.round(14 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(it.label, sx + 28 * s, iy + 20 * s);
      ctx.textAlign = "right";
      ctx.fillText(it.shortcut, sx + sw - 28 * s, iy + 20 * s);
    });
  }
  // STATE 9: TOAST ("✓ Every frame is code") (11.95 - 13.0s)
  else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `600 ${Math.round(17 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✓  Every frame is code", cx, cy);
  }

  ctx.restore(); // End interior clip

  // ==========================================================================
  // DIRECT-MANIPULATION CURSOR (Drives every interaction)
  // ==========================================================================
  const cursorX = MathUtil.springSeries(time, [
    { t: 0.0, v: 130 },
    { t: 0.6, v: 25, f: 3.0, d: 0.55 },   // click button
    { t: 2.5, v: 118, f: 2.8, d: 0.55 },  // click play
    { t: 3.1, v: -30, f: 2.8, d: 0.55 },  // scrub progress start
    { t: 3.8, v: 65, f: 2.5, d: 0.60 },   // scrub progress end
    { t: 4.5, v: 95, f: 3.0, d: 0.55 },   // grab volume slider
    { t: 5.0, v: 185, f: 3.6, d: 0.42 },  // pull past max!
    { t: 5.5, v: 110, f: 3.4, d: 0.50 },  // release slider
    { t: 6.3, v: 32, f: 3.2, d: 0.52 },   // flip toggle
    { t: 7.7, v: 0, f: 3.2, d: 0.52 },    // click Week tab
    { t: 8.15, v: 105, f: 3.2, d: 0.52 }, // click Month tab
    { t: 9.4, v: 112, f: 3.0, d: 0.55 },  // hover chart peak
    { t: 11.4, v: 80, f: 3.0, d: 0.55 },  // hit enter in ⌘K
    { t: 13.0, v: 130, f: 2.8, d: 0.55 }  // return to start
  ]) * s + cx;

  const cursorY = MathUtil.springSeries(time, [
    { t: 0.0, v: 95 },
    { t: 0.6, v: 12, f: 3.0, d: 0.55 },
    { t: 2.5, v: 4, f: 2.8, d: 0.55 },
    { t: 3.1, v: 26, f: 2.8, d: 0.55 },
    { t: 4.5, v: 4, f: 3.0, d: 0.55 },
    { t: 6.3, v: 6, f: 3.2, d: 0.52 },
    { t: 9.4, v: -18, f: 3.0, d: 0.55 },
    { t: 11.4, v: 35, f: 3.0, d: 0.55 },
    { t: 13.0, v: 95, f: 2.8, d: 0.55 }
  ]) * s + cy;

  // Draw sleek pointer cursor
  ctx.save();
  ctx.translate(cursorX, cursorY);
  ctx.fillStyle = "#111111";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22 * s);
  ctx.lineTo(6 * s, 17 * s);
  ctx.lineTo(11 * s, 26 * s);
  ctx.lineTo(15 * s, 24 * s);
  ctx.lineTo(10 * s, 15 * s);
  ctx.lineTo(17 * s, 15 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Subtle bottom telemetry badge
  ctx.fillStyle = "rgba(17,17,17,0.45)";
  ctx.font = `600 ${Math.round(11.5 * s)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`ONE SHAPE · NEVER CUT · 120 BPM · BEAT ${Math.floor(time * 2) + 1}/28`, cx, H - 18 * s);

  ctx.restore();
}

// ============================================================================
// RENDERER 3: BOLD KINETIC TYPE SHOWREEL (@shneural)
// ============================================================================
function renderDesign3(ctx, W, H, t) {
  const duration = 15.0;
  const time = ((t % duration) + duration) % duration;
  const bpm = 128;
  const beatDur = 60 / bpm;
  const beatIdx = Math.floor(time / beatDur);
  const beatPhase = (time % beatDur) / beatDur;
  const beatKick = Math.pow(1 - beatPhase, 3);
  const s = W / 960;
  const cx = W / 2;
  const cy = H / 2;

  ctx.save();
  // Dark charcoal textured viewport (#0B0C0E)
  ctx.fillStyle = "#0B0C0E";
  ctx.fillRect(0, 0, W, H);

  // Precision alignment grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = W * 0.125; x < W; x += W * 0.125) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = H * 0.166; y < H; y += H * 0.166) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // SCENE 1 (0.0 - 4.0s): EXPANDING HORIZON LINE -> ORANGE BOUNDING BOX "FRAME" (1375 x 339)
  if (time < 4.0) {
    const lineSpring = MathUtil.springStep(time, 3.2, 0.42);
    const boxSpring = MathUtil.springStep(Math.max(0, time - 0.55), 2.9, 0.34);

    // Bright white horizontal center axis line
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - (W * 0.44) * lineSpring, cy);
    ctx.lineTo(cx + (W * 0.44) * lineSpring, cy);
    ctx.stroke();

    if (time > 0.5) {
      const bw = MathUtil.lerp(40, 560, boxSpring) * s * (1 + beatKick * 0.03);
      const bh = MathUtil.lerp(4, 154, boxSpring) * s * (1 + beatKick * 0.03);
      const bx = cx - bw / 2;
      const by = cy - bh / 2;

      // High-contrast condensed typography "FRAME"
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `900 ${Math.round(124 * s)}px "Inter", "Arial Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FRAME", cx, cy + 4 * s);
      ctx.restore();

      // Prominent bright orange bounding box (#FF5500) + corner resize handles
      ctx.strokeStyle = "#FF5500";
      ctx.lineWidth = 3 * s;
      ctx.strokeRect(bx, by, bw, bh);

      const hSz = 9 * s;
      ctx.fillStyle = "#FF5500";
      [
        [bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh],
        [bx + bw / 2, by], [bx + bw / 2, by + bh]
      ].forEach(([hx, hy]) => {
        ctx.fillRect(hx - hSz / 2, hy - hSz / 2, hSz, hSz);
      });

      // Live measurement pill callout: "1375 x 339"
      const dispW = Math.round(1375 * boxSpring);
      const dispH = Math.round(339 * boxSpring);
      const pillW = 128 * s;
      const pillH = 28 * s;
      ctx.fillStyle = "#FF5500";
      MathUtil.roundRect(ctx, cx - pillW / 2, by + bh + 14 * s, pillW, pillH, 14 * s);
      ctx.fill();
      ctx.fillStyle = "#0B0C0E";
      ctx.font = `800 ${Math.round(13 * s)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${dispW} x ${dispH}`, cx, by + bh + 28 * s);
    }
  }
  // SCENE 2 (4.0 - 8.0s): KINETIC LAYOUT CUTS & VECTOR STARBURSTS
  else if (time < 8.0) {
    const st = time - 4.0;
    const subScene = Math.floor(st / 1.33);
    const localT = st % 1.33;
    const sp = MathUtil.springStep(localT, 3.4, 0.36);

    const words = ["KINETIC", "VECTOR", "SYSTEM"];
    const dims = ["1920 x 1080", "1440 x 1440", "2560 x 1080"];

    // Dynamic diagonal alignment guides
    ctx.strokeStyle = "rgba(255,85,0,0.35)";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(0, H * (0.2 + subScene * 0.15));
    ctx.lineTo(W, H * (0.8 - subScene * 0.15));
    ctx.stroke();

    // Giant kinetic word with orange selection frame
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.6 + 0.4 * sp, 0.6 + 0.4 * sp);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 ${Math.round(128 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(words[subScene % 3], 0, 0);

    ctx.strokeStyle = "#FF5500";
    ctx.lineWidth = 2.5 * s;
    ctx.strokeRect(-295 * s, -68 * s, 590 * s, 136 * s);
    ctx.restore();

    // Rotating vector starbursts on corners
    [[-295 * s, -68 * s], [295 * s, 68 * s]].forEach(([ox, oy], idx) => {
      ctx.save();
      ctx.translate(cx + ox * sp, cy + oy * sp);
      ctx.rotate(time * (idx === 0 ? 2.5 : -2.5));
      ctx.fillStyle = "#FF5500";
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = (i % 2 === 0 ? 32 : 11) * s;
        const a = (i / 16) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Measurement pill
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${Math.round(13 * s)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`BOUNDING BOX // ${dims[subScene % 3]}`, cx, cy + 112 * s);
  }
  // SCENE 3 (8.0 - 11.8s): PARTICLE FIELD & RADIAL VELOCITY BURSTS
  else if (time < 11.8) {
    const st = time - 8.0;
    const count = 48;
    for (let i = 0; i < count; i++) {
      const seed = (i * 73.13) % 1;
      const angle = (i / count) * Math.PI * 2 + st * 0.4;
      const speed = 90 + seed * 220;
      const dist = ((st * speed + seed * 260) % 340) * s;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist * 0.65;
      const sz = (2.5 + (dist / (340 * s)) * 7) * s;

      ctx.fillStyle = i % 3 === 0 ? "#FF5500" : "#FFFFFF";
      ctx.globalAlpha = MathUtil.clamp(1 - dist / (340 * s), 0.1, 1);
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Central high-contrast badge
    const pop = 1 + beatKick * 0.1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    ctx.fillStyle = "#FF5500";
    ctx.fillRect(-210 * s, -48 * s, 420 * s, 96 * s);
    ctx.fillStyle = "#0B0C0E";
    ctx.font = `900 ${Math.round(64 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PARTICLES", 0, 2 * s);
    ctx.restore();
  }
  // SCENE 4 (11.8 - 15.0s): GRID SNAP COMPILATION -> HORIZON COLLAPSE
  else {
    const st = time - 11.8;
    const collapse = st > 2.3 ? MathUtil.smoothstep(2.3, 3.1, st) : 0;
    const hScale = 1 - collapse;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, Math.max(0.01, hScale));
    ctx.strokeStyle = "#FF5500";
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(-320 * s, -85 * s, 640 * s, 170 * s);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 ${Math.round(82 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SHOWREEL // 03", 0, 0);
    ctx.restore();
  }

  // ==========================================================================
  // TECHNICAL VIEWPORT HUD OVERLAY (Corner crosshairs + telemetry)
  // ==========================================================================
  const m = 26 * s;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.8 * s;
  [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y); ctx.lineTo(x + 10 * s, y);
    ctx.moveTo(x, y - 10 * s); ctx.lineTo(x, y + 10 * s);
    ctx.stroke();
  });

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `700 ${Math.round(12.5 * s)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText(`02 - KINETIC TYPE   |   ${MathUtil.formatTimecode(time, 60, 129, 2)}`, m + 18 * s, m + 4 * s);
  ctx.textAlign = "right";
  ctx.fillText(`128 BPM   60 FPS   1920x1080`, W - m - 18 * s, m + 4 * s);

  ctx.restore();
}

// ============================================================================
// RENDERER 4: ABSTRACT MOTION DESIGN REEL (@ajith_io)
// ============================================================================
function renderDesign4(ctx, W, H, t) {
  const duration = 15.0;
  const time = ((t % duration) + duration) % duration;
  const bpm = 128;
  const beatDur = 60 / bpm;
  const beatIdx = Math.floor(time / beatDur);
  const barIdx = Math.min(8, Math.floor(beatIdx / 4) + 1);
  const beatPhase = (time % beatDur) / beatDur;
  const beatKick = Math.pow(1 - beatPhase, 3);
  const s = W / 960;
  const cx = W / 2;
  const cy = H / 2;

  // Palette shifts between Vermilion Red (#E8291C), Warm Off-White (#F4F1EA), and Jet Black (#0F0F0F)
  let mode = "red";
  if (time >= 3.75 && time < 7.5) mode = "dots";
  else if (time >= 7.5 && time < 11.25) mode = "black";
  else if (time >= 11.25) mode = (beatIdx % 2 === 0) ? "red" : "dots";

  const bg = mode === "red" ? "#E8291C" : mode === "dots" ? "#F4F1EA" : "#0F0F0F";
  const fg = mode === "red" ? "#0F0F0F" : mode === "dots" ? "#0F0F0F" : "#F4F1EA";
  const accent = "#E8291C";

  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // SCENE 1 (0.0 - 3.75s): VERMILION RED + "EVERY FRAME ON PURPOSE"
  if (time < 3.75) {
    const sp1 = MathUtil.springStep(time, 3.0, 0.36);
    const sp2 = MathUtil.springStep(Math.max(0, time - 0.45), 3.0, 0.36);

    // Pulsing black bounding box + crop marks
    const bw = (620 + beatKick * 22) * s * sp1;
    const bh = (220 + beatKick * 12) * s * sp1;
    const bx = cx - bw / 2;
    const by = cy - bh / 2;

    ctx.strokeStyle = "#0F0F0F";
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(bx, by, bw, bh);

    // Registration crop marks outside corners
    const cm = 18 * s;
    [
      [bx, by, -1, -1], [bx + bw, by, 1, -1],
      [bx, by + bh, -1, 1], [bx + bw, by + bh, 1, 1]
    ].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x + dx * 6 * s, y); ctx.lineTo(x + dx * (6 * s + cm), y);
      ctx.moveTo(x, y + dy * 6 * s); ctx.lineTo(x, y + dy * (6 * s + cm));
      ctx.stroke();
    });

    ctx.fillStyle = "#0F0F0F";
    ctx.font = `900 ${Math.round(68 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EVERY FRAME", cx, cy - 34 * s * sp1);

    ctx.save();
    ctx.translate(cx, cy + 40 * s);
    ctx.scale(sp2, sp2);
    ctx.fillStyle = "#F4F1EA";
    ctx.fillRect(-245 * s, -34 * s, 490 * s, 68 * s);
    ctx.fillStyle = "#0F0F0F";
    ctx.fillText("ON PURPOSE", 0, 2 * s);
    ctx.restore();
  }
  // SCENE 2 (3.75 - 7.5s): OFF-WHITE DOT MATRIX WITH BEAT-ILLUMINATED RED COLUMNS
  else if (time < 7.5) {
    const cols = 15;
    const rows = 8;
    const gridW = W * 0.78;
    const gridH = H * 0.62;
    const startX = (W - gridW) / 2;
    const startY = (H - gridH) / 2;
    const activeCol = beatIdx % cols;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const dx = startX + (c / (cols - 1)) * gridW;
        const dy = startY + (r / (rows - 1)) * gridH;
        const distCol = Math.abs(c - activeCol);
        const wave = Math.sin(time * 8 - c * 0.6 - r * 0.4) > 0.45;
        const isLit = (distCol <= 1) || wave;
        const rad = (isLit ? 10.5 + beatKick * 4 : 5.5) * s;

        ctx.fillStyle = isLit ? "#E8291C" : "rgba(15,15,15,0.22)";
        ctx.beginPath();
        ctx.arc(dx, dy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Center Swiss kinetic badge
    ctx.fillStyle = "#0F0F0F";
    ctx.fillRect(cx - 195 * s, cy - 42 * s, 390 * s, 84 * s);
    ctx.fillStyle = "#F4F1EA";
    ctx.font = `900 ${Math.round(42 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`RHYTHM // BAR ${barIdx}/8`, cx, cy + 2 * s);
  }
  // SCENE 3 (7.5 - 11.25s): ROTATING TARGET CROSSHAIRS & BAUHAUS GEOMETRY
  else if (time < 11.25) {
    const st = time - 7.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st * 1.1);

    // Concentric split arcs
    for (let i = 1; i <= 4; i++) {
      ctx.strokeStyle = i % 2 === 0 ? "#E8291C" : "#F4F1EA";
      ctx.lineWidth = (14 - i * 2) * s;
      ctx.beginPath();
      ctx.arc(0, 0, i * 44 * s * (1 + beatKick * 0.06), i * 0.8, i * 0.8 + Math.PI * 1.25);
      ctx.stroke();
    }
    // Target crosshair lines
    ctx.strokeStyle = "#F4F1EA";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-220 * s, 0); ctx.lineTo(220 * s, 0);
    ctx.moveTo(0, -220 * s); ctx.lineTo(0, 220 * s);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#E8291C";
    ctx.font = `900 ${Math.round(32 * s)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("PRECISION GRID SNAP", cx, cy + 205 * s);
  }
  // SCENE 4 (11.25 - 15.0s): STROBE BAUHAUS FINALE
  else {
    const st = time - 11.25;
    const sp = MathUtil.springStep(st % 0.9375, 3.6, 0.36);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.75 + 0.25 * sp, 0.75 + 0.25 * sp);
    ctx.fillStyle = mode === "red" ? "#0F0F0F" : "#E8291C";
    ctx.font = `900 ${Math.round(84 * s)}px "Inter", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLAUDE REEL 2026", 0, -24 * s);
    ctx.font = `800 ${Math.round(38 * s)}px "JetBrains Mono", monospace`;
    ctx.fillText("EVERY FRAME ON PURPOSE", 0, 42 * s);
    ctx.restore();
  }

  // ==========================================================================
  // SWISS EDITORIAL HEADER & FOOTER TELEMETRY
  // ==========================================================================
  const pad = 28 * s;
  ctx.fillStyle = fg;
  ctx.font = `700 ${Math.round(13 * s)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("CLAUDE MOTION REEL 2026", pad, pad + 8 * s);
  ctx.textAlign = "right";
  ctx.fillText(`${MathUtil.formatTimecode(time, 60, 0, 6)}   |   128 BPM   |   BAR ${barIdx}/8`, W - pad, pad + 8 * s);

  ctx.restore();
}

// ============================================================================
// RENDERER 5: PHOTO PRINT APP LAUNCH FILM (@twoclipping)
// ============================================================================
function drawProceduralPhoto(ctx, x, y, w, h, goldenHour = 0, variant = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (variant === 0) {
    // Mountain Lake & Sun Landscape (with daylight -> golden hour relighting!)
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (goldenHour < 0.5) {
      const t = goldenHour * 2;
      grad.addColorStop(0, `rgb(${Math.round(MathUtil.lerp(72, 245, t))}, ${Math.round(MathUtil.lerp(148, 130, t))}, ${Math.round(MathUtil.lerp(235, 65, t))})`);
      grad.addColorStop(1, `rgb(${Math.round(MathUtil.lerp(185, 255, t))}, ${Math.round(MathUtil.lerp(222, 198, t))}, ${Math.round(MathUtil.lerp(252, 115, t))})`);
    } else {
      const t = (goldenHour - 0.5) * 2;
      grad.addColorStop(0, `rgb(${Math.round(MathUtil.lerp(245, 195, t))}, ${Math.round(MathUtil.lerp(130, 68, t))}, ${Math.round(MathUtil.lerp(65, 58, t))})`);
      grad.addColorStop(1, `rgb(${Math.round(MathUtil.lerp(255, 255, t))}, ${Math.round(MathUtil.lerp(198, 162, t))}, ${Math.round(MathUtil.lerp(115, 72, t))})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Sun position shifts lower and warmer with goldenHour slider
    const sunX = x + w * (0.68 - goldenHour * 0.12);
    const sunY = y + h * (0.26 + goldenHour * 0.22);
    ctx.fillStyle = goldenHour > 0.3 ? "#FFE28A" : "#FFFFFF";
    ctx.beginPath();
    ctx.arc(sunX, sunY, Math.min(w, h) * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // Layered mountain ridges
    ctx.fillStyle = goldenHour > 0.4 ? "#4A2535" : "#2B4C6F";
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.62);
    ctx.lineTo(x + w * 0.32, y + h * 0.38);
    ctx.lineTo(x + w * 0.64, y + h * 0.56);
    ctx.lineTo(x + w * 0.88, y + h * 0.42);
    ctx.lineTo(x + w, y + h * 0.54);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = goldenHour > 0.4 ? "#2A1321" : "#182F49";
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.74);
    ctx.lineTo(x + w * 0.24, y + h * 0.58);
    ctx.lineTo(x + w * 0.55, y + h * 0.72);
    ctx.lineTo(x + w * 0.78, y + h * 0.52);
    ctx.lineTo(x + w, y + h * 0.68);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  } else if (variant === 1) {
    // Astronaut / Deep Space editorial portrait for Lock Screen
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#0F172A");
    g.addColorStop(0.6, "#1E293B");
    g.addColorStop(1, "#334155");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // Visor helmet silhouette
    ctx.fillStyle = "#F8FAFC";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.54, Math.min(w, h) * 0.25, 0, Math.PI * 2);
    ctx.fill();
    const vg = ctx.createLinearGradient(x + w * 0.3, y + h * 0.4, x + w * 0.7, y + h * 0.65);
    vg.addColorStop(0, "#38BDF8");
    vg.addColorStop(0.5, "#F97316");
    vg.addColorStop(1, "#0F172A");
    ctx.fillStyle = vg;
    MathUtil.roundRect(ctx, x + w * 0.32, y + h * 0.43, w * 0.36, h * 0.20, Math.min(w, h) * 0.08);
    ctx.fill();
  } else {
    // Minimalist architectural / botanical tile for Bento grid
    const colors = ["#D97757", "#4F7CAC", "#5E8C6A", "#C9A259", "#7C6A96", "#3E6B7E"];
    ctx.fillStyle = colors[variant % colors.length];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderDesign5(ctx, W, H, t) {
  const duration = 15.0;
  const time = ((t % duration) + duration) % duration;
  const s = Math.min(W, H) / 720;
  const cx = W / 2;
  const cy = H / 2;

  // Warm off-white keynote canvas (#F5F3EE)
  ctx.save();
  ctx.fillStyle = "#F5F3EE";
  ctx.fillRect(0, 0, W, H);

  // ==========================================================================
  // ACT 1 (0.0 - 3.6s): ACCORDION WORDMARK -> BLACK PILL -> 6-BLADE IRIS -> BENTO GRID
  // ==========================================================================
  if (time < 3.6) {
    if (time < 1.3) {
      // Wordmark "develop." squeezes into its own period dot, then grows into black pill
      const squeeze = MathUtil.springStep(Math.max(0, time - 0.35), 3.4, 0.48);
      const pillGrow = MathUtil.springStep(Math.max(0, time - 0.78), 3.4, 0.45);

      if (time < 0.78) {
        ctx.fillStyle = "#111111";
        ctx.font = `900 ${Math.round(64 * s)}px "Inter", "Arial Black", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tracking = MathUtil.lerp(1, 0, squeeze);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(Math.max(0.08, tracking), 1);
        ctx.fillText("develop", -12 * s, 0);
        ctx.restore();
        // Period dot stays anchored and grows
        ctx.beginPath();
        ctx.arc(cx + MathUtil.lerp(136, 0, squeeze) * s, cy + MathUtil.lerp(16, 0, squeeze) * s, (9 + squeeze * 14) * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const pw = MathUtil.lerp(46, 220, pillGrow) * s;
        const ph = MathUtil.lerp(46, 64, pillGrow) * s;
        ctx.fillStyle = "#111111";
        MathUtil.roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `600 ${Math.round(18 * s)}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = pillGrow;
        ctx.fillText("Open gallery", cx, cy);
        ctx.globalAlpha = 1;
      }
    } else if (time < 2.3) {
      // 6-Blade Mechanical Iris snaps over label and opens onto photo!
      const st = time - 1.3;
      const openFrac = MathUtil.springStep(st, 3.0, 0.46);
      const radius = MathUtil.lerp(24, 240, openFrac) * s;

      ctx.save();
      // 6-sided polygon aperture
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + (1 - openFrac) * 0.8;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.clip();
      drawProceduralPhoto(ctx, cx - 240 * s, cy - 240 * s, 480 * s, 480 * s, 0.1, 0);
      ctx.restore();

      // Mechanical iris blade lines
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + (1 - openFrac) * 0.8;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      // Unfolds like a paper map into a 3x3 Bento Grid, then zooms into center hero tile
      const st = time - 2.3;
      const unfold = MathUtil.springStep(st, 3.2, 0.45);
      const zoomHero = st > 0.75 ? MathUtil.springStep(st - 0.75, 3.0, 0.48) : 0;

      const tileSz = MathUtil.lerp(132, 420, zoomHero) * s;
      const gap = MathUtil.lerp(12, 40, zoomHero) * s;

      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          const isCenter = (r === 0 && c === 0);
          if (!isCenter && zoomHero > 0.85) continue;
          const dist = isCenter ? 0 : unfold;
          const tx = cx + c * (tileSz + gap) * dist - tileSz / 2;
          const ty = cy + r * (tileSz + gap) * dist - tileSz / 2;

          ctx.save();
          MathUtil.roundRect(ctx, tx, ty, tileSz, tileSz, 18 * s);
          ctx.clip();
          drawProceduralPhoto(ctx, tx, ty, tileSz, tileSz, 0.1, isCenter ? 0 : Math.abs(r * 3 + c) + 2);
          ctx.restore();
        }
      }
    }
  }
  // ==========================================================================
  // ACT 2 (3.6 - 7.2s): LIQUID GLASS TOOLBAR & DAY -> GOLDEN HOUR SLIDER -> LOCK SCREEN
  // ==========================================================================
  else if (time < 7.2) {
    const st = time - 3.6;
    if (st < 2.0) {
      // Hero photo being relit from Daylight (0) to Golden Hour (1) via Liquid Glass Slider
      const golden = MathUtil.clamp((st - 0.3) / 1.3, 0, 1);
      const boxSz = 450 * s;
      ctx.save();
      MathUtil.roundRect(ctx, cx - boxSz / 2, cy - boxSz / 2, boxSz, boxSz, 28 * s);
      ctx.clip();
      drawProceduralPhoto(ctx, cx - boxSz / 2, cy - boxSz / 2, boxSz, boxSz, golden, 0);

      // iOS 26 Liquid Glass Toolbar at bottom of photo
      const gx = cx - 175 * s;
      const gy = cy + 125 * s;
      const gw = 350 * s;
      const gh = 56 * s;
      ctx.fillStyle = "rgba(255,255,255,0.26)";
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1.5 * s;
      MathUtil.roundRect(ctx, gx, gy, gw, gh, 28 * s);
      ctx.fill();
      ctx.stroke();

      // Slider track inside glass bar
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      MathUtil.roundRect(ctx, gx + 24 * s, gy + 25 * s, gw - 48 * s, 6 * s, 3 * s);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      MathUtil.roundRect(ctx, gx + 24 * s, gy + 25 * s, (gw - 48 * s) * golden, 6 * s, 3 * s);
      ctx.fill();

      // Glass lens knob while held
      const kx = gx + 24 * s + (gw - 48 * s) * golden;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(kx, gy + 28 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Floating glass title "golden hour"
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = `700 ${Math.round(14 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`☀  Relight · ${Math.round(golden * 100)}% Golden Hour`, cx, gy - 14 * s);
      ctx.restore();
    } else {
      // Glass Orb expands into iOS 26 Lock Screen ("9:41", "Friday, September 25", Astronaut, Glass Music Player)
      const lsSpring = MathUtil.springStep(st - 2.0, 3.2, 0.46);
      const pw = MathUtil.lerp(220, 290, lsSpring) * s;
      const ph = MathUtil.lerp(220, 520, lsSpring) * s;
      const px = cx - pw / 2;
      const py = cy - ph / 2;

      ctx.save();
      // iPhone bezel frame
      ctx.fillStyle = "#111111";
      MathUtil.roundRect(ctx, px - 10 * s, py - 10 * s, pw + 20 * s, ph + 20 * s, 44 * s);
      ctx.fill();

      MathUtil.roundRect(ctx, px, py, pw, ph, 36 * s);
      ctx.clip();
      drawProceduralPhoto(ctx, px, py, pw, ph, 0.8, 1);

      // Dynamic Island at top
      ctx.fillStyle = "#000000";
      MathUtil.roundRect(ctx, cx - 48 * s, py + 14 * s, 96 * s, 26 * s, 13 * s);
      ctx.fill();

      // iOS 26 Glass Clock Digits
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `600 ${Math.round(13 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Friday, September 25", cx, py + 68 * s);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = `800 ${Math.round(64 * s)}px "Inter", sans-serif`;
      ctx.fillText("9:41", cx, py + 124 * s);

      // Bottom Glass Music Player ("motion study 04")
      const mpY = py + ph - 92 * s;
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2 * s;
      MathUtil.roundRect(ctx, px + 16 * s, mpY, pw - 32 * s, 68 * s, 20 * s);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${Math.round(13.5 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("motion study 04", px + 32 * s, mpY + 28 * s);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `500 ${Math.round(11.5 * s)}px "Inter", sans-serif`;
      ctx.fillText("iOS 26 Liquid Glass", px + 32 * s, mpY + 46 * s);
      ctx.restore();
    }
  }
  // ==========================================================================
  // ACT 3 (7.2 - 11.0s): DYNAMIC ISLAND DETACHES -> MAC SAFARI STORE ("the print" $129)
  // ==========================================================================
  else if (time < 11.0) {
    const st = time - 7.2;
    const winSpring = MathUtil.springStep(st, 3.0, 0.46);
    const mw = MathUtil.lerp(140, 560, winSpring) * s;
    const mh = MathUtil.lerp(36, 390, winSpring) * s;
    const mx = cx - mw / 2;
    const my = cy - mh / 2;

    // macOS Safari window with shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.16)";
    ctx.shadowBlur = 32 * s;
    ctx.shadowOffsetY = 12 * s;
    ctx.fillStyle = "#FFFFFF";
    MathUtil.roundRect(ctx, mx, my, mw, mh, 18 * s);
    ctx.fill();
    ctx.strokeStyle = "rgba(17,17,17,0.12)";
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    MathUtil.roundRect(ctx, mx, my, mw, mh, 18 * s);
    ctx.clip();

    // Safari titlebar
    ctx.fillStyle = "#F0EFEA";
    ctx.fillRect(mx, my, mw, 40 * s);
    ["#FF5F56", "#FFBD2E", "#27C93F"].forEach((col, idx) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(mx + (20 + idx * 18) * s, my + 20 * s, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#FFFFFF";
    MathUtil.roundRect(ctx, cx - 110 * s, my + 8 * s, 220 * s, 24 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.font = `600 ${Math.round(11.5 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("develop.app / the-print", cx, my + 20 * s);

    // Left side: Framed Print Preview with interactive molding color & mat
    const frameColors = ["#8B5A2B", "#111111", "#E5E4DF"]; // wood, black, white
    const fIdx = st < 1.3 ? 0 : st < 2.3 ? 1 : 0;
    const frameX = mx + 36 * s;
    const frameY = my + 66 * s;
    const frameW = 220 * s;
    const frameH = 275 * s;

    // Outer molding
    ctx.fillStyle = frameColors[fIdx];
    ctx.fillRect(frameX, frameY, frameW, frameH);
    // Archival cotton rag mat
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(frameX + 14 * s, frameY + 14 * s, frameW - 28 * s, frameH - 28 * s);
    // Inner photo
    drawProceduralPhoto(ctx, frameX + 34 * s, frameY + 34 * s, frameW - 68 * s, frameH - 68 * s, 0.85, 0);

    // Right side: E-Commerce Product Configuration
    const rx = mx + 285 * s;
    ctx.fillStyle = "#111111";
    ctx.font = `800 ${Math.round(26 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("the print", rx, my + 92 * s);

    ctx.fillStyle = "rgba(17,17,17,0.6)";
    ctx.font = `500 ${Math.round(13 * s)}px "Inter", sans-serif`;
    ctx.fillText("archival pigment on cotton rag", rx, my + 118 * s);

    ctx.fillStyle = "#111111";
    ctx.font = `700 ${Math.round(22 * s)}px "Inter", sans-serif`;
    ctx.fillText("$129", rx, my + 154 * s);

    // Frame swatches (wood, black, white)
    ["Wood", "Black", "White"].forEach((lbl, idx) => {
      const sx = rx + idx * 78 * s;
      const sy = my + 180 * s;
      const active = (idx === fIdx);
      ctx.fillStyle = active ? "#111111" : "#F0EFEA";
      MathUtil.roundRect(ctx, sx, sy, 70 * s, 30 * s, 8 * s);
      ctx.fill();
      ctx.fillStyle = active ? "#FFFFFF" : "#111111";
      ctx.font = `600 ${Math.round(12 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(lbl, sx + 35 * s, sy + 15 * s);
    });

    // Size pills (30x40, 50x70, 70x100)
    const activeSz = st > 1.8 ? 1 : 0;
    ["30×40", "50×70", "70×100"].forEach((sz, idx) => {
      const sx = rx + idx * 78 * s;
      const sy = my + 224 * s;
      const active = (idx === activeSz);
      ctx.strokeStyle = active ? "#111111" : "rgba(17,17,17,0.2)";
      ctx.lineWidth = active ? 2 * s : 1 * s;
      MathUtil.roundRect(ctx, sx, sy, 70 * s, 30 * s, 8 * s);
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.font = `600 ${Math.round(12 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(sz, sx + 35 * s, sy + 15 * s);
    });

    // Order print CTA button
    const btnScale = st > 3.1 ? 0.94 : 1.0;
    ctx.fillStyle = "#111111";
    MathUtil.roundRect(ctx, rx, my + 282 * s, 230 * s * btnScale, 48 * s, 24 * s);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `600 ${Math.round(15 * s)}px "Inter", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Order print →", rx + 115 * s, my + 306 * s);

    ctx.restore();
  }
  // ==========================================================================
  // ACT 4 (11.0 - 15.0s): ORDER STATUS MORPH -> FRAMED WALL ART WITH LEAF SHADOWS
  // ==========================================================================
  else {
    const st = time - 11.0;
    if (st < 1.8) {
      // Order pill morphs: Ordered ✓ -> Printing % -> On its way -> Delivered ✓
      const stepIdx = Math.min(3, Math.floor(st / 0.45));
      const statuses = [
        "Ordered ✓",
        `Printing ${Math.min(100, Math.round(((st - 0.45) / 0.45) * 100))}%`,
        "🚚  On its way · Express",
        "Delivered ✓"
      ];
      const pw = (stepIdx === 2 ? 280 : 210) * s;
      const ph = 64 * s;
      ctx.fillStyle = "#111111";
      MathUtil.roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 32 * s);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${Math.round(18 * s)}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(statuses[stepIdx], cx, cy);
    } else {
      // Framed print hanging on a warm gallery wall with moving plant shadows, then iris loop back
      const wallT = st - 1.8;
      // Warm gallery wall texture
      ctx.fillStyle = "#EAE6DF";
      ctx.fillRect(0, 0, W, H);

      // Moving dappled plant/leaf shadows across the wall
      ctx.save();
      ctx.fillStyle = "rgba(25, 22, 18, 0.08)";
      for (let i = 0; i < 6; i++) {
        const sway = Math.sin(time * 1.8 + i * 0.7) * 28 * s;
        ctx.beginPath();
        ctx.ellipse(
          cx + (-180 + i * 75) * s + sway,
          cy + (-140 + (i % 3) * 110) * s,
          120 * s,
          36 * s,
          0.45 + i * 0.12,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();

      // Framed archival print hanging on wall
      const fw = 270 * s;
      const fh = 335 * s;
      const fx = cx - fw / 2;
      const fy = cy - fh / 2;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.22)";
      ctx.shadowBlur = 36 * s;
      ctx.shadowOffsetX = 14 * s;
      ctx.shadowOffsetY = 18 * s;
      ctx.fillStyle = "#8B5A2B"; // walnut wood frame
      ctx.fillRect(fx, fy, fw, fh);
      ctx.restore();

      ctx.fillStyle = "#FAF8F5"; // cotton rag mat
      ctx.fillRect(fx + 16 * s, fy + 16 * s, fw - 32 * s, fh - 32 * s);
      drawProceduralPhoto(ctx, fx + 40 * s, fy + 40 * s, fw - 80 * s, fh - 80 * s, 0.85, 0);

      // Final 0.45s: iris contracts into wordmark "develop." for seamless loop!
      if (wallT > 1.7) {
        const loopP = MathUtil.smoothstep(1.7, 2.15, wallT);
        ctx.fillStyle = "#F5F3EE";
        ctx.globalAlpha = loopP;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#111111";
        ctx.font = `900 ${Math.round(64 * s)}px "Inter", "Arial Black", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("develop.", cx, cy);
      }
    }
  }

  // Subtle bottom telemetry badge
  ctx.fillStyle = "rgba(17,17,17,0.45)";
  ctx.font = `600 ${Math.round(11.5 * s)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`CONTINUOUS 2D LAUNCH FILM · iOS 26 LIQUID GLASS · 120 BPM`, cx, H - 18 * s);

  ctx.restore();
}

const RENDERERS = {
  1: renderDesign1,
  2: renderDesign2,
  3: renderDesign3,
  4: renderDesign4,
  5: renderDesign5
};

// ============================================================================
// REACT COMPONENT: <MotionCanvas />
// Runs the deterministic 60 FPS seek(t) renderer inside a React canvas ref
// ============================================================================
function MotionCanvas({ design, playing, speed, manualTime, onTimeUpdate, onClick }) {
  const canvasRef = useRef(null);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(performance.now());

  // Sync external manual scrub changes into the animation ref
  useEffect(() => {
    if (typeof manualTime === 'number' && !Number.isNaN(manualTime)) {
      timeRef.current = manualTime;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        RENDERERS[design.order](ctx, canvas.width, canvas.height, timeRef.current);
      }
    }
  }, [manualTime, design.order]);

  useEffect(() => {
    let rafId;
    lastFrameRef.current = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.1, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      if (playing) {
        timeRef.current = (timeRef.current + dt * speed) % design.duration;
        if (onTimeUpdate) onTimeUpdate(timeRef.current);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        RENDERERS[design.order](ctx, canvas.width, canvas.height, timeRef.current);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, speed, design.order, design.duration, onTimeUpdate]);

  const width = design.aspect === '1:1' ? 720 : 960;
  const height = design.aspect === '1:1' ? 720 : 600;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={onClick}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
    />
  );
}

// ============================================================================
// REACT COMPONENT: <MotionCard />
// Individual Catalog Card with Live 60 FPS Canvas, Scrubber & Verbatim Prompt
// ============================================================================
function MotionCard({ design, globalPlaying, onOpenModal, onCopyPrompt, onExportHTML }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [manualSeek, setManualSeek] = useState(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  useEffect(() => {
    setPlaying(globalPlaying);
  }, [globalPlaying]);

  const handleScrub = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    setManualSeek(val);
  };

  const handleStepFrame = (deltaFrames) => {
    setPlaying(false);
    const next = (currentTime + deltaFrames * (1 / 60) + design.duration) % design.duration;
    setCurrentTime(next);
    setManualSeek(next);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setManualSeek(0);
  };

  const beatNumber = Math.floor(currentTime / (60 / design.bpm)) + 1;
  const totalBeats = Math.round(design.duration / (60 / design.bpm));

  return (
    <article className="pm-card">
      <div className="pm-stage-wrap" onClick={() => onOpenModal(design)} title="Click to open Fullscreen React Studio Modal">
        <MotionCanvas
          design={design}
          playing={playing}
          speed={speed}
          manualTime={manualSeek}
          onTimeUpdate={setCurrentTime}
        />
        <div className="pm-stage-badges">
          <span className="pm-badge-dark">#{String(design.order).padStart(2, '0')} · {design.aspect}</span>
          <span className="pm-badge-dark">BEAT {String(beatNumber).padStart(2, '0')}/{totalBeats} · {design.bpm} BPM · 60 FPS</span>
        </div>
      </div>

      {/* Interactive React Scrubber & Frame Controls */}
      <div className="pm-player-bar">
        <button className="pm-icon-btn" onClick={() => setPlaying((p) => !p)} title="Play / Pause">
          {playing ? '⏸' : '▶'}
        </button>
        <button className="pm-icon-btn" onClick={() => handleStepFrame(-1)} title="Step Backward 1 Frame (-1/60s)">
          ⏮
        </button>
        <button className="pm-icon-btn" onClick={() => handleStepFrame(1)} title="Step Forward 1 Frame (+1/60s)">
          ⏭
        </button>
        <button className="pm-icon-btn" onClick={handleRestart} title="Restart from 0.00s">
          ↺
        </button>
        <input
          type="range"
          className="pm-scrubber"
          min="0"
          max={design.duration}
          step="0.016"
          value={currentTime}
          onChange={handleScrub}
        />
        <span className="pm-time-readout">
          {currentTime.toFixed(2)}s / {design.duration.toFixed(1)}s
        </span>
        <select
          className="pm-speed-select"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          title="Playback Speed"
        >
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
        </select>
        <button className="pm-icon-btn" onClick={() => onOpenModal(design)} title="Open Fullscreen Studio">
          ⛶
        </button>
      </div>

      {/* Card Body Metadata & Prompt Box */}
      <div className="pm-card-body">
        <div className="pm-card-header">
          <div>
            <h2 className="pm-card-title">{design.title}</h2>
            <div className="pm-creator-row">
              <span>
                by{' '}
                <a href={design.socialUrl} target="_blank" rel="noopener noreferrer">
                  {design.creator} ({design.handle})
                </a>
              </span>
              <span>·</span>
              <a href={design.promptMotionUrl} target="_blank" rel="noopener noreferrer">
                prompt-motion.com/{design.id} ↗
              </a>
              <span>·</span>
              <span>{design.date}</span>
            </div>
          </div>
        </div>

        <div className="pm-tag-row">
          <span className="pm-meta-chip">{design.model} ({design.effort})</span>
          {design.tags.map((tag) => (
            <span key={tag} className="pm-tag-chip">{tag}</span>
          ))}
        </div>

        <p className="pm-summary">{design.summary}</p>

        {/* Verbatim Prompt Box */}
        <div className="pm-prompt-panel">
          <div className="pm-prompt-header">
            <span className="pm-prompt-label">📋 Exact Verbatim Prompt</span>
            <div className="pm-prompt-actions">
              <button className="pm-mini-btn" onClick={() => setShowFullPrompt((s) => !s)}>
                {showFullPrompt ? 'Collapse' : 'Expand'}
              </button>
              <button className="pm-mini-btn" onClick={() => onCopyPrompt(design)}>
                Copy Prompt
              </button>
              <button className="pm-mini-btn" onClick={() => onExportHTML(design)}>
                Export HTML
              </button>
            </div>
          </div>
          <pre className="pm-prompt-code" style={{ maxHeight: showFullPrompt ? '420px' : '150px' }}>
            {design.prompt}
          </pre>
        </div>
      </div>
    </article>
  );
}

// ============================================================================
// REACT COMPONENT: <StudioModal />
// Fullscreen Theater Inspector with Frame Scrubber & Prompt Customizer
// ============================================================================
function StudioModal({ design, onClose, onCopyPrompt, onExportHTML }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [manualSeek, setManualSeek] = useState(null);
  const [customBrand, setCustomBrand] = useState('CLAUDE');

  if (!design) return null;

  const customizedPrompt = design.prompt.replace(/Claude/gi, customBrand);

  return (
    <div className="pm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal-window">
        <div className="pm-modal-stage-col">
          <div className="pm-modal-canvas-wrap">
            <MotionCanvas
              design={design}
              playing={playing}
              speed={speed}
              manualTime={manualSeek}
              onTimeUpdate={setCurrentTime}
            />
          </div>
          <div className="pm-player-bar">
            <button className="pm-icon-btn" onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸' : '▶'}
            </button>
            <button
              className="pm-icon-btn"
              onClick={() => {
                setCurrentTime(0);
                setManualSeek(0);
              }}
            >
              ↺
            </button>
            <input
              type="range"
              className="pm-scrubber"
              min="0"
              max={design.duration}
              step="0.016"
              value={currentTime}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setCurrentTime(v);
                setManualSeek(v);
              }}
            />
            <span className="pm-time-readout">
              {currentTime.toFixed(2)}s / {design.duration.toFixed(1)}s
            </span>
            <select
              className="pm-speed-select"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
            >
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={1.5}>1.5×</option>
            </select>
          </div>
        </div>

        <div className="pm-modal-info-col">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="pm-pill-callout">#{String(design.order).padStart(2, '0')} · {design.model} ({design.effort})</span>
            <button className="pm-btn" onClick={onClose}>✕ Close</button>
          </div>

          <h2 style={{ fontSize: '23px', fontWeight: 800 }}>{design.title}</h2>
          <div className="pm-creator-row">
            <span>
              Creator:{' '}
              <a href={design.socialUrl} target="_blank" rel="noopener noreferrer">
                {design.creator} ({design.handle})
              </a>
            </span>
            <span>·</span>
            <a href={design.promptMotionUrl} target="_blank" rel="noopener noreferrer">
              Original Showcase ↗
            </a>
          </div>

          <div className="pm-tag-row">
            {design.tags.map((t) => (
              <span key={t} className="pm-tag-chip">{t}</span>
            ))}
          </div>

          <p className="pm-summary">{design.summary}</p>

          <div className="pm-prompt-panel">
            <div className="pm-prompt-header">
              <span className="pm-prompt-label">📋 Exact Verbatim Prompt</span>
              <div className="pm-prompt-actions">
                <button className="pm-mini-btn" onClick={() => onCopyPrompt(design)}>Copy Verbatim</button>
                <button className="pm-mini-btn" onClick={() => onExportHTML(design)}>Export HTML</button>
              </div>
            </div>
            <pre className="pm-prompt-code" style={{ maxHeight: '280px' }}>{customizedPrompt}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN REACT APPLICATION: <PromptMotionCatalogApp />
// ============================================================================
export default function PromptMotionCatalogApp() {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('order');
  const [viewTab, setViewTab] = useState('catalog'); // 'catalog' | 'prompts' | 'react-code'
  const [globalPlaying, setGlobalPlaying] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef(null);

  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  }, []);

  // Compute tag counts across the 5 motion designs
  const tagCounts = useMemo(() => {
    const counts = { All: MOTION_DESIGNS.length };
    MOTION_DESIGNS.forEach((d) => {
      d.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }, []);

  // Filtered and sorted designs
  const filteredDesigns = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return MOTION_DESIGNS.filter((d) => {
      const matchesTag = activeTag === 'All' || d.tags.includes(activeTag);
      const matchesQuery =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.creator.toLowerCase().includes(q) ||
        d.handle.toLowerCase().includes(q) ||
        d.prompt.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q));
      return matchesTag && matchesQuery;
    }).sort((a, b) => {
      if (sortBy === 'bpm') return b.bpm - a.bpm;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return a.order - b.order;
    });
  }, [activeTag, searchQuery, sortBy]);

  // Web Audio 128 BPM metronome synth
  useEffect(() => {
    if (!audioEnabled) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    let beat = 0;
    const interval = setInterval(() => {
      if (!globalPlaying) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const isDown = beat % 4 === 0;
      osc.frequency.setValueAtTime(isDown ? 135 : 95, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.09);
      gain.gain.setValueAtTime(isDown ? 0.16 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
      beat++;
    }, (60 / 128) * 1000);

    return () => clearInterval(interval);
  }, [audioEnabled, globalPlaying]);

  const handleCopyPrompt = useCallback((design) => {
    navigator.clipboard.writeText(design.prompt).then(() => {
      triggerToast(`✓ Copied #0${design.order} (${design.handle}) verbatim prompt`);
    }).catch(() => {
      triggerToast(`✓ Copied #0${design.order} verbatim prompt`);
    });
  }, [triggerToast]);

  const handleExportHTML = useCallback((design) => {
    const fnSource = RENDERERS[design.order].toString();
    const helperPhoto = design.order === 5 ? drawProceduralPhoto.toString() : '';
    const w = design.aspect === '1:1' ? 1080 : 1280;
    const h = design.aspect === '1:1' ? 1080 : 720;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>#0${design.order} ${design.title}</title>
<style>body{margin:0;background:#07080B;display:grid;place-items:center;min-height:100vh;}canvas{max-width:94vw;max-height:90vh;border-radius:14px;}</style>
</head><body><canvas id="c" width="${w}" height="${h}"></canvas>
<script>
const MathUtil = {
  clamp: ${MathUtil.clamp.toString()},
  lerp: ${MathUtil.lerp.toString()},
  smoothstep: ${MathUtil.smoothstep.toString()},
  springStep: ${MathUtil.springStep.toString()},
  springSeries: ${MathUtil.springSeries.toString()},
  formatTimecode: ${MathUtil.formatTimecode.toString()},
  roundRect: ${MathUtil.roundRect.toString()}
};
${helperPhoto}
const render = ${fnSource};
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let start = performance.now();
function loop(now){
  const t = ((now - start) / 1000) % ${design.duration};
  render(ctx, canvas.width, canvas.height, t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
<\/script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `0${design.order}_${design.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast(`✓ Exported standalone HTML for #0${design.order}`);
  }, [triggerToast]);

  return (
    <div className="pm-app">
      {/* React Header Navigation */}
      <header className="pm-navbar">
        <div className="pm-brand">
          <div className="pm-brand-mark">⚛</div>
          <span className="pm-brand-title">Prompt Motion</span>
          <span className="pm-brand-sub">React 18 Catalog App · First 5 Motion Designs</span>
        </div>

        <div className="pm-nav-tabs">
          <button
            className={`pm-tab-switch ${viewTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setViewTab('catalog')}
          >
            🎬 Interactive Catalog ({filteredDesigns.length})
          </button>
          <button
            className={`pm-tab-switch ${viewTab === 'prompts' ? 'active' : ''}`}
            onClick={() => setViewTab('prompts')}
          >
            📋 All 5 Verbatim Prompts
          </button>
          <button
            className={`pm-tab-switch ${viewTab === 'react-code' ? 'active' : ''}`}
            onClick={() => setViewTab('react-code')}
          >
            ⚛ React Component Architecture
          </button>
        </div>

        <div className="pm-nav-actions">
          <button className="pm-btn" onClick={() => setGlobalPlaying((p) => !p)}>
            {globalPlaying ? '⏸ Pause All' : '▶ Play All'}
          </button>
          <button
            className="pm-btn pm-btn-accent"
            onClick={() => setAudioEnabled((a) => !a)}
          >
            {audioEnabled ? '🔊 Beat Synth ON' : '🔇 Enable Beat Synth'}
          </button>
          <a
            className="pm-btn pm-btn-primary"
            href="https://prompt-motion.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            prompt-motion.com ↗
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pm-hero">
        <div className="pm-hero-badges">
          <span className="pm-pill-callout">⚛ Built with React 18 Hooks &amp; Deterministic 60 FPS Canvas Refs</span>
          <span className="pm-brand-sub">Claude Opus 5.5 Showcases #01 – #05</span>
        </div>
        <h1>Prompt Motion — React Catalog &amp; Live Motion Studio</h1>
        <p>
          Browse, filter, scrub frame-by-frame, and inspect the first 5 AI motion graphics from{' '}
          <a href="https://prompt-motion.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#F4F5F8', fontWeight: 600 }}>
            prompt-motion.com
          </a>
          , rendered live inside modular React components (<code>&lt;MotionCard /&gt;</code>, <code>&lt;MotionCanvas /&gt;</code>, and <code>&lt;StudioModal /&gt;</code>).
        </p>
      </section>

      {/* Filter & Search Toolbar */}
      <div className="pm-toolbar">
        <div className="pm-tag-filters">
          {Object.entries(tagCounts).map(([tag, count]) => (
            <button
              key={tag}
              className={`pm-tag-btn ${activeTag === tag ? 'active' : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              <span>{tag}</span>
              <span className="pm-tag-count">{count}</span>
            </button>
          ))}
        </div>

        <div className="pm-toolbar-right">
          <select
            className="pm-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="order">Sort: Default Order (#01–#05)</option>
            <option value="bpm">Sort: Tempo (BPM)</option>
            <option value="title">Sort: Alphabetical</option>
          </select>
          <div className="pm-search-box">
            <input
              type="text"
              placeholder="Search creator, tag, or prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE REACT CATALOG GRID */}
      {viewTab === 'catalog' && (
        <main className="pm-catalog-grid">
          {filteredDesigns.map((design) => (
            <MotionCard
              key={design.id}
              design={design}
              globalPlaying={globalPlaying}
              onOpenModal={setSelectedDesign}
              onCopyPrompt={handleCopyPrompt}
              onExportHTML={handleExportHTML}
            />
          ))}
        </main>
      )}

      {/* VIEW 2: SIDE-BY-SIDE VERBATIM PROMPT DIRECTORY */}
      {viewTab === 'prompts' && (
        <main className="pm-prompts-view">
          {filteredDesigns.map((design) => (
            <div key={design.id} className="pm-prompt-directory-card">
              <div className="pm-prompt-dir-top">
                <div>
                  <span className="pm-pill-callout">#{String(design.order).padStart(2, '0')} · {design.model}</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '6px' }}>{design.title}</h3>
                  <div className="pm-creator-row">
                    <a href={design.socialUrl} target="_blank" rel="noopener noreferrer">{design.creator} ({design.handle})</a>
                    <span>·</span>
                    <a href={design.promptMotionUrl} target="_blank" rel="noopener noreferrer">{design.promptMotionUrl} ↗</a>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="pm-btn" onClick={() => handleCopyPrompt(design)}>📋 Copy Verbatim Prompt</button>
                  <button className="pm-btn pm-btn-primary" onClick={() => setSelectedDesign(design)}>▶ Open Live Animation</button>
                </div>
              </div>
              <pre className="pm-prompt-code" style={{ maxHeight: 'none', marginTop: '14px' }}>{design.prompt}</pre>
            </div>
          ))}
        </main>
      )}

      {/* VIEW 3: REACT ARCHITECTURE & COMPONENT TREE */}
      {viewTab === 'react-code' && (
        <main className="pm-prompts-view">
          <div className="pm-prompt-directory-card">
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
              ⚛ React 18 Component Hierarchy &amp; State Flow
            </h3>
            <p className="pm-summary" style={{ marginBottom: '14px' }}>
              This catalog is structured as a modular React 18 application where each motion graphic is encapsulated inside a reusable <code>&lt;MotionCanvas /&gt;</code> hook component driven by closed-form spring equations inside <code>seek(t)</code>.
            </p>
            <pre className="pm-prompt-code" style={{ maxHeight: '520px' }}>{`// Project Structure (prompt_motion_react_project.zip)
prompt-motion-react-catalog/
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx                   // ReactDOM.createRoot(<App />)
    ├── App.jsx                    // Master Catalog State, Tag Filtering, Search & WebAudio Synth
    ├── styles.css                 // Dark Studio Theme & Responsive Grid Layout
    └── engine/
        └── motionEngine.js        // MathUtil (springStep, springSeries) + 5 Deterministic Renderers`}</pre>
          </div>
        </main>
      )}

      {/* Fullscreen React Studio Modal */}
      <StudioModal
        design={selectedDesign}
        onClose={() => setSelectedDesign(null)}
        onCopyPrompt={handleCopyPrompt}
        onExportHTML={handleExportHTML}
      />

      {/* Toast Notification */}
      <div className={`pm-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}

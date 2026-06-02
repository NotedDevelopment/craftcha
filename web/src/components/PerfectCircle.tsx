import React, { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { fetchNui } from "../utils/fetchNui";

export interface PerfectCirclePayload {
  minAccuracy: number;
  timer?: number;
}

const CANVAS_W = 436;
const CANVAS_H = 310;
const MIN_POINTS = 40;
const TWO_PI = 2 * Math.PI;

interface Point { x: number; y: number; time: number; }

// ---------------------------------------------------------------------------
// Circle analysis
// ---------------------------------------------------------------------------
function analyzeCircle(points: Point[]): number {
  if (points.length < MIN_POINTS) return 0;

  // Step 1 — bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 40 || height < 40) return 0;

  // Step 2 — aspect ratio (no hard fail, just penalise below)
  const aspectRatio = width / height;

  // Step 3 — centroid
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  // Step 4-6 — radius consistency
  const radii = points.map(p => Math.hypot(p.x - cx, p.y - cy));
  const meanR = radii.reduce((s, r) => s + r, 0) / radii.length;
  if (meanR < 20) return 0;
  const variance = radii.reduce((s, r) => s + (r - meanR) ** 2, 0) / radii.length;
  const circleError = Math.sqrt(variance) / meanR; // normalised stdDev (CV)

  // Step 7 — closure: gap between first and last point relative to radius
  const first = points[0], last = points[points.length - 1];
  const closureRatio = Math.hypot(last.x - first.x, last.y - first.y) / meanR;

  // Step 8 — angle unwrapping: total rotation + direction consistency
  const rawAngles = points.map(p => Math.atan2(p.y - cy, p.x - cx));
  const unwrapped: number[] = [rawAngles[0]];
  let cwSteps = 0, ccwSteps = 0;
  for (let i = 1; i < rawAngles.length; i++) {
    let delta = rawAngles[i] - rawAngles[i - 1];
    // Normalise to [-π, π] to avoid wrap-around jumps
    while (delta >  Math.PI) delta -= TWO_PI;
    while (delta < -Math.PI) delta += TWO_PI;
    unwrapped.push(unwrapped[i - 1] + delta);
    if (delta >  0.002) ccwSteps++;
    else if (delta < -0.002) cwSteps++;
  }
  const totalRotation = Math.abs(unwrapped[unwrapped.length - 1] - unwrapped[0]);

  const totalDirectional = cwSteps + ccwSteps;
  const directionConsistency = totalDirectional > 0
    ? Math.max(cwSteps, ccwSteps) / totalDirectional
    : 0;

  // Path coverage — 16 angular slices (ensures full loop, not just an arc)
  const sliceSize = TWO_PI / 16;
  const slices = new Set(
    rawAngles.map(a => Math.floor(((a + TWO_PI) % TWO_PI) / sliceSize))
  );
  const coverageFactor = slices.size / 16;

  // Step 9 — score
  // Each penalty is calibrated so a decent human drawing (~CV 0.07, closure 0.1,
  // aspect ~1, full coverage, full rotation) lands around 82-88.
  let score = 100;
  score -= circleError * 70;                                      // radius wobble
  score -= closureRatio * 30;                                     // gap between start/end
  score -= Math.abs(1 - aspectRatio) * 30;                       // oval stretch
  score -= (1 - coverageFactor) * 32;                            // missing slices
  score -= Math.max(0, (1 - totalRotation / TWO_PI) * 20);       // incomplete rotation
  score -= Math.max(0, (0.85 - directionConsistency) * 80);      // direction reversals

  return Math.max(0, Math.round(score));
}

// ---------------------------------------------------------------------------
// Icons (shared with Craftcha)
// ---------------------------------------------------------------------------
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="#5f6368">
    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="#5f6368">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const PerfectCircle: React.FC<{ payload: PerfectCirclePayload }> = ({ payload }) => {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const pointsRef        = useRef<Point[]>([]);
  const drawingRef       = useRef(false);
  const accRef           = useRef(0);
  const lastCalcAtRef    = useRef(0); // throttle accuracy recalcs

  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [timer, setTimer]       = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expired, setExpired]   = useState(false);

  const minAccuracy = payload.minAccuracy ?? 85;

  // ── reset on new payload ─────────────────────────────────────────────────
  useEffect(() => {
    const t = payload.timer ?? 0;
    setTimer(t);
    setTimeLeft(t);
    setExpired(false);
    setAccuracy(null);
    setHasDrawn(false);
    pointsRef.current = [];
    drawingRef.current = false;
    accRef.current = 0;
    lastCalcAtRef.current = 0;
    clearCanvas();
  }, [payload]);

  // ── countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); setExpired(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!expired) return;
    const id = setTimeout(() => closeWithResult(false), 1200);
    return () => clearTimeout(id);
  }, [expired]);

  // ── escape ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") closeWithResult(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const closeWithResult = useCallback((success: boolean) => {
    fetchNui("craftResult", { success }, { success });
    window.dispatchEvent(new MessageEvent("message", { data: { action: "setVisible", data: false } }));
  }, []);

  // ── canvas helpers ───────────────────────────────────────────────────────
  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawCenterDot(ctx);
  };

  const drawCenterDot = (ctx: CanvasRenderingContext2D) => {
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 3, 0, TWO_PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  };

  const redraw = useCallback((pts: Point[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (pts.length > 1) {
      // Throttle accuracy recalc to every 5 new points
      const n = pts.length;
      if (n - lastCalcAtRef.current >= 5 && n >= MIN_POINTS) {
        accRef.current = analyzeCircle(pts);
        lastCalcAtRef.current = n;
      }

      // Glow stroke
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = "#4ae54a";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "#4ae54a";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Brush blob at the start of the stroke
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 8, 0, TWO_PI);
      ctx.fillStyle = "#4ae54a";
      ctx.shadowColor = "#4ae54a";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Live accuracy text (shown once enough points collected)
      if (n >= MIN_POINTS && accRef.current > 0) {
        const acc = accRef.current;
        const passing = acc >= minAccuracy;
        const color = passing ? "#4ae54a" : "#ea4335";
        ctx.font = 'bold 56px "Courier New", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillText(`${acc}%`, CANVAS_W / 2, CANVAS_H / 2);
        ctx.shadowBlur = 0;
      }
    }

    drawCenterDot(ctx);
  }, [minAccuracy]);

  // ── mouse events ─────────────────────────────────────────────────────────
  const canvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, time: performance.now() };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (expired) return;
    e.preventDefault();
    const pt = canvasPoint(e);
    pointsRef.current = [pt];
    drawingRef.current = true;
    accRef.current = 0;
    lastCalcAtRef.current = 0;
    setAccuracy(null);
    setHasDrawn(false);
    redraw([pt]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || expired) return;
    pointsRef.current.push(canvasPoint(e));
    redraw(pointsRef.current);
  };

  const handleMouseUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = pointsRef.current;
    if (pts.length >= MIN_POINTS) {
      const acc = analyzeCircle(pts);
      accRef.current = acc;
      setAccuracy(acc);
      setHasDrawn(true);
      // Final redraw so canvas shows definitive score
      redraw(pts);
    }
  };

  const handleReset = () => {
    if (expired) return;
    pointsRef.current = [];
    drawingRef.current = false;
    accRef.current = 0;
    lastCalcAtRef.current = 0;
    setAccuracy(null);
    setHasDrawn(false);
    clearCanvas();
  };

  useEffect(() => { clearCanvas(); }, []);

  const canVerify   = hasDrawn && accuracy !== null && accuracy >= minAccuracy && !expired;
  const timerPct    = timer > 0 ? (timeLeft / timer) * 100 : 100;
  const timerColor  = timerPct > 50 ? "#4285f4" : timerPct > 25 ? "#fbbc04" : "#ea4335";

  return (
    <div style={s.card} onContextMenu={e => e.preventDefault()}>

      {/* ── Title bar ── */}
      <div style={s.titleBar}>
        <span style={s.robotEmoji}>🤖</span>
        <div>
          <div style={s.titleMain}>I'm Not a Robot</div>
          <div style={s.titleSub}>Perfect Circle Challenge</div>
        </div>
      </div>

      {/* ── Blue instruction header ── */}
      <div style={s.instrHeader}>
        <div style={s.instrTop}>Draw a circle that is</div>
        <div style={s.instrAccuracy}>{minAccuracy}% accurate</div>
        {timer > 0 && (
          <div style={s.timerWrap}>
            <span style={s.timerLabel}>{timeLeft}s</span>
            <div style={s.timerTrack}>
              <div style={{ ...s.timerFill, width: `${timerPct}%`, background: timerColor }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Drawing canvas ── */}
      <div style={{ ...s.canvasWrap, opacity: expired ? 0.45 : 1 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ ...s.canvas, cursor: expired ? "not-allowed" : "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* ── Footer ── */}
      <div style={s.footer}>
        <div style={s.footerLeft}>
          <button
            style={s.iconBtn}
            title="Reset"
            onClick={handleReset}
            onMouseEnter={e => (e.currentTarget.style.background = "#f1f3f4")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <IconRefresh />
          </button>
          <button
            style={s.iconBtn}
            title="Close"
            onClick={() => closeWithResult(false)}
            onMouseEnter={e => (e.currentTarget.style.background = "#f1f3f4")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <IconClose />
          </button>
        </div>

        <button
          style={{ ...s.verifyBtn, ...(canVerify ? {} : s.verifyDisabled) }}
          disabled={!canVerify}
          onClick={() => { if (canVerify) closeWithResult(true); }}
          onMouseEnter={e => { if (canVerify) (e.currentTarget.style.background = "#1a73e8"); }}
          onMouseLeave={e => { if (canVerify) (e.currentTarget.style.background = "#4285f4"); }}
        >
          VERIFY
        </button>
      </div>
    </div>
  );
};

export default PerfectCircle;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s: Record<string, CSSProperties> = {
  card: {
    fontFamily: "'Roboto', 'Arial', sans-serif",
    background: "#fff",
    width: 460,
    borderRadius: 4,
    boxShadow: "0 1px 3px 1px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)",
    overflow: "hidden",
    userSelect: "none",
    position: "relative",
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px 12px",
    background: "#fff",
    borderBottom: "1px solid #e8eaed",
  },
  robotEmoji: {
    fontSize: 32,
    lineHeight: 1,
  },
  titleMain: {
    fontSize: 22,
    fontWeight: 700,
    color: "#202124",
    letterSpacing: 0.1,
    lineHeight: 1.2,
  },
  titleSub: {
    fontSize: 12,
    fontWeight: 400,
    color: "#5f6368",
    marginTop: 2,
  },
  instrHeader: {
    background: "#4285f4",
    color: "#fff",
    padding: "12px 18px 10px",
    margin: "0 12px",
    borderRadius: "0 0 4px 4px",
  },
  instrTop: {
    fontSize: 13,
    fontWeight: 400,
    opacity: 0.92,
    marginBottom: 2,
  },
  instrAccuracy: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 0.2,
    lineHeight: 1.2,
  },
  timerWrap: { marginTop: 10 },
  timerLabel: {
    display: "block",
    textAlign: "right",
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: 700,
    marginBottom: 4,
  },
  timerTrack: {
    height: 5,
    background: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    transition: "width 1s linear, background 0.5s",
    borderRadius: 3,
  },
  canvasWrap: {
    margin: "12px 12px 0",
    borderRadius: 3,
    overflow: "hidden",
    lineHeight: 0,
    transition: "opacity 0.3s",
  },
  canvas: {
    display: "block",
    background: "#0d0d0d",
    width: CANVAS_W,
    height: CANVAS_H,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px 8px 8px",
    background: "#fff",
    borderTop: "1px solid #e8eaed",
    marginTop: 12,
  },
  footerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: "50%",
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    transition: "background 0.15s",
  },
  verifyBtn: {
    background: "#4285f4",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "10px 26px",
    fontSize: 14,
    fontFamily: "Roboto, Arial, sans-serif",
    fontWeight: 700,
    letterSpacing: 0.8,
    cursor: "pointer",
    transition: "background 0.15s",
    boxShadow: "0 1px 3px rgba(66,133,244,0.4)",
  },
  verifyDisabled: {
    background: "#dadce0",
    color: "#9aa0a6",
    boxShadow: "none",
    cursor: "not-allowed",
  },
};

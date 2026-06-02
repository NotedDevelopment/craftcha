import React, { useState, useEffect, useCallback, CSSProperties } from "react";
import { fetchNui } from "../utils/fetchNui";
import { ItemDef, RecipeDef, craftchaItems, craftchaRecipes } from "../AppConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Item = { type: string; qty: number } | null;
type Location = "craft" | "inv" | "result";

export interface CraftchaPayload {
  recipeKey: string;
  inventory: Item[];
  timer?: number;
  invRows?: number;
}

// ---------------------------------------------------------------------------
// Resolve image path — FiveM NUI can't handle absolute paths like /img/foo.webp
// Strip leading slash so it becomes relative to the NUI page (web/build/index.html)
// ---------------------------------------------------------------------------
const resolveImg = (img: string): string => {
  if (!img) return "";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return img.replace(/^\//, ""); // "/img/foo.webp" -> "img/foo.webp"
};

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------
interface SlotProps {
  item: Item;
  items: Record<string, ItemDef>;
  onClick: (right: boolean) => void;
  dimmed?: boolean;
  size?: number;
}

const Slot: React.FC<SlotProps> = ({ item, items, onClick, dimmed, size = 60 }) => {
  const [hovered, setHovered] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    setHovered(true);
    if (item && items[item.type]) {
      timerRef.current = setTimeout(() => setTooltip(true), 600);
    }
  };
  const onLeave = () => {
    setHovered(false);
    setTooltip(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div
      data-slot="true"
      style={{
        width: size,
        height: size,
        background: hovered && !dimmed ? "#e8f0fe" : "#fff",
        border: "1px solid #d3d3d3",
        borderRadius: 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        opacity: dimmed ? 0.35 : 1,
        transition: "background 0.1s",
        boxSizing: "border-box",
      }}
      onClick={() => onClick(false)}
      onContextMenu={(e) => { e.preventDefault(); onClick(true); }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {item && items[item.type] && (
        <>
          <img
            src={resolveImg(items[item.type].img)}
            alt={items[item.type].label}
            style={{
              width: "75%",
              height: "75%",
              objectFit: "contain",
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
            draggable={false}
          />
          {item.qty > 1 && (
            <span style={{
              position: "absolute",
              bottom: 2,
              right: 3,
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 0 2px #000, 1px 1px 0 #000",
              pointerEvents: "none",
              fontFamily: "Roboto, sans-serif",
            }}>
              {item.qty}
            </span>
          )}
          {tooltip && (
            <div style={{
              position: "absolute",
              bottom: "110%",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(30,30,30,0.92)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "Roboto, sans-serif",
              padding: "4px 8px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 9999,
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              {items[item.type].label}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SVG icons
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
// Craftcha — <Craftcha /> with no props, listens for openCraftcha NUI event
// ---------------------------------------------------------------------------
const Craftcha: React.FC<{ payload: CraftchaPayload }> = ({ payload }) => {
  const items   = craftchaItems;
  const recipes = craftchaRecipes;

  const [recipeKey, setRecipeKey] = useState<string>("");
  const [craft, setCraft]     = useState<Item[]>(Array(9).fill(null));
  const [inv, setInv]         = useState<Item[]>([]);
  const [origInv, setOrigInv] = useState<Item[]>([]);
  const [cursor, setCursor]   = useState<Item>(null);

  // Refs so handleClick can read current state without nested setState calls
  const craftRef  = React.useRef<Item[]>(craft);
  const invRef    = React.useRef<Item[]>(inv);
  const cursorRef = React.useRef<Item>(cursor);
  craftRef.current  = craft;
  invRef.current    = inv;
  cursorRef.current = cursor;
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [timer, setTimer]     = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const [hasCrafted, setHasCrafted] = useState(false);
  const [invRows, setInvRows] = useState(1);

  // Initialise from payload prop — App.tsx catches the NUI event and passes it down
  useEffect(() => {
    if (!payload) return;
    const safeInv = (payload.inventory ?? []).map(x => x ? { ...x } : null);
    setRecipeKey(payload.recipeKey);
    setInv(safeInv);
    setOrigInv(safeInv.map(x => x ? { ...x } : null));
    setCraft(Array(9).fill(null));
    setCursor(null);
    setExpired(false);
    setHasCrafted(false);
    const requestedRows = payload.invRows ?? 1;
    const itemCount     = (payload.inventory ?? []).length;
    const minRows       = Math.ceil(itemCount / 6);
    setInvRows(Math.max(requestedRows, minRows));
    const t = payload.timer ?? 0;
    setTimer(t);
    setTimeLeft(t);
  }, [payload]);

  const recipe = recipes[recipeKey];

  // Timer
  useEffect(() => {
    if (!timer || timer <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); setExpired(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!expired) return;
    const t = setTimeout(() => closeWithResult(false), 1200);
    return () => clearTimeout(t);
  }, [expired]);

  // Escape / Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") closeWithResult(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Intentionally no outside-click handler — dropping an item outside a slot
  // would destroy it. Player must place it back in a slot to deselect.

  const closeWithResult = useCallback((success: boolean) => {
    fetchNui("craftResult", { success }, { success });
    window.dispatchEvent(new MessageEvent("message", { data: { action: "setVisible", data: false } }));
  }, []);

  const checkRecipe = useCallback((craftGrid: Item[]): string | null => {
    // Convert flat 9-slot grid into 3x3 rows
    const rows: (string | null)[][] = [
      [craftGrid[0]?.type ?? null, craftGrid[1]?.type ?? null, craftGrid[2]?.type ?? null],
      [craftGrid[3]?.type ?? null, craftGrid[4]?.type ?? null, craftGrid[5]?.type ?? null],
      [craftGrid[6]?.type ?? null, craftGrid[7]?.type ?? null, craftGrid[8]?.type ?? null],
    ];

    // Crop to bounding box of non-null cells
    const usedRows = rows.filter(r => r.some(c => c !== null));
    if (usedRows.length === 0) return null;
    const usedCols = [0, 1, 2].filter(c => rows.some(r => r[c] !== null));
    const cropped = usedRows.map(r => usedCols.map(c => r[c]));

    // Compare cropped grid against each recipe shape
    for (const [key, rec] of Object.entries(recipes)) {
      const shape = rec.shape;
      if (!shape) continue;
      if (shape.length !== cropped.length) continue;
      if (shape[0].length !== cropped[0].length) continue;
      const matches = shape.every((row, r) =>
        row.every((expected, c) => expected === cropped[r][c])
      );
      if (matches) return key;
    }
    return null;
  }, [recipes]);

  const result      = checkRecipe(craft);  // whatever is currently craftable (any recipe)
  const gridMatch   = result !== null;          // something is craftable — show it in result slot
  const canVerify   = (result === recipeKey) || hasCrafted;  // only verify if it's the TARGET recipe

  const handleClick = useCallback((loc: Location, idx: number, right: boolean) => {
    if (expired) return;

    const craftArr = craftRef.current.map(x => x ? { ...x } : null);
    const invArr   = invRef.current.map(x => x ? { ...x } : null);
    let cur        = cursorRef.current ? { ...cursorRef.current } : null;

    const maxFor  = (type: string) => items[type]?.max ?? 64;
    const getSlot = (l: Location, i: number): Item => l === "craft" ? craftArr[i] : invArr[i];
    const setSlot = (l: Location, i: number, v: Item) => {
      if (l === "craft") craftArr[i] = v; else invArr[i] = v;
    };

    if (loc === "result") {
      const res = checkRecipe(craftArr);
      if (!res) return;
      const resultType = recipes[res]?.result;
      const resultQty  = recipes[res]?.resultQty ?? 1;
      if (!resultType) return;
      if (cur && cur.type !== resultType) return;
      const maxQ = maxFor(resultType);
      if ((cur?.qty ?? 0) >= maxQ) return;
      const addQty = Math.min(resultQty, maxQ - (cur?.qty ?? 0));
      cur = cur ? { ...cur, qty: cur.qty + addQty } : { type: resultType, qty: addQty };
      for (let i = 0; i < 9; i++) {
        if (craftArr[i]) {
          craftArr[i]!.qty -= 1;
          if (craftArr[i]!.qty <= 0) craftArr[i] = null;
        }
      }
      if (res === recipeKey) setHasCrafted(true);
    } else {
      const slot = getSlot(loc, idx);

      if (!right) {
        if (!cur) {
          if (!slot) return;
          cur = { type: slot.type, qty: slot.qty };
          setSlot(loc, idx, null);
        } else {
          if (!slot) {
            setSlot(loc, idx, { ...cur }); cur = null;
          } else if (slot.type === cur.type) {
            const max = maxFor(slot.type);
            const add = Math.min(cur.qty, max - slot.qty);
            slot.qty += add; cur.qty -= add;
            if (cur.qty <= 0) cur = null;
            setSlot(loc, idx, slot);
          } else {
            const tmp = { type: slot.type, qty: slot.qty };
            setSlot(loc, idx, { ...cur }); cur = tmp;
          }
        }
      } else {
        if (!cur) {
          if (!slot) return;
          const half = Math.ceil(slot.qty / 2);
          cur = { type: slot.type, qty: half };
          const rem = slot.qty - half;
          setSlot(loc, idx, rem > 0 ? { type: slot.type, qty: rem } : null);
        } else {
          if (!slot) {
            setSlot(loc, idx, { type: cur.type, qty: 1 });
            cur.qty -= 1; if (cur.qty <= 0) cur = null;
          } else if (slot.type === cur.type) {
            const max = maxFor(slot.type);
            if (slot.qty < max) {
              slot.qty += 1; setSlot(loc, idx, slot);
              cur.qty -= 1; if (cur.qty <= 0) cur = null;
            }
          }
        }
      }
    }

    setCraft([...craftArr]);
    setInv([...invArr]);
    setCursor(cur);
  }, [items, checkRecipe, expired, recipeKey, recipes]);

  const handleReset = () => {
    if (expired) return;
    setCraft(Array(9).fill(null));
    setInv(origInv.map(x => x ? { ...x } : null));
    setCursor(null);
    setHasCrafted(false);
    const requestedRows = payload.invRows ?? 1;
    const itemCount     = (payload.inventory ?? []).length;
    const minRows       = Math.ceil(itemCount / 6);
    setInvRows(Math.max(requestedRows, minRows));
  };

  const timerPct   = timer > 0 ? (timeLeft / timer) * 100 : 100;
  const timerColor = timerPct > 50 ? "#4285f4" : timerPct > 25 ? "#fbbc04" : "#ea4335";

  const resultItem: Item = result && recipes[result]
    ? { type: recipes[result].result, qty: recipes[result].resultQty }
    : null;

  return (
    <div style={s.card} onContextMenu={e => e.preventDefault()}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerSub}>
          {expired ? "Time's up!" : "Select items to craft a"}
        </div>
        <div style={s.headerTitle}>{recipe?.label ?? recipeKey}</div>
        {timer > 0 && (
          <div style={s.timerWrap}>
            <span style={s.timerLabel}>{timeLeft}s</span>
            <div style={s.timerTrack}>
              <div style={{ ...s.timerFill, width: `${timerPct}%`, background: timerColor }} />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{
        ...s.body,
        pointerEvents: expired ? "none" : "auto",
        opacity: expired ? 0.5 : 1,
      }}>
        {/* Crafting */}
        <div style={s.sectionLabel}>Crafting</div>
        <div style={s.craftRow}>
          <div style={s.grid3x3}>
            {craft.map((item, i) => (
              <Slot key={i} item={item} items={items} onClick={r => handleClick("craft", i, r)} />
            ))}
          </div>
          <div style={s.arrowWrap}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="#5f6368">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
          </div>
          <div style={s.resultWrap}>
            <Slot
              item={resultItem}
              items={items}
              onClick={r => handleClick("result", 0, r)}
              dimmed={!gridMatch}
              size={68}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Inventory */}
        <div style={s.sectionLabel}>Inventory</div>
        <div style={{ ...s.invGrid, gridTemplateColumns: `repeat(6, 60px)`, gridTemplateRows: `repeat(${invRows}, 60px)` }}>
          {Array.from({ length: invRows * 6 }).map((_, i) => (
            <Slot key={i} item={inv[i] ?? null} items={items} onClick={r => handleClick("inv", i, r)} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <div style={s.footerLeft}>
          <button
            style={s.iconBtn}
            title="Reset crafting grid"
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
          style={{ ...s.verifyBtn, ...(canVerify && !expired ? {} : s.verifyDisabled) }}
          disabled={!canVerify || expired}
          onClick={() => { if (canVerify && !expired) closeWithResult(true); }}
          onMouseEnter={e => { if (canVerify && !expired) (e.currentTarget.style.background = "#1a73e8"); }}
          onMouseLeave={e => { if (canVerify && !expired) (e.currentTarget.style.background = "#4285f4"); }}
        >
          VERIFY
        </button>
      </div>

      {/* Floating cursor item */}
      {cursor && (
        <div style={{ ...s.cursorEl, left: cursorPos.x, top: cursorPos.y }}>
          {items[cursor.type] && (
            <img
              src={resolveImg(items[cursor.type].img)}
              alt={cursor.type}
              style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", pointerEvents: "none" }}
              draggable={false}
            />
          )}
          {cursor.qty > 1 && (
            <span style={{
              position: "absolute", bottom: 0, right: 0,
              fontSize: 10, fontWeight: 700, color: "#fff",
              textShadow: "0 0 2px #000, 1px 1px 0 #000",
            }}>
              {cursor.qty}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Craftcha;

// ---------------------------------------------------------------------------
// Styles — Google reCAPTCHA visual language
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
  header: {
    background: "#4285f4",
    color: "#fff",
    padding: "14px 18px 12px",
    margin: "12px 12px 0",
    borderRadius: 4,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: 400,
    opacity: 0.92,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0.2,
    lineHeight: 1.15,
  },
  timerWrap: {
    marginTop: 10,
  },
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
  body: {
    background: "#f8f9fa",
    padding: "16px 18px 14px",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: "#5f6368",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  craftRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  grid3x3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 60px)",
    gridTemplateRows: "repeat(3, 60px)",
    gap: 3,
  },
  arrowWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 2px",
  },
  resultWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    borderRadius: 3,
    border: "1px solid #d3d3d3",
    padding: 3,
  },
  divider: {
    height: 1,
    background: "#e8eaed",
    margin: "12px 0",
  },
  invGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 60px)",
    gap: 3,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px 8px 8px",
    background: "#fff",
    borderTop: "1px solid #e8eaed",
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
  cursorEl: {
    position: "fixed",
    pointerEvents: "none",
    zIndex: 9999,
    transform: "translate(-50%, -50%)",
    width: 40,
    height: 40,
  },
};

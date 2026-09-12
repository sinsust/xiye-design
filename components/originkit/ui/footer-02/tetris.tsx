"use client";

"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const FALLBACK_COLORS = ["#F9731A", "#FFFFFF"];

const CLEAR_BLINKS = 2;
const BLINK_MS = 90;

const SHAPES: Array<Array<[number, number]>> = [
  [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseColor(color: string): [number, number, number, number] {
  const value = (color ?? "").trim();
  const hex = value.replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      1,
    ];
  }
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(",").map((p) => parseFloat(p));
    return [
      parts[0] || 0,
      parts[1] || 0,
      parts[2] || 0,
      parts[3] === undefined ? 1 : parts[3],
    ];
  }
  return [255, 255, 255, 1];
}

const rgba = (c: [number, number, number, number], alpha: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] * alpha})`;

interface TetrisProps {
  boardColor?: string;
  colors?: string[];
  movement?: number;
  cellSize?: number;
  gap?: number;
  rounded?: number;
  dropSpeed?: number;
  startFilled?: boolean;
  style?: CSSProperties;
}

interface Piece {
  shape: number;
  cells: Array<[number, number]>;
  color: number;
  col: number;
  row: number;

  startCol: number;
  startRow: number;
  targetCol: number;
  targetRow: number;
}

function __OriginkitBase_Tetris(props: TetrisProps) {
  const {
    boardColor = "rgba(255, 255, 255, 0.06)",
    colors = ["#F9731A", "#FFFFFF"],
    movement = 4,
    cellSize = 29,
    gap = 1,
    rounded = 20,
    dropSpeed = 2,
    startFilled = false,
    style,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const boardRGB = parseColor(boardColor);

    const source = colors && colors.length ? colors : FALLBACK_COLORS;
    const blockRGB = source.map(parseColor);

    const rand = mulberry32(0x7e7415);
    const pitch = cellSize + gap;

    const dropEvery = 1000 / Math.max(1, dropSpeed * 4);

    const wander = Math.min(10, Math.max(0, movement)) / 10;

    let alive = true;
    let raf = 0;
    let last = 0;
    let dropAcc = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;

    let cellW = 0;
    let cellH = 0;
    let pitchX = 0;
    let pitchY = 0;
    let cellRadius = 0;

    let grid: number[] = [];
    let piece: Piece | null = null;

    let clearing: number[] = [];
    let clearMs = 0;

    const at = (col: number, row: number) => grid[row * cols + col];

    function rotate(shape: number, turns: number): Array<[number, number]> {
      let cells = SHAPES[shape].map(([c, r]) => [c, r] as [number, number]);
      for (let t = 0; t < turns; t++) {
        let maxRow = 0;
        for (const [, r] of cells) maxRow = Math.max(maxRow, r);

        cells = cells.map(([c, r]) => [maxRow - r, c] as [number, number]);
      }

      let minC = Infinity;
      let minR = Infinity;
      for (const [c, r] of cells) {
        minC = Math.min(minC, c);
        minR = Math.min(minR, r);
      }
      return cells.map(([c, r]) => [c - minC, r - minR] as [number, number]);
    }

    function fits(cells: Array<[number, number]>, col: number, row: number) {
      for (const [c, r] of cells) {
        const gc = col + c;
        const gr = row + r;
        if (gc < 0 || gc >= cols || gr >= rows) return false;
        if (gr >= 0 && at(gc, gr) !== -1) return false;
      }
      return true;
    }

    function landing(cells: Array<[number, number]>, col: number): number {
      if (!fits(cells, col, 0)) return -1;
      let row = 0;
      while (fits(cells, col, row + 1)) row++;
      return row;
    }

    function score(cells: Array<[number, number]>, col: number, row: number) {
      const test = grid.slice();
      for (const [c, r] of cells) {
        const gr = row + r;
        if (gr >= 0) test[gr * cols + (col + c)] = 1;
      }

      let lines = 0;
      for (let r = 0; r < rows; r++) {
        let full = true;
        for (let c = 0; c < cols; c++) {
          if (test[r * cols + c] === -1) {
            full = false;
            break;
          }
        }
        if (full) lines++;
      }

      let aggHeight = 0;
      let holes = 0;
      let bump = 0;
      let prevTop = -1;
      for (let c = 0; c < cols; c++) {
        let top = rows;
        for (let r = 0; r < rows; r++) {
          if (test[r * cols + c] !== -1) {
            top = r;
            break;
          }
        }
        const height = rows - top;
        aggHeight += height;
        for (let r = top + 1; r < rows; r++) {
          if (test[r * cols + c] === -1) holes++;
        }
        if (prevTop >= 0) bump += Math.abs(top - prevTop);
        prevTop = top;
      }

      return lines * 4.0 - aggHeight * 0.5 - holes * 3.5 - bump * 0.3;
    }

    function spawn() {
      const shape = Math.floor(rand() * SHAPES.length);
      let bestCells: Array<[number, number]> | null = null;
      let bestCol = 0;
      let bestRow = 0;
      let bestScore = -Infinity;

      for (let turn = 0; turn < 4; turn++) {
        const cells = rotate(shape, turn);
        let width = 0;
        for (const [c] of cells) width = Math.max(width, c);
        for (let col = 0; col + width < cols; col++) {
          const row = landing(cells, col);
          if (row < 0) continue;
          const s = score(cells, col, row);
          if (s > bestScore) {
            bestScore = s;
            bestCells = cells;
            bestCol = col;
            bestRow = row;
          }
        }
      }

      if (!bestCells) {
        grid = new Array(cols * rows).fill(-1);
        piece = null;
        return;
      }

      let startRow = 0;
      let width = 0;
      for (const [c, r] of bestCells) {
        startRow = Math.max(startRow, r);
        width = Math.max(width, c);
      }
      startRow = -1 - startRow;

      const maxCol = cols - 1 - width;
      const swing = Math.round((rand() * 2 - 1) * wander * cols);
      const startCol = Math.min(maxCol, Math.max(0, bestCol + swing));
      const color =
        blockRGB.length > 1 ? Math.floor(rand() * blockRGB.length) : 0;
      piece = {
        shape,
        cells: bestCells,
        color,
        col: startCol,
        row: startRow,
        startCol,
        startRow,
        targetCol: bestCol,
        targetRow: bestRow,
      };
    }

    function lock() {
      if (!piece) return;
      for (const [c, r] of piece.cells) {
        const gr = piece.row + r;
        const gc = piece.col + c;
        if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
          grid[gr * cols + gc] = piece.color;
        }
      }
      piece = null;

      const full: number[] = [];
      for (let r = 0; r < rows; r++) {
        let solid = true;
        for (let c = 0; c < cols; c++) {
          if (grid[r * cols + c] === -1) {
            solid = false;
            break;
          }
        }
        if (solid) full.push(r);
      }
      if (full.length) {
        clearing = full;
        clearMs = CLEAR_BLINKS * BLINK_MS * 2;
      }
    }

    function collapse() {
      const gone = new Set(clearing);
      const next = new Array(cols * rows).fill(-1);
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (gone.has(r)) continue;
        for (let c = 0; c < cols; c++) {
          next[write * cols + c] = grid[r * cols + c];
        }
        write--;
      }
      grid = next;
      clearing = [];
    }

    function scatterInitialStack() {
      const limit = 8;

      const ceiling = Math.max(0, rows - limit);
      let guard = cols * rows;
      while (guard-- > 0) {
        const shape = Math.floor(rand() * SHAPES.length);

        const imperfect = rand() < 0.15;
        let bestCells: Array<[number, number]> | null = null;
        let bestCol = 0;
        let bestRow = 0;
        let bestScore = -Infinity;
        const options: Array<{
          cells: Array<[number, number]>;
          col: number;
          row: number;
        }> = [];
        for (let turn = 0; turn < 4; turn++) {
          const cells = rotate(shape, turn);
          let width = 0;
          for (const [c] of cells) width = Math.max(width, c);
          for (let col = 0; col + width < cols; col++) {
            const row = landing(cells, col);
            if (row < 0) continue;

            let top = rows;
            for (const [, r] of cells) top = Math.min(top, row + r);
            if (top < ceiling) continue;
            options.push({ cells, col, row });
            const s = score(cells, col, row);
            if (s > bestScore) {
              bestScore = s;
              bestCells = cells;
              bestCol = col;
              bestRow = row;
            }
          }
        }

        if (!bestCells) break;
        const chosen =
          imperfect && options.length > 1
            ? options[Math.floor(rand() * options.length)]
            : { cells: bestCells, col: bestCol, row: bestRow };

        const color =
          blockRGB.length > 1 ? Math.floor(rand() * blockRGB.length) : 0;
        for (const [c, r] of chosen.cells) {
          grid[(chosen.row + r) * cols + (chosen.col + c)] = color;
        }

        const full: number[] = [];
        for (let r = 0; r < rows; r++) {
          let solid = true;
          for (let c = 0; c < cols; c++) {
            if (grid[r * cols + c] === -1) {
              solid = false;
              break;
            }
          }
          if (solid) full.push(r);
        }
        if (full.length) {
          const gone = new Set(full);
          const next = new Array(cols * rows).fill(-1);
          let write = rows - 1;
          for (let r = rows - 1; r >= 0; r--) {
            if (gone.has(r)) continue;
            for (let c = 0; c < cols; c++) {
              next[write * cols + c] = grid[r * cols + c];
            }
            write--;
          }
          grid = next;
        }
      }
    }

    function build() {
      dpr = Math.min(2, window.devicePixelRatio || 1);

      const w = Math.max(1, Math.round(canvas.clientWidth));
      const h = Math.max(1, Math.round(canvas.clientHeight));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(4, Math.floor((w + gap) / pitch));
      rows = Math.max(6, Math.floor((h + gap) / pitch));

      cellW = Math.max(1, (w - gap * (cols - 1)) / cols);
      cellH = Math.max(1, (h - gap * (rows - 1)) / rows);
      pitchX = cellW + gap;
      pitchY = cellH + gap;

      cellRadius =
        (Math.min(cellW, cellH) / 2) *
        (Math.min(20, Math.max(0, rounded)) / 20);
      grid = new Array(cols * rows).fill(-1);
      piece = null;
      clearing = [];
      clearMs = 0;
      if (startFilled) scatterInitialStack();
      spawn();
    }

    function tilePath(col: number, row: number) {
      const x = col * pitchX;
      const y = row * pitchY;
      if (cellRadius > 0 && typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, cellW, cellH, cellRadius);
      } else {
        ctx.rect(x, y, cellW, cellH);
      }
    }

    function colorFor(index: number): [number, number, number, number] {
      return blockRGB[index] ?? blockRGB[0];
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) tilePath(c, r);
      }
      ctx.fillStyle = rgba(boardRGB, 1);
      ctx.fill();

      const flashing = new Set(clearing);
      const lit = clearMs > 0 && Math.floor(clearMs / BLINK_MS) % 2 === 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const color = grid[r * cols + c];
          if (color === -1) continue;
          ctx.beginPath();
          tilePath(c, r);
          if (flashing.has(r) && lit) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          } else {
            ctx.fillStyle = rgba(colorFor(color), 1);
          }
          ctx.fill();
        }
      }

      if (piece) {
        ctx.fillStyle = rgba(colorFor(piece.color), 1);
        for (const [c, r] of piece.cells) {
          const gr = piece.row + r;
          if (gr < 0) continue;
          ctx.beginPath();
          tilePath(piece.col + c, gr);
          ctx.fill();
        }
      }
    }

    function loop(time: number) {
      if (!alive) return;
      const dt = last ? Math.min(time - last, 200) : 0;
      last = time;

      if (clearMs > 0) {
        clearMs -= dt;
        if (clearMs <= 0) {
          clearMs = 0;
          collapse();
          spawn();
        }
        draw();
        raf = requestAnimationFrame(loop);
        return;
      }

      if (piece) {
        dropAcc += dt;
        while (dropAcc >= dropEvery && piece) {
          dropAcc -= dropEvery;
          if (piece.row < piece.targetRow) {
            piece.row++;

            const span = piece.targetRow - piece.startRow;
            const prog = span > 0 ? (piece.row - piece.startRow) / span : 1;
            piece.col = Math.round(
              piece.startCol + (piece.targetCol - piece.startCol) * prog,
            );
          } else {
            piece.col = piece.targetCol;
            lock();
          }
        }
      } else {
        spawn();
      }

      draw();
      raf = requestAnimationFrame(loop);
    }

    build();

    let built = `${canvas.clientWidth}x${canvas.clientHeight}`;
    const ro = new ResizeObserver(() => {
      const size = `${canvas.clientWidth}x${canvas.clientHeight}`;
      if (size === built) return;
      built = size;
      build();
    });
    ro.observe(canvas);

    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [
    boardColor,

    (colors ?? []).join(","),
    movement,
    cellSize,
    gap,
    rounded,
    dropSpeed,
    startFilled,
  ]);

  return (
    <div
      style={{
        ...style,
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

const __originkitPresetProps = {
  backgroundColor: "#212121",
  boardColor: "#212121",
  colors: ["#FDF9ED"],
  cellSize: 20,
};

export default function Tetris(props: Record<string, unknown>) {
  return (
    <__OriginkitBase_Tetris
      {...(__originkitPresetProps as Record<string, unknown>)}
      {...props}
    />
  );
}
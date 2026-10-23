import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs } from "../../lib/pdf";
import { Mark } from "../../lib/books";
export type ReaderMode = "read" | "highlight" | "ink" | "erase";
type Props = {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  ratio: number;
  root: HTMLElement | null;
  marks: Mark[];
  mode: ReaderMode;
  color: string;
  penWidth: number;
  fingerDraw: boolean;
  onMark: (page: number, kind: Mark["kind"], data: Mark["data"]) => void;
  onDelete: (id: string) => void;
};
function PdfPage({
  pdf,
  number,
  width,
  ratio,
  root,
  marks,
  mode,
  color,
  penWidth,
  fingerDraw,
  onMark,
  onDelete,
}: Props) {
  const box = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    text = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false),
    [pageRatio, setPageRatio] = useState(ratio),
    [error, setError] = useState(""),
    [draft, setDraft] = useState<number[][]>([]);
  const stroke = useRef<number[][]>([]);
  const finger = useRef<{
      x: number;
      y: number;
      t: number;
      vx: number;
      vy: number;
    } | null>(null),
    inertia = useRef(0);
  useEffect(() => () => cancelAnimationFrame(inertia.current), []);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    if (!root || !box.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root, rootMargin: "850px 0px" },
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    if (!near || !canvas.current || !text.current) {
      if (canvas.current) {
        canvas.current.width = 0;
        canvas.current.height = 0;
      }
      if (text.current) text.current.replaceChildren();
      return;
    }
    let disposed = false,
      render: any,
      layer: any,
      page: any;
    const target = canvas.current,
      container = text.current;
    setError("");
    (async () => {
      page = await pdf.getPage(number);
      if (disposed) return;
      const original = page.getViewport({ scale: 1 });
      setPageRatio(original.height / original.width);
      const viewport = page.getViewport({ scale: width / original.width });
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(6000000 / (viewport.width * viewport.height)),
      );
      target.width = Math.floor(viewport.width * dpr);
      target.height = Math.floor(viewport.height * dpr);
      render = page.render({
        canvas: target,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await render.promise;
      if (disposed) return;
      container.replaceChildren();
      container.style.setProperty(
        "--total-scale-factor",
        String(viewport.scale),
      );
      layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport,
      });
      await layer.render();
    })().catch((e) => {
      if (!disposed && e.name !== "RenderingCancelledException")
        setError("This page could not be rendered. " + e.message);
    });
    return () => {
      disposed = true;
      render?.cancel();
      layer?.cancel();
      container.replaceChildren();
      page?.cleanup();
    };
  }, [pdf, near, width, number]);
  const point = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  };
  const start = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "read" || mode === "erase") return;
    cancelAnimationFrame(inertia.current);
    if (mode === "ink" && e.pointerType === "touch" && !fingerDraw) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      finger.current = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        vx: 0,
        vy: 0,
      };
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = [point(e)];
    setDraft(stroke.current);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (finger.current && root) {
      const f = finger.current,
        dt = Math.max(1, performance.now() - f.t),
        dx = f.x - e.clientX,
        dy = f.y - e.clientY;
      root.scrollTop += dy;
      root.scrollLeft += dx;
      finger.current = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        vx: Math.max(-4, Math.min(4, dx / dt)),
        vy: Math.max(-4, Math.min(4, dy / dt)),
      };
      return;
    }
    if (!stroke.current.length) return;
    const p = point(e);
    if (mode === "highlight") stroke.current = [stroke.current[0], p];
    else if (stroke.current.length < 1400)
      stroke.current = [...stroke.current, p];
    setDraft([...stroke.current]);
  };
  const end = () => {
    if (finger.current && root) {
      let { vx, vy, t } = finger.current;
      finger.current = null;
      if (performance.now() - t < 100) {
        let last = performance.now();
        const step = (now: number) => {
          const dt = Math.min(32, now - last);
          last = now;
          root.scrollTop += vy * dt;
          root.scrollLeft += vx * dt;
          vx *= 0.9;
          vy *= 0.9;
          if (Math.abs(vx) + Math.abs(vy) > 0.03)
            inertia.current = requestAnimationFrame(step);
        };
        inertia.current = requestAnimationFrame(step);
      }
      return;
    }
    const pts = stroke.current;
    stroke.current = [];
    setDraft([]);
    if (pts.length < 2) return;
    if (modeRef.current === "highlight") {
      const [a, b] = [pts[0], pts.at(-1)!],
        x = Math.min(a[0], b[0]),
        y = Math.min(a[1], b[1]),
        w = Math.abs(a[0] - b[0]),
        h = Math.abs(a[1] - b[1]);
      if (w > 0.003 && h > 0.003)
        onMark(number, "highlight", { x, y, w, h, color });
    } else if (modeRef.current === "ink")
      onMark(number, "ink", { points: pts, color, penWidth });
  };
  const rect = (points: number[][]) => {
    const a = points[0],
      b = points.at(-1)!;
    return {
      x: Math.min(a[0], b[0]) * 1000,
      y: Math.min(a[1], b[1]) * 1000,
      width: Math.abs(a[0] - b[0]) * 1000,
      height: Math.abs(a[1] - b[1]) * 1000,
    };
  };
  return (
    <div
      ref={box}
      className="pdf-sheet"
      data-page={number}
      id={`pdf-page-${number}`}
      style={{ width, height: width * pageRatio }}
    >
      <div className="pdf-loading">{error || `Page ${number}`}</div>
      <canvas ref={canvas} aria-label={`Page ${number}`} />
      <div
        ref={text}
        className="textLayer pdf-text-layer"
        style={{ pointerEvents: mode === "read" ? "auto" : "none" }}
      />
      {error && (
        <div
          className="library-alert"
          style={{ position: "absolute", top: 20, left: 20, right: 20 }}
        >
          {error}
        </div>
      )}
      <svg
        className="pdf-mark-layer"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        style={{
          pointerEvents: mode === "read" ? "none" : "auto",
          touchAction:
            mode === "highlight" || mode === "ink"
              ? "none"
              : "pan-x pan-y pinch-zoom",
          cursor:
            mode === "erase"
              ? "pointer"
              : mode === "read"
                ? "auto"
                : "crosshair",
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          finger.current = null;
          stroke.current = [];
          setDraft([]);
        }}
        aria-label={`Page ${number} annotation layer`}
      >
        {marks
          .filter((m) => m.kind === "highlight" || m.kind === "ink")
          .map((m) =>
            m.kind === "highlight" ? (
              <rect
                key={m.id}
                x={(m.data.x || 0) * 1000}
                y={(m.data.y || 0) * 1000}
                width={(m.data.w || 0) * 1000}
                height={(m.data.h || 0) * 1000}
                fill={m.data.color}
                opacity=".35"
                onClick={() => mode === "erase" && onDelete(m.id)}
              />
            ) : (
              <polyline
                key={m.id}
                points={m.data.points
                  ?.map((p) => `${p[0] * 1000},${p[1] * 1000}`)
                  .join(" ")}
                fill="none"
                stroke={m.data.color}
                strokeWidth={m.data.penWidth || 2}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                onClick={() => mode === "erase" && onDelete(m.id)}
              />
            ),
          )}
        {draft.length > 1 &&
          (mode === "highlight" ? (
            <rect {...rect(draft)} fill={color} opacity=".4" />
          ) : (
            <polyline
              points={draft
                .map((p) => `${p[0] * 1000},${p[1] * 1000}`)
                .join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={penWidth}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
          ))}
      </svg>
      <span className="pdf-number">{number}</span>
    </div>
  );
}
export default memo(PdfPage);

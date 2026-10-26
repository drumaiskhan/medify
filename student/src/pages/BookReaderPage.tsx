import {authHeaders} from '../lib/client';
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Search,
  PanelRight,
  List,
  Highlighter,
  PenLine,
  MousePointer2,
  Eraser,
  Minus,
  Plus,
  Maximize,
  Minimize,
  Save,
  Trash2,
  X,
  Download,
  StickyNote,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import { pdfjs, pdfOptions } from "../lib/pdf";
import { api, apiBase } from "../lib/client";
import { Book, Mark } from "../lib/books";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import PdfPage, { ReaderMode } from "../components/reader/PdfPage";
type Theme = "light" | "sepia" | "night";
function savedStyle() {
  try {
    const p = JSON.parse(localStorage.getItem("medify-pen-style") || "{}");
    return {
      color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#263238",
      width: Number.isFinite(p.width) ? Math.max(1, Math.min(12, p.width)) : 2,
    };
  } catch {
    return { color: "#263238", width: 2 };
  }
}

export function BookReaderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const site = useSite();
  const [book, setBook] = useState<Book | null>(null),
    [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [marks, setMarks] = useState<Mark[]>([]),
    [current, setCurrent] = useState(1),
    [inputPage, setInputPage] = useState("1"),
    [ratio, setRatio] = useState(1.414),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [mode, setMode] = useState<ReaderMode>("read"),
    [color, setColor] = useState("#facc15"),
    [penColor, setPenColor] = useState(() => savedStyle().color),
    [penWidth, setPenWidth] = useState(() => savedStyle().width),
    [toolOptions, setToolOptions] = useState(false),
    [fingerDraw, setFingerDraw] = useState(false),
    [zoom, setZoom] = useState(1),
    [theme, setTheme] = useState<Theme>(() => {
      try {
        const t = localStorage.getItem("medify-reader-theme");
        return ["light", "sepia", "night"].includes(t || "")
          ? (t as Theme)
          : (site.readerTheme as Theme);
      } catch {
        return "light";
      }
    }),
    [focus, setFocus] = useState(false),
    [panel, setPanel] = useState<
      "contents" | "bookmarks" | "notes" | "search" | null
    >(null),
    [root, setRoot] = useState<HTMLDivElement | null>(null),
    [containerWidth, setContainerWidth] = useState(window.innerWidth),
    [note, setNote] = useState(""),
    [outline, setOutline] = useState<
      { title: string; page: number; level: number }[]
    >([]),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [searchProgress, setSearchProgress] = useState(0),
    [hits, setHits] = useState<{ page: number; text: string }[]>([]),
    [loadingPercent, setLoadingPercent] = useState(0);
  const searchToken = useRef(0),
    resume = useRef(1),
    position = useRef(1),
    hydrated = useRef(false),
    room = useRef<HTMLDivElement>(null),
    searchCache = useRef(new Map<number, string>()),
    anchor = useRef({ page: 1, offset: 0 }),
    previousWidth = useRef(0);
  const width = Math.round(
    Math.min(900, Math.max(220, containerWidth - (containerWidth <= 760 ? 14 : 40))) * zoom,
  );
  useEffect(() => {
    let alive = true;
    let task: any;
    hydrated.current = false;
    setReady(false);
    setLoadError("");
    setSaved("");
    searchCache.current.clear();
    (async () => {
      const b = await api(`/books/${id}`);
      if (!alive) return;
      setBook(b);
      let state = { page: 1, marks: [] };
      if (user) state = await api(`/books/${id}/state`);
      if (!alive) return;
      setMarks(state.marks);
      resume.current = state.page || 1;
      task = pdfjs.getDocument({
        ...pdfOptions,
        url: `${apiBase()}/books/${id}/file`,
        withCredentials: true,
        httpHeaders: authHeaders(),
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: 256 * 1024,
      });
      task.onProgress = ({
        loaded,
        total,
      }: {
        loaded: number;
        total: number;
      }) => {
        if (alive && total)
          setLoadingPercent(Math.min(99, Math.round((loaded / total) * 100)));
      };
      const document = await task.promise;
      if (!alive) {
        await document.destroy();
        return;
      }
      const first = await document.getPage(1);
      const v = first.getViewport({ scale: 1 });
      setRatio(v.height / v.width);
      setPdf(document);
      setLoadingPercent(100);
      const raw = await document.getOutline();
      const items: { title: string; page: number; level: number }[] = [];
      async function flatten(list: any[], level = 0) {
        for (const item of list) {
          if (!alive) return;
          try {
            let dest = item.dest;
            if (typeof dest === "string")
              dest = await document.getDestination(dest);
            if (dest) {
              const page =
                typeof dest[0] === "number"
                  ? dest[0] + 1
                  : (await document.getPageIndex(dest[0])) + 1;
              items.push({ title: item.title, page, level });
            }
          } catch {}
          if (item.items) await flatten(item.items, level + 1);
        }
      }
      if (raw) await flatten(raw);
      if (alive) setOutline(items);
    })().catch((e) => {
      if (alive) setLoadError(e.message || "Unable to open this book");
    });
    return () => {
      alive = false;
      searchToken.current++;
      task?.destroy();
    };
  }, [id, user?.uid]);
  useEffect(() => {
    if (!root) return;
    const observer = new ResizeObserver(() =>
      setContainerWidth(root.clientWidth),
    );
    observer.observe(root);
    setContainerWidth(root.clientWidth);
    return () => observer.disconnect();
  }, [root]);
  const jump = useCallback(
    (n: number) => {
      if (!pdf || !root) return;
      const page = Math.max(1, Math.min(pdf.numPages, Math.floor(n) || 1));
      const el = root.querySelector<HTMLElement>(`[data-page="${page}"]`);
      if (el) root.scrollTo({ top: el.offsetTop - 20, behavior: "auto" });
      setCurrent(page);
      setInputPage(String(page));
      // On a phone the sidebar covers the page, so close it once the reader has jumped.
      if (window.innerWidth <= 760) setPanel(null);
    },
    [pdf, root],
  );
  useEffect(() => {
    if (!pdf || !root || ready) return;
    const n = Math.max(1, Math.min(pdf.numPages, resume.current));
    const timer = requestAnimationFrame(() => {
      jump(n);
      position.current = n;
      hydrated.current = true;
      setReady(true);
    });
    return () => cancelAnimationFrame(timer);
  }, [pdf, root, ready, jump]);
  useEffect(() => {
    if (!root || !pdf || !ready) return;
    const visible = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target, e.intersectionRatio);
          else visible.delete(e.target);
        }
        const line =
          root.getBoundingClientRect().top +
          Math.min(100, root.clientHeight * 0.15);
        const list = Array.from(visible.keys()).sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        );
        const best = list.find(
          (el) => el.getBoundingClientRect().bottom > line,
        );
        if (best) setCurrent(Number((best as HTMLElement).dataset.page) || 1);
      },
      { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9] },
    );
    root.querySelectorAll(".pdf-sheet").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pdf, root, ready]);
  useEffect(() => {
    setInputPage(String(current));
    position.current = current;
    if (!ready || !user) return;
    setSaved("Saving position…");
    const timer = setTimeout(
      () =>
        api(`/books/${id}/progress`, { page: current })
          .then(() => setSaved("Progress saved"))
          .catch(() => setSaved("Not synced — use Save to retry")),
      900,
    );
    return () => clearTimeout(timer);
  }, [current, ready, user?.uid, id]);
  useEffect(
    () => () => {
      if (hydrated.current && user)
        fetch(`${apiBase()}/books/${id}/progress`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ page: position.current }),
        }).catch(() => {});
    },
    [id, user?.uid],
  );
  useEffect(() => {
    try {
      const stored = localStorage.getItem("medify-reader-theme");
      if (!stored) setTheme(site.readerTheme as Theme);
    } catch {}
  }, [site.readerTheme]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "medify-pen-style",
        JSON.stringify({ color: penColor, width: penWidth }),
      );
    } catch {}
  }, [penColor, penWidth]);
  useLayoutEffect(() => {
    if (
      root &&
      ready &&
      previousWidth.current &&
      width !== previousWidth.current
    ) {
      const target = root.querySelector<HTMLElement>(
        `[data-page="${anchor.current.page}"]`,
      );
      if (target)
        root.scrollTop =
          target.offsetTop +
          anchor.current.offset * (width / previousWidth.current);
    }
    previousWidth.current = width;
  }, [width, root, ready]);
  useEffect(() => {
    if (!root || !ready) return;
    const target = root.querySelector<HTMLElement>(`[data-page="${current}"]`);
    if (target)
      anchor.current = {
        page: current,
        offset: root.scrollTop - target.offsetTop,
      };
  }, [current, root, ready]);
  const save = async () => {
    if (!user) {
      setError("Sign in to save progress, bookmarks, and notes.");
      return;
    }
    try {
      await api(`/books/${id}/progress`, { page: current });
      setSaved("All changes saved");
    } catch (e: any) {
      setError(e.message);
    }
  };
  const createMark = useCallback(
    async (page: number, kind: Mark["kind"], data: Mark["data"]) => {
      if (!user) {
        setError("Sign in to keep your annotations and reading progress.");
        return false;
      }
      try {
        const m = await api(`/books/${id}/marks`, {
          id: crypto.randomUUID(),
          page,
          kind,
          data,
        });
        setMarks((old) => [...old, m]);
        setSaved("Annotation saved");
        return true;
      } catch (e: any) {
        setError(e.message);
        return false;
      }
    },
    [id, user?.uid],
  );
  const deleteMark = useCallback(
    async (markId: string) => {
      try {
        await api(`/books/${id}/marks/${markId}/delete`, {});
        setMarks((old) => old.filter((m) => m.id !== markId));
        setSaved("Annotation removed");
      } catch (e: any) {
        setError(e.message);
      }
    },
    [id],
  );
  const bookmark = () => {
    const existing = marks.find(
      (m) => m.kind === "bookmark" && m.page === current,
    );
    if (existing) deleteMark(existing.id);
    else createMark(current, "bookmark", { text: `Page ${current}` });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        jump(position.current + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        jump(position.current - 1);
      }
      if (e.key === "Escape") {
        setFocus(false);
        setPanel(null);
        setMode("read");
        setToolOptions(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [jump]);
  const marksByPage = useMemo(() => {
    const map = new Map<number, Mark[]>();
    for (const m of marks) {
      if (!map.has(m.page)) map.set(m.page, []);
      map.get(m.page)!.push(m);
    }
    return map;
  }, [marks]);
  const emptyMarks = useMemo<Mark[]>(() => [], []);
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdf || query.trim().length < 2) return;
    const token = ++searchToken.current;
    setSearching(true);
    setSearchProgress(0);
    setHits([]);
    const term = query.toLowerCase().trim();
    let found = 0;
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        if (token !== searchToken.current) return;
        let text = searchCache.current.get(n);
        if (text === undefined) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text = content.items.map((i: any) => i.str || "").join(" ");
          if (searchCache.current.size > 100)
            searchCache.current.delete(
              searchCache.current.keys().next().value!,
            );
          searchCache.current.set(n, text);
        }
        const index = text.toLowerCase().indexOf(term);
        if (index >= 0) {
          const hit = {
            page: n,
            text: text.slice(
              Math.max(0, index - 65),
              index + term.length + 120,
            ),
          };
          setHits((prev) => [...prev, hit]);
          found++;
          if (found >= 100) break;
        }
        setSearchProgress(Math.round((n / pdf.numPages) * 100));
        if (n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    } catch (e: any) {
      setError("Search stopped: " + e.message);
    } finally {
      if (token === searchToken.current) setSearching(false);
    }
  };
  const exportNotes = () => {
    const text = [
      book?.title,
      "",
      ...marks
        .filter((m) => m.kind === "note" || m.kind === "bookmark")
        .sort((a, b) => a.page - b.page)
        .map((m) => `Page ${m.page} — ${m.kind}\n${m.data.text || ""}\n`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-reading-notes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (loadError)
    return (
      <div className="reader" data-theme={theme}>
        <div className="reader-empty">
          <BookOpen size={38} />
          <h1 style={{ fontSize: 23, margin: "20px 0 10px" }}>
            We couldn't open this book
          </h1>
          <p>{loadError}</p>
          <Link className="library-btn" style={{ marginTop: 24 }} to="/books">
            Back to library
          </Link>
        </div>
      </div>
    );
  return (
    <div ref={room} className="reader" data-theme={theme}>
      {!focus ? (
        <>
          <header className="reader-top">
            <div className="reader-actions" style={{ minWidth: 0 }}>
              <Link
                to="/books"
                className="reader-btn"
                aria-label="Back to library"
              >
                <ArrowLeft />
              </Link>
              <div style={{ minWidth: 0 }}>
                <div className="reader-title">
                  {book?.title || "Opening your book…"}
                </div>
                <p className="reader-subtitle">
                  {book?.author || "MEDIFY READER"}
                </p>
              </div>
            </div>
            <div className="reader-actions">
              <button
                className="reader-btn"
                onClick={() => {
                  const next =
                    theme === "light"
                      ? "sepia"
                      : theme === "sepia"
                        ? "night"
                        : "light";
                  setTheme(next);
                  try {
                    localStorage.setItem("medify-reader-theme", next);
                  } catch {}
                }}
                title={`Theme: ${theme}`}
                aria-label={`Change theme, currently ${theme}`}
              >
                {theme === "night" ? <Moon /> : <Sun />}
                <span className="reader-desktop">{theme}</span>
              </button>
              <button
                className="reader-btn"
                onClick={() => {
                  setFocus(true);
                  setPanel(null);
                  setToolOptions(false);
                }}
                title="Hide toolbar / focus mode"
                aria-label="Hide toolbar"
              >
                <Maximize />
              </button>
              <button
                className="reader-btn"
                onClick={save}
                title="Save reading position"
                aria-label="Save reading position"
              >
                <Save />
              </button>
              <button
                className={`reader-btn ${panel ? "active" : ""}`}
                onClick={() => setPanel(panel ? null : "contents")}
                title="Reader sidebar"
                aria-label="Toggle reader sidebar"
              >
                <PanelRight />
              </button>
            </div>
          </header>
          <div className="reader-toolbar">
            <div className="reader-actions">
              <button
                className="reader-btn"
                disabled={current <= 1}
                onClick={() => jump(current - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  jump(Number(inputPage));
                }}
              >
                <input
                  aria-label="Page number"
                  className="reader-input"
                  style={{ width: 49, textAlign: "center", padding: "7px 3px" }}
                  type="number"
                  min={1}
                  max={pdf?.numPages || 1}
                  value={inputPage}
                  onChange={(e) => setInputPage(e.target.value)}
                  onBlur={() => jump(Number(inputPage))}
                />
              </form>
              <span className="reader-caption">/ {pdf?.numPages || "—"}</span>
              <button
                className="reader-btn"
                disabled={!pdf || current >= pdf.numPages}
                onClick={() => jump(current + 1)}
                aria-label="Next page"
              >
                <ChevronRight />
              </button>
            </div>
            <span className="reader-separator" />
            <button
              className="reader-btn"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
              disabled={zoom <= 0.5}
              aria-label="Zoom out"
            >
              <Minus />
            </button>
            <button
              className="reader-btn"
              onClick={() => setZoom(1)}
              title="Fit to width"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="reader-btn"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              disabled={zoom >= 2.5}
              aria-label="Zoom in"
            >
              <Plus />
            </button>
            <span className="reader-separator" />
            {[
              {
                id: "read",
                label: "Read and select text",
                icon: MousePointer2,
              },
              {
                id: "highlight",
                label: "Highlight an area",
                icon: Highlighter,
              },
              { id: "ink", label: "Pen (stylus or mouse)", icon: PenLine },
              { id: "erase", label: "Erase annotation", icon: Eraser },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`reader-btn ${mode === id ? "active" : ""}`}
                onClick={() => {
                  setMode(id as ReaderMode);
                  setToolOptions(id === "ink" || id === "highlight");
                }}
                aria-label={label}
                title={label}
              >
                <Icon />
              </button>
            ))}
            {(mode === "highlight" || mode === "ink") && (
              <div className="reader-tool-picker">
                <button
                  className="reader-btn"
                  onClick={() => setToolOptions(!toolOptions)}
                  aria-label="Pen colour and thickness"
                  aria-expanded={toolOptions}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: mode === "ink" ? penColor : color,
                      border: "1px solid #aaa",
                    }}
                  />
                  {mode === "ink" ? `${penWidth} px` : "Colour"} ▾
                </button>
                {toolOptions && (
                  <div
                    className="reader-tool-popover"
                    role="dialog"
                    aria-label="Annotation style"
                  >
                    <div
                      className="reader-actions"
                      style={{ justifyContent: "space-between" }}
                    >
                      <strong>
                        {mode === "ink" ? "Pen settings" : "Highlighter colour"}
                      </strong>
                      <button
                        className="reader-btn"
                        onClick={() => setToolOptions(false)}
                        aria-label="Close pen settings"
                      >
                        <X />
                      </button>
                    </div>
                    <p className="reader-caption">Choose a colour</p>
                    <div
                      className="reader-actions"
                      style={{
                        gap: 12,
                        flexWrap: "wrap",
                        margin: "12px 0 18px",
                      }}
                    >
                      {(mode === "ink"
                        ? [
                            "#263238",
                            "#ffffff",
                            "#ef4444",
                            "#2563eb",
                            "#16a34a",
                            "#9333ea",
                            "#ec4899",
                            "#f59e0b",
                          ]
                        : [
                            "#facc15",
                            "#4ade80",
                            "#60a5fa",
                            "#f472b6",
                            "#fb923c",
                          ]
                      ).map((c) => (
                        <button
                          key={c}
                          className={`reader-color ${c === (mode === "ink" ? penColor : color) ? "active" : ""}`}
                          style={{ background: c, width: 23, height: 23 }}
                          onClick={() => {
                            if (mode === "ink") setPenColor(c);
                            else setColor(c);
                            setToolOptions(false);
                          }}
                          aria-label={`Use colour ${c}`}
                        />
                      ))}
                    </div>
                    {mode === "ink" && (
                      <>
                        <p className="reader-caption">Line thickness</p>
                        <div
                          className="reader-actions"
                          style={{ gap: 7, margin: "10px 0" }}
                        >
                          {[1, 2, 4, 6, 9, 12].map((w) => (
                            <button
                              key={w}
                              className={`reader-btn ${penWidth === w ? "active" : ""}`}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                width: 35,
                              }}
                              onClick={() => {
                                setPenWidth(w);
                                setToolOptions(false);
                              }}
                              aria-label={`Pen size ${w} pixels`}
                            >
                              <span
                                style={{
                                  width: 18,
                                  height: w,
                                  background: penColor,
                                  borderRadius: 6,
                                  border: "1px solid #aaa",
                                }}
                              />
                              <small>{w}</small>
                            </button>
                          ))}
                        </div>
                        <label
                          className="reader-caption"
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={fingerDraw}
                            onChange={(e) => setFingerDraw(e.target.checked)}
                          />
                          Draw with finger (otherwise fingers scroll)
                        </label>
                      </>
                    )}
                    <button
                      className="reader-btn active"
                      style={{ width: "100%", marginTop: 10 }}
                      onClick={() => {
                        setToolOptions(false);
                        setFocus(true);
                      }}
                    >
                      <Minimize />
                      Hide tools & study
                    </button>
                    <p className="reader-caption" style={{ marginTop: 10 }}>
                      Your selected tool stays active. Tap “Show tools” to bring
                      the toolbar back.
                    </p>
                  </div>
                )}
              </div>
            )}
            <span className="reader-separator" />
            <button
              className={`reader-btn ${marks.some((m) => m.page === current && m.kind === "bookmark") ? "active" : ""}`}
              onClick={bookmark}
              title="Bookmark this page"
              aria-label="Bookmark this page"
            >
              <Bookmark />
            </button>
            <button
              className="reader-btn"
              onClick={() => setPanel("search")}
              aria-label="Search inside book"
            >
              <Search />
            </button>
          </div>
        </>
      ) : (
        <button
          className="reader-btn reader-focus-toggle"
          onClick={() => setFocus(false)}
        >
          <PanelRight />
          Show tools
        </button>
      )}
      <div
        className="reader-layout"
        onPointerDown={() => setToolOptions(false)}
      >
        {!pdf ? (
          <div className="reader-empty">
            <div className="reader-spinner" />
            <p style={{ fontSize: 13 }}>
              Preparing your reading space…{" "}
              {loadingPercent > 0 ? `${loadingPercent}%` : ""}
            </p>
          </div>
        ) : (
          <div
            className="reader-scroll"
            ref={setRoot}
            onScroll={() => {
              if (!root || !ready) return;
              const target = root.querySelector<HTMLElement>(
                `[data-page="${position.current}"]`,
              );
              if (target)
                anchor.current = {
                  page: position.current,
                  offset: root.scrollTop - target.offsetTop,
                };
            }}
          >
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                pdf={pdf}
                number={i + 1}
                width={width}
                ratio={ratio}
                root={root}
                marks={marksByPage.get(i + 1) || emptyMarks}
                mode={mode}
                color={mode === "ink" ? penColor : color}
                penWidth={penWidth}
                fingerDraw={fingerDraw}
                onMark={createMark}
                onDelete={deleteMark}
              />
            ))}
          </div>
        )}
        {panel && (
          <button
            type="button"
            className="reader-panel-backdrop"
            aria-label="Close reader sidebar"
            onClick={() => setPanel(null)}
          />
        )}
        {panel && (
          <aside className="reader-panel">
            <div
              className="reader-actions"
              style={{ justifyContent: "space-between", marginBottom: 12 }}
            >
              <strong style={{ fontSize: 13 }}>Your reading companion</strong>
              <button
                className="reader-btn"
                onClick={() => setPanel(null)}
                aria-label="Close reader sidebar"
              >
                <X />
              </button>
            </div>
            <div className="reader-panel-tabs">
              {["contents", "bookmarks", "notes", "search"].map((p) => (
                <button
                  key={p}
                  className={panel === p ? "active" : ""}
                  onClick={() => setPanel(p as any)}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            {panel === "contents" && (
              <>
                <h2>Contents</h2>
                {outline.length ? (
                  outline.map((o, i) => (
                    <button
                      className="reader-btn"
                      key={i}
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        textAlign: "left",
                        paddingLeft: 8 + Math.min(o.level, 3) * 10,
                      }}
                      onClick={() => jump(o.page)}
                    >
                      <span>{o.title}</span>
                      <small>{o.page}</small>
                    </button>
                  ))
                ) : (
                  <p className="reader-caption">
                    This PDF has no embedded contents. Jump to a page using the
                    page number above.
                  </p>
                )}
              </>
            )}
            {panel === "bookmarks" && (
              <>
                <h2>Saved places</h2>
                <button className="library-btn" onClick={bookmark}>
                  <Bookmark size={15} />
                  Bookmark page {current}
                </button>
                {!marks.some((m) => m.kind === "bookmark") && (
                  <p className="reader-caption" style={{ marginTop: 18 }}>
                    Keep important pages one tap away.
                  </p>
                )}
                {marks
                  .filter((m) => m.kind === "bookmark")
                  .sort((a, b) => a.page - b.page)
                  .map((m) => (
                    <div className="reader-note" key={m.id}>
                      <div
                        className="reader-actions"
                        style={{ justifyContent: "space-between" }}
                      >
                        <button
                          className="reader-btn"
                          onClick={() => jump(m.page)}
                        >
                          Page {m.page}
                        </button>
                        <button
                          className="reader-btn"
                          onClick={() => deleteMark(m.id)}
                          aria-label={`Remove bookmark page ${m.page}`}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            )}
            {panel === "notes" && (
              <>
                <h2>Your notes</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      note.trim() &&
                      (await createMark(current, "note", { text: note }))
                    )
                      setNote("");
                  }}
                >
                  <label className="reader-caption" htmlFor="reading-note">
                    Add a thought on page {current}
                  </label>
                  <textarea
                    id="reading-note"
                    className="reader-input"
                    rows={4}
                    maxLength={5000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Connect the idea to a clinical case…"
                  />
                  <button
                    className="reader-btn active"
                    style={{ marginTop: 8 }}
                    disabled={!note.trim()}
                  >
                    <Plus />
                    Save note
                  </button>
                </form>
                <button
                  className="reader-btn"
                  style={{ margin: "16px 0" }}
                  onClick={exportNotes}
                >
                  <Download />
                  Export notes & bookmarks
                </button>
                {marks
                  .filter((m) => m.kind !== "bookmark")
                  .sort((a, b) => a.page - b.page)
                  .map((m) => (
                    <div className="reader-note" key={m.id}>
                      <div
                        className="reader-actions"
                        style={{ justifyContent: "space-between" }}
                      >
                        <button
                          className="reader-btn"
                          onClick={() => jump(m.page)}
                        >
                          Page {m.page} · {m.kind}
                        </button>
                        <button
                          className="reader-btn"
                          onClick={() => deleteMark(m.id)}
                          aria-label={`Delete ${m.kind} on page ${m.page}`}
                        >
                          <Trash2 />
                        </button>
                      </div>
                      {m.data.text && <p>{m.data.text}</p>}
                    </div>
                  ))}
              </>
            )}
            {panel === "search" && (
              <>
                <h2>Find in this book</h2>
                <form onSubmit={search}>
                  <input
                    className="reader-input"
                    aria-label="Search PDF text"
                    placeholder="e.g. inflammation"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    minLength={2}
                  />
                  <div className="reader-actions" style={{ margin: "10px 0" }}>
                    <button
                      className="reader-btn active"
                      disabled={!pdf || query.trim().length < 2 || searching}
                    >
                      <Search />
                      Search
                    </button>
                    {searching && (
                      <button
                        className="reader-btn"
                        type="button"
                        onClick={() => {
                          searchToken.current++;
                          setSearching(false);
                        }}
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </form>
                <p className="reader-caption">
                  {searching
                    ? `Searching… ${searchProgress}%`
                    : `${hits.length} matching pages (maximum 100).`}{" "}
                  Scanned pages need an existing text layer to be searchable.
                </p>
                {hits.map((h) => (
                  <button
                    key={h.page}
                    className="reader-note"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => jump(h.page)}
                  >
                    <strong>Page {h.page}</strong>
                    <p style={{ fontSize: 11, marginTop: 5 }}>{h.text}</p>
                  </button>
                ))}
              </>
            )}
          </aside>
        )}
      </div>
      {!focus && (
        <footer className="reader-footer">
          <span>
            {pdf
              ? `${Math.round((current / pdf.numPages) * 100)}% through this book`
              : "Loading"}{" "}
            <span className="reader-desktop">
              ·{" "}
              {mode === "read"
                ? "Read at your own pace"
                : mode === "ink"
                  ? "Draw with a stylus or mouse; fingers scroll"
                  : mode === "highlight"
                    ? "Drag over an area to highlight"
                    : "Tap a highlight or ink stroke to erase"}
            </span>
          </span>
          <span>{user ? saved : "Sign in to save your progress"}</span>
        </footer>
      )}
      {error && (
        <div className="reader-error" role="alert">
          {error}
          <button
            className="reader-btn"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X />
          </button>
        </div>
      )}
    </div>
  );
}

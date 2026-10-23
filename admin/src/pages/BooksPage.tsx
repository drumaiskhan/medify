import { useEffect, useState, useRef } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Upload,
  ImagePlus,
  LoaderCircle,
} from "lucide-react";
import { api } from "../lib/client";
import { Book, coverURL, uploadBook } from "../lib/books";
import { getAllYearsAdmin, YearDoc } from "../services/curriculum";
const empty = {
  title: "",
  author: "",
  description: "",
  yearId: "",
  category: "",
  published: true,
  isFree: false,
  pageCount: 1,
};
export function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]),
    [years, setYears] = useState<YearDoc[]>([]),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [edit, setEdit] = useState<Book | null | undefined>(undefined),
    [form, setForm] = useState(empty),
    [pdf, setPdf] = useState<File | null>(null),
    [driveLink,setDriveLink]=useState(""),
    [cover, setCover] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [inspecting, setInspecting] = useState(false),
    [progress, setProgress] = useState(0),
    [deleting, setDeleting] = useState<Book | null>(null),
    [maxMB, setMaxMB] = useState(100);
  const coverManual = useRef(false),
    inspection = useRef(0);
  const reload = async () => {
    setLoading(true);
    try {
      const [b, y] = await Promise.all([api("/books"), getAllYearsAdmin()]);
      setBooks(b);
      setYears(y);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
    api("/admin/settings")
      .then((s) => setMaxMB(s.maxBookMB))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!cover) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  useEffect(() => {
    if (edit === undefined) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        inspection.current++;
        setEdit(undefined);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [edit, busy]);
  const open = (book: Book | null) => {
    inspection.current++;
    setInspecting(false);
    setEdit(book);
    setForm(
      book
        ? {
            title: book.title,
            author: book.author,
            description: book.description,
            yearId: book.yearId,
            category: book.category,
            published: book.published,
            isFree: book.isFree,
            pageCount: book.pageCount,
          }
        : { ...empty, yearId: years[0]?.id || "" },
    );
    setPdf(null);
    setDriveLink("");
    setCover(null);
    coverManual.current = false;
    setError("");
    setProgress(0);
  };
  const choosePDF = async (file?: File) => {
    if (!file) return;
    const seq = ++inspection.current;
    setError("");
    setPdf(null);
    if (file.size > maxMB * 1024 * 1024) {
      setError(`PDF must be at most ${maxMB} MB`);
      return;
    }
    setInspecting(true);
    try {
      const { inspectPDF } = await import("../lib/pdf");
      const result = await inspectPDF(file);
      if (seq !== inspection.current) return;
      setPdf(file);
      setForm((v) => ({
        ...v,
        pageCount: result.pageCount,
        title: v.title || file.name.replace(/\.pdf$/i, ""),
      }));
      if (!coverManual.current && (!edit || !edit.hasCover))
        setCover(result.cover);
    } catch (e: any) {
      if (seq === inspection.current)
        setError(
          "Could not open this PDF. Use an unlocked, valid PDF. " + e.message,
        );
    } finally {
      if (seq === inspection.current) setInspecting(false);
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!edit && !pdf && !driveLink.trim()) {
      setError("Choose a PDF or paste a Google Drive link first");
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, String(v)));
      if (driveLink.trim()) data.append("driveLink",driveLink.trim());
      if (pdf) data.append("pdf", pdf);
      if (cover) data.append("cover", cover);
      await uploadBook(data, edit?.id, setProgress);
      setEdit(undefined);
      const parent=years.find(y=>y.id===form.yearId);
      setMessage(!form.published?'Book saved as a draft. Enable Published to show it to students.':parent?.published===false?'Book saved, but its academic year is hidden. Publish that year in Curriculum to show this book.':edit?'Book updated and published to the student library.':'Book published to the student library.');
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const visible = books.filter(
    (b) =>
      (!filter || b.yearId === filter) &&
      [b.title, b.author, b.category]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="studio-eyebrow">CURATED FOR YOUR STUDENTS</div>
          <h1>
            Book library{" "}
            <span style={{ fontSize: 15, color: "#7a8e91" }}>
              ({books.length})
            </span>
          </h1>
          <p>Upload, organise, and publish your medical textbooks.</p>
        </div>
        <button className="studio-btn primary" onClick={() => open(null)}>
          <Plus />
          Add book
        </button>
      </div>
      {message && (
        <div className="studio-alert studio-success" role="status">
          {message}
        </div>
      )}
      {error && edit === undefined && (
        <div className="studio-alert" role="alert">
          {error}
        </div>
      )}
      <div className="studio-actions" style={{ marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search
            size={17}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              color: "#7b9298",
            }}
          />
          <input
            className="studio-search"
            style={{ paddingLeft: 38 }}
            placeholder="Search books, authors, or subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search books"
          />
        </div>
        <select
          className="studio-search"
          style={{ width: 190 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter year"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="studio-empty">Loading your library…</div>
      ) : !visible.length ? (
        <div className="studio-card studio-empty">
          <BookOpen size={40} />
          <h3>
            {books.length
              ? "No matching books"
              : "A home for your best resources"}
          </h3>
          <p>
            {books.length
              ? "Try a different search or year."
              : "Upload a PDF. We can create its cover from the first page."}
          </p>
        </div>
      ) : (
        <div className="studio-bookgrid">
          {visible.map((b) => (
            <article className="studio-book" key={b.id}>
              <div className="studio-cover">
                {b.hasCover ? (
                  <img
                    src={coverURL(b)}
                    alt={`${b.title} cover`}
                    crossOrigin="use-credentials"
                    loading="lazy"
                  />
                ) : (
                  <BookOpen size={65} color="#6d9691" />
                )}
                <span className="studio-pill">
                  {b.published ? "Published" : "Draft"} ·{" "}
                  {b.isFree ? "Free" : "Members"}
                </span>
              </div>
              <div className="studio-bookbody">
                <div className="studio-eyebrow">
                  {b.category || "MEDICAL LIBRARY"}
                </div>
                <h3>{b.title}</h3>
                <p>{b.author || "Author not specified"}</p>
                <p style={{ marginTop: 12 }}>
                  {years.find((y) => y.id === b.yearId)?.name || b.yearId} ·{" "}
                  {b.pageCount} pages
                </p>
                <div
                  className="studio-actions"
                  style={{ marginTop: 18, justifyContent: "space-between" }}
                >
                  <button
                    className="studio-btn"
                    onClick={() => open(b)}
                    aria-label={`Edit ${b.title}`}
                  >
                    <Pencil />
                    Edit book
                  </button>
                  <button
                    className="studio-btn"
                    onClick={() => setDeleting(b)}
                    aria-label={`Delete ${b.title}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {edit !== undefined && (
        <div className="studio-modal">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-dialog-title"
            className="studio-dialog"
          >
            <div className="studio-heading">
              <div>
                <div className="studio-eyebrow">LIBRARY EDITOR</div>
                <h1 id="book-dialog-title">
                  {edit ? "Edit book" : "Add a new book"}
                </h1>
              </div>
              <button
                className="studio-btn"
                disabled={busy}
                onClick={() => {
                  inspection.current++;
                  setEdit(undefined);
                }}
                aria-label="Close editor"
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="studio-form">
                <label className="studio-field full studio-upload">
                  <span>
                    <Upload
                      size={18}
                      style={{ display: "inline", marginRight: 8 }}
                    />
                    {edit ? "Replace PDF (optional)" : "Book PDF"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => choosePDF(e.target.files?.[0])}
                    disabled={busy || !!driveLink.trim()}
                  />
                  <span className="studio-small">
                    Up to {maxMB} MB.{" "}
                    {inspecting
                      ? "Inspecting pages and generating cover…"
                      : pdf
                        ? `${form.pageCount} pages · ${(pdf.size / 1048576).toFixed(1)} MB`
                        : "A cover will be generated automatically for new books."}
                  </span>
                  {edit && (
                    <span className="studio-small">
                      Replacing a PDF preserves reading history. Use a new book
                      for a different edition.
                    </span>
                  )}
                </label>
                <label className="studio-field full">
                  {edit ? 'Replace with Google Drive PDF (optional)' : 'Or paste a Google Drive PDF link'}
                  <input type="url" placeholder="https://drive.google.com/file/d/…/view" value={driveLink} disabled={busy || !!pdf || inspecting} onChange={e=>setDriveLink(e.target.value)}/>
                  <span className="studio-small">In Drive: Share → General access → Anyone with the link (Viewer). Allow downloading. Students read through Medify; the link is not included in student book details. Drive availability and download quotas still apply. You can upload a cover below.</span>
                  {pdf&&<button type="button" className="studio-btn" disabled={busy} onClick={()=>{inspection.current++;setPdf(null);if(!coverManual.current)setCover(null);}}>Clear selected PDF to use a Drive link</button>}
                </label>
                {driveLink.trim()&&<label className="studio-field">PDF page count<input type="number" min={1} max={20000} required value={form.pageCount} onChange={e=>setForm({...form,pageCount:Number(e.target.value)})}/><span className="studio-small">Enter the PDF's actual page count so saved progress and annotations work correctly.</span></label>}
                <label className="studio-field">
                  Book title
                  <input
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </label>
                <label className="studio-field">
                  Author
                  <input
                    maxLength={160}
                    value={form.author}
                    onChange={(e) =>
                      setForm({ ...form, author: e.target.value })
                    }
                  />
                </label>
                <label className="studio-field">
                  Academic year
                  <select
                    required
                    value={form.yearId}
                    onChange={(e) =>
                      setForm({ ...form, yearId: e.target.value })
                    }
                  >
                    <option value="">Choose year</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="studio-field">
                  Subject / category
                  <input
                    placeholder="e.g. Pathology"
                    maxLength={80}
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                </label>
                <label className="studio-field full">
                  Description
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                <label className="studio-field">
                  <span>
                    <ImagePlus size={16} style={{ display: "inline" }} /> Custom
                    thumbnail (optional)
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 5 * 1048576) {
                        setError("Cover must be at most 5 MB");
                        return;
                      }
                      if (f) {
                        coverManual.current = true;
                        setCover(f);
                      }
                    }}
                  />
                  <span className="studio-small">
                    JPEG, PNG or WebP · up to 5 MB
                  </span>
                </label>
                <div
                  style={{
                    height: 130,
                    background: "#f0f5f2",
                    borderRadius: 10,
                    display: "flex",
                    justifyContent: "center",
                    padding: 8,
                  }}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="New cover preview"
                      style={{ objectFit: "contain" }}
                    />
                  ) : edit?.hasCover ? (
                    <img
                      src={coverURL(edit)}
                      crossOrigin="use-credentials"
                      alt="Current cover"
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <BookOpen
                      size={50}
                      style={{ alignSelf: "center", color: "#7d9b91" }}
                    />
                  )}
                </div>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) =>
                      setForm({ ...form, published: e.target.checked })
                    }
                  />
                  Published and visible to students
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={form.isFree}
                    onChange={(e) =>
                      setForm({ ...form, isFree: e.target.checked })
                    }
                  />
                  Free access without membership
                </label>
              </div>
              {error && (
                <div role="alert" className="studio-alert">
                  {error}
                </div>
              )}
              {busy && (
                <>
                  <div className="studio-progress">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <p className="studio-small">
                    {progress === 100
                      ? "Processing upload…"
                      : `Uploading ${progress}%`}
                  </p>
                </>
              )}
              <div
                className="studio-actions"
                style={{ justifyContent: "flex-end", marginTop: 26 }}
              >
                <button
                  type="button"
                  className="studio-btn"
                  disabled={busy}
                  onClick={() => {
                    inspection.current++;
                    setEdit(undefined);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="studio-btn primary"
                  disabled={busy || inspecting}
                >
                  {busy ? <LoaderCircle /> : <Upload />}
                  {busy ? "Saving…" : "Save book"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleting && (
        <div className="studio-modal">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="studio-dialog"
            style={{ maxWidth: 420 }}
          >
            <h2 id="delete-title" style={{ fontSize: 22, fontWeight: 700 }}>
              Delete this book?
            </h2>
            <p className="studio-muted" style={{ margin: "15px 0" }}>
              “{deleting.title}”, its files, and all students' saved annotations
              will be removed permanently.
            </p>
            <div className="studio-actions">
              <button
                className="studio-btn"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Keep book
              </button>
              <button
                className="studio-btn danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/admin/books/${deleting.id}/delete`, {});
                    setDeleting(null);
                    await reload();
                  } catch (e: any) {
                    setError(e.message);
                    setDeleting(null);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete book
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Search,
  Star,
  ArrowRight,
  LockKeyhole,
  Clock3,
} from "lucide-react";
import { api } from "../lib/client";
import { Book, coverURL } from "../lib/books";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
export function BooksPage() {
  const { user } = useAuth();
  const settings = useSite();
  const [books, setBooks] = useState<Book[]>([]),
    [search, setSearch] = useState(""),
    [year, setYear] = useState(""),
    [category, setCategory] = useState(""),
    [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload,setReload]=useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api("/books")
      .then((b) => {
        if (active) setBooks(b);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.uid,reload,settings.booksEnabled]);
  useEffect(()=>{const refresh=()=>{if(!document.hidden)setReload(n=>n+1);};const timer=window.setInterval(refresh,30000);window.addEventListener("focus",refresh);return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);};},[]);
  const visible = books.filter(
    (b) =>
      (!year || b.yearId === year) &&
      (!category || b.category === category) &&
      (!saved || b.favorite) &&
      [b.title, b.author, b.category]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const recent = books
    .filter((b) => b.lastRead && b.canRead && b.page)
    .sort((a, b) => Date.parse(b.lastRead!) - Date.parse(a.lastRead!))[0];
  const favorite = async (b: Book) => {
    if (!user) {
      setError("Sign in to save favourites to your account.");
      return;
    }
    try {
      await api(`/books/${b.id}/progress`, { favorite: !b.favorite });
      setBooks((old) =>
        old.map((x) => (x.id === b.id ? { ...x, favorite: !x.favorite } : x)),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div className="library-home">
      <div className="library-hero">
        <div>
          <div className="library-kicker">THE {settings.siteName} LIBRARY</div>
          <h1>A little focus. A lot to discover.</h1>
          <p>
            {settings.tagline}
            <br />
            Your books, bookmarks, and next chapter — all in one place.
          </p>
        </div>
        <Link className="library-btn" to="/dashboard">
          <Clock3 size={16} />
          My dashboard
        </Link>
      </div>
      {error && (
        <div className="library-alert" role="alert">
          {error}{" "}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {!settings.booksEnabled ? (
        <div className="library-empty">
          <BookOpen size={38} />
          <h2>The library will be back soon</h2>
          <p>Your notes remain available from your dashboard.</p>
        </div>
      ) : (
        <>
          {recent && (
            <div className="library-resume">
              <div>
                <div className="library-kicker">PICK UP WHERE YOU LEFT OFF</div>
                <h2>{recent.title}</h2>
                <p style={{ fontSize: 12, color: "#658177" }}>
                  Page {recent.page} of {recent.pageCount}
                </p>
              </div>
              <Link
                className="library-btn primary"
                to={`/books/${recent.id}/read`}
              >
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <div className="library-tools">
            <button className="library-btn" disabled={loading} onClick={()=>setReload(n=>n+1)}>Refresh books</button>
            <div style={{ position: "relative", flex: 1, minWidth: 170 }}>
              <Search
                size={17}
                style={{
                  position: "absolute",
                  top: 13,
                  left: 12,
                  color: "#89a0a5",
                }}
              />
              <input
                className="library-input"
                style={{ paddingLeft: 38, width: "100%" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a book, author, or subject…"
                aria-label="Search library"
              />
            </div>
            <select
              className="library-input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-label="Filter academic year"
            >
              <option value="">All years</option>
              {Array.from(new Set(books.map((b) => b.yearId))).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select
              className="library-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter category"
            >
              <option value="">All subjects</option>
              {Array.from(
                new Set(books.map((b) => b.category).filter(Boolean)),
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className={`library-btn ${saved ? "active" : ""}`}
              onClick={() => setSaved(!saved)}
            >
              <Star size={15} />
              Favourites
            </button>
          </div>
          <p className="library-count">
            {visible.length} {visible.length === 1 ? "book" : "books"} in your
            collection
          </p>
          {loading ? (
            <div className="library-empty">Loading library…</div>
          ) : !visible.length ? (
            <div className="library-empty">
              <BookOpen size={40} />
              <h2>
                {books.length
                  ? "Nothing here just yet"
                  : "Your library is taking shape"}
              </h2>
              <p>
                {books.length
                  ? "Try another search, subject, or year."
                  : "Published books will appear here when your administrator adds them."}
              </p>
            </div>
          ) : (
            <div className="library-grid">
              {visible.map((b) => (
                <article key={b.id} className="library-card">
                  <div className="library-cover">
                    {b.hasCover ? (
                      <img
                        src={coverURL(b)}
                        alt={`${b.title} cover`}
                        loading="lazy"
                        crossOrigin="use-credentials"
                      />
                    ) : (
                      <BookOpen size={64} color="#6e9d92" />
                    )}
                    <span className="library-badge">
                      {b.isFree
                        ? "Free to read"
                        : b.canRead
                          ? "Your membership"
                          : "Member book"}
                    </span>
                    {b.canRead && (
                      <button
                        className={`library-favorite ${b.favorite ? "active" : ""}`}
                        onClick={() => favorite(b)}
                        aria-label={`${b.favorite ? "Unsave" : "Save"} ${b.title}`}
                      >
                        <Star
                          size={16}
                          fill={b.favorite ? "currentColor" : "none"}
                        />
                      </button>
                    )}
                  </div>
                  <div className="library-card-body">
                    <div className="library-kicker" style={{ fontSize: 9 }}>
                      {b.category || "MEDICAL LIBRARY"}
                    </div>
                    <h2>{b.title}</h2>
                    <p>{b.author || "Medical resource"}</p>
                    <p style={{ marginTop: 10 }}>
                      {b.pageCount} pages · {b.yearId}
                    </p>
                    {b.description && (
                      <p
                        style={{
                          marginTop: 10,
                          lineHeight: 1.65,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {b.description}
                      </p>
                    )}
                    {b.page && (
                      <div
                        className="library-progress"
                        title={`Page ${b.page} of ${b.pageCount}`}
                      >
                        <i
                          style={{
                            width: `${Math.min(100, (b.page / b.pageCount) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                    <Link
                      className={`library-btn ${b.canRead ? "primary" : ""}`}
                      style={{ width: "100%", marginTop: 17 }}
                      to={
                        b.canRead
                          ? `/books/${b.id}/read`
                          : user
                            ? "/dashboard"
                            : "/login"
                      }
                    >
                      {b.canRead ? (
                        <>
                          <BookOpen size={15} />
                          {b.page && b.page > 1
                            ? "Continue reading"
                            : "Open book"}
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={15} />
                          View access
                        </>
                      )}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {settings.supportEmail && (
        <p style={{ marginTop: 30, fontSize: 12, color: "#6b7f85" }}>
          Need a hand?{" "}
          <a
            href={`mailto:${settings.supportEmail}`}
            style={{ color: "var(--brand)" }}
          >
            Contact support
          </a>
        </p>
      )}
    </div>
  );
}

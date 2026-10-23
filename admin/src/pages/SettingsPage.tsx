import {Link} from 'react-router-dom';
import { useEffect, useState } from "react";
import {
  Settings,
  Palette,
  BookOpen,
  ShieldCheck,
  Server,
  Save,
} from "lucide-react";
import { api } from "../lib/client";
export function SettingsPage() {
  const [form, setForm] = useState<any>(null),
    [tab, setTab] = useState("general"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("");
  const dirty = !!form && JSON.stringify(form) !== saved;
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
  useEffect(() => {
    api("/admin/settings")
      .then(value=>{setForm(value);setSaved(JSON.stringify(value));})
      .catch((e) => setError(e.message));
  }, []);
  const set = (k: string, v: any) => {
    setMessage("");
    setForm({ ...form, [k]: v });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/admin/settings", form);
      const next={ ...form, ...result };
      setForm(next);
      setSaved(JSON.stringify(next));
      document.documentElement.style.setProperty("--brand", result.accent);
      setMessage(
        "Settings saved. Students see updates when they reload the site.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="studio-eyebrow">MAKE MEDIFY YOURS</div>
          <h1>Settings</h1>
          <p>Manage your platform, appearance, student access, and communication.</p>
        </div>
      </div>
      {error && (
        <div className="studio-alert" role="alert">
          {error}
        </div>
      )}
      {!form ? (
        <div className="studio-empty">Loading settings…</div>
      ) : (
        <form onSubmit={save}>
          <div className="studio-tabs">
            {[
              { id: "general", label: "Platform", icon: Settings },
              { id: "branding", label: "Branding", icon: Palette },
              { id: "access", label: "Student access", icon: ShieldCheck },
              { id: "reader", label: "Reader", icon: BookOpen },
              { id: "communication", label: "Communication", icon: Settings },
              { id: "payments", label: "Payments", icon: Settings },
              { id: "system", label: "System", icon: Server },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`studio-btn ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
          {dirty&&<div className="studio-alert" role="status">You have unsaved changes. Switching sections keeps your draft.</div>}
          <div className="studio-card" style={{ maxWidth: 850 }}>
            {tab === "general" && (
              <div className="studio-form">
                <label className="studio-field">
                  Site name
                  <input
                    maxLength={60}
                    required
                    value={form.siteName}
                    onChange={(e) => set("siteName", e.target.value)}
                  />
                </label>
                <label className="studio-field">
                  Support email
                  <input
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => set("supportEmail", e.target.value)}
                  />
                </label>
                <label className="studio-field full">
                  Library tagline
                  <input
                    maxLength={160}
                    value={form.tagline}
                    onChange={(e) => set("tagline", e.target.value)}
                  />
                </label>
                <label className="studio-field full">
                  Student announcement
                  <textarea
                    maxLength={500}
                    rows={3}
                    placeholder="e.g. New pathology books are now available."
                    value={form.announcement}
                    onChange={(e) => set("announcement", e.target.value)}
                  />
                  <span className="studio-small">
                    Displayed below student navigation. Leave blank to hide.
                  </span>
                </label>
              </div>
            )}
            {tab === "branding" && (
              <div className="studio-form">
                <label className="studio-field">
                  Accent colour
                  <input
                    type="color"
                    value={form.accent}
                    onChange={(e) => set("accent", e.target.value)}
                    style={{ height: 50 }}
                  />
                  <span className="studio-small">
                    Used in the new admin workspace and student library.
                  </span>
                </label>
                <div
                  style={{
                    background: form.accent,
                    borderRadius: 14,
                    color: "white",
                    padding: 24,
                  }}
                >
                  <BookOpen />
                  <h2 style={{ fontSize: 23, fontWeight: 750, marginTop: 12 }}>
                    {form.siteName}
                  </h2>
                  <p style={{ fontSize: 12 }}>{form.tagline}</p>
                </div>
              </div>
            )}
            {tab === "access" && (
              <div style={{ display: "grid", gap: 25 }}>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={form.registrationOpen}
                    onChange={(e) => set("registrationOpen", e.target.checked)}
                  />
                  <span>
                    <strong>Allow new registrations</strong>
                    <br />
                    <span className="studio-small">
                      Existing accounts can still sign in when this is off.
                    </span>
                  </span>
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={form.booksEnabled}
                    onChange={(e) => set("booksEnabled", e.target.checked)}
                  />
                  <span>
                    <strong>Enable student book library</strong>
                    <br />
                    <span className="studio-small">
                      Turning this off also blocks student book-file access at
                      the API.
                    </span>
                  </span>
                </label>
                <div className="studio-alert studio-success">
                  Member books require verified email and approval for the
                  book's academic year. Free books are available without
                  membership.
                </div>
              </div>
            )}
            {tab === "reader" && (
              <div className="studio-form">
                <label className="studio-field">
                  Default reading theme
                  <select
                    value={form.readerTheme}
                    onChange={(e) => set("readerTheme", e.target.value)}
                  >
                    <option value="light">Light — crisp white pages</option>
                    <option value="sepia">Sepia — warm paper</option>
                    <option value="night">Night — low-light reading</option>
                  </select>
                  <span className="studio-small">
                    Students can override this on their device.
                  </span>
                </label>
                <div className="studio-muted">
                  The reader includes page search, bookmarks, annotations, saved
                  progress, focus mode, and keyboard navigation. Scanned PDFs
                  without a text layer do not support text search.
                </div>
              </div>
            )}
            {tab === "communication" && <div><h2>Student communication</h2><p className="studio-muted">Announcements below navigation are managed in Platform. Use notifications for targeted updates and feedback for private support conversations.</p><div className="studio-actions" style={{marginTop:20}}><Link className="studio-btn" to="/notifications" onClick={e=>{if(dirty&&!window.confirm('Leave without saving settings?'))e.preventDefault();}}>Manage notifications</Link><Link className="studio-btn" to="/feedback" onClick={e=>{if(dirty&&!window.confirm('Leave without saving settings?'))e.preventDefault();}}>Feedback inbox</Link></div></div>}
            {tab === "payments" && <div><h2>Payments & discounts</h2><p className="studio-muted">Manage bank details, payment instructions, discount coupons, and student transactions in their dedicated screens.</p><div className="studio-actions" style={{marginTop:20}}>{[['/payment-details','Payment details'],['/coupons','Discount coupons'],['/students','Transactions']].map(([to,label])=><Link key={to} className="studio-btn" to={to} onClick={e=>{if(dirty&&!window.confirm('Leave without saving settings?'))e.preventDefault();}}>{label}</Link>)}</div></div>}
            {tab === "system" && (
              <>
                <h2 style={{ fontWeight: 750, marginBottom: 18 }}>
                  Hosting & storage
                </h2>
                <div className="studio-row">
                  <span>Database</span>
                  <strong>PostgreSQL</strong>
                </div>
                <div className="studio-row">
                  <span>Email configuration</span>
                  <strong>
                    {form.emailConfigured
                      ? "SMTP configured"
                      : "Not configured"}
                  </strong>
                </div>
                <div className="studio-row">
                  <span>Maximum PDF upload</span>
                  <strong>{form.maxBookMB} MB</strong>
                </div>
                <div className="studio-row">
                  <span>Thumbnail formats</span>
                  <strong>JPEG · PNG · WebP</strong>
                </div>
                <p className="studio-muted" style={{ marginTop: 20 }}>
                  Database, SMTP credentials, private upload directory and
                  server upload limits are managed in the backend environment.
                  Back up both PostgreSQL and the private upload folder. SMTP
                  configuration status does not confirm delivery.
                </p>
              </>
            )}
          </div>
          {dirty&&<button type="button" className="studio-btn" style={{marginTop:20,marginRight:12}} disabled={busy} onClick={()=>{if(window.confirm('Discard all unsaved settings changes?')){setForm(JSON.parse(saved));setMessage('');setError('');}}}>Discard changes</button>}
          {message && (
            <div role="status" className="studio-alert studio-success">
              {message}
            </div>
          )}
          {dirty && (
            <button
              className="studio-btn primary"
              style={{ marginTop: 24 }}
              disabled={busy}
            >
              <Save />
              {busy ? "Saving…" : "Save changes"}
            </button>
          )}
        </form>
      )}
    </>
  );
}

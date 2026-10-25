import {Link} from 'react-router-dom';
import { useEffect, useState } from "react";
import {
  Settings,
  Palette,
  BookOpen,
  ShieldCheck,
  Server,
  Save,
  Sparkles,
} from "lucide-react";
import { api } from "../lib/client";
import { AiSettingsPanel } from "./AiSettingsPanel";
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
              { id: "ai", label: "AI", icon: Sparkles },
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
                <label className="studio-field">Contact phone
                  <input type="tel" maxLength={35} value={form.contactPhone || ''} onChange={e=>set('contactPhone',e.target.value)} placeholder="+92..." />
                </label>
                <label className="studio-field">WhatsApp number
                  <input type="tel" maxLength={35} value={form.contactWhatsApp || ''} onChange={e=>set('contactWhatsApp',e.target.value)} placeholder="+92..." />
                </label>
                <label className="studio-field">Public website
                  <input type="url" maxLength={350} value={form.contactWebsite || ''} onChange={e=>set('contactWebsite',e.target.value)} placeholder="https://med-ify.live" />
                </label>
                <label className="studio-field">
                  Contact location
                  <input maxLength={180} value={form.contactLocation || ''} onChange={(e) => set('contactLocation', e.target.value)} placeholder="City, province, country" />
                </label>
                <label className="studio-field">
                  Founder / organization
                  <input maxLength={120} value={form.founderName || ''} onChange={(e) => set('founderName', e.target.value)} />
                </label>
                <label className="studio-field full">
                  Footer description
                  <textarea maxLength={450} rows={3} value={form.footerDescription || ''} onChange={(e) => set('footerDescription', e.target.value)} />
                </label>
                <label className="studio-field full">
                  Copyright / footer location
                  <input maxLength={180} value={form.footerCopyright || ''} onChange={(e) => set('footerCopyright', e.target.value)} placeholder="All rights reserved." />
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
                <label className="studio-field full">
                  Site logo (HTTPS URL or site asset path)
                  <input maxLength={500} value={form.logoUrl || ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="/assets/logo.png or https://..." />
                  <span className="studio-small">For an uploaded logo, host the image at a trusted HTTPS URL; it is displayed in the student navigation, homepage and footer.</span>
                </label>
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
            {tab === "payments" && <div>
              <h2>Subscription prices (PKR)</h2>
              <p className="studio-muted">Prices are stored in PostgreSQL and used by checkout, coupon validation and student plan cards. Existing payments are not repriced.</p>
              <div className="studio-form" style={{marginTop:18, marginBottom:22}}>
                {([['quarterly','Quarterly · 3 months'],['half-yearly','Half-yearly · 6 months'],['annual','Annual · 12 months']] as const).map(([key,label]) => (
                  <label className="studio-field" key={key}>{label}
                    <input type="number" min={0} max={1000000} step={1} required value={form.planPrices?.[key] ?? 0} onChange={e=>set('planPrices',{...(form.planPrices || {}),[key]:Number(e.target.value)})}/>
                  </label>
                ))}
              </div>
              <h2>Plan card content</h2>
              <p className="studio-muted">Edit the names and benefits students see on the homepage, registration and checkout. Plan IDs and billing durations stay fixed to preserve existing subscriptions.</p>
              {([['quarterly','Quarterly · 3 months'],['half-yearly','Half-yearly · 6 months'],['annual','Annual · 12 months']] as const).map(([key,label]) => {
                const detail = form.planDetails?.[key] || {};
                const update = (field: string, value: any) => set('planDetails',{...form.planDetails,[key]:{...detail,[field]:value}});
                return <div className="studio-card" key={key} style={{marginTop:18,padding:18}}>
                  <h3>{label}</h3>
                  <div className="studio-form" style={{marginTop:12}}>
                    <label className="studio-field">Display name<input maxLength={90} value={detail.name || ''} onChange={e=>update('name',e.target.value)} placeholder={label}/></label>
                    <label className="studio-field">Billing description<input maxLength={180} value={detail.billingText || ''} onChange={e=>update('billingText',e.target.value)} placeholder="One-time payment"/></label>
                    <label className="studio-field full">Plan benefits (one per line, max 12)
                      <textarea rows={6} maxLength={2400} value={(detail.features||[]).join('\n')} onChange={e=>update('features',e.target.value.split('\n').slice(0,12))}/>
                    </label>
                    <label className="studio-check"><input type="checkbox" checked={detail.recommended === true} onChange={e=>update('recommended',e.target.checked)}/>Highlight as recommended</label>
                  </div>
                </div>;
              })}
              <h2 style={{marginTop:22}}>Payment details & discounts</h2><p className="studio-muted">Manage bank details, payment instructions, discount coupons, and student transactions in their dedicated screens.</p><div className="studio-actions" style={{marginTop:20}}>{[['/payment-details','Payment details'],['/coupons','Discount coupons'],['/students','Transactions']].map(([to,label])=><Link key={to} className="studio-btn" to={to} onClick={e=>{if(dirty&&!window.confirm('Leave without saving settings?'))e.preventDefault();}}>{label}</Link>)}</div></div>}
            {tab === "ai" && <AiSettingsPanel />}
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

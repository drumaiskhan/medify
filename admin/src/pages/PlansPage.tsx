import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Crown,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Star,
  RotateCcw,
  Clock,
  Eye,
} from "lucide-react";
import { api } from "../lib/client";
import "./plans.css";

type PlanKey = "quarterly" | "half-yearly" | "annual";
interface PlanDetail {
  name: string;
  billingText: string;
  features: string[];
  recommended: boolean;
}
const PLAN_META: { key: PlanKey; label: string; months: number }[] = [
  { key: "quarterly", label: "Quarterly", months: 3 },
  { key: "half-yearly", label: "Half-yearly", months: 6 },
  { key: "annual", label: "Annual", months: 12 },
];
const MAX_FEATURES = 12;
const fmt = (n: number) => "PKR " + (Number(n) || 0).toLocaleString("en-US");

export function PlansPage() {
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState("");
  const [active, setActive] = useState<PlanKey>("quarterly");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const snapshot = (f: any) =>
    JSON.stringify({ p: f?.planPrices, d: f?.planDetails });
  const dirty = !!form && snapshot(form) !== saved;

  useEffect(() => {
    api("/admin/settings")
      .then((v) => {
        setForm(v);
        setSaved(snapshot(v));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const detail = (k: PlanKey): PlanDetail => ({
    name: "",
    billingText: "",
    features: [],
    recommended: false,
    ...(form?.planDetails?.[k] || {}),
  });
  const setPrice = (k: PlanKey, v: number) => {
    setMessage("");
    setForm({ ...form, planPrices: { ...(form.planPrices || {}), [k]: v } });
  };
  const setDetail = (k: PlanKey, patch: Partial<PlanDetail>) => {
    setMessage("");
    const next = { ...(form.planDetails || {}) };
    // Only one plan can carry the "recommended" badge at a time
    if (patch.recommended === true)
      for (const other of PLAN_META)
        if (other.key !== k && next[other.key])
          next[other.key] = { ...next[other.key], recommended: false };
    next[k] = { ...detail(k), ...patch };
    setForm({ ...form, planDetails: next });
  };
  const setFeature = (k: PlanKey, i: number, v: string) => {
    const f = [...detail(k).features];
    f[i] = v;
    setDetail(k, { features: f });
  };
  const addFeature = (k: PlanKey) => {
    const f = detail(k).features;
    if (f.length < MAX_FEATURES) setDetail(k, { features: [...f, ""] });
  };
  const removeFeature = (k: PlanKey, i: number) =>
    setDetail(k, { features: detail(k).features.filter((_, x) => x !== i) });
  const moveFeature = (k: PlanKey, i: number, dir: -1 | 1) => {
    const f = [...detail(k).features];
    const j = i + dir;
    if (j < 0 || j >= f.length) return;
    [f[i], f[j]] = [f[j], f[i]];
    setDetail(k, { features: f });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      // The settings endpoint rebuilds the whole record from what it receives,
      // so send every field, with empty feature lines removed.
      const cleaned: any = { ...form, planDetails: { ...form.planDetails } };
      for (const { key } of PLAN_META)
        cleaned.planDetails[key] = {
          ...detail(key),
          features: detail(key).features.map((x) => x.trim()).filter(Boolean),
        };
      const result = await api("/admin/settings", cleaned);
      const next = { ...form, ...result };
      setForm(next);
      setSaved(snapshot(next));
      setMessage("Membership plans saved. Students see them after reloading the site.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    if (!window.confirm("Discard all unsaved plan changes?")) return;
    const s = JSON.parse(saved);
    setForm({ ...form, planPrices: s.p, planDetails: s.d });
    setMessage("");
    setError("");
  };

  const cheapestMonthly = useMemo(() => {
    if (!form) return null;
    return PLAN_META.map(({ key, months }) => ({
      key,
      perMonth: (Number(form.planPrices?.[key]) || 0) / months,
    }));
  }, [form]);

  const current = PLAN_META.find((p) => p.key === active)!;
  const d = form ? detail(active) : null;

  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="studio-eyebrow">MEMBERSHIP</div>
          <h1>Membership plans</h1>
          <p>Set prices and the benefits students see on the homepage, registration and checkout.</p>
        </div>
      </div>

      {error && <div className="studio-alert" role="alert">{error}</div>}
      {!form ? (
        !error && <div className="studio-empty">Loading plans…</div>
      ) : (
        <>
          <div className="pl-overview">
            {PLAN_META.map(({ key, label, months }) => {
              const dt = detail(key);
              const per = cheapestMonthly?.find((x) => x.key === key)?.perMonth || 0;
              return (
                <button
                  type="button"
                  key={key}
                  className={`pl-tile ${active === key ? "on" : ""}`}
                  onClick={() => setActive(key)}
                >
                  {dt.recommended && (
                    <span className="pl-badge"><Star size={11} /> Recommended</span>
                  )}
                  <span className="pl-tile-label">{label}</span>
                  <strong className="pl-tile-price">{fmt(form.planPrices?.[key])}</strong>
                  <span className="pl-tile-sub">
                    <Clock size={12} /> {months} months · ≈ {fmt(Math.round(per))}/mo
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pl-layout">
            <section className="studio-card pl-editor">
              <div className="pl-editor-head">
                <span className="pl-icon"><Crown size={18} /></span>
                <div>
                  <h2>{current.label} plan</h2>
                  <small>{current.months} months of access · plan ID <code>{active}</code></small>
                </div>
              </div>

              <div className="studio-form">
                <label className="studio-field">
                  Price (PKR)
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    required
                    value={form.planPrices?.[active] ?? 0}
                    onChange={(e) => setPrice(active, Number(e.target.value))}
                  />
                </label>
                <label className="studio-field">
                  Display name
                  <input
                    maxLength={90}
                    value={d!.name}
                    onChange={(e) => setDetail(active, { name: e.target.value })}
                    placeholder={current.label + " Access"}
                  />
                </label>
                <label className="studio-field full">
                  Billing description
                  <input
                    maxLength={180}
                    value={d!.billingText}
                    onChange={(e) => setDetail(active, { billingText: e.target.value })}
                    placeholder="One-time payment · 3 months of access"
                  />
                </label>
              </div>

              <label className="pl-switch">
                <input
                  type="checkbox"
                  checked={d!.recommended}
                  onChange={(e) => setDetail(active, { recommended: e.target.checked })}
                />
                <span className="pl-track" aria-hidden="true" />
                <span>
                  <strong>Highlight as recommended</strong>
                  <small>Adds a badge and emphasis on student plan cards. Only one plan can be highlighted.</small>
                </span>
              </label>

              <div className="pl-features-head">
                <h3>Plan benefits</h3>
                <span className="studio-small">{d!.features.length}/{MAX_FEATURES}</span>
              </div>
              <ul className="pl-features">
                {d!.features.map((f, i) => (
                  <li key={i}>
                    <span className="pl-tick"><Check size={13} /></span>
                    <input
                      maxLength={200}
                      value={f}
                      onChange={(e) => setFeature(active, i, e.target.value)}
                      placeholder="Describe a benefit"
                      aria-label={`Benefit ${i + 1}`}
                    />
                    <button type="button" className="pl-icon-btn" onClick={() => moveFeature(active, i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                    <button type="button" className="pl-icon-btn" onClick={() => moveFeature(active, i, 1)} disabled={i === d!.features.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                    <button type="button" className="pl-icon-btn danger" onClick={() => removeFeature(active, i)} aria-label="Remove benefit"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="studio-btn"
                onClick={() => addFeature(active)}
                disabled={d!.features.length >= MAX_FEATURES}
              >
                <Plus /> Add benefit
              </button>
            </section>

            <aside className="pl-preview-wrap">
              <div className="pl-preview-label"><Eye size={14} /> Student preview</div>
              <div className={`pl-preview ${d!.recommended ? "rec" : ""}`}>
                {d!.recommended && <span className="pl-ribbon">Most popular</span>}
                <h3>{d!.name || current.label + " Access"}</h3>
                <div className="pl-price">
                  {fmt(form.planPrices?.[active])}
                </div>
                <p className="pl-billing">{d!.billingText || "—"}</p>
                <ul>
                  {d!.features.filter((x) => x.trim()).map((f, i) => (
                    <li key={i}><Check size={14} /> {f}</li>
                  ))}
                </ul>
                <div className="pl-cta">Choose plan</div>
              </div>
              <p className="studio-small" style={{ marginTop: 12 }}>
                Plan IDs and durations are fixed so existing subscriptions keep working. Existing payments are not repriced.
              </p>
              <div className="studio-actions" style={{ marginTop: 14 }}>
                <Link className="studio-btn" to="/coupons" onClick={(e) => { if (dirty && !window.confirm("Leave without saving plan changes?")) e.preventDefault(); }}>Discount coupons</Link>
                <Link className="studio-btn" to="/payment-details" onClick={(e) => { if (dirty && !window.confirm("Leave without saving plan changes?")) e.preventDefault(); }}>Payment details</Link>
              </div>
            </aside>
          </div>

          {message && <div role="status" className="studio-alert studio-success">{message}</div>}

          <div className={`pl-savebar ${dirty ? "show" : ""}`} role="status">
            <span>You have unsaved plan changes.</span>
            <div className="studio-actions">
              <button type="button" className="studio-btn" disabled={busy} onClick={discard}><RotateCcw /> Discard</button>
              <button type="button" className="studio-btn primary" disabled={busy} onClick={save}>
                <Save /> {busy ? "Saving…" : "Save plans"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

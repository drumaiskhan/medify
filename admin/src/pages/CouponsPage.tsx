import { useEffect, useState } from "react";
import { Ticket, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "../lib/client";

interface Coupon {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  active: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  planIds: string[];
  yearIds: string[];
  note: string;
}
interface Form {
  id?: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  maxUses: string;
  expiresAt: string;
  planIds: string[];
  active: boolean;
  note: string;
}
const PLAN_LABELS: Record<string, string> = {
  quarterly: "Quarterly (3 months)",
  "half-yearly": "Half-yearly (6 months)",
  annual: "Annual (12 months)",
};
const blank: Form = {
  code: "",
  discountType: "percent",
  discountValue: "10",
  maxUses: "",
  expiresAt: "",
  planIds: [],
  active: true,
  note: "",
};
// <input type="date"> works in the admin's local day; a coupon runs to the end of that day.
const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const endOfDay = (d: string) => (d ? new Date(d + "T23:59:59").toISOString() : null);
const status = (c: Coupon) => {
  if (!c.active) return "Paused";
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return "Expired";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "Used up";
  return "Active";
};

export function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await api("/admin/coupons");
      setCoupons(r.coupons);
      setPrices(r.planPrices || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const edit = (c: Coupon) => {
    setMessage("");
    setError("");
    setForm({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      maxUses: c.maxUses === null ? "" : String(c.maxUses),
      expiresAt: toDateInput(c.expiresAt),
      planIds: c.planIds,
      active: c.active,
      note: c.note,
    });
  };
  const set = (patch: Partial<Form>) => form && setForm({ ...form, ...patch });
  const togglePlan = (id: string) =>
    form &&
    set({
      planIds: form.planIds.includes(id)
        ? form.planIds.filter((p) => p !== id)
        : [...form.planIds, id],
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/admin/coupons/save", {
        id: form.id,
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
        expiresAt: endOfDay(form.expiresAt),
        planIds: form.planIds,
        active: form.active,
        note: form.note,
      });
      setMessage(`Coupon ${form.code.toUpperCase()} saved.`);
      setForm(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleActive = async (c: Coupon) => {
    setError("");
    try {
      await api("/admin/coupons/save", { ...c, active: !c.active });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const remove = async (c: Coupon) => {
    if (
      !window.confirm(
        `Delete coupon ${c.code}? Past payments keep their record of it. To stop new use without deleting, pause it instead.`,
      )
    )
      return;
    setError("");
    try {
      await api("/admin/coupons/delete", { id: c.id });
      setMessage(`Coupon ${c.code} deleted.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Live preview of what a student would pay on each plan.
  const preview = (planId: string) => {
    if (!form) return "";
    const v = Number(form.discountValue);
    const price = prices[planId];
    if (!(v > 0) || !price) return "";
    const off = Math.min(
      price,
      Math.round(form.discountType === "percent" ? (price * v) / 100 : v),
    );
    return `PKR ${price.toLocaleString()} → PKR ${(price - off).toLocaleString()}`;
  };

  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="studio-eyebrow">PROMOTIONS</div>
          <h1>Discount coupons</h1>
          <p>
            Students enter a code at checkout. The discount lowers the amount
            on their payment request; you still verify each payment as usual.
          </p>
        </div>
        {!form && (
          <button
            className="studio-btn primary"
            onClick={() => {
              setMessage("");
              setError("");
              setForm({ ...blank });
            }}
          >
            <Plus /> New coupon
          </button>
        )}
      </div>
      {error && (
        <div className="studio-alert" role="alert">
          {error}
        </div>
      )}
      {message && <div className="studio-success">{message}</div>}

      {form && (
        <form className="studio-card" style={{ marginBottom: 22 }} onSubmit={save}>
          <div className="studio-form">
            <label className="studio-field">
              Code
              <input
                required
                maxLength={40}
                placeholder="e.g. WELCOME20"
                value={form.code}
                onChange={(e) =>
                  set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })
                }
                style={{ fontFamily: "monospace" }}
              />
              <span className="studio-small">
                Letters, numbers, - or _. Students are not case-sensitive.
              </span>
            </label>
            <label className="studio-field">
              Discount type
              <select
                value={form.discountType}
                onChange={(e) =>
                  set({ discountType: e.target.value as "percent" | "fixed" })
                }
              >
                <option value="percent">Percentage off (%)</option>
                <option value="fixed">Fixed amount off (PKR)</option>
              </select>
            </label>
            <label className="studio-field">
              {form.discountType === "percent" ? "Percent off" : "PKR off"}
              <input
                required
                type="number"
                min={1}
                max={form.discountType === "percent" ? 100 : undefined}
                step="1"
                value={form.discountValue}
                onChange={(e) => set({ discountValue: e.target.value })}
              />
            </label>
            <label className="studio-field">
              Maximum uses
              <input
                type="number"
                min={1}
                step="1"
                placeholder="Unlimited"
                value={form.maxUses}
                onChange={(e) => set({ maxUses: e.target.value })}
              />
              <span className="studio-small">
                Each student can use a coupon once. A rejected payment frees
                its use.
              </span>
            </label>
            <label className="studio-field">
              Last valid day
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => set({ expiresAt: e.target.value })}
              />
              <span className="studio-small">Leave blank for no expiry.</span>
            </label>
            <label className="studio-field">
              Internal note
              <input
                maxLength={200}
                placeholder="e.g. Instagram giveaway"
                value={form.note}
                onChange={(e) => set({ note: e.target.value })}
              />
            </label>
            <div className="studio-field full">
              Valid for plans
              <div className="studio-actions" style={{ gap: 18 }}>
                {Object.keys(PLAN_LABELS).map((id) => (
                  <label className="studio-check" key={id}>
                    <input
                      type="checkbox"
                      checked={form.planIds.includes(id)}
                      onChange={() => togglePlan(id)}
                    />
                    <span>
                      {PLAN_LABELS[id]}
                      {preview(id) && (
                        <small style={{ display: "block", color: "#5b7177" }}>
                          {preview(id)}
                        </small>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <span className="studio-small">
                Tick none to allow every plan.
              </span>
            </div>
            <label className="studio-check full">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set({ active: e.target.checked })}
              />
              Active (students can use it now)
            </label>
          </div>
          <div className="studio-actions" style={{ marginTop: 20 }}>
            <button className="studio-btn primary" disabled={busy}>
              <Save /> {busy ? "Saving…" : "Save coupon"}
            </button>
            <button
              type="button"
              className="studio-btn"
              onClick={() => setForm(null)}
            >
              <X /> Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="studio-empty">Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <div className="studio-empty">
          <Ticket /> No coupons yet. Create one to offer a discount.
        </div>
      ) : (
        <div className="studio-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#5b7177", fontSize: 11, textTransform: "uppercase" }}>
                {["Code", "Discount", "Used", "Expires", "Plans", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "14px 16px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const st = status(c);
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid #e3ebed" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ fontFamily: "monospace" }}>{c.code}</strong>
                      {c.note && (
                        <small style={{ display: "block", color: "#5b7177" }}>{c.note}</small>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.discountType === "percent"
                        ? `${c.discountValue}% off`
                        : `PKR ${c.discountValue.toLocaleString()} off`}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.usedCount}
                      {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.planIds.length
                        ? c.planIds.map((p) => PLAN_LABELS[p]?.split(" ")[0] || p).join(", ")
                        : "All"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="studio-pill"
                        style={{ background: st === "Active" ? "#e3f7ee" : "#f1f3f4" }}
                      >
                        {st}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="studio-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="studio-btn" onClick={() => edit(c)}>Edit</button>
                        <button className="studio-btn" onClick={() => toggleActive(c)}>
                          {c.active ? "Pause" : "Resume"}
                        </button>
                        <button className="studio-btn danger" onClick={() => remove(c)} aria-label={`Delete ${c.code}`}>
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

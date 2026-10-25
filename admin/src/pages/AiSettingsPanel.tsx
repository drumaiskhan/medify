import { useEffect, useState } from "react";
import { Save, PlugZap, Trash2 } from "lucide-react";
import { api } from "../lib/client";

type AiView = {
  configured: boolean;
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  keyHint: string;
  providers: Record<string, { label: string; model: string }>;
};

/** Lets the administrator add the AI provider key used by the student AI visualizer. */
export function AiSettingsPanel() {
  const [view, setView] = useState<AiView | null>(null);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = (v: AiView) => {
    setView(v);
    setProvider(v.provider);
    setModel(v.model);
    setBaseUrl(v.baseUrl);
    setEnabled(v.configured ? v.enabled : true);
    setApiKey("");
  };
  useEffect(() => {
    api("/admin/ai").then(apply).catch((e) => setError(e.message));
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const save = () =>
    run("save", async () => {
      const v = await api("/admin/ai", { provider, model, baseUrl, apiKey, enabled });
      apply(v);
      setNotice(v.configured ? "AI settings saved. Students can now use the AI visualizer." : "Saved. Add an API key to switch the visualizer on.");
    });
  const test = () =>
    run("test", async () => {
      const r = await api("/admin/ai/test", {});
      if (r.ok) setNotice("Connection works. The provider answered correctly.");
      else setError(r.error || "The test failed");
    });
  const removeKey = () => {
    if (!window.confirm("Remove the saved API key? The AI visualizer will stop working for students.")) return;
    void run("remove", async () => {
      apply(await api("/admin/ai", { provider, model, baseUrl, removeKey: true, enabled }));
      setNotice("API key removed.");
    });
  };

  if (!view) return error ? <div className="studio-alert" role="alert">{error}</div> : <div className="studio-empty">Loading AI settings…</div>;
  const defaultModel = view.providers[provider]?.model || "";

  return (
    <div onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
      <h2 style={{ fontWeight: 750, marginBottom: 6 }}>AI visualizer</h2>
      <p className="studio-muted" style={{ marginBottom: 18 }}>
        Add the API key of your AI provider. Students use it through the Study visualizer to turn a topic into an interactive concept map.
        The key is stored encrypted on your server and is never shown to students or sent back to this page.
      </p>
      <div className="studio-row">
        <span>Status</span>
        <strong>{view.configured ? (view.enabled ? "On · key ending " + view.keyHint.slice(-4) : "Key saved · switched off") : "No key added"}</strong>
      </div>
      {error && <div className="studio-alert" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      {notice && <div className="studio-alert studio-success" role="status" style={{ marginTop: 14 }}>{notice}</div>}
      <div className="studio-form" style={{ marginTop: 18 }}>
        <label className="studio-field">
          Provider
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(view.providers[e.target.value]?.model || ""); }}>
            {Object.entries(view.providers).map(([id, p]) => (
              <option key={id} value={id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="studio-field">
          Model name
          <input value={model} maxLength={80} onChange={(e) => setModel(e.target.value)} placeholder={defaultModel} />
        </label>
        {provider === "openai" && (
          <label className="studio-field">
            Base URL (optional)
            <input value={baseUrl} maxLength={300} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
            <small className="studio-muted">Leave empty for OpenAI. For OpenRouter, Groq, DeepSeek and similar services paste their https endpoint, for example https://openrouter.ai/api/v1</small>
          </label>
        )}
        <label className="studio-field">
          API key
          <input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={apiKey}
            maxLength={400}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={view.configured ? view.keyHint + "  (leave empty to keep)" : "Paste your API key"}
          />
        </label>
        <label className="studio-check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Let students use the AI visualizer
        </label>
      </div>
      <div className="studio-actions" style={{ marginTop: 20 }}>
        <button type="button" className="studio-btn primary" disabled={!!busy} onClick={save}><Save />{busy === "save" ? "Saving…" : "Save AI settings"}</button>
        <button type="button" className="studio-btn" disabled={!!busy || !view.configured} onClick={test}><PlugZap />{busy === "test" ? "Testing…" : "Test connection"}</button>
        {view.configured && <button type="button" className="studio-btn" disabled={!!busy} onClick={removeKey}><Trash2 />Remove key</button>}
      </div>
      <p className="studio-muted" style={{ marginTop: 18 }}>
        Save before testing. Each student can generate about 12 maps per hour and 40 per day, so one key cannot be drained by a single account. You pay your provider for the usage.
        Set <code>AI_KEY_SECRET</code> in the backend environment to choose your own encryption secret.
      </p>
    </div>
  );
}

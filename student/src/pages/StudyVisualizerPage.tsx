import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// This is an offline concept-map preview, not an AI model. No external service
// receives text and no unverified medical relationships are fabricated.
export function StudyVisualizerPage() {
  const [topic, setTopic] = useState('Acute inflammation');
  const [input, setInput] = useState('Recognition of injury\nVasodilation and permeability\nLeukocyte recruitment\nPhagocytosis\nResolution or fibrosis');
  const [selected, setSelected] = useState(0);
  const concepts = useMemo(() => input.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 10), [input]);
  return <main className="mx-auto w-full max-w-5xl px-4 py-10 space-y-6">
    <Link to="/dashboard" className="text-indigo-700 text-sm">← Dashboard</Link>
    <h1 className="font-serif-heading text-3xl font-bold text-slate-900">Study concept visualizer</h1>
    <p className="text-slate-600">Create an interactive concept map from your own notes. This offline visualizer is not AI-generated and does not check medical accuracy.</p>
    <label className="block text-sm font-semibold">Topic<input value={topic} maxLength={100} onChange={e=>setTopic(e.target.value)} className="mt-2 w-full rounded border p-3" /></label>
    <label className="block text-sm font-semibold">Concepts (one per line)<textarea rows={7} value={input} onChange={e=>{setInput(e.target.value);setSelected(0);}} className="mt-2 w-full rounded border p-3" /></label>
    <section aria-label="Interactive study concept map" className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-center text-lg font-bold">{topic || 'Study topic'}</h2>
      <div className="flex flex-wrap justify-center gap-3">{concepts.map((concept,i)=><button type="button" key={i} onClick={()=>setSelected(i)} aria-pressed={selected===i} className={'max-w-xs rounded-xl border-2 px-5 py-4 text-sm font-semibold transition-colors '+(selected===i?'border-indigo-700 bg-indigo-50 text-indigo-900':'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300')}>{i+1}. {concept}</button>)}</div>
      {concepts.length > 0 ? <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700"><strong>Selected:</strong> {concepts[Math.min(selected,concepts.length-1)]}</p> : <p className="text-center text-sm text-slate-500">Add concepts to see the visual map.</p>}
    </section>
  </main>;
}

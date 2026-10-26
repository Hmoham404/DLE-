'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, Factory, Plus, RefreshCw, ShieldCheck, Video, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { departments, summarize, today, type Action, type FactoryState } from '@/lib/domain';
import { aggregateCategories, Btn, Chip, Empty, Kpis, PanelTitle, Performance, number, percent } from './ui-parts';
export function MeetingView({ state, date, demo, canEdit, onAction, presentation, onExit, onRefresh }: {
    state: FactoryState;
    date: string;
    demo: boolean;
    canEdit: boolean;
    onAction: (a?: Action | null) => void;
    presentation: boolean;
    onExit: () => void;
    onRefresh: () => unknown;
}) {
    const [slide, setSlide] = useState(0);
    const reports = state.reports.filter(r => r.date === date);
    const stats = summarize(reports);
    const dStats = departments.map(d => ({ ...d, ...summarize(reports.filter(r => r.department === d.id)) }));
    const overdue = state.actions.filter(a => a.status !== 'Clôturée' && a.due_date < today());
    useEffect(() => { if (!presentation)
        return; const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight')
        setSlide(n => Math.min(5, n + 1)); if (e.key === 'ArrowLeft')
        setSlide(n => Math.max(0, n - 1)); if (e.key === 'Escape')
        onExit(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [presentation]);
    const tooltip = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' };
    const content = (n: number) => {
        if (n === 0)
            return <><div className="meeting-intro"><span className="eyebrow">DAILY PRODUCTION MEETING</span><h2>La performance, en perspective.</h2><p>{stats.count} rapports validés · {date} · {demo ? 'Données de démonstration' : 'Données de production'}</p></div><Kpis stats={stats} demo={demo} approved={state.settings.metricApproved}/><div className="meeting-notice"><ShieldCheck size={16}/>OEE et DLE : conventions à valider par MYC. Les indicateurs sont pondérés à partir des valeurs brutes.</div></>;
        if (n === 1)
            return <section className="panel"><PanelTitle title="Performance des départements" sub="Comparaison sur les rapports validés"/><div className="table-scroll"><table className="data-table"><thead><tr><th>Département</th><th>Production</th><th>Planning</th><th>Qualité</th><th>OEE*</th><th>DLE*</th><th>Rapports</th></tr></thead><tbody>{dStats.map(d => <tr key={d.id}><td><span className="dep-dot" style={{ background: d.color }}/>{d.name}</td><td>{number(d.actual)} <small>pcs</small></td><td><Performance value={d.planning} settings={state.settings}/></td><td>{percent(d.quality)}</td><td>{percent(d.oee)}</td><td>{percent(d.dle)}</td><td>{d.count}</td></tr>)}</tbody></table></div></section>;
        if (n === 2)
            return <section className="panel chart-panel"><PanelTitle title="Planifié vs réalisé" sub="Quantités par département · pièces"/>{stats.count ? <ResponsiveContainer width="100%" height={310}><BarChart data={dStats} barGap={8}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}/><Tooltip contentStyle={tooltip}/><Legend /><Bar name="Planifié" dataKey="planned" fill="#294c58" radius={[4, 4, 0, 0]}/><Bar name="Réalisé" dataKey="actual" fill="#63ddbd" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer> : <Empty title="Aucun rapport validé" detail="La comparaison apparaîtra après validation de la saisie."/>}</section>;
        if (n === 3) {
            const data = aggregateCategories(reports, 'defectCategories');
            let running = 0;
            const total = data.reduce((n, r) => n + r.value, 0);
            const pareto = data.map(r => ({ ...r, cumulative: total ? (running += r.value) / total * 100 : 0 }));
            return <section className="panel chart-panel"><PanelTitle title="Pareto des défauts" sub="Quantités et pourcentage cumulé"/>{pareto.length ? <ResponsiveContainer width="100%" height={320}><ComposedChart data={pareto}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} interval={0}/><YAxis yAxisId="left" tick={{ fill: 'var(--muted)', fontSize: 11 }}/><YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: 'var(--muted)', fontSize: 11 }}/><Tooltip contentStyle={tooltip}/><Bar yAxisId="left" dataKey="value" name="Défauts" fill="#dfbd7c" radius={[4, 4, 0, 0]}/><Line yAxisId="right" dataKey="cumulative" name="Cumul (%)" stroke="#63ddbd" strokeWidth={2}/></ComposedChart></ResponsiveContainer> : <Empty title="Aucun défaut renseigné" detail="Les catégories proviennent des rapports de production validés."/>}</section>;
        }
        if (n === 4) {
            const data = aggregateCategories(reports, 'losses'), max = Math.max(...data.map(x => x.value), 1);
            return <section className="panel"><PanelTitle title="Analyse des pertes" sub="Arrêts non planifiés · minutes"/>{data.length ? <div className="loss-list">{data.map((r, i) => <div className="loss-row" key={r.name}><span className="loss-rank">0{i + 1}</span><div><span>{r.name}</span><div className="bar-track"><i style={{ width: r.value / max * 100 + '%', background: i ? '#4e868a' : '#dfbd7c' }}/></div></div><strong>{number(r.value)} <small>min</small></strong></div>)}</div> : <Empty title="Aucune perte renseignée" detail="Les durées d’arrêt des rapports seront consolidées ici."/>}</section>;
        }
        return <section className="panel"><PanelTitle title="Décisions & plan d’actions" sub={`${state.actions.filter(a => a.status !== 'Clôturée').length} actions ouvertes · ${overdue.length} en retard`} action={canEdit ? <Btn onClick={() => onAction(null)} primary><Plus size={15}/> Nouvelle décision</Btn> : undefined}/>{state.actions.length ? <div className="table-scroll"><table className="data-table actions-table"><thead><tr><th>Problème / Action</th><th>Responsable</th><th>Échéance</th><th>Priorité</th><th>Statut</th><th /></tr></thead><tbody>{state.actions.map(a => <tr key={a.id}><td><strong>{a.problem}</strong><small>{a.action}</small></td><td>{a.owner}</td><td className={a.due_date < today() && a.status !== 'Clôturée' ? 'danger' : ''}>{a.due_date}</td><td><Chip color={a.priority === 'Haute' ? 'orange' : 'neutral'}>{a.priority}</Chip></td><td><Chip color={a.status === 'Clôturée' ? 'green' : a.status === 'En cours' ? 'blue' : 'neutral'}>{a.status}</Chip></td><td>{canEdit && <button className="text-btn" onClick={() => onAction(a)}>Modifier</button>}</td></tr>)}</tbody></table></div> : <Empty title="Un plan d’actions partagé" detail="Ajoutez les décisions, responsables et échéances de votre réunion."/>}</section>;
    };
    return presentation ? <div className="presentation"><header><span className="presentation-brand"><Factory size={23}/> MYC <small>SMART FACTORY</small></span><span>{date} · {demo ? 'DÉMONSTRATION' : 'PRODUCTION'}</span><button className="icon-btn" aria-label="Quitter la réunion" onClick={onExit}><X size={24}/></button></header><div className="slide-content" key={slide}>{content(slide)}</div><footer><span>DAILY PRODUCTION MEETING</span><div className="slide-dots">{['Indicateurs', 'Départements', 'Planning', 'Pareto', 'Pertes', 'Décisions'].map((name, i) => <button title={name} aria-label={name} className={i === slide ? 'active' : ''} key={name} onClick={() => setSlide(i)}/>)}</div><div><button className="icon-btn" aria-label="Section précédente" onClick={() => setSlide(n => Math.max(0, n - 1))}><ChevronLeft size={22}/></button><span>0{slide + 1} / 06</span><button className="icon-btn" aria-label="Section suivante" onClick={() => setSlide(n => Math.min(5, n + 1))}><ChevronRight size={22}/></button></div></footer></div> : <><div className="meeting-toolbar"><div><Video size={18}/><span>DAILY PRODUCTION MEETING</span><Chip color="neutral">Écran 16:9</Chip></div><div><Btn onClick={() => window.print()}><Download size={14}/> Compte rendu PDF</Btn><Btn onClick={() => onRefresh()}><RefreshCw size={14}/> Actualiser</Btn></div></div><div className="meeting-sections">{[0, 1, 2, 3, 4, 5].map(n => <div key={n} className={'meeting-section section-' + n}>{content(n)}</div>)}</div></>;
}

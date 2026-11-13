'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, CheckCheck, ChevronDown, ChevronRight, ClipboardList, Database, Download, Factory, FileSpreadsheet, History, LayoutDashboard, LockKeyhole, LogOut, Map, Menu, MonitorPlay, Moon, Plus, RefreshCw, Save, Search, Settings2, Sun, TriangleAlert, Upload, X } from 'lucide-react';
import { departments, emptyState, sampleState, summarize, today, type Action, type FactoryState, type Machine, type Report } from '@/lib/domain';
import { metricsFromCells } from '@/lib/metrics';
import { calculateCells } from '@/lib/cell-calculation';
import templateData from '@/data/templates.json';
import { FactoryScene } from './factory-scene';
import { Btn, Chip, DepartmentTabs, Empty, Kpis, Modal, PanelTitle, Performance, number } from './ui-parts';
import { MeetingView } from './meeting-view';
import { PlanEditor, MachineModal, ActionModal, HistoryView, SettingsView } from './workspace-views';
type View = 'overview' | 'production' | 'meeting' | 'plan' | 'history' | 'excel' | 'settings';
export type Template = {
    id: string;
    file: string;
    sheet: string;
    sheetPath: string;
    startRow: number;
    columns: {
        key: string;
        label: string;
        calculated: boolean;
        formula?: string | null;
    }[];
    sheets: string[];
    warnings: {
        brokenReferences: number;
        largeFormattedRange: boolean;
    };
};
export const templates = templateData as Record<string, Template>;
export const statusNames = { running: 'En production', stopped: 'À l’arrêt', maintenance: 'Maintenance', idle: 'Disponible', unknown: 'État à renseigner' };
const nav = [{ id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard }, { id: 'production', label: 'Saisie de production', icon: ClipboardList }, { id: 'meeting', label: 'Salle de réunion', icon: MonitorPlay }, { id: 'plan', label: 'Plan de l’usine', icon: Map }, { id: 'history', label: 'Historique', icon: History }, { id: 'excel', label: 'Rapports Excel', icon: FileSpreadsheet }] as const;
const titles = { overview: 'L’usine, en temps réel.', production: 'Chaque pièce compte.', meeting: 'Piloter. Décider. Avancer.', plan: 'Votre usine, à portée de vue.', history: 'La mémoire de votre production.', excel: 'Vos rapports. Votre format.', settings: 'Un pilotage à votre mesure.' };
const subtitles = { overview: 'Une vision claire de vos ateliers, de la production aux décisions.', production: 'Vos rapports officiels, dans une grille de saisie connectée.', meeting: 'Les mêmes données. Une vision partagée. Des actions concrètes.', plan: 'Placez vos machines et retrouvez chaque atelier en un instant.', history: 'Retrouvez vos rapports et ouvrez les données d’origine.', excel: 'Les quatre modèles Excel officiels MYC, conservés à la source.', settings: 'Configurez vos seuils de performance et votre espace de travail.' };
export default function FactoryApp() {
    const [view, setView] = useState<View>('overview'), [state, setState] = useState<FactoryState>(sampleState), [demo, setDemo] = useState(true), [role, setRole] = useState<'entry' | 'meeting' | null>(null), [date, setDate] = useState(today()), [dep, setDep] = useState('injection'), [shift, setShift] = useState('Équipe du matin'), [search, setSearch] = useState(''), [light, setLight] = useState(false), [sidebar, setSidebar] = useState(false), [loginOpen, setLoginOpen] = useState(false), [modal, setModal] = useState<'machine' | 'action' | null>(null), [editingMachine, setEditingMachine] = useState<Machine | null>(null), [editingAction, setEditingAction] = useState<Action | null>(null), [toast, setToast] = useState(''), [busy, setBusy] = useState(false), [presentation, setPresentation] = useState(false), [lastSync, setLastSync] = useState(''), [dirty, setDirty] = useState(false), [gridRows, setGridRows] = useState<Report[]>([]), [code, setCode] = useState(''), [loginError, setLoginError] = useState('');
    const filtered = useMemo(() => state.reports.filter(r => r.date === date), [state.reports, date]);
    const stats = summarize(filtered);
    const canEntry = demo || role === 'entry', canMeeting = demo || role === 'meeting';
    const notify = (s: string) => setToast(s);
    useEffect(() => { if (toast) {
        const t = setTimeout(() => setToast(''), 6000);
        return () => clearTimeout(t);
    } }, [toast]);
    const refresh = async () => { try {
        const r = await fetch('/api/factory');
        const b: any = await r.json();
        if (!r.ok)
            throw new Error(b.error);
        setState(b);
        setLastSync(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        return b as FactoryState;
    }
    catch (e) {
        notify((e as Error).message === 'UNAUTHORIZED' ? 'Saisissez votre code d’accès.' : (e as Error).message);
        return null;
    } };
    useEffect(() => { fetch('/api/session').then(r => r.json() as Promise<any>).then(async (b) => { if (b.session) {
        setRole(b.session.role);
        setDemo(false);
        setState(emptyState);
        await refresh();
    } }).catch(() => { }); }, []);
    useEffect(() => { if (demo)
        return; const t = setInterval(() => { if (!dirty)
        refresh(); }, 30000); return () => clearInterval(t); }, [demo, dirty]);
    useEffect(() => { if (view === 'production' && !dirty) {
        setGridRows(state.reports.filter(r => r.date === date && r.department === dep && r.shift === shift));
    } }, [view, dep, date, shift, state.reports, dirty]);
    useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
    const navigate = (next: View, d?: string) => { if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Quitter cette saisie ?'))
        return; setDirty(false); if (d)
        setDep(d); setView(next); setSidebar(false); setSearch(''); };
    const save = async (kind: 'machine' | 'report' | 'action' | 'settings', value: any) => { if (demo) {
        setState(prev => { if (kind === 'settings')
            return { ...prev, settings: value }; const field = kind === 'machine' ? 'machines' : kind === 'report' ? 'reports' : 'actions'; const rows = prev[field] as any[]; return { ...prev, [field]: [...rows.filter(x => x.id !== value.id), value] }; });
        return;
    } const r = await fetch('/api/factory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, value }) }); const b: any = await r.json(); if (!r.ok)
        throw new Error(b.error); };
    const doLogin = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setLoginError(''); try {
        const r = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        const b: any = await r.json();
        if (!r.ok)
            throw new Error(b.error);
        setRole(b.role);
        setDemo(false);
        setState(emptyState);
        setLoginOpen(false);
        setCode('');
        setView(b.role === 'entry' ? 'production' : 'meeting');
        await refresh();
    }
    catch (e) {
        setLoginError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const switchDemo = async () => { if (demo) {
        setLoginOpen(true);
        return;
    } await fetch('/api/session', { method: 'DELETE' }); setRole(null); setDemo(true); setState(sampleState()); setView('overview'); setDirty(false); };
    const addRow = () => { const m = state.machines.find(m => m.department === dep); if (!m) {
        notify('Ajoutez d’abord une machine pour cet atelier.');
        setEditingMachine(null);
        setModal('machine');
        return;
    } const cells: Record<string, string | number> = dep === 'injection' ? { A: m.name, C: shift } : dep === 'metalisation' ? { A: date, B: m.name, C: shift } : { A: date, B: shift, C: m.name }; setGridRows(rs => [...rs, { id: crypto.randomUUID(), date, department: dep, shift, machine_id: m.id, reference: '', status: 'draft', cells, metrics: metricsFromCells(dep, cells) }]); setDirty(true); };
    const changeCell = (id: string, key: string, v: string) => { setGridRows(rs => rs.map(r => { if (r.id !== id)
        return r; const cells = { ...r.cells, [key]: v }, ref = dep === 'injection' ? 'E' : dep === 'metalisation' ? 'H' : 'F', mc = dep === 'injection' ? 'A' : dep === 'metalisation' ? 'B' : 'C'; return { ...r, cells, reference: String(cells[ref] || ''), machine_id: key === mc ? state.machines.find(m => m.name === v && m.department === dep)?.id || '' : r.machine_id, metrics: { ...metricsFromCells(dep, cells), planned: r.planningTarget ?? metricsFromCells(dep, cells).planned }, status: 'draft' }; })); setDirty(true); };
    const saveGrid = async (validated: boolean) => { if (!gridRows.length) {
        notify('Ajoutez une ligne de production.');
        return;
    } setBusy(true); let count = 0; try {
        for (const row of gridRows) {
            if (!row.machine_id)
                throw new Error('Choisissez une machine connue du département.');
            if (validated && !row.reference)
                throw new Error('Renseignez la référence produit sur chaque ligne.');
            await save('report', { ...row, status: validated ? 'validated' : 'draft' });
            count++;
        }
        setDirty(false);
        if (!demo) {
            const b = await refresh();
            if (b)
                setGridRows(b.reports.filter(r => r.date === date && r.department === dep && r.shift === shift));
        }
        else
            setGridRows(rs => rs.map(r => ({ ...r, status: validated ? 'validated' : 'draft' })));
        notify(demo ? 'Modifications conservées en démonstration.' : validated ? 'Rapports validés et disponibles en réunion.' : 'Brouillons enregistrés.');
    }
    catch (e) {
        notify(`${count ? count + ' ligne(s) enregistrée(s). ' : ''}${(e as Error).message}`);
    }
    finally {
        setBusy(false);
    } };
    const download = async (d: string, source = false) => { if (demo) {
        setLoginOpen(true);
        notify('Le téléchargement officiel nécessite votre code d’accès.');
        return;
    } setBusy(true); try {
        const r = await fetch(`/api/excel?department=${d}&date=${date}&blank=${source ? 1 : 0}`);
        if (!r.ok)
            throw new Error((await r.json() as any).error);
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = `MYC_${d}_${date}${source ? '_source' : ''}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        notify('Classeur téléchargé. Ouvrez-le dans Excel pour recalculer les formules.');
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const importExcel = async (file: File) => { if (demo) {
        setLoginOpen(true);
        return;
    } if (file.size > 5000000) {
        notify('Le fichier doit faire moins de 5 Mo.');
        return;
    } setBusy(true); try {
        const f = new FormData();
        f.set('file', file);
        f.set('department', dep);
        f.set('date', date);
        f.set('shift', shift);
        const r = await fetch('/api/excel', { method: 'POST', body: f });
        const b: any = await r.json();
        if (!r.ok)
            throw new Error(b.error);
        setView('production');
        setGridRows(b.rows.map((r: Report) => ({ ...r, machine_id: state.machines.find(m => m.name === String(r.cells[dep === 'injection' ? 'A' : dep === 'metalisation' ? 'B' : 'C']) && m.department === dep)?.id || '' })));
        setDirty(true);
        notify(`${b.rows.length} lignes importées en brouillon. Vérifiez les machines puis enregistrez.`);
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const openAction = (a: Action | null = null) => { setEditingAction(a); setModal('action'); };
    const openMachine = (m: Machine | null = null) => { setEditingMachine(m); setModal('machine'); };
    const selectDep = (d: string) => navigate('production', d);
    const depStats = departments.map(d => ({ ...d, ...summarize(filtered.filter(r => r.department === d.id)) }));
    const matching = search ? state.machines.filter(m => (m.name + ' ' + m.reference + ' ' + m.department).toLowerCase().includes(search.toLowerCase())).slice(0, 6) : [];
    useEffect(() => { if (editingMachine) {
        const current = state.machines.find(m => m.id === editingMachine.id);
        if (current)
            setEditingMachine(current);
    } }, [state.machines]);
    const startMeeting = () => { navigate('meeting'); setPresentation(true); document.documentElement.requestFullscreen?.().catch(() => { }); };
    return <div className={'app ' + (light ? 'light' : '')}>
 {!presentation && <><aside className={'sidebar ' + (sidebar ? 'open' : '')}><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('overview'); }}><span className="brand-mark"><Factory size={23}/></span><span><strong>MYC<span className="brand-thin"> SMART FACTORY</span></strong><small>PRODUCTION & MEETING SYSTEM</small></span></a><div className="workspace-tag"><span className="flag">TN</span><span>Beauty Innovation Tunisia<small>Site de production</small></span><ChevronDown size={14}/></div><p className="nav-label">ESPACE DE TRAVAIL</p><nav>{nav.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id === 'plan' && <span className="new-tag">NEW</span>}{n.id === 'meeting' && <span className="nav-count">{state.actions.filter(a => a.status !== 'Clôturée').length}</span>}</button>)}</nav><p className="nav-label dept-label">ATELIERS</p><nav className="dept-nav">{departments.map(d => <button key={d.id} className={view === 'production' && dep === d.id ? 'selected' : ''} onClick={() => selectDep(d.id)}><i style={{ background: d.color }}/>{d.name}<ChevronRight size={13}/></button>)}</nav><div className="sidebar-bottom"><div className="system-health"><i className={demo ? 'amber' : ''}/><span>{demo ? 'Environnement de démonstration' : state.connected ? 'Supabase connecté' : 'Connexion à vérifier'}</span></div><button onClick={() => navigate('settings')}><Settings2 size={17}/> Paramètres</button><button onClick={() => demo ? setLoginOpen(true) : switchDemo()}><span className="avatar">{role === 'meeting' ? 'DR' : 'MY'}</span><span>{demo ? 'Visiteur' : role === 'entry' ? 'Espace saisie' : 'Espace réunion'}<small>{demo ? 'Se connecter par code' : 'Session sécurisée · 8 h'}</small></span>{demo ? <LockKeyhole size={15}/> : <LogOut size={15}/>}</button></div></aside><div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-btn mobile-menu" aria-label="Menu" onClick={() => setSidebar(!sidebar)}><Menu size={21}/></button><span>Workspace</span><ChevronRight size={12}/><strong>{nav.find(n => n.id === view)?.label || 'Paramètres'}</strong></div><div className="top-actions"><div className="search-wrap"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une machine…" aria-label="Rechercher une machine"/>{search && <div className="search-results">{matching.length ? matching.map(m => <button key={m.id} onClick={() => { setEditingMachine(m); navigate('plan'); }}>{m.name}<small>{departments.find(d => d.id === m.department)?.name}</small></button>) : <p>Aucune machine trouvée</p>}</div>}</div><span className={'mode-badge ' + (demo ? 'demo' : 'live')}><i />{demo ? 'DÉMONSTRATION' : 'PRODUCTION'}</span><button className="icon-btn" aria-label="Changer le thème" onClick={() => setLight(!light)}>{light ? <Moon size={18}/> : <Sun size={18}/>}</button></div></header><main><div className="page-heading"><div><div className="eyebrow"><span className="tiny-line"/> MYC OPERATIONS CENTER</div><h1>{titles[view]}</h1><p>{subtitles[view]}</p></div><div className="heading-actions"><label className="date-control"><CalendarDays size={15}/><input type="date" aria-label="Date de production" value={date} onChange={e => { if (dirty) {
            notify('Enregistrez avant de changer de date.');
            return;
        } setDate(e.target.value); }}/></label>{view === 'overview' || view === 'meeting' ? <Btn primary onClick={startMeeting}><MonitorPlay size={16}/> Start meeting <ArrowUpRight size={15}/></Btn> : view === 'production' ? <Btn primary onClick={() => saveGrid(true)} disabled={busy || !canEntry}><CheckCheck size={16}/> Valider le rapport</Btn> : view === 'plan' ? <Btn primary disabled={!canEntry} onClick={() => openMachine()}><Plus size={16}/> Ajouter une machine</Btn> : null}</div></div>
 {demo && <div className="demo-ribbon"><span><span className="demo-dot"/>MODE DÉMONSTRATION <span className="ribbon-detail">· Données fictives isolées de votre production</span></span><button onClick={() => setLoginOpen(true)}>Connecter mon usine <ArrowRight size={13}/></button></div>}
 {!demo && !state.connected && <div className="error-banner"><TriangleAlert size={17}/>Les données Supabase n’ont pas été chargées.<button onClick={refresh}>Réessayer</button></div>}
 {view === 'overview' && <><Kpis stats={stats} demo={demo} approved={state.settings.metricApproved}/><div className="overview-grid"><section className="panel digital-twin"><PanelTitle title="Au cœur de votre usine" sub="4 ateliers. Un seul centre de pilotage." action={<button className="text-btn" onClick={() => navigate('plan')}>Ouvrir le plan <ArrowUpRight size={14}/></button>}/><div className="scene-area"><div className="scene-status"><span className="signal-dot"/>APERÇU SCHÉMATIQUE</div><FactoryScene onDepartment={selectDep}/><div className="scene-caption"><span>Sélectionnez un atelier pour saisir sa production</span><span>VUE ISOMÉTRIQUE</span></div></div></section><section className="panel pulse-panel"><PanelTitle title="Le pouls de l’usine" sub="Situation des équipements"/><div className="pulse-total"><strong>{state.machines.filter(m => m.status === 'running').length}<small> / {state.machines.length}</small></strong><span>machines en production</span></div><div className="machine-meter">{state.machines.map(m => <span key={m.id} title={m.name + ' : ' + statusNames[m.status]} className={m.status}/>)}</div><div className="status-legend"><span><i className="running"/>Production</span><span><i className="stopped"/>Arrêt</span><span><i className="maintenance"/>Maintenance</span></div><div className="pulse-separator"/><div className="subhead">POINTS D’ATTENTION</div><div className="attention-list">{state.machines.filter(m => m.status === 'stopped' || m.status === 'maintenance').slice(0, 3).map(m => <button key={m.id} onClick={() => { setEditingMachine(m); navigate('plan'); }}><span className={'attention-icon ' + m.status}><TriangleAlert size={16}/></span><span><strong>{m.name}</strong><small>{statusNames[m.status]} · {departments.find(d => d.id === m.department)?.name}</small></span><ChevronRight size={15}/></button>)}{!state.machines.some(m => m.status === 'stopped' || m.status === 'maintenance') && <p className="muted">Aucune machine signalée à l’arrêt.</p>}</div><button className="pulse-link" onClick={() => navigate('plan')}>Voir toutes les machines <ArrowRight size={14}/></button></section></div><div className="section-heading"><h2>Vos ateliers</h2><span>{stats.count} rapports validés aujourd’hui</span></div><div className="department-cards">{depStats.map((d, i) => <button className="department-card" key={d.id} onClick={() => selectDep(d.id)} style={{ '--department': d.color } as React.CSSProperties}><div className="department-card-top"><span className="department-icon"><Factory size={19}/></span><span>0{i + 1}</span><ArrowUpRight size={16}/></div><h3>{d.name}</h3><p>{d.description}</p><div className="department-card-bottom"><div><small>PRODUCTION</small><strong>{number(d.actual)} <span>pcs</span></strong></div><Performance value={d.planning} settings={state.settings}/></div></button>)}</div><div className="bottom-banner"><FileSpreadsheet size={25}/><div><h3>De l’atelier au rapport officiel.</h3><p>Retrouvez vos données dans vos classeurs Excel MYC.</p></div><Btn onClick={() => navigate('excel')}>Accéder aux rapports <ArrowRight size={15}/></Btn></div></>}
 {view === 'production' && <><DepartmentTabs selected={dep} onChange={selectDep}/><section className="panel production-panel"><div className="production-toolbar"><div><span className="dep-dot" style={{ background: departments.find(d => d.id === dep)?.color }}/><h2>{departments.find(d => d.id === dep)?.name}</h2><Chip color="neutral">{dirty ? 'Modifié' : 'Rapport journalier'}</Chip></div><div><select aria-label="Équipe" value={shift} onChange={e => { if (dirty) {
            notify('Enregistrez avant de changer d’équipe.');
            return;
        } setShift(e.target.value); }}>{['Équipe du matin', 'Équipe du soir', 'Équipe de nuit'].map(x => <option key={x}>{x}</option>)}</select><Btn disabled={busy || !canEntry} onClick={() => saveGrid(false)}><Save size={14}/> Enregistrer</Btn><Btn disabled={busy} onClick={() => download(dep)}><Download size={14}/> Excel</Btn></div></div><div className="grid-information"><span><FileSpreadsheet size={14}/>{templates[dep].file} <span className="muted">/ {templates[dep].sheet}</span></span><span>{templates[dep].columns.length} colonnes officielles · Défilement horizontal</span></div>{gridRows.length ? <div className="spreadsheet-scroll"><table className="spreadsheet"><thead><tr><th className="row-number">#</th><th><small>WEB / PLANNING</small>Objectif planning (pcs)</th>{templates[dep].columns.map(c => <th key={c.key} className={c.calculated ? 'calculated' : ''}><small>{c.key}{c.calculated && <span>ƒx</span>}</small>{c.label}</th>)}</tr></thead><tbody>{gridRows.map((r, i) => <tr key={r.id}><td className="row-number">{templates[dep].startRow + i}</td><td><input aria-label={`Objectif planning · ligne ${i + 1}`} type="number" min="0" value={r.planningTarget ?? ''} placeholder="Objectif (facultatif)" disabled={!canEntry} onChange={e => { const target = e.target.value === '' ? null : Number(e.target.value); setGridRows(rs => rs.map(x => x.id === r.id ? { ...x, planningTarget: target, metrics: { ...x.metrics, planned: target ?? metricsFromCells(dep, x.cells).planned } } : x)); setDirty(true); }}/></td>{templates[dep].columns.map(c => <td key={c.key} className={c.calculated ? 'calculated' : ''}>{c.calculated ? <span title="Calcul local ; cumul ou formule externe a verifier dans Excel">{calculateCells(dep,r.cells)[c.key]===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(calculateCells(dep,r.cells)[c.key]!)}</span> : c.key === (dep === 'injection' ? 'A' : dep === 'metalisation' ? 'B' : 'C') ? <select value={r.cells[c.key] || ''} onChange={e => changeCell(r.id, c.key, e.target.value)} disabled={!canEntry} aria-label={c.label}><option value="">Choisir…</option>{state.machines.filter(m => m.department === dep).map(m => <option key={m.id}>{m.name}</option>)}</select> : <input value={r.cells[c.key] ?? ''} onChange={e => changeCell(r.id, c.key, e.target.value)} disabled={!canEntry} aria-label={`${c.label} · ligne ${i + 1}`}/>}</td>)}</tr>)}</tbody></table></div> : <Empty title="Prêt pour une nouvelle journée" detail="Ajoutez une ligne de production. Tous les champs du modèle officiel restent disponibles." action={canEntry ? <Btn primary onClick={addRow}><Plus size={15}/> Ajouter une ligne</Btn> : <p>Utilisez le code saisie pour modifier les rapports.</p>}/>}<div className="grid-footer"><button className="text-btn" onClick={addRow} disabled={!canEntry}><Plus size={15}/> Ajouter une ligne</button><span>{gridRows.length} lignes · {dirty ? 'Modifications non enregistrées' : 'À jour'}</span><label className="text-btn"><Upload size={14}/> Importer un XLSX<input hidden type="file" accept=".xlsx" onChange={e => e.target.files?.[0] && importExcel(e.target.files[0])}/></label></div></section><div className="formula-note"><TriangleAlert size={17}/><p>Les cellules <strong>ƒx</strong> conservent les formules du modèle. Les résultats sont recalculés à l’ouverture dans Excel. Les formules MYC et les références cassées d’origine restent à valider.</p></div></>}
 {view === 'meeting' && <MeetingView state={state} date={date} demo={demo} canEdit={canMeeting} onAction={openAction} presentation={false} onExit={() => { }} onRefresh={() => !demo ? refresh() : notify('Les données de démonstration sont à jour.')}/>}
 {view === 'plan' && <PlanEditor state={state} canEdit={canEntry} selected={editingMachine} setSelected={setEditingMachine} onEdit={openMachine} onSave={async (m) => { await save('machine', m); if (!demo)
            await refresh(); }} onPlan={async (url, name) => { await save('settings', { ...state.settings, green: state.settings.green ?? 85, yellow: state.settings.yellow ?? 65, metricApproved: state.settings.metricApproved ?? false, planUrl: url, planName: name }); if (!demo)
            await refresh(); }} notify={notify}/>}
 {view === 'history' && <HistoryView reports={state.reports} machines={state.machines} onOpen={r => { setDate(r.date); setShift(r.shift); navigate('production', r.department); }}/>}
 {view === 'excel' && <><div className="excel-intro"><FileSpreadsheet size={28}/><div><h2>L’original, toujours à la source.</h2><p>Les données sont injectées dans une copie du classeur officiel fourni.</p></div><Chip>4 modèles intégrés</Chip></div><div className="excel-cards">{departments.map(d => <section className="panel excel-card" key={d.id}><div className="excel-card-icon" style={{ color: d.color }}><FileSpreadsheet size={29}/></div><h2>{d.name}</h2><p>{templates[d.id].file}</p><div className="template-details"><span>{templates[d.id].columns.length} colonnes</span><span>{templates[d.id].sheets.length} feuille(s)</span></div>{templates[d.id].warnings.brokenReferences > 0 && <div className="template-warning"><TriangleAlert size={14}/>{templates[d.id].warnings.brokenReferences} références cassées dans le modèle fourni</div>}<div className="excel-card-actions"><Btn primary disabled={busy} onClick={() => download(d.id)}><Download size={15}/> Rapport du {date}</Btn><button className="text-btn" onClick={() => download(d.id, true)}>Télécharger le modèle source</button><button className="text-btn" onClick={() => selectDep(d.id)}>Ouvrir la grille de saisie <ArrowRight size={13}/></button></div></section>)}</div><div className="formula-note"><TriangleAlert size={17}/><p>Les formules et références externes restent celles des fichiers fournis. Le recalcul dans Microsoft Excel et la validation métier MYC sont nécessaires avant usage officiel.</p></div></>}
 {view === 'settings' && <SettingsView state={state} canEdit={canEntry} onSave={async (s) => { await save('settings', s); if (!demo)
            await refresh(); notify('Paramètres enregistrés.'); }} onLogin={() => setLoginOpen(true)} onDemo={switchDemo} demo={demo} notify={notify}/>}
 <footer className="footer"><span>MYC Beauty Innovation Tunisia <i /> Smart Factory v1.0</span><span><i className="footer-dot"/>{demo ? 'Données de démonstration' : lastSync ? 'Synchronisé à ' + lastSync : 'Connexion sécurisée'}<span className="footer-separator">/</span>PRODUCTION & MEETING</span></footer></main></div></>}
 {presentation && <MeetingView state={state} date={date} demo={demo} canEdit={canMeeting} onAction={openAction} presentation onExit={() => { setPresentation(false); if (document.fullscreenElement)
        document.exitFullscreen?.(); }} onRefresh={refresh}/>}
 {loginOpen && <Modal title="Connecter votre usine" onClose={() => setLoginOpen(false)}><div className="login-icon"><LockKeyhole size={28}/></div><p className="modal-description">Un code pour la saisie. Un code pour la réunion.<br />Les données de production sont enregistrées dans votre Supabase.</p><form onSubmit={doLogin}><label className="field">Code d’accès<input autoComplete="off" type="password" placeholder="Saisissez votre code MYC" value={code} onChange={e => setCode(e.target.value)} required/></label>{loginError && <p className="form-error" role="alert">{loginError}</p>}<Btn primary type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Ouvrir mon espace'}<ArrowRight size={16}/></Btn></form><div className="login-roles"><span><ClipboardList size={16}/>Saisie : rapports & machines</span><span><MonitorPlay size={16}/>Réunion : indicateurs & décisions</span></div></Modal>}
 {modal === 'machine' && <MachineModal existing={editingMachine} department={dep} onClose={() => setModal(null)} onSave={async (m) => { await save('machine', m); if (!demo)
        await refresh(); setModal(null); setEditingMachine(m); notify(demo ? 'Machine enregistrée en démonstration.' : 'Machine enregistrée dans Supabase.'); }} notify={notify}/>}
 {modal === 'action' && <ActionModal existing={editingAction} onClose={() => setModal(null)} onSave={async (a) => { await save('action', a); if (!demo)
        await refresh(); setModal(null); notify(demo ? 'Décision enregistrée en démonstration.' : 'Décision enregistrée dans Supabase.'); }} notify={notify}/>}
 {toast && <div className="toast" role="status"><Activity size={17}/><span>{toast}</span><button aria-label="Fermer" onClick={() => setToast('')}><X size={15}/></button></div>}
 </div>;
}

'use client';
import React, { useRef, useState } from 'react';
import { ArrowUpRight, Box, Database, Factory, Layers3, LockKeyhole, Save, Search, Settings2, Upload } from 'lucide-react';
import { departments, today, type Action, type FactoryState, type Machine, type Report } from '@/lib/domain';
import { Btn, Chip, Empty, Modal, PanelTitle, number } from './ui-parts';
import {AuditButton} from './audit-button';
const statusNames = { running: 'En production', stopped: 'À l’arrêt', maintenance: 'Maintenance', idle: 'Disponible', unknown: 'État à renseigner' };
type Notify = (s: string) => void;
export function MachineModal({ existing, department, onClose, onSave, notify }: {
    existing: Machine | null;
    department: string;
    onClose: () => void;
    onSave: (m: Machine) => Promise<void>;
    notify: Notify;
}) { const [m, setM] = useState<Machine>(existing ? { ...existing } : { id: crypto.randomUUID(), name: '', department, status: 'idle', x: 50, y: 50, reference: '', line: '' }); const [saving, setSaving] = useState(false); const field = (k: keyof Machine, v: string | number) => setM(s => ({ ...s, [k]: v })); return <Modal title={existing ? 'Modifier la machine' : 'Ajouter une machine'} onClose={onClose}><form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try {
    await onSave(m);
}
catch (e) {
    notify((e as Error).message);
}
finally {
    setSaving(false);
} }}><div className="form-grid"><label className="field">Nom / numéro de machine<input required maxLength={80} value={m.name} onChange={e => field('name', e.target.value)} placeholder="Ex. INJ-01"/></label><label className="field">Atelier<select value={m.department} onChange={e => field('department', e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="field">Ligne<input value={m.line || ''} onChange={e => field('line', e.target.value)} placeholder="Ex. Ligne A"/></label><label className="field">État<select value={m.status} onChange={e => field('status', e.target.value)}>{Object.entries(statusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="field">Position X (%)<input required type="number" min="0" max="100" step="0.1" value={m.x} onChange={e => field('x', Number(e.target.value))}/></label><label className="field">Position Y (%)<input required type="number" min="0" max="100" step="0.1" value={m.y} onChange={e => field('y', Number(e.target.value))}/></label></div><label className="field">Référence en cours<input value={m.reference || ''} onChange={e => field('reference', e.target.value)}/></label><div className="modal-actions"><Btn onClick={onClose}>Annuler</Btn><Btn primary type="submit" disabled={saving}><Save size={15}/>{saving ? 'Enregistrement…' : 'Enregistrer la machine'}</Btn></div></form></Modal>; }
export function ActionModal({ existing, onClose, onSave, notify }: {
    existing: Action | null;
    onClose: () => void;
    onSave: (a: Action) => Promise<void>;
    notify: Notify;
}) { const [a, setA] = useState<Action>(existing ? { ...existing } : { id: crypto.randomUUID(), problem: '', action: '', owner: '', due_date: today(), priority: 'Normale', status: 'Ouverte', comment: '', department: 'injection' }); const [saving, setSaving] = useState(false); const f = (k: keyof Action, v: string) => setA(s => ({ ...s, [k]: v })); return <Modal title={existing ? 'Modifier la décision' : 'Nouvelle décision de réunion'} onClose={onClose}><form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try {
    await onSave(a);
}
catch (e) {
    notify((e as Error).message);
}
finally {
    setSaving(false);
} }}><label className="field">Problème identifié<input required value={a.problem} onChange={e => f('problem', e.target.value)}/></label><label className="field">Action corrective<textarea required rows={3} value={a.action} onChange={e => f('action', e.target.value)}/></label><div className="form-grid"><label className="field">Responsable<input required value={a.owner} onChange={e => f('owner', e.target.value)}/></label><label className="field">Date limite<input type="date" required value={a.due_date} onChange={e => f('due_date', e.target.value)}/></label><label className="field">Priorité<select value={a.priority} onChange={e => f('priority', e.target.value)}>{['Haute', 'Normale', 'Basse'].map(v => <option key={v}>{v}</option>)}</select></label><label className="field">Statut<select value={a.status} onChange={e => f('status', e.target.value)}>{['Ouverte', 'En cours', 'Clôturée'].map(v => <option key={v}>{v}</option>)}</select></label><label className="field">Département<select value={a.department} onChange={e => f('department', e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div><label className="field">Commentaire<textarea value={a.comment} onChange={e => f('comment', e.target.value)}/></label><div className="modal-actions"><Btn onClick={onClose}>Annuler</Btn><Btn primary type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la décision'}</Btn></div></form></Modal>; }
export function PlanEditor({ state, canEdit, selected, setSelected, onEdit, onSave, onPlan, notify }: {
    state: FactoryState;
    canEdit: boolean;
    selected: Machine | null;
    setSelected: (m: Machine | null) => void;
    onEdit: (m: Machine) => void;
    onSave: (m: Machine) => Promise<void>;
    onPlan: (url: string, name: string) => Promise<void>;
    notify: Notify;
}) {
    const [filter, setFilter] = useState('all'), [volumetric, setVolumetric] = useState(false), [positions, setPositions] = useState<Record<string, {
        x: number;
        y: number;
    }>>({}), [saving, setSaving] = useState(false);
    const drag = useRef<string | null>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const machines = state.machines.filter(m => filter === 'all' || m.department === filter);
    const upload = (file: File) => { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2000000) {
        notify('Choisissez un plan PNG, JPG ou WebP de moins de 2 Mo.');
        return;
    } const reader = new FileReader(); reader.onload = async () => { try {
        await onPlan(String(reader.result), file.name);
        notify('Plan enregistré. Placez les machines sur votre image.');
    }
    catch (e) {
        notify((e as Error).message);
    } }; reader.readAsDataURL(file); };
    return <><div className="plan-toolbar"><div><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tous les ateliers</button>{departments.map(d => <button key={d.id} className={filter === d.id ? 'active' : ''} onClick={() => setFilter(d.id)}><i style={{ background: d.color }}/>{d.name}</button>)}</div><button className={'view-toggle ' + (volumetric ? 'active' : '')} onClick={() => setVolumetric(!volumetric)}><Layers3 size={16}/>{volumetric ? 'Vue en perspective' : 'Plan 2D'}</button></div><div className="plan-layout"><section className="panel map-panel"><div className="map-top"><span><span className="signal-dot"/>{state.settings.planName || 'PLAN SCHÉMATIQUE · À PERSONNALISER'}</span>{canEdit && <label className="text-btn"><Upload size={14}/>Importer mon plan<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])}/></label>}</div><div className={'map-perspective ' + (volumetric ? 'volumetric' : '')}><div className="map-canvas" ref={canvas} style={state.settings.planUrl ? { backgroundImage: `url(${state.settings.planUrl})`, backgroundSize: '100% 100%' } : {}} onPointerMove={e => { if (!drag.current || !canvas.current || volumetric)
        return; const b = canvas.current.getBoundingClientRect(); setPositions(p => ({ ...p, [drag.current!]: { x: Math.max(2, Math.min(98, (e.clientX - b.left) / b.width * 100)), y: Math.max(4, Math.min(96, (e.clientY - b.top) / b.height * 100)) } })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>{!state.settings.planUrl && <><div className="map-aisle horizontal"/><div className="map-aisle vertical"/>{departments.map((d, i) => <div className="map-zone" key={d.id} style={{ left: i % 2 ? '53%' : '3%', top: i < 2 ? '5%' : '55%', width: '44%', height: '40%', borderColor: d.color + '40', background: d.color + '06' }}><span style={{ color: d.color }}>0{i + 1} / {d.name.toUpperCase()}</span><div className="zone-hatch"/></div>)}</>}{machines.map(m => { const p = positions[m.id] || m; return <button key={m.id} className={`map-machine ${m.status} ${selected?.id === m.id ? 'selected' : ''}`} style={{ left: p.x + '%', top: p.y + '%' }} onClick={() => setSelected(m)} onPointerDown={e => { setSelected(m); if (canEdit && !volumetric) {
        drag.current = m.id;
        e.currentTarget.setPointerCapture(e.pointerId);
    } }} aria-label={m.name + ' : ' + statusNames[m.status]}><span className="machine-top"><Factory size={19}/><i /></span><span>{m.name}</span></button>; })}{!state.machines.length && <div className="map-empty"><Factory size={34}/><h3>Le plan attend vos machines.</h3><p>Ajoutez une machine, puis placez-la sur le plan.</p></div>}</div></div><div className="map-bottom"><div className="status-legend">{Object.entries(statusNames).map(([k, v]) => <span key={k}><i className={k}/>{v}</span>)}</div>{Object.keys(positions).length > 0 && <Btn primary disabled={saving} onClick={async () => { setSaving(true); try {
        for (const [id, p] of Object.entries(positions)) {
            const m = state.machines.find(m => m.id === id);
            if (m)
                await onSave({ ...m, ...p });
        }
        setPositions({});
        notify('Positions enregistrées.');
    }
    catch (e) {
        notify((e as Error).message);
    } setSaving(false); }}><Save size={14}/>{saving ? 'Enregistrement…' : 'Enregistrer les positions'}</Btn>}</div></section><section className="panel machine-detail">{selected ? <><div className="machine-detail-icon"><Factory size={33}/></div><span className="eyebrow">FICHE MACHINE</span><h2>{selected.name}</h2><Chip color={selected.status === 'running' ? 'green' : selected.status === 'stopped' ? 'red' : 'orange'}>{statusNames[selected.status]}</Chip><dl><dt>Département</dt><dd>{departments.find(d => d.id === selected.department)?.name}</dd><dt>Ligne</dt><dd>{selected.line || 'Non renseignée'}</dd><dt>Référence en cours</dt><dd>{selected.reference || 'Non renseignée'}</dd><dt>Position sur le plan</dt><dd>X {(positions[selected.id] || selected).x.toFixed(1)} % · Y {(positions[selected.id] || selected).y.toFixed(1)} %</dd></dl>{canEdit && <Btn onClick={() => onEdit(selected)}><Settings2 size={15}/> Modifier la machine</Btn>}</> : <><div className="machine-detail-icon"><Box size={31}/></div><h3>Chaque machine a sa place.</h3><p>Sélectionnez un équipement sur le plan pour afficher sa fiche.</p>{canEdit && <div className="drag-tip">En mode 2D, faites glisser les machines puis enregistrez leurs positions.</div>}</>}</section></div><section className="panel machine-inventory"><PanelTitle title="Parc machines" sub={`${machines.length} équipements dans la sélection`}/><div className="table-scroll"><table className="data-table"><thead><tr><th>Machine</th><th>Atelier</th><th>Ligne</th><th>Référence</th><th>État</th><th /></tr></thead><tbody>{machines.map(m => <tr key={m.id}><td><strong>{m.name}</strong></td><td>{departments.find(d => d.id === m.department)?.name}</td><td>{m.line || '—'}</td><td>{m.reference || '—'}</td><td><Chip color={m.status === 'running' ? 'green' : m.status === 'stopped' ? 'red' : 'neutral'}>{statusNames[m.status]}</Chip></td><td><button className="text-btn" onClick={() => { setSelected(m); canEdit && onEdit(m); }}>{canEdit ? 'Modifier' : 'Voir'}</button></td></tr>)}</tbody></table></div></section></>;
}
export function HistoryView({ reports, machines, onOpen }: {
    reports: Report[];
    machines: Machine[];
    onOpen: (r: Report) => void;
}) { const [term, setTerm] = useState(''), [d, setD] = useState('all'), [dt, setDt] = useState(''); const rows = reports.filter(r => (d === 'all' || r.department === d) && (!dt || r.date === dt) && `${r.reference} ${machines.find(m => m.id === r.machine_id)?.name || ''} ${r.date}`.toLowerCase().includes(term.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)); return <section className="panel"><PanelTitle title="Rapports de production" sub="Recherchez par date, atelier, machine ou référence"/><div className="history-filters"><label><Search size={15}/><input aria-label="Filtrer les rapports" placeholder="Machine, référence…" value={term} onChange={e => setTerm(e.target.value)}/></label><select aria-label="Département" value={d} onChange={e => setD(e.target.value)}><option value="all">Tous les départements</option>{departments.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><input type="date" aria-label="Filtrer par date" value={dt} onChange={e => setDt(e.target.value)}/>{dt && <button className="text-btn" onClick={() => setDt('')}>Effacer</button>}</div>{rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Atelier / Équipe</th><th>Machine</th><th>Référence</th><th>Production</th><th>Statut</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.date}</td><td>{departments.find(d => d.id === r.department)?.name}<small>{r.shift}</small></td><td>{machines.find(m => m.id === r.machine_id)?.name || '—'}</td><td>{r.reference}</td><td>{number(r.metrics.actual)} pcs</td><td><Chip color={r.status === 'validated' ? 'green' : 'orange'}>{r.status === 'validated' ? 'Validé' : 'Brouillon'}</Chip></td><td><button className="text-btn" onClick={() => onOpen(r)}>Ouvrir <ArrowUpRight size={13}/></button><AuditButton id={r.id}/></td></tr>)}</tbody></table></div> : <Empty title="Aucun rapport trouvé" detail="Modifiez les filtres ou enregistrez votre première saisie."/>}</section>; }
export function SettingsView({ state, canEdit, onSave, onLogin, onDemo, demo, notify }: {
    state: FactoryState;
    canEdit: boolean;
    onSave: (s: FactoryState['settings']) => Promise<void>;
    onLogin: () => void;
    onDemo: () => void;
    demo: boolean;
    notify: Notify;
}) { const [green, setGreen] = useState(state.settings.green ?? 85), [yellow, setYellow] = useState(state.settings.yellow ?? 65), [approved, setApproved] = useState(state.settings.metricApproved ?? false), [saving, setSaving] = useState(false); return <div className="settings-grid"><section className="panel settings-panel"><PanelTitle title="Seuils de performance" sub="Couleurs des indicateurs de planning"/><form onSubmit={async (e) => { e.preventDefault(); if (yellow >= green)
    return; setSaving(true); try {
    await onSave({ ...state.settings, green, yellow, metricApproved: approved });
}
catch (e) {
    notify((e as Error).message);
} setSaving(false); }}><div className="form-grid"><label className="field">Objectif atteint à partir de (%)<input type="number" min="1" max="100" required value={green} onChange={e => setGreen(+e.target.value)} disabled={!canEdit}/></label><label className="field">À surveiller à partir de (%)<input type="number" min="0" max="99" required value={yellow} onChange={e => setYellow(+e.target.value)} disabled={!canEdit}/></label></div>{yellow >= green && <p className="form-error">Le seuil jaune doit être inférieur au seuil vert.</p>}<div className="threshold-preview"><Chip color="red">&lt; {yellow} %</Chip><Chip color="orange">{yellow} – {green} %</Chip><Chip color="green">≥ {green} %</Chip></div><label className="checkbox-field"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} disabled={!canEdit}/>Les conventions OEE / DLE ont été validées par MYC.</label><Btn primary type="submit" disabled={!canEdit || saving || yellow >= green}><Save size={15}/>{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</Btn></form></section><section className="panel settings-panel"><PanelTitle title="Accès & connexion" sub="Deux espaces, deux codes distincts"/><div className="connection-item"><Database size={19}/><div><strong>Supabase</strong><small>ztabtbqtscjfvrautczj.supabase.co</small></div><Chip color={demo ? 'neutral' : state.connected ? 'green' : 'red'}>{demo ? 'Démo' : state.connected ? 'Connecté' : 'À vérifier'}</Chip></div><p className="settings-copy">Le code saisie permet de gérer les rapports, machines et paramètres. Le code réunion donne accès aux indicateurs et aux décisions. Les codes sont vérifiés sur le serveur.</p><div className="settings-actions"><Btn onClick={onLogin}><LockKeyhole size={15}/>Changer d’espace</Btn><Btn onClick={onDemo}>{demo ? 'Connecter la production' : 'Passer en démonstration'}</Btn></div></section><section className="panel settings-panel formula-settings"><PanelTitle title="Conventions de calcul" sub="À approuver avant le pilotage opérationnel"/><dl><dt>Planning</dt><dd>Production réalisée / quantité planifiée.</dd><dt>OEE pondéré</dt><dd>Formules locales des classeurs Injection et Assemblage, pondérées par le temps de charge machine. Les autres ateliers restent non disponibles sans convention validée.</dd><dt>DLE pondéré</dt><dd>Somme des minutes gagnées / somme des minutes de main-d’œuvre engagées. Ne mesure pas la disponibilité machine.</dd><dt>Qualité</dt><dd>Production conforme / (production conforme + rebuts).</dd><dt>Métallisation</dt><dd>OEE et DLE non disponibles : la cadence idéale et le temps gagné ne sont pas définis dans le modèle fourni.</dd></dl></section></div>; }

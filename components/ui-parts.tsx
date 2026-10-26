'use client';
import React, { useEffect, useRef } from 'react';
import { Activity, ArrowRight, Layers3, Target, Users, X } from 'lucide-react';
import { departments, summarize, type FactoryState, type Report } from '@/lib/domain';
export const number = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
export const percent = (n: number | null) => n === null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n) + ' %';
export function Btn({ children, onClick, primary = false, className = '', disabled = false, type = 'button' }: {
    children: React.ReactNode;
    onClick?: () => void;
    primary?: boolean;
    className?: string;
    disabled?: boolean;
    type?: 'button' | 'submit';
}) { return <button type={type} disabled={disabled} className={`btn ${primary ? 'primary' : ''} ${className}`} onClick={onClick}>{children}</button>; }
export function Chip({ children, color = 'green' }: {
    children: React.ReactNode;
    color?: string;
}) { return <span className={'chip ' + color}><i />{children}</span>; }
export function Empty({ title, detail, action }: {
    title: string;
    detail: string;
    action?: React.ReactNode;
}) { return <div className="empty"><div className="empty-icon"><Layers3 size={28}/></div><h3>{title}</h3><p>{detail}</p>{action}</div>; }
export function Modal({ title, children, onClose }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) { const ref = useRef<HTMLDivElement>(null); useEffect(() => { const prev = document.activeElement as HTMLElement; const h = (e: KeyboardEvent) => { if (e.key === 'Escape')
    onClose(); if (e.key === 'Tab') {
    const f = Array.from(ref.current?.querySelectorAll<HTMLElement>('button,input,select,textarea') || []).filter(x => !x.hasAttribute('disabled'));
    if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f.at(-1)?.focus();
    }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) {
        e.preventDefault();
        f[0]?.focus();
    }
} }; ref.current?.querySelector<HTMLElement>('input,button')?.focus(); document.addEventListener('keydown', h); return () => { document.removeEventListener('keydown', h); prev?.focus(); }; }, []); return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Fermer" onClick={onClose}><X size={20}/></button></div>{children}</div></div>; }
export function PanelTitle({ title, sub, action }: {
    title: string;
    sub?: string;
    action?: React.ReactNode;
}) { return <div className="panel-title"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</div>; }
export function DepartmentTabs({ selected, onChange }: {
    selected: string;
    onChange: (d: string) => void;
}) { return <div className="department-tabs">{departments.map(d => <button key={d.id} className={selected === d.id ? 'active' : ''} onClick={() => onChange(d.id)}><i style={{ background: d.color }}/>{d.name}</button>)}</div>; }
export function Performance({ value, settings }: {
    value: number | null;
    settings: FactoryState['settings'];
}) { return <Chip color={value === null ? 'neutral' : value >= (settings.green ?? 85) ? 'green' : value >= (settings.yellow ?? 65) ? 'orange' : 'red'}>{percent(value)}</Chip>; }
export function Kpis({ stats, demo, approved }: {
    stats: ReturnType<typeof summarize>;
    demo: boolean;
    approved?: boolean;
}) { return <div className="kpi-grid">{[{ title: 'OEE · Efficacité des équipements', value: percent(stats.oee), label: approved ? 'Convention validée par MYC' : 'Convention à valider par MYC', icon: Activity, color: '#63ddbd' }, { title: 'DLE · Efficacité main-d’œuvre', value: percent(stats.dle), label: approved ? 'Convention validée par MYC' : 'Temps gagnés / temps engagés', icon: Users, color: '#83aef1' }, { title: 'Respect du planning', value: percent(stats.planning), label: stats.planned ? 'Réalisé / quantité planifiée' : 'Aucune quantité planifiée', icon: Target, color: '#e3bd7b' }].map((k, i) => <section className="kpi-card" key={k.title}><div className="kpi-label"><span>{k.title}</span><k.icon size={16}/></div><div className="kpi-main"><strong>{k.value}</strong>{demo && <svg viewBox="0 0 90 40" className="spark"><path d={i % 2 ? 'M0 30L10 34L20 22L30 26L40 19L50 20L60 10L70 15L80 6L90 9' : 'M0 34L10 30L20 33L30 20L40 23L50 18L60 22L70 10L80 12L90 3'} fill="none" stroke={k.color} strokeWidth="2"/></svg>}</div><div className="kpi-bottom"><span><i style={{ background: k.color }}/>{stats.count ? k.label : 'En attente de rapports validés'}</span><small>{demo ? 'DÉMO' : i < 2 && !approved ? 'PROVISOIRE' : 'JOUR'}</small></div></section>)}</div>; }
export function aggregateCategories(reports: Report[], key: 'losses' | 'defectCategories') { const all: Record<string, number> = {}; reports.filter(r => r.status === 'validated').forEach(r => Object.entries(r.metrics[key]).forEach(([k, v]) => all[k] = (all[k] || 0) + v)); return Object.entries(all).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10); }

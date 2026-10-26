export const departments = [
    { id: 'injection', name: 'Injection', code: 'INJ', color: '#54deca', description: 'Moulage & transformation' },
    { id: 'metalisation', name: 'Métallisation', code: 'MET', color: '#80acff', description: 'Revêtement & finition' },
    { id: 'serigraphie', name: 'Sérigraphie', code: 'SER', color: '#c9a7f5', description: 'Impression & décoration' },
    { id: 'assemblage', name: 'Assemblage', code: 'ASM', color: '#efc27b', description: 'Montage & conditionnement' },
];
export type Machine = {
    id: string;
    name: string;
    department: string;
    status: 'running' | 'stopped' | 'maintenance' | 'idle';
    x: number;
    y: number;
    reference?: string;
    line?: string;
};
export type Metrics = {
    planned: number;
    actual: number;
    defects: number;
    loadMinutes: number;
    runMinutes: number;
    idealSeconds: number | null;
    earnedMinutes: number | null;
    laborMinutes: number | null;
    oeeRatio?: number | null;
    losses: Record<string, number>;
    defectCategories: Record<string, number>;
};
export type Report = {
    id: string;
    date: string;
    department: string;
    shift: string;
    machine_id: string;
    reference: string;
    status: 'draft' | 'validated';
    cells: Record<string, string | number>;
    metrics: Metrics;
    updated_at?: string;
    planningTarget?: number | null;
};
export type Action = {
    id: string;
    problem: string;
    action: string;
    owner: string;
    due_date: string;
    priority: string;
    status: string;
    comment: string;
    closed_at?: string | null;
    department: string;
};
export type FactoryState = {
    machines: Machine[];
    reports: Report[];
    actions: Action[];
    settings: {
        planUrl?: string;
        planName?: string;
        green?: number;
        yellow?: number;
        metricApproved?: boolean;
    };
    connected: boolean;
    error?: string;
};
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function summarize(reports: Report[]) {
    const rows = reports.filter(r => r.status === 'validated');
    const sum = (key: keyof Metrics) => rows.reduce((n, r) => n + (typeof r.metrics[key] === 'number' ? r.metrics[key] as number : 0), 0);
    const actual = sum('actual'), defects = sum('defects'), planned = sum('planned'), load = sum('loadMinutes'), run = sum('runMinutes');
    const completeOee = rows.length > 0 && rows.every(r => r.metrics.idealSeconds !== null && r.metrics.actual > 0 && r.metrics.runMinutes > 0 && r.metrics.loadMinutes > 0);
    const completeDle = rows.length > 0 && rows.every(r => r.metrics.earnedMinutes !== null && r.metrics.laborMinutes !== null && r.metrics.laborMinutes > 0);
    const good = actual;
    return { count: rows.length, actual, defects, good, planned, load, run, planning: planned > 0 ? actual / planned * 100 : null, quality: actual + defects > 0 ? actual / (actual + defects) * 100 : null,
        oee: rows.length > 0 && rows.every(r => r.metrics.oeeRatio != null) && load > 0 ? rows.reduce((n, r) => n + r.metrics.oeeRatio! * r.metrics.loadMinutes, 0) / load * 100 : completeOee && load > 0 ? rows.reduce((n, r) => n + r.metrics.idealSeconds! * r.metrics.actual / 60, 0) / load * 100 : null,
        dle: completeDle && sum('laborMinutes') > 0 ? sum('earnedMinutes') / sum('laborMinutes') * 100 : null,
        downtime: load - run };
}
export const emptyState: FactoryState = { machines: [], reports: [], actions: [], settings: { green: 85, yellow: 65, metricApproved: false }, connected: false };
export const sampleState = (): FactoryState => {
    const machines: Machine[] = departments.flatMap((d, i) => Array.from({ length: i === 0 ? 5 : 3 }, (_, j) => ({ id: `demo-${i}-${j}`, name: `${d.code}-${String(j + 1).padStart(2, '0')}`, department: d.id, status: (i === 0 && j === 2 ? 'stopped' : i === 2 && j === 1 ? 'maintenance' : 'running') as Machine['status'], x: 12 + (i % 2) * 47 + j % 3 * 11, y: 22 + Math.floor(i / 2) * 43 + Math.floor(j / 3) * 13, reference: ['YZL019AD', 'YZL028I05', 'MYC-204'][j % 3], line: 'Ligne 01' })));
    const reports: Report[] = machines.map((m, i) => ({ id: `demo-r-${i}`, date: today(), department: m.department, shift: 'Équipe du matin', machine_id: m.id, reference: m.reference!, status: 'validated', cells: {}, metrics: { planned: 12000, actual: 9300 + i * 130, defects: 130 + i * 7, loadMinutes: 480, runMinutes: 380 + i * 4, idealSeconds: 2.1, earnedMinutes: 370 + i * 6, laborMinutes: 480, losses: { 'Panne machine': 34 + i, 'Changement de série': 18, 'Attente matière': 12 }, defectCategories: { 'Rayures': 80 + i * 2, 'Points noirs': 35, 'Déformation': 15 } } }));
    return { machines, reports, connected: false, settings: { green: 85, yellow: 65, metricApproved: false }, actions: [{ id: 'demo-a-1', problem: 'Arrêts répétés sur INJ-03', action: 'Contrôler le circuit de refroidissement', owner: 'Maintenance', due_date: today(), priority: 'Haute', status: 'En cours', comment: '', department: 'injection' }, { id: 'demo-a-2', problem: 'Rayures en sortie de ligne', action: 'Vérifier les supports de manutention', owner: 'Qualité', due_date: today(), priority: 'Normale', status: 'Ouverte', comment: '', department: 'serigraphie' }] };
};

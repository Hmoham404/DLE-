import type { Metrics } from './domain';
import { calculateCells } from './cell-calculation';
export function metricsFromCells(department: string, c: Record<string, string | number>): Metrics {
    const calculated = calculateCells(department, c);
    const n = (key: string) => { if (calculated[key] != null)
        return calculated[key]!; const v = Number(String(c[key] ?? '').replace(',', '.')); return Number.isFinite(v) ? v : 0; };
    const sum = (keys: string[]) => keys.reduce((s, k) => s + n(k), 0);
    const has = (key: string) => calculated[key] != null || (c[key] !== undefined && c[key] !== '');
    if (department === 'injection') {
        const load = Math.max(0, n('J') - sum(['K', 'L', 'M', 'N', 'O', 'P']));
        const losses = { 'Anomalie moule': n('S'), 'Panne machine': n('T'), 'Réglage produit': n('U'), 'Changement de moule': n('V'), 'Validation première pièce': n('W'), 'Essai moule': n('X'), 'Attente matière': n('Y'), 'Main-d’œuvre': n('Z'), 'Sans OF': n('AA') };
        const run = Math.max(0, load - Object.values(losses).reduce((a, b) => a + b, 0));
        const ideal = has('AD') && n('AF') > 0 ? n('AD') / n('AF') : null;
        return { planned: 0, actual: n('AJ'), defects: n('AR'), loadMinutes: load, runMinutes: run, idealSeconds: ideal, oeeRatio: calculated.BC, earnedMinutes: has('AL') ? n('AL') * 60 : null, laborMinutes: has('AM') && has('AI') ? n('AM') * 60 * n('AI') : null, losses, defectCategories: { [String(c.AQ || 'Non catégorisé')]: n('AR') } };
    }
    if (department === 'metalisation') {
        const load = n('AB') * 60;
        const losses = { 'Réglage anormal': n('AE') * 60, 'Panne machine': n('AG') * 60, 'Changement de ligne': n('AI') * 60, 'Matière entrante': n('AK') * 60, 'Échantillonnage': n('AM') * 60, 'Retravail': n('AO') * 60 };
        return { planned: n('L'), actual: n('N'), defects: n('O') + n('P'), loadMinutes: load, runMinutes: Math.max(0, load - Object.values(losses).reduce((a, b) => a + b, 0)), idealSeconds: null, earnedMinutes: null, laborMinutes: has('M') && has('AB') ? n('M') * load : null, losses, defectCategories: { 'Matière entrante': n('O'), 'Autres': n('P') } };
    }
    const defects = ['X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS'];
    const defectNames = ['Dorure à chaud', 'Impression', 'Rayures', 'Manque matière', 'Déformation', 'Particules', 'Piqûres', 'Oxydation', 'Autres', 'Particules (assemblage)', 'Écrasement', 'Rayures (assemblage)', 'Réglage machine', 'Cassure', 'Couple', 'Oxydation (assemblage)', 'Impression (assemblage)', 'Embout floqué', 'Décalage', 'Points noirs', 'Écart de hauteur', 'Autres (assemblage)'];
    const load = Math.max(0, n('T') * 60 - sum(['AV', 'AW', 'AX', 'AY', 'AZ']));
    const losses = { 'Panne machine': n('BD'), 'Changement de série': n('BE'), 'Approvisionnement': n('BF'), 'Autres': n('BG') };
    return { planned: n('O'), actual: n('P'), defects: sum(defects), loadMinutes: load, runMinutes: Math.max(0, load - Object.values(losses).reduce((a, b) => a + b, 0)), idealSeconds: null, oeeRatio: calculated.BQ, earnedMinutes: has('V') ? n('V') * n('P') : null, laborMinutes: has('S') && has('T') ? n('S') * n('T') * 60 : null, losses, defectCategories: Object.fromEntries(defects.map((k, i) => [defectNames[i], n(k)])) };
}

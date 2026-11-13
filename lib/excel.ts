import {prepareReportForExcel,automaticFormulas} from './excel-autofill';
import {calculateCells} from './cell-calculation';
import type {Machine} from './domain';
import {canonicalShift,shiftDefinition} from './shifts';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import templateData from '@/data/templates.json';
import { templateFiles } from '@/private/template-data';
import { metricsFromCells } from './metrics';
import type { Report } from './domain';
type Column = {
    key: string;
    label: string;
    calculated: boolean;
    overrideAllowed?: boolean;
};
type Template = {
    id: string;
    sheet: string;
    sheetPath: string;
    startRow: number;
    columns: Column[];
    sheets: string[];
};
const templates = templateData as Record<string, Template>;
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0] === 'x' ? parseInt(n.slice(1), 16) : +n)).replace(/&amp;/g, '&');
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
export function sourceBytes(department: string) { if (!templateFiles[department])
    throw new Error('Département inconnu.'); return Uint8Array.from(atob(templateFiles[department]), c => c.charCodeAt(0)); }
function unpack(bytes: Uint8Array) { if (bytes.length > 5000000)
    throw new Error('Fichier trop volumineux (5 Mo maximum).'); let size = 0; const files = unzipSync(bytes, { filter: f => { size += f.originalSize; if (size > 65000000 || f.originalSize > 50000000)
        throw new Error('Classeur décompressé trop volumineux.'); return true; } }); if (!files['xl/workbook.xml'])
    throw new Error('Ce fichier n’est pas un classeur XLSX valide.'); return files; }
function sharedStrings(files: Record<string, Uint8Array>) { const source = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : ''; return [...source.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join('')); }
function cellValue(xml: string, strings: string[]) { if (/\bt="s"/.test(xml)) {
    const index = /<v[^>]*>([^<]*)<\/v>/.exec(xml)?.[1];
    return strings[Number(index)] ?? '';
} if (/\bt="inlineStr"/.test(xml))
    return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join(''); const raw = /<v[^>]*>([^<]*)<\/v>/.exec(xml)?.[1]; return raw === undefined ? '' : decode(raw); }
function cellsOf(row: string) { return [...row.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map(m => ({ key: m[1], xml: m[0] })); }
function textColumn(dep: string, key: string) { return (dep === 'injection' ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'AQ', 'BD'] : dep === 'metalisation' ? ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'S', 'AD', 'AF', 'AH', 'AJ', 'AL', 'AN', 'AV'] : ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'BR', 'BS', 'BT', 'BU']).includes(key); }
function typedCell(dep: string, column: Column, address: string, value: string | number, existing?: string) {
    let attr = existing?.match(/^<c\b([^>]*?)(?:\/?>)/)?.[1] || ` r="${address}"`;
    attr = attr.replace(/\s+t="[^"]*"/g, '').replace(/\s+r="[^"]*"/, ' r="' + address + '"').replace(/\/$/, '');
    if (value === '' || value === undefined)
        return `<c${attr}/>`;
    if (dep !== 'injection' && column.key === 'A') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
            throw new Error('La date de production doit être au format AAAA-MM-JJ.');
        const serial = (Date.parse(String(value) + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000;
        return `<c${attr}><v>${serial}</v></c>`;
    }
    if (!textColumn(dep, column.key)) {
        const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
        if (!Number.isFinite(n))
            throw new Error(`${column.label} : saisissez un nombre valide.`);
        return `<c${attr}><v>${n}</v></c>`;
    }
    return `<c${attr} t="inlineStr"><is><t xml:space="preserve">${escape(String(value))}</t></is></c>`;
}
function shiftedRow(row: string, from: number, to: number) { const offset = to - from; return row.replace(/\br="([A-Z]*)(\d+)"/g, (_, col, n) => `r="${col}${+n + offset}"`).replace(/<f([^>]*)>([\s\S]*?)<\/f>/g, (_, attr, formula) => `<f${attr}>${formula.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g, (_: string, c: string, fixed: string, n: string) => c + fixed + (fixed ? n : +n + offset))}</f>`); }
export function exportWorkbook(department: string, reports: Report[], context:{machines?:Machine[];allReports?:Report[]}={}) {
    reports=reports.map(report=>prepareReportForExcel(report,context.machines?.find(machine=>machine.id===report.machine_id),context.allReports||reports));
    const t = templates[department];
    if (!t)
        throw new Error('Département inconnu.');
    const limit = department === 'injection' ? 80 : department === 'metalisation' ? 8 : 200;
    if (!reports.length)
        throw new Error('Aucun rapport validé pour cette date.');
    if (reports.length > limit)
        throw new Error(`Le modèle accepte ${limit} lignes par export. Réduisez la sélection.`);
    const files = unpack(sourceBytes(department));
    let xml = strFromU8(files[t.sheetPath]);
    const rows = new Map<number, string>();
    for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g))
        rows.set(+m[1], m[0]);
    const base = rows.get(t.startRow);
    if (!base)
        throw new Error('La ligne de saisie du modèle est introuvable.');
    const allowed = new Map(t.columns.map(c => [c.key, c]));
    const patch = (row: string, index: number, report:Report|null) => {
        const values=report?.cells||null,overrides=report?automaticFormulas(report,index):{};
        const baseOverrides=report?automaticFormulas(report,t.startRow):{};
        const computed=report?.workshop?calculateCells(department,report.cells,baseOverrides):{} as Record<string,number|null>;
        const cells = cellsOf(row), byKey = new Map(cells.map(c => [c.key, c.xml]));
        for (const [key, col] of allowed) {
            const existing = byKey.get(key);
            if(key in overrides){
                let attributes=existing?.match(/^<c\b([^>]*?)(?:\/?>)/)?.[1]||(' r="'+key+index+'"');
                attributes=attributes.replace(/\s+t="[^"]*"/g,'').replace(/\s+r="[^"]*"/,' r="'+key+index+'"').replace(/\/$/,'');
                const formula=overrides[key];
                const replacement=formula===null?'<c'+attributes+'/>':'<c'+attributes+'><f>'+escape(formula)+'</f></c>';
                row=existing?row.replace(existing,replacement):row.replace('</row>',replacement+'</row>');
                continue;
            }
            if (col.calculated)
                continue;
            // External lookup overrides are changed only when the user supplies a value.
            if (existing && /<f\b/.test(existing) && !col.overrideAllowed)
                continue;
            const value = values?.[key] ?? '';
            if (col.overrideAllowed && value === '' && !report?.workshop)
                continue;
            const replacement = typedCell(department, col, key + index, value, existing);
            if (existing)
                row = row.replace(existing, replacement);
            else
                row = row.replace('</row>', replacement + '</row>');
        }
        // Native hourly reports use saved inputs for formulas and caches.
        // Legacy imports retain original formulas; layout stays unchanged.
        row = row.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, cell => {
            if(!/<f\b/.test(cell))return cell;
            let clean=cell.replace(/<v\b[^>]*>[\s\S]*?<\/v>/g,'');
            const key=cell.match(/r="([A-Z]+)\d+"/)?.[1],value=key?computed[key]:null;
            if(report?.workshop&&value!==null&&value!==undefined&&Number.isFinite(value))clean=clean.replace('</c>','<v>'+value+'</v></c>');
            return clean;
        });
        return row;
    };
    for (const [index, row] of rows) {
        if (index < t.startRow || index >= t.startRow + limit)
            continue;
        const r = reports[index - t.startRow];
        const patched = patch(row, index, r || null);
        if (patched !== row)
            xml = xml.replace(row, patched);
    }
    for (let i = 0; i < reports.length; i++) {
        const index = t.startRow + i;
        if (rows.has(index))
            continue;
        let clone = shiftedRow(base, t.startRow, index);
        clone = patch(clone, index, reports[i]);
        let inserted = false;
        xml = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (row, n) => { if (!inserted && +n > index) {
            inserted = true;
            return clone + row;
        } return row; });
        if (!inserted)
            xml = xml.replace('</sheetData>', clone + '</sheetData>');
    }
    files[t.sheetPath] = strToU8(xml);
    let wb = strFromU8(files['xl/workbook.xml']);
    wb = wb.includes('<calcPr') ? wb.replace(/<calcPr\b[^>]*\/>/, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>') : wb.replace('</workbook>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
    files['xl/workbook.xml'] = strToU8(wb);
    return zipSync(files, { level: 6 });
}
export function importWorkbook(department: string, bytes: Uint8Array, date: string, shift: string): Report[] {
    const t = templates[department];
    if (!t)
        throw new Error('Département inconnu.');
    const files = unpack(bytes);
    if (!files[t.sheetPath])
        throw new Error('La feuille attendue est absente du classeur.');
    const wb = strFromU8(files['xl/workbook.xml']);
    if (!wb.includes('name="' + escape(t.sheet) + '"'))
        throw new Error(`Le modèle doit contenir la feuille « ${t.sheet} ».`);
    const strings = sharedStrings(files), xml = strFromU8(files[t.sheetPath]);
    const rows: Report[] = [];
    const machineKey = department === 'injection' ? 'A' : department === 'metalisation' ? 'B' : 'C', refKey = department === 'injection' ? 'E' : department === 'metalisation' ? 'H' : 'F';
    for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
        if (+m[1] < t.startRow)
            continue;
        const cells: Record<string, string | number> = {};
        for (const c of cellsOf(m[0])) {
            const col = t.columns.find(x => x.key === c.key);
            if (!col || col.calculated)
                continue;
            const value = cellValue(c.xml, strings);
            if (!value)
                continue;
            if (c.key === 'A' && department !== 'injection') {
                const n = Number(value);
                cells.A = Number.isFinite(n) ? new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10) : value;
            }
            else
                cells[c.key] = textColumn(department, c.key) ? value : Number.isFinite(Number(value)) ? Number(value) : value;
        }
        if (!cells[machineKey])
            continue;
        if (rows.length >= 200)
            throw new Error('Import limité à 200 lignes. Divisez le fichier.');
        const sourceShift=String(cells[department==='injection'||department==='metalisation'?'C':'B']||'');
        const rowShift=canonicalShift(shiftDefinition(sourceShift)?sourceShift:shift);
        rows.push({ id: crypto.randomUUID(), date, department, shift:rowShift, machine_id: '', reference: String(cells[refKey] || ''), status: 'draft', cells, metrics: metricsFromCells(department, cells) });
    }
    if (!rows.length)
        throw new Error('Aucune ligne de production avec numéro de machine trouvée.');
    return rows;
}

import templateData from '@/data/templates.json';
// Deliberately supports only local arithmetic and single-row SUM. No eval, external
// workbook resolution, or historical hard-coded cumulative formula is executed.
export function calculateCells(department: string, input: Record<string, string | number>) {
    const template = (templateData as any)[department];
    if (!template)
        return {} as Record<string, number | null>;
    const columns = template.columns as {
        key: string;
        formula?: string;
        calculated: boolean;
    }[];
    const result: Record<string, number | null> = {}, visiting = new Set<string>();
    const base = template.startRow;
    const num = (key: string, blankZero = false): number | null => {
        if (key in result) {
            if (blankZero && result[key] === null && !columns.find(c => c.key === key)?.calculated && (input[key] === undefined || input[key] === ''))
                return 0;
            return result[key];
        }
        if (visiting.has(key))
            return null;
        const col = columns.find(c => c.key === key);
        if (!col?.calculated) {
            const v = input[key];
            if (v === undefined || v === '')
                return blankZero ? 0 : null;
            const n = Number(String(v).replace(',', '.'));
            return Number.isFinite(n) ? n : null;
        }
        visiting.add(key);
        let value: number | null = null;
        try {
            let f = col.formula || '';
            if (/\[|#REF!|VLOOKUP|XLOOKUP/.test(f) || ['AK', 'AP', 'AS'].includes(key) && department === 'injection')
                throw 0;
            f = f.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_: string, a: string, r1: string, b: string, r2: string) => {
                if (+r1 !== base || +r2 !== base)
                    throw 0;
                let n = 0;
                for (const c of columns) {
                    if (columnNumber(c.key) >= columnNumber(a) && columnNumber(c.key) <= columnNumber(b)) {
                        const x = num(c.key, true);
                        if (x === null)
                            throw 0;
                        n += x;
                    }
                }
                return String(n);
            });
            f = f.replace(/\$?([A-Z]+)\$?(\d+)/g, (_: string, k: string, r: string) => { if (+r !== base)
                throw 0; const n = num(k); if (n === null)
                throw 0; return '(' + n + ')'; });
            value = arithmetic(f);
            if (!Number.isFinite(value))
                value = null;
        }
        catch {
            value = null;
        }
        visiting.delete(key);
        result[key] = value;
        return value;
    };
    for (const c of columns)
        result[c.key] = num(c.key);
    return result;
}
function columnNumber(col: string) { return [...col].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0); }
function arithmetic(source: string): number {
    const tokens = source.match(/\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?|[()+\-*/]/g) || [];
    if (tokens.join('') !== source.replace(/\s/g, ''))
        throw 0;
    let i = 0;
    const atom = (): number => { const t = tokens[i++]; if (t === '(') {
        const n = add();
        if (tokens[i++] !== ')')
            throw 0;
        return n;
    } if (t === '-')
        return -atom(); if (t === '+')
        return atom(); if (!t || !/^\d/.test(t))
        throw 0; return Number(t); };
    const mul = (): number => { let n = atom(); while (tokens[i] === '*' || tokens[i] === '/') {
        const t = tokens[i++], r = atom();
        if (t === '/' && r === 0)
            throw 0;
        n = t === '*' ? n * r : n / r;
    } return n; };
    const add = (): number => { let n = mul(); while (tokens[i] === '+' || tokens[i] === '-') {
        const t = tokens[i++], r = mul();
        n = t === '+' ? n + r : n - r;
    } return n; };
    const n = add();
    if (i !== tokens.length)
        throw 0;
    return n;
}

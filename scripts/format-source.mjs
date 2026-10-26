import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
const files=['app/page.tsx','app/layout.tsx','components/factory-app.tsx','components/factory-scene.tsx','components/ui-parts.tsx','components/meeting-view.tsx','components/workspace-views.tsx','lib/domain.ts','lib/server.ts','lib/cell-calculation.ts','lib/metrics.ts','lib/excel.ts','app/api/session/route.ts','app/api/factory/route.ts','app/api/excel/route.ts','app/api/audit/route.ts'];
for(const name of files){const source=ts.createSourceFile(name,readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);writeFileSync(name,printer.printFile(source));}

"""Optional dedicated Python XLSX service. Never rebuilds an official workbook.

Run behind TLS/reverse proxy with EXCEL_SERVICE_TOKEN set. Bind is loopback by
default. Supplied templates are immutable. This engine preserves ZIP members
and patches only mapped worksheet inputs and Excel recalculation flags.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import json, os, re, hmac, math
from datetime import date
from html import escape

ROOT=Path(__file__).resolve().parents[1]
TEMPLATES=json.loads((ROOT/'data/templates.json').read_text(encoding='utf-8'))
TEXT={
 'injection':set('A B C D E F G H AQ BD'.split()),
 'metalisation':set('B C D E G H I S AD AF AH AJ AL AN AV'.split()),
 'serigraphie':set('B C D E F G H I J K L BR BS BT BU'.split()),
 'assemblage':set('B C D E F G H I J K L BR BS BT BU'.split()),
}
ROW=re.compile(r'<row\b[^>]*\br="(\d+)"[^>]*?(?:/>|>[\s\S]*?</row>)')
CELL=re.compile(r'<c\b[^>]*\br="([A-Z]+)\d+"[^>]*?(?:/>|>[\s\S]*?</c>)')

def export_workbook(department, reports):
 if department not in TEMPLATES:raise ValueError('Département inconnu.')
 t=TEMPLATES[department]
 limit=80 if department=='injection' else 8 if department=='metalisation' else 200
 if not reports or len(reports)>limit:raise ValueError(f'Entre 1 et {limit} lignes requises.')
 with ZipFile(ROOT/'private/templates'/f'{department}.xlsx') as source:
  parts={n:source.read(n) for n in source.namelist()}
  info=source.infolist()
 xml=parts[t['sheetPath']].decode('utf-8')
 rows={int(m[1]):m[0] for m in ROW.finditer(xml)}
 base=rows[t['startRow']]
 def patch(row,index,values):
  old={m[1]:m[0] for m in CELL.finditer(row)}
  for col in t['columns']:
   k=col['key']; cell=old.get(k)
   if col['calculated']:continue
   v=values.get(k,'')
   if col.get('overrideAllowed') and v=='':continue
   if cell and '<f' in cell and not col.get('overrideAllowed'):continue
   attrs=re.match(r'<c\b([^>]*?)(?:/?>)',cell)[1] if cell else f' r="{k}{index}"'
   attrs=re.sub(r'\s+t="[^"]*"','',attrs).rstrip('/')
   if v=='':replacement=f'<c{attrs}/>'
   elif department!='injection' and k=='A':
    serial=(date.fromisoformat(str(v))-date(1899,12,30)).days
    replacement=f'<c{attrs}><v>{serial}</v></c>'
   elif k in TEXT[department]:replacement=f'<c{attrs} t="inlineStr"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>'
   else:
    number=float(str(v).replace(',','.'))
    if not math.isfinite(number):raise ValueError(f'{k} : nombre invalide.')
    replacement=f'<c{attrs}><v>{number:g}</v></c>'
   if cell:row=row.replace(cell,replacement)
   else:row=row.replace('</row>',replacement+'</row>')
  return re.sub(r'<c\b[^>]*?(?:/>|>[\s\S]*?</c>)',lambda m:re.sub(r'<v\b[^>]*>[\s\S]*?</v>','',m[0]) if '<f' in m[0] else m[0],row)
 for index,row in rows.items():
  if t['startRow']<=index<t['startRow']+limit:
   offset=index-t['startRow']; values=reports[offset].get('cells',{}) if offset<len(reports) else {}
   xml=xml.replace(row,patch(row,index,values))
 for i,report in enumerate(reports):
  index=t['startRow']+i
  if index in rows:continue
  clone=re.sub(r'\br="([A-Z]*)(\d+)"',lambda m:f'r="{m[1]}{int(m[2])+i}"',base)
  clone=re.sub(r'<f([^>]*)>([\s\S]*?)</f>',lambda m:'<f'+m[1]+'>'+re.sub(r'(\$?[A-Z]{1,3})(\$?)(\d+)',lambda f:f[1]+f[2]+str(int(f[3]) if f[2] else int(f[3])+i),m[2])+'</f>',clone)
  clone=patch(clone,index,report.get('cells',{}))
  next_row=next((m for m in ROW.finditer(xml) if int(m[1])>index),None)
  if next_row:xml=xml[:next_row.start()]+clone+xml[next_row.start():]
  else:xml=xml.replace('</sheetData>',clone+'</sheetData>')
 parts[t['sheetPath']]=xml.encode('utf-8')
 wb=parts['xl/workbook.xml'].decode('utf-8')
 calc='<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'
 wb=re.sub(r'<calcPr\b[^>]*/>',calc,wb) if '<calcPr' in wb else wb.replace('</workbook>',calc+'</workbook>')
 parts['xl/workbook.xml']=wb.encode('utf-8')
 output=BytesIO()
 with ZipFile(output,'w') as result:
  for member in info:result.writestr(member,parts[member.filename])
 return output.getvalue()

class Handler(BaseHTTPRequestHandler):
 def do_POST(self):
  token=os.environ.get('EXCEL_SERVICE_TOKEN','')
  if not token:self.send_error(503,'Service token not configured');return
  if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):self.send_error(401);return
  if self.path!='/export':self.send_error(404);return
  size=int(self.headers.get('Content-Length','0'))
  if not 0<size<=5000000:self.send_error(413);return
  try:
   body=json.loads(self.rfile.read(size)); result=export_workbook(body['department'],body['reports'])
   self.send_response(200);self.send_header('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');self.send_header('Content-Length',str(len(result)));self.end_headers();self.wfile.write(result)
  except (ValueError,KeyError,TypeError) as exc:
   result=json.dumps({'error':str(exc)}).encode();self.send_response(400);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(result)
 def log_message(self,format,*args):pass

if __name__=='__main__':
 if not os.environ.get('EXCEL_SERVICE_TOKEN'):raise SystemExit('Set EXCEL_SERVICE_TOKEN before starting the service.')
 ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('EXCEL_SERVICE_PORT','8090'))),Handler).serve_forever()

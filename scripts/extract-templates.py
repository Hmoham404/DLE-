"""Read OOXML templates without rewriting the originals."""
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import json, re, shutil, base64

ROOT=Path(__file__).resolve().parents[1]
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sources=[('injection','Injection_Daily Report.xlsx',0,4,2,3),('metalisation','Metalisation Daily Report.xlsx',0,6,4,5),('serigraphie','Serigraphie Daily Report.xlsx',0,2,1,1),('assemblage','Assembly_Daily report.xlsx',1,2,1,1)]
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'private'/'templates').mkdir(parents=True,exist_ok=True)
(ROOT/'public').mkdir(exist_ok=True)
shutil.copy2(ROOT.parent/'MYC beauty innovation TUNISIA @300x-100.jpg',ROOT/'public'/'myc-logo.jpg')
output={}
binary={}
for slug,name,idx,start,header,subheader in sources:
 with ZipFile(ROOT.parent/name) as z:
  wb=ET.fromstring(z.read('xl/workbook.xml'))
  sheets=list(wb.find('m:sheets',NS))
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   strings=[''.join(si.itertext()) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
  rels={r.attrib['Id']:r.attrib['Target'].lstrip('/') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  sh=sheets[idx]; target=rels[sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
  target=target if target.startswith('xl/') else 'xl/'+target
  xml=ET.fromstring(z.read(target))
  rows={int(r.attrib['r']):r for r in xml.findall('m:sheetData/m:row',NS)}
  def value(c):
   v=c.find('m:v',NS)
   if c.attrib.get('t')=='s' and v is not None:return strings[int(v.text)]
   return ''.join(c.find('m:is',NS).itertext()) if c.find('m:is',NS) is not None else v.text if v is not None else ''
  labels={re.sub(r'\d','',c.attrib['r']):value(c).replace('\n',' ').strip() for c in rows[header]}
  if header!=subheader:
   for c in rows.get(subheader,[]):
    if value(c):labels[re.sub(r'\d','',c.attrib['r'])]=value(c).replace('\n',' ').strip()
  sample=rows.get(start,[])
  formulas={re.sub(r'\d','',c.attrib['r']):c.find('m:f',NS).text for c in sample if c.find('m:f',NS) is not None}
  # For blank templates derive formula columns from any data row.
  for n,row in rows.items():
   if start<=n<=start+5:
    for c in row:
     if c.find('m:f',NS) is not None:formulas.setdefault(re.sub(r'\d','',c.attrib['r']),c.find('m:f',NS).text or '')
  def colnum(col):
   result=0
   for char in col:result=result*26+ord(char)-64
   return result
  end='BD' if slug=='injection' else 'AV' if slug=='metalisation' else 'BU'
  columns=[]
  for n in range(1,colnum(end)+1):
   x=n;col=''
   while x:x,r=divmod(x-1,26);col=chr(65+r)+col
   label=labels.get(col) or ('Quantité de défauts' if slug=='injection' and col=='AR' else col)
   formula=formulas.get(col)
   override=bool(formula and '[' in formula)
   columns.append({'key':col,'label':label,'formula':formula,'calculated':col in formulas and not override,'overrideAllowed':override})
  # Blank workbooks keep formula and formatting XML; only populated input cells are cleared.
  output[slug]={'id':slug,'file':name,'sheet':sh.attrib['name'],'sheetPath':target,'startRow':start,'columns':columns,'sheets':[s.attrib['name'] for s in sheets],'warnings':{'brokenReferences':sum(z.read(n).count(b'#REF!') for n in z.namelist() if n.startswith('xl/worksheets/') and n.endswith('.xml')),'largeFormattedRange':slug in ['assemblage','serigraphie']}}
  shutil.copy2(ROOT.parent/name,ROOT/'private'/'templates'/f'{slug}.xlsx')
  binary[slug]=base64.b64encode((ROOT.parent/name).read_bytes()).decode('ascii')
(ROOT/'data'/'templates.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'private'/'template-data.ts').write_text('export const templateFiles:Record<string,string> = '+json.dumps(binary)+';\n',encoding='utf-8')
print(json.dumps({k:{'columns':len(v['columns']),'sheets':len(v['sheets']),'warnings':v['warnings']} for k,v in output.items()}))

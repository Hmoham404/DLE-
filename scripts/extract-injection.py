"""Read the supplied inventory without modifying the original workbook."""
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else next(root.parent.glob('*Atelier injection*.xlsx'))
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
machines = []
with zipfile.ZipFile(source) as archive:
    strings = [''.join(si.itertext()) for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
    sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
    for row in sheet.findall('.//s:sheetData/s:row', ns):
        cells = {}
        for cell in row:
            value = cell.find('s:v', ns)
            text = value.text if value is not None else ''
            if cell.get('t') == 's' and text:
                text = strings[int(text)]
            cells[''.join(c for c in cell.get('r') if c.isalpha())] = (text or '').strip()
        if cells.get('D', '').casefold() != 'machine injection':
            continue
        code = cells.get('E', '')
        if not code or not cells.get('F'):
            raise ValueError(f'Missing code or serial number on row {row.get("r")}')
        machines.append({
            'code': code, 'manufacturer': cells.get('B', ''),
            'model': cells.get('C', ''), 'serialNumber': cells.get('F', ''),
            'power': cells.get('M', ''), 'weight': cells.get('L', ''),
            'voltage': cells.get('N', ''), 'frequency': cells.get('O', ''),
            'manufacturedAt': cells.get('H', ''), 'acquiredAt': cells.get('I', ''),
            'sourceFile': source.name, 'sourceSheet': 'Feuil1', 'sourceRow': int(row.get('r')),
        })
if len({m['code'] for m in machines}) != len(machines) or len({m['serialNumber'] for m in machines}) != len(machines):
    raise ValueError('Duplicate machine codes or serial numbers in Feuil1')
if not machines:
    raise ValueError('No injection machines found')
target = root / 'data' / 'injection-machines.json'
target.write_text(json.dumps(machines, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(machines)} injection machines extracted from Feuil1')

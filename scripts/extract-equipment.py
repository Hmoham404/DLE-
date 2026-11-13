"""Extract the two supplied equipment inventories, preserving physical source rows.

No spreadsheet is modified. Blank codes and conflicting source values stay explicit.
"""
import collections
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def rows(path):
    with zipfile.ZipFile(path) as archive:
        strings = [''.join(s.itertext()) for s in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        for row in sheet.findall('.//s:sheetData/s:row', NS):
            values = {}
            for cell in row:
                value = cell.find('s:v', NS)
                text = value.text if value is not None else ''
                if cell.get('t') == 's' and text:
                    text = strings[int(text)]
                values[re.sub(r'\d', '', cell.get('r'))] = (text or '').strip()
            yield int(row.get('r')), values


def base_inventory(path, row, code, model, serial):
    return dict(code=code, manufacturer='', model=model, serialNumber=serial,
                power='', weight='', voltage='', frequency='', manufacturedAt='', acquiredAt='',
                sourceFile=path.name, sourceSheet='Feuil1', sourceRow=row)


def extract():
    catalog, issues, groups = [], [], []
    injection = next(ROOT.parent.glob('*Atelier injection*.xlsx'))
    second = next(ROOT.parent.glob('FICHIER_INVENTAIRE*.xlsx'))
    for row, cells in rows(injection):
        if row < 2 or not cells.get('D'):
            continue
        category, code = cells['D'], cells.get('E', '')
        kind = 'production' if category.casefold() == 'machine injection' else 'tooling' if category.casefold() == 'moule injection' else 'support'
        inventory = base_inventory(injection, row, code, cells.get('C', ''), cells.get('F', ''))
        inventory.update(manufacturer=cells.get('B', ''), power=cells.get('M', ''), weight=cells.get('L', ''),
                         voltage=cells.get('N', ''), frequency=cells.get('O', ''),
                         manufacturedAt=cells.get('H', ''), acquiredAt=cells.get('I', ''),
                         category=category, zone='ATELIER INJECTION')
        catalog.append(dict(name=code or cells.get('G') or category, department='injection',
                            assetKind=kind, line='', inventory=inventory))
    current = None
    for row, cells in rows(second):
        if row <= 5:
            continue
        if cells.get('A'):
            current = dict(name=cells['A'], zone=cells.get('C', ''), quantity=cells.get('B', ''), row=row, count=0)
            groups.append(current)
        if not current or not cells.get('D'):
            continue
        current['count'] += 1
        category, zone, code = current['name'], current['zone'], cells['D']
        department = 'metalisation' if 'METALLISATION' in zone.upper() and 'ASSEMBLAGE' not in zone.upper() else 'serigraphie' if 'DECORATION' in zone.upper() and 'ASSEMBLAGE' not in zone.upper() else 'assemblage'
        kind = 'production' if code.startswith(('MYC-02-SRG-', 'MYC-02-MAC-', 'MYC-02-ASA-')) else 'support'
        inventory = base_inventory(second, row, code, category, cells.get('E', ''))
        inventory.update(category=category, zone=zone)
        line = 'Automatique' if code.startswith('MYC-02-ASA-') else ''
        catalog.append(dict(name=code, department=department, assetKind=kind, line=line, inventory=inventory))
    # Preserve groups whose quantity is known but whose individual codes are absent.
    for group in groups:
        if group['count'] == 0 and group['quantity'].isdigit() and int(group['quantity']) > 0:
            inventory = base_inventory(second, group['row'], '', group['name'], '')
            inventory.update(category=group['name'], zone=group['zone'], quantity=int(group['quantity']))
            catalog.append(dict(name=group['name'], department='assemblage', assetKind='support', line='', inventory=inventory))
    for group in groups:
        if not group['quantity'].isdigit() or int(group['quantity']) != group['count']:
            issues.append(dict(file=second.name, sheet='Feuil1', row=group['row'],
                               message=f"{group['name']} : quantité indiquée {group['quantity'] or 'vide'}, {group['count']} codes présents. Les codes présents sont conservés."))
    for path in (injection, second):
        codes = collections.defaultdict(list)
        serials = collections.defaultdict(list)
        for item in catalog:
            inv = item['inventory']
            if inv['sourceFile'] != path.name:
                continue
            if inv['code']:
                codes[inv['code']].append(inv['sourceRow'])
            serial = inv['serialNumber']
            if serial and serial.upper() not in ('ND', 'NA', 'N/A'):
                serials[serial].append(inv['sourceRow'])
        for label, values in [('Code interne', codes), ('Numéro de série', serials)]:
            for value, locations in values.items():
                if len(locations) > 1:
                    issues.append(dict(file=path.name, sheet='Feuil1', row=locations[0],
                                       message=f"{label} {value} répété aux lignes {', '.join(map(str, locations))}. Équipements conservés séparément par ligne source."))
    # These reporting units follow the user's explicit workshop structure.
    # Their names are editable, and no official machine matricule is fabricated.
    units = [dict(name='Ligne 1', department='metalisation', line='Ligne 1'),
             dict(name='Ligne 2', department='metalisation', line='Ligne 2'),
             dict(name='Ligne automatique', department='assemblage', line='Automatique'),
             dict(name='Ligne manuelle', department='assemblage', line='Manuelle')]
    for unit in units:
        catalog.append(dict(**unit, assetKind='line'))
    names = collections.Counter((i['department'], i['name']) for i in catalog)
    for item in catalog:
        if names[(item['department'], item['name'])] > 1:
            item['name'] = f"{item['name']} · {item['inventory']['category']}"[:80]
    identities = [(i['inventory']['sourceFile'], i['inventory']['sourceRow']) for i in catalog if 'inventory' in i]
    assert len(identities) == len(set(identities)), 'Duplicate source rows'
    assert sum(i['inventory']['code'].startswith('MYC-02-SRG-') for i in catalog if 'inventory' in i) == 6
    summary = {d: dict(collections.Counter(i['assetKind'] for i in catalog if i['department'] == d)) for d in ['injection', 'serigraphie', 'metalisation', 'assemblage']}
    report = dict(counts=summary, issues=issues,
                  notes=['Feuil2 du parc injection reprend 10 presses sous des codes différents : Feuil1 est retenue.',
                         'Les chambres à vide PMT et les équipements d’assemblage restent à affecter à leurs lignes réelles.',
                         'Le rapport d’assemblage utilise B02 et B23 ; leur correspondance avec les codes internes est à confirmer.'])
    (ROOT / 'data' / 'equipment-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'data' / 'equipment-review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(total=len(catalog), counts=summary, issues=len(issues))))


if __name__ == '__main__':
    extract()

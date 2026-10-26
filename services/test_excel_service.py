import unittest
from io import BytesIO
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from excel_service import export_workbook, TEMPLATES, ROOT

class FidelityTests(unittest.TestCase):
 def test_all_templates(self):
  for department,t in TEMPLATES.items():
   with self.subTest(department=department):
    cells={'A':'INJ-TEST','C':'Matin','E':'REF<&01','AD':130,'AF':8,'AI':1,'AJ':1300,'AR':200} if department=='injection' else {'A':'2026-10-26','B':'MET-TEST','H':'REF<&01','L':1000,'N':900,'AB':8} if department=='metalisation' else {'A':'2026-10-26','B':'Matin','C':'ASM-TEST','F':'REF<&01','N':20000,'R':4,'S':4,'T':6,'P':10856}
    result=export_workbook(department,[{'cells':cells}])
    with ZipFile(ROOT/'private/templates'/f'{department}.xlsx') as source,ZipFile(BytesIO(result)) as output:
     self.assertEqual(source.namelist(),output.namelist())
     for name in source.namelist():
      if name not in [t['sheetPath'],'xl/workbook.xml']:self.assertEqual(source.read(name),output.read(name),name)
     tree=ET.fromstring(output.read(t['sheetPath']))
     ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
     key='E' if department=='injection' else 'H' if department=='metalisation' else 'F'
     cell=tree.find(f'.//m:c[@r="{key}{t["startRow"]}"]',ns)
     self.assertEqual(''.join(cell.find('m:is',ns).itertext()),'REF<&01')
     for tag in ['cols','mergeCells','pageMargins','pageSetup','sheetViews']:
      a=ET.fromstring(source.read(t['sheetPath'])).find('m:'+tag,ns);b=tree.find('m:'+tag,ns)
      self.assertEqual(ET.tostring(a) if a is not None else None,ET.tostring(b) if b is not None else None,tag)
 def test_rejects_empty(self):
  with self.assertRaises(ValueError):export_workbook('injection',[])

if __name__=='__main__':unittest.main()

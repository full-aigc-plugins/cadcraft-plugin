"""CAD文档字体库必须包含中文字体，不能仅补UI字体栈。"""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
class CadFontOverlay(unittest.TestCase):
    def test_cad_document_font_budget_keeps_chinese_face(self):
        script=Path(__file__).parents[1]/'runtime/prepare-fonts.py'
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);fonts=root/'crates/fonts';fonts.mkdir(parents=True);(fonts/'build.rs').write_text('if wasm && !web_face { continue; }\n')
            ui=root/'crates/ui-egui/src';ui.mkdir(parents=True);(ui/'lib.rs').write_text('fn install(ctx: Context) { ctx.set_fonts(Default::default()); }\n')
            result=subprocess.run([sys.executable,str(script),str(root),'cadcraft'],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('if wasm && *family != "LXGW WenKai" && !web_face',(fonts/'build.rs').read_text())
            self.assertTrue((ui/'craft_fonts.rs').is_file())
if __name__=='__main__':unittest.main()

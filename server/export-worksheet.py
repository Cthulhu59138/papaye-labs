"""Copy a private workbook and write the choices into its three editable columns."""

import base64
import io
import json
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile

SHEET = "xl/worksheets/sheet1.xml"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ET.register_namespace("x", NS[1:-1])
ET.register_namespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")


def excel_text(value):
    # Excel gives these sequences meaning even when the user typed them literally.
    value = re.sub(r"_(?=x[0-9A-Fa-f]{4}_)", "_x005F_", value)
    return re.sub(r"[\x00-\x08\x0b-\x0d\x0e-\x1f\ufffe\uffff]",
                  lambda match: f"_x{ord(match[0]):04X}_", value)


def update_cells(xml, choices):
    sheet = ET.fromstring(xml)
    data = sheet.find(NS + "sheetData")
    cells = {cell.get("r"): cell for cell in data.iter(NS + "c")}
    for row, priority, status, comment in choices:
        for column, value in zip("BCD", (priority, status, comment)):
            cell = cells[column + str(row)]
            for previous in list(cell):
                cell.remove(previous)
            cell.attrib.pop("t", None)
            if value:
                cell.set("t", "inlineStr")
                string = ET.SubElement(cell, NS + "is")
                text = ET.SubElement(string, NS + "t")
                text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                text.text = excel_text(value)
    return ET.tostring(sheet, encoding="utf-8", xml_declaration=True)


def main():
    data = json.load(sys.stdin)
    template = base64.b64decode(data["template"], validate=True)
    output = io.BytesIO()
    with ZipFile(io.BytesIO(template)) as source, ZipFile(output, "w") as result:
        for entry in source.infolist():
            raw = source.read(entry)
            if entry.filename == SHEET:
                raw = update_cells(raw, data["rows"])
            result.writestr(entry, raw)
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()

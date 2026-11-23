"""Write saved choices into the private template and extend its table with a decision."""

import base64
import io
import json
import posixpath
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile

SHEET = "xl/worksheets/sheet1.xml"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
ET.register_namespace("x", NS[1:-1])
ET.register_namespace("r", REL_NS[1:-1])


def excel_text(value):
    # Excel gives these sequences meaning even when the user typed them literally.
    value = re.sub(r"_(?=x[0-9A-Fa-f]{4}_)", "_x005F_", value)
    return re.sub(r"[\x00-\x08\x0b-\x0d\x0e-\x1f\ufffe\uffff]",
                  lambda match: f"_x{ord(match[0]):04X}_", value)


def set_text(cell, value):
    for previous in list(cell):
        cell.remove(previous)
    cell.attrib.pop("t", None)
    if value:
        cell.set("t", "inlineStr")
        string = ET.SubElement(cell, NS + "is")
        text = ET.SubElement(string, NS + "t")
        text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        text.text = excel_text(value)


def column_number(letters):
    result = 0
    for letter in letters:
        result = result * 26 + ord(letter) - ord("A") + 1
    return result


def column_letters(number):
    letters = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        letters = chr(ord("A") + remainder) + letters
    return letters


def choice_table(source, sheet, first_row, last_row):
    parts = sheet.findall(NS + "tableParts/" + NS + "tablePart")
    if not parts:
        return None, None
    rels = ET.fromstring(source.read("xl/worksheets/_rels/sheet1.xml.rels"))
    targets = {r.get("Id"):r.get("Target") for r in rels if r.get("Type","").endswith("/table")}
    for part in parts:
        target = targets[part.get(REL_NS + "id")]
        path = posixpath.normpath(posixpath.join("xl/worksheets", target)).lstrip("/")
        table = ET.fromstring(source.read(path))
        left, header, right, bottom = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", table.get("ref")).groups()
        if column_number(left) <= 2 and column_number(right) >= 4 and int(header) < first_row and last_row <= int(bottom):
            return path, table
    return None, None


def data_validation(sheet, start, end, decisions):
    validations = sheet.find(NS + "dataValidations")
    if validations is None:
        validations = ET.Element(NS + "dataValidations")
        # dataValidations follows the sheet data, filters, merges, and conditional formats.
        successors = {"hyperlinks", "printOptions", "pageMargins", "pageSetup", "headerFooter",
                      "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors",
                      "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "picture",
                      "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"}
        position = next((i for i, child in enumerate(sheet) if child.tag.removeprefix(NS) in successors), len(sheet))
        sheet.insert(position, validations)
    target = f"{start}:{end}"
    if not any(v.get("sqref") == target for v in validations.findall(NS + "dataValidation")):
        rule = ET.SubElement(validations, NS + "dataValidation", type="list", allowBlank="1",
                             showErrorMessage="0", sqref=target)
        ET.SubElement(rule, NS + "formula1").text = '"' + ",".join(decisions) + '"'
    validations.set("count", str(len(validations.findall(NS + "dataValidation"))))


def xml_bytes(root):
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def update_sheet(source, choices, decisions):
    if not choices:
        return {}
    sheet = ET.fromstring(source.read(SHEET))
    data = sheet.find(NS + "sheetData")
    rows = {int(row.get("r")): row for row in data.findall(NS + "row")}
    first_row = min(row[0] for row in choices)
    last_row = max(row[0] for row in choices)
    path, table = choice_table(source, sheet, first_row, last_row)
    changes = {}
    if table is not None:
        left, header, right, bottom = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", table.get("ref")).groups()
        header_row = int(header)
        columns = table.find(NS + "tableColumns")
        entries = columns.findall(NS + "tableColumn")
        index = next((i for i, entry in enumerate(entries) if entry.get("name") == "Décision"), None)
        if index is None:
            decision_col = column_letters(column_number(right) + 1)
            next_id = 1 + max(int(entry.get("id")) for entry in entries)
            ET.SubElement(columns, NS + "tableColumn", id=str(next_id), name="Décision")
            columns.set("count", str(len(entries) + 1))
            table.set("ref", f"{left}{header}:{decision_col}{bottom}")
            table_filter = table.find(NS + "autoFilter")
            if table_filter is not None:
                table_filter.set("ref", re.sub(r":[A-Z]+", ":" + decision_col, table_filter.get("ref")))
            changes[path] = xml_bytes(table)
        else:
            decision_col = column_letters(column_number(left) + index)
    else:
        header_row = first_row - 1
        rightmost = max(column_number(re.match(r"[A-Z]+", cell.get("r"))[0]) for cell in data.iter(NS + "c"))
        decision_col = column_letters(rightmost + 1)

    if header_row not in rows:
        rows[header_row] = ET.Element(NS + "row", r=str(header_row))
        at = next((i for i, row in enumerate(data) if int(row.get("r")) > header_row), len(data))
        data.insert(at, rows[header_row])
    def decision_cell(row_id):
        row = rows[row_id]
        ref = decision_col + str(row_id)
        existing = row.find(f"{NS}c[@r='{ref}']")
        if existing is not None:
            return existing
        cell = ET.Element(NS + "c", r=ref)
        style_from = row.find(f"{NS}c[@r='C{row_id}']")
        if style_from is not None and style_from.get("s") is not None:
            cell.set("s", style_from.get("s"))
        position = next((i for i, c in enumerate(row) if c.tag != NS + "c" or
                         column_number(re.match(r"[A-Z]+", c.get("r"))[0]) > column_number(decision_col)), len(row))
        row.insert(position, cell)
        if "spans" in row.attrib:
            del row.attrib["spans"]  # Optional optimization would omit the new column.
        return cell
    set_text(decision_cell(header_row), "Décision")
    for row_id, priority, status, comment, decision in choices:
        for col, value in zip("BCD", (priority, status, comment)):
            set_text(rows[row_id].find(f"{NS}c[@r='{col}{row_id}']"), value)
        set_text(decision_cell(row_id), decision)
    data_validation(sheet, decision_col + str(first_row), decision_col + str(last_row), decisions)
    cols = sheet.find(NS + "cols")
    number = column_number(decision_col)
    if cols is not None and not any(int(c.get("min")) <= number <= int(c.get("max")) for c in cols):
        col = ET.Element(NS + "col", min=str(number), max=str(number), width="16", customWidth="1")
        position = next((i for i, c in enumerate(cols) if int(c.get("min")) > number), len(cols))
        cols.insert(position, col)
    dimension = sheet.find(NS + "dimension")
    if dimension is not None and ":" in dimension.get("ref", ""):
        start, right, bottom = re.fullmatch(r"(\w+):([A-Z]+)(\d+)", dimension.get("ref")).groups()
        dimension.set("ref", f"{start}:{column_letters(max(column_number(right), number))}{max(int(bottom),last_row)}")
    changes[SHEET] = xml_bytes(sheet)
    return changes


def main():
    data = json.load(sys.stdin)
    template = base64.b64decode(data["template"], validate=True)
    output = io.BytesIO()
    with ZipFile(io.BytesIO(template)) as source, ZipFile(output, "w") as result:
        changes = update_sheet(source, data["rows"], data["decisions"])
        for entry in source.infolist():
            raw = changes[entry.filename] if entry.filename in changes else source.read(entry)
            result.writestr(entry, raw)
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()

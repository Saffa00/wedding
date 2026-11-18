// Spreadsheet-safe CSV. Cells that start with = + - @ could run as formulas when opened in Excel or Sheets,
// so they are prefixed with an apostrophe. Plain phone numbers such as +23276000000 are left alone.
const PHONE_LIKE = /^[+-]?[\d\s().-]+$/;

const cell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !PHONE_LIKE.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows, columns) =>
  "\uFEFF" + // byte-order mark so Excel reads accents correctly
  [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))].join("\r\n");

export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// PERF-05C: Research-only trusted SQL ORDER BY reversal.
"use strict";
const assert = require("node:assert/strict");
function splitOrderTerms(sql) {
  const terms = [];
  let start = 0, depth = 0, quote = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (quote) {
      if (c === quote) { if (next === quote) { i++; continue; } quote = ""; }
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "(") { depth++; continue; }
    if (c === ")") { depth--; assert.ok(depth >= 0); continue; }
    if (c === "," && depth === 0) { terms.push(sql.slice(start, i).trim()); start = i + 1; }
  }
  assert.equal(depth, 0); assert.equal(quote, "");
  terms.push(sql.slice(start).trim());
  assert.ok(terms.length >= 2 && terms.every(Boolean));
  return terms;
}
function reverseOrderSql(sql) {
  const terms = splitOrderTerms(sql);
  assert.match(terms.at(-1), /\bplayer_id\s+DESC$/i);
  return terms.map(term => {
    if (/\s+ASC$/i.test(term)) return term.replace(/\s+ASC$/i, " DESC");
    if (/\s+DESC$/i.test(term)) return term.replace(/\s+DESC$/i, " ASC");
    return term + " DESC";
  }).join(", ");
}
function reversedTailQuery(sql, parameters, totalRows) {
  const start = sql.lastIndexOf(" ORDER BY "), end = sql.lastIndexOf(" LIMIT ? OFFSET ?");
  assert.ok(start >= 0 && end > start && end + " LIMIT ? OFFSET ?".length === sql.length);
  const pageSize = Number(parameters.at(-2)), offset = Number(parameters.at(-1));
  assert.ok(Number.isSafeInteger(pageSize) && pageSize > 0 && Number.isSafeInteger(offset) && offset >= 0);
  assert.ok(Number.isSafeInteger(totalRows) && totalRows > offset && totalRows > 0);
  const expectedRows = Math.min(pageSize, totalRows - offset);
  const inverseOffset = totalRows - offset - expectedRows;
  assert.ok(Number.isSafeInteger(inverseOffset) && inverseOffset >= 0);
  return {
    sql: sql.slice(0, start) + " ORDER BY " + reverseOrderSql(sql.slice(start + " ORDER BY ".length, end)) + " LIMIT ? OFFSET ?",
    parameters: [...parameters.slice(0, -2), expectedRows, inverseOffset],
    inverseOffset, expectedRows, recommended: inverseOffset < offset,
  };
}
module.exports = { splitOrderTerms, reverseOrderSql, reversedTailQuery };

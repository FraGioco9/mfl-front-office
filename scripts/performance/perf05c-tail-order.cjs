"use strict";
const assert = require("node:assert/strict");
const { reverseOrderSql } = require("../../api/_data-page-order.js");
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
module.exports = { reverseOrderSql, reversedTailQuery };

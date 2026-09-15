import React from "react";
import Document, { Head, Html, Main, NextScript } from "next/document";
import parse from "html-react-parser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import legacyDevWatchToken from "../legacy-dev-watch-token.js";

const INDEX_PATH = resolve(process.cwd(), "index.html");

function requiredMatch(source, expression, label) {
  const match = source.match(expression);
  if (!match) throw new Error(`Could not extract legacy ${label} from index.html.`);
  return match;
}

function elementProps(tagName, rawAttributes) {
  const node = parse(`<${tagName}${rawAttributes || ""}></${tagName}>`);
  if (!React.isValidElement(node)) return {};
  const props = { ...(node.props || {}) };
  delete props.children;
  return props;
}

function legacyDocumentSnapshot() {
  const source = readFileSync(INDEX_PATH, "utf8");
  const html = requiredMatch(source, /<html([^>]*)>/i, "html attributes");
  const head = requiredMatch(source, /<head([^>]*)>([\s\S]*?)<\/head>/i, "head");
  const body = requiredMatch(source, /<body([^>]*)>([\s\S]*?)<\/body>/i, "body");
  return Object.freeze({
    htmlProps: elementProps("html", html[1]),
    headProps: elementProps("head", head[1]),
    headChildren: parse(head[2]),
    bodyProps: elementProps("body", body[1]),
    bodyChildren: parse(body[2]),
  });
}

const legacy = legacyDocumentSnapshot();

export default class MflDocument extends Document {
  render() {
    return React.createElement(
      Html,
      {
        ...legacy.htmlProps,
        suppressHydrationWarning: true,
        "data-mfl-dev-assets": process.env.NODE_ENV === "development" ? legacyDevWatchToken : undefined,
      },
      React.createElement(
        Head,
        legacy.headProps,
        legacy.headChildren,
      ),
      React.createElement(
        "body",
        { ...legacy.bodyProps, suppressHydrationWarning: true },
        legacy.bodyChildren,
        React.createElement(Main),
        React.createElement(NextScript),
      ),
    );
  }
}

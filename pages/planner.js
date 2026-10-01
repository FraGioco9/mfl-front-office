import React from "react";
import Head from "next/head";
import { initialPageMetadata } from "../initial-page-metadata.mjs";

// Serve Planner as a first-class Next page rather than depending on the
// static SPA fallback rewrite. _document supplies the shared legacy shell.
// The runtime upgrades the generic title to a saved plan name once loaded.
const metadata = initialPageMetadata("/planner");
export default function MflPlannerPage() {
  return React.createElement(Head, null,
    React.createElement("title", null, metadata.title),
    React.createElement("meta", { name: "description", content: metadata.description }),
    React.createElement("meta", { property: "og:title", content: metadata.title }),
  );
}

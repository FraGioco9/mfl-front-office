import React from "react";
import Head from "next/head";
import { initialPageMetadata } from "../../initial-page-metadata.mjs";

// Do not fetch or expose a private plan name in public first-response metadata.
// The wallet-aware SPA resolves saved/shared plan identity after authorization.
const metadata = initialPageMetadata("/planner");
export default function MflPlannerPlanPage() {
  return React.createElement(Head, null,
    React.createElement("title", null, metadata.title),
    React.createElement("meta", { name: "description", content: metadata.description }),
    React.createElement("meta", { property: "og:title", content: metadata.title }),
  );
}

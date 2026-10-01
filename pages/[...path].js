import React from "react";
import Head from "next/head";
import { initialPageMetadata } from "../initial-page-metadata.mjs";

// The legacy browser router still owns the interactive page and entity titles.
// Provide route-specific metadata in the response HTML before JS can execute.
export function getServerSideProps(context) {
  return { props: { initialMetadata: initialPageMetadata(context.resolvedUrl) } };
}

export default function MflLegacyShellRoutePage({ initialMetadata }) {
  return React.createElement(Head, null,
    React.createElement("title", null, initialMetadata.title),
    React.createElement("meta", { name: "description", content: initialMetadata.description }),
    React.createElement("meta", { property: "og:title", content: initialMetadata.title }),
  );
}

import React from "react";
import Head from "next/head";
import { initialPageMetadata } from "../initial-page-metadata.mjs";
import { resolveEntityDeepLink, entityStatusMetadata } from "../entity-deep-links.mjs";

// The legacy browser router still owns the interactive page and entity titles.
// Provide route-specific metadata in the response HTML before JS can execute.
export async function getServerSideProps(context) {
  const entity = await resolveEntityDeepLink(context.resolvedUrl);
  if (entity && entity.status !== 200) context.res.statusCode = entity.status;
  return { props: {
    initialMetadata: entityStatusMetadata(entity?.kind, entity?.status)
      || initialPageMetadata(context.resolvedUrl),
  } };
}

export default function MflLegacyShellRoutePage({ initialMetadata }) {
  return React.createElement(Head, null,
    React.createElement("title", null, initialMetadata.title),
    React.createElement("meta", { name: "description", content: initialMetadata.description }),
    React.createElement("meta", { property: "og:title", content: initialMetadata.title }),
  );
}

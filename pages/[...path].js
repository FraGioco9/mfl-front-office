import React from "react";
import Head from "next/head";

function initialDocumentTitle(resolvedUrl = "") {
  const pathname = String(resolvedUrl || "").split(/[?#]/, 1)[0] || "/";
  if (pathname === "/planner") return "Planner - MFL Front Office";
  return "";
}

export function getServerSideProps(context) {
  return {
    props: {
      initialDocumentTitle: initialDocumentTitle(context?.resolvedUrl),
    },
  };
}

export default function MflLegacyShellRoutePage({ initialDocumentTitle = "" }) {
  if (!initialDocumentTitle) return null;
  return React.createElement(
    Head,
    null,
    React.createElement("title", null, initialDocumentTitle),
  );
}

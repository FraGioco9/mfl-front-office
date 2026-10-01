import React from "react";
import Head from "next/head";
import { initialPageMetadata } from "../initial-page-metadata.mjs";

const homeMetadata = initialPageMetadata("/");

export default function MflHomePage() {
  return React.createElement(Head, null,
    React.createElement("title", null, homeMetadata.title),
    React.createElement("meta", { name: "description", content: homeMetadata.description }),
    React.createElement("meta", { property: "og:title", content: homeMetadata.title }),
  );
}

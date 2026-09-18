import React from "react";
import Head from "next/head";

export default function MflApp({ Component, pageProps, router }) {
  const routePath = String(router?.asPath || "").split(/[?#]/, 1)[0] || "/";
  const managedTitle = routePath === "/planner" ? "Planner - MFL Front Office" : "";

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Head,
      null,
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      }),
      managedTitle ? React.createElement("title", null, managedTitle) : null,
    ),
    React.createElement(Component, pageProps),
  );
}

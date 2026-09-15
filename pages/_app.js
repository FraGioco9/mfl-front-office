import React from "react";
import Head from "next/head";

export default function MflApp({ Component, pageProps }) {
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
    ),
    React.createElement(Component, pageProps),
  );
}

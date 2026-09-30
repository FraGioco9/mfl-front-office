import React from "react";
import Head from "next/head";

// Stable saved/shared Planner links reuse the shared legacy shell. The route
// owner resolves whether the opaque plan id belongs to this wallet or is a
// public share.
export default function MflPlannerPlanPage() {
  return React.createElement(Head, null,
    React.createElement("title", null, "Planner - MFL Front Office"));
}

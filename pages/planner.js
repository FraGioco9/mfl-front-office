import Head from "next/head";

// Serve Planner as a first-class Next page rather than depending on the
// static SPA fallback rewrite. _document supplies the shared legacy shell.
// A page-owned title also survives Next's head reconciliation on direct load.
export default function MflPlannerPage() {
  return <Head><title>Planner - MFL Front Office</title></Head>;
}

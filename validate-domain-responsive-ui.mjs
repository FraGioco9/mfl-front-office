import { runDomain } from "./validation/run-domain.mjs";

// Keep the legacy CLI path, argv, and process boundary while sharing the manifest.
await runDomain("responsive-ui");

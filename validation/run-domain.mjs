import { pathToFileURL } from "node:url";
import { domainSuites } from "./domain-suites.mjs";
import { runDomainValidators } from "./domain-runner.mjs";

/** One domain per process; the parent validate-all.mjs still owns process isolation. */
export async function runDomain(domainId) {
  if (!Object.hasOwn(domainSuites, domainId)) {
    throw new Error("Unknown validation domain: " + domainId);
  }
  const suite = domainSuites[domainId];
  await runDomainValidators({
    domain: suite.domain,
    title: suite.title,
    validators: suite.validators,
    baseUrl: new URL("../", import.meta.url),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !Object.hasOwn(domainSuites, args[0])) {
    console.error("Usage: node validation/run-domain.mjs <domain-id>");
    process.exitCode = 2;
  } else {
    // Legacy one-file runners had no positional args. A domain ID in argv[2]
    // can be mistaken for a CLI argument by imported validator dependencies.
    const domainId = args[0];
    process.argv.splice(2);
    await runDomain(domainId);
  }
}

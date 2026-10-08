/**
 * Execute a domain suite in one process, in declared order.
 *
 * Keep the existing per-validator log lines, fail-fast semantics and
 * imported module context. validate-all.mjs owns subprocess isolation.
 */
export async function runDomainValidators({ domain, title, validators, baseUrl }) {
  for (const validator of validators) {
    console.log("[" + domain + "] " + validator);
    try {
      await import(new URL("./" + validator, baseUrl));
    } catch (error) {
      console.error("[" + domain + "] FAILED " + validator);
      throw error;
    }
  }

  console.log(title + " validator domain passed: " + validators.length + " validators in one process.");
}

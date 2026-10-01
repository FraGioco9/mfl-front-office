// Next.js Pages Router adapter for the privacy-safe CSP report receiver.
// Disable automatic JSON parsing so the receiver can enforce its own 16-KiB
// request-body cap and validate both browser reporting wire formats.
const handler = require("../../api/csp-report.js");

export const config = { api: { bodyParser: false } };
export default handler;

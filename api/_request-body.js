const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

class RequestBodyError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "RequestBodyError";
    this.statusCode = statusCode;
  }
}

class RequestBodyTooLargeError extends RequestBodyError {
  constructor() {
    super(413, "Request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

class MalformedJsonBodyError extends RequestBodyError {
  constructor() {
    super(400, "Malformed JSON request body.");
    this.name = "MalformedJsonBodyError";
  }
}

function requestBodyLimit(options = {}) {
  const configured = Number(options.maxBytes);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_BODY_BYTES;
}

async function readRequestBody(request, options = {}) {
  const maxBytes = requestBodyLimit(options);
  const contentLength = Number(request?.headers?.["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

async function readJsonBody(request, options = {}) {
  const rawBody = await readRequestBody(request, options);
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new MalformedJsonBodyError();
  }
}

function sendRequestBodyError(response, error) {
  if (!(error instanceof RequestBodyError)) return false;
  response.status(error.statusCode).json({ error: error.message });
  return true;
}

module.exports = {
  DEFAULT_MAX_BODY_BYTES,
  RequestBodyError,
  RequestBodyTooLargeError,
  MalformedJsonBodyError,
  readRequestBody,
  readJsonBody,
  sendRequestBodyError,
};

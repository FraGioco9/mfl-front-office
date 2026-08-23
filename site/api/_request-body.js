async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  const rawBody = await readRequestBody(request);
  return rawBody ? JSON.parse(rawBody) : {};
}

module.exports = {
  readRequestBody,
  readJsonBody,
};

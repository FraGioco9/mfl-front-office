module.exports = function redirectToData(mode) {
  return function handler(request, response) {
    const params = new URLSearchParams();
    Object.entries(request.query || {}).forEach(([key, value]) => {
      if (key === "mode") return;
      if (Array.isArray(value)) value.forEach((entry) => params.append(key, String(entry)));
      else if (value !== undefined && value !== null) params.set(key, String(value));
    });
    params.set("mode", mode);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Location", `/api/data?${params.toString()}`);
    response.status(307).end();
  };
};

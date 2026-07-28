export const config = {
  matcher: "/app.js",
};

export default async function middleware(request) {
  const target = new URL("/api/app-bundle", request.url);
  const response = await fetch(target, {
    headers: {
      "x-mfl-app-bundle": "1",
    },
  });
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

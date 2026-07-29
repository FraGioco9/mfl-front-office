/* v1.151.15: serve the stabilized single app bundle before route startup. */
export const config = {
  matcher: "/app.js",
};

export default function middleware(request: Request) {
  const target = new URL("/api/app-bundle", request.url);
  return fetch(target, {
    headers: {
      "x-mfl-app-bundle": "1",
    },
  });
}

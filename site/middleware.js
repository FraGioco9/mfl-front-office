/* v1.151.13: serve the validated MFL stats and club-loading bundle. */
export const config = {
  matcher: "/app.js",
};

export default function middleware(request) {
  const target = new URL("/api/app-bundle", request.url);
  return fetch(target, {
    headers: {
      "x-mfl-app-bundle": "1",
    },
  });
}

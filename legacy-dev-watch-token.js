// In development, Webpack replaces this module through dev-legacy-watch-loader.cjs.
// The generated token changes whenever a legacy public compatibility asset changes,
// giving Next Fast Refresh a real dependency to invalidate.
const legacyDevWatchToken = "production-static";

export default legacyDevWatchToken;

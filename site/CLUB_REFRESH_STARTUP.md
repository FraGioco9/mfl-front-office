# Club refresh startup ownership

Direct Club refresh and in-site Club navigation must resolve the same route identity before application startup begins.

A canonical `/clubs/<clubId>/<view>` URL is resolved by the shared `pageTargetFromPath` startup parser as `pageName: "club"`, preserving the Club ID, view, and canonical path. `showHomeShell` then delegates that target to `window.mflOpenClubPage`, the same public gate used by in-site Club links.

Club uses shared Table infrastructure for headers, loading state, columns, rows, and view switching, but Club does not own saved filter state and must never fall through the generic unknown-route Home startup path.

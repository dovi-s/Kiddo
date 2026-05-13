## Admin Access

There is now one source of truth for fallback admin-email behavior:

- Shared helper: [shared/adminAccess.ts](/c:/Apps/Kora%20(newest)/shared/adminAccess.ts:1)

How it works:

- Normal admin access comes from the database `is_admin` flag.
- Super admin access comes from `SUPER_ADMIN_EMAILS` or `SUPER_ADMIN_EMAIL`.
- If neither env var is set, the default fallback super admin is `dovisherman@gmail.com`.
- Super admins are treated as effective admins automatically.

Where it is applied:

- Auth/session resolution: [server/auth.ts](/c:/Apps/Kora%20(newest)/server/auth.ts:1)
- Bootstrap admin grant on startup: [server/index.ts](/c:/Apps/Kora%20(newest)/server/index.ts:1)
- Super-admin-only admin routes: [server/routes.ts](/c:/Apps/Kora%20(newest)/server/routes.ts:1)
- Frontend auth normalization and admin UI gating:
  [client/src/hooks/use-auth.ts](/c:/Apps/Kora%20(newest)/client/src/hooks/use-auth.ts:1)
  [client/src/pages/Admin.tsx](/c:/Apps/Kora%20(newest)/client/src/pages/Admin.tsx:1)

Recommended env config:

```env
SUPER_ADMIN_EMAILS=dovisherman@gmail.com
```

Notes:

- Email matching is case-insensitive.
- The frontend fallback exists only to keep the UI consistent with the server rule.
- The server remains the enforcement point for all admin access.

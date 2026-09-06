# Password-first cloud login (v47)

The cloud dialog now offers the existing Listenwrite account password as the primary connection method. Password login calls the standard Supabase password grant and does not request email or create an account. Mail is an optional collapsed fallback. Local study and mistake review remain usable without signing in.

An already authenticated owner can set or change the synchronization password from the cloud dialog using Supabase's authenticated user-update endpoint. The password is entered only in the app, sent to Supabase over HTTPS, and is not stored by the app, added to learning backups, or logged. Server-side password and reauthentication policies remain enforced. This does not change the Gmail or GitHub password.

Refresh errors now retain the saved session on network failures, timeouts, malformed responses, HTTP 429 and server errors. Only explicit revoked/expired-session error codes clear it. Retry backoff prevents the five-second sync poll from hammering authentication. Web Locks serialize refresh across tabs where supported. A delayed refresh cannot overwrite a newer session or resurrect a signed-out one. Storage events propagate login across tabs in the same browser profile.

Logged-out polling no longer destroys typed passwords or overwrites error messages. Mail quota errors show the password alternative and apply a local resend cooldown. Expired-link callbacks display the failure instead of silently remaining logged out.

## Verification

Run 34017454432, job 101443664708: 182/182 tests passed before and after the production browser build. Runtime and rebuilt bundle committed as 606e7776f3c014aca7707780318810202ec1c021. A test-only MutationObserver teardown warning was identified in the logs and fixed in the subsequent test commit; the PR reruns the suite with browser-error assertions.

Tests use fake authentication responses and JSDOM. They cover successful password requests, wrong passwords, owner checks, session retention/backoff, revoked sessions, simultaneous refreshes, tab rotation, authenticated password changes, UI input preservation, email cooldown and callback errors. They are not a live sign-in on the user's physical Edge installation.

No production password was reset, no authentication policy or RLS protection was weakened, and no production learning state was overwritten. Finish active study and reload the same app to get the new dialog; do not clear browser storage.

# Personal no-prompt synchronization (v48)

A fixed personal entry opens the same owner vocabulary from another browser without entering a password, requesting email, or following an authorization screen. After a successful connection the browser retains its private access separately from learning backups. Ordinary reloads automatically reconnect. The entry is reusable across the owner's devices; it is not a single-use email token.

The personal URL is a bearer capability: anyone it is shared with can read or modify that owner's learning state. Keep it private. Real keys are never embedded in this public repository or build artifacts. A random 256-bit key is provisioned separately; only its SHA-256 digest is stored in the protected mapping table. A key can be revoked server-side without resetting passwords or changing learning data. The URL fragment is removed before the app performs sync requests; keys are submitted in HTTPS request bodies with no referrer and are never included in learning exports.

The database exposes only connect, pull and revision-checked push for the owner mapped by the key. The client cannot choose another user ID. The helper and key table cannot be read by anonymous or ordinary authenticated roles. Existing learning-table RLS and normal authentication policies remain in place. Definer functions use an empty search_path and schema-qualified relations.

Connection errors retain device access and retry with backoff. A late response cannot restore a disconnected device or overwrite a newer entry. Existing cloud merge and conflict backups remain active; obtaining a connection does not authorize silently overwriting divergent local records. Password/mail flows remain under a collapsed legacy fallback for old devices but are absent from the personal-entry dialog.

## Validation

Server-side integration was executed as the anonymous client role in a transaction and fully rolled back: valid connect/read, revision-checked write, stale-revision conflict, invalid-key rejection, revoked-key rejection, inaccessible key table and inaccessible internal helper. The production learning-state hash and revision were identical before and after the rollback.

The JavaScript suite adds personal-entry persistence, scoped RPC payloads, invalid-link handling, offline retry, revoked entry, delayed disconnect, cross-tab storage adoption and an actual cloud-dialog integration flow in JSDOM. CI runs the entire project suite and production build. Authentication transports in JS tests are simulated; database function tests use the deployed functions. No claim is made that a real user's physical Edge browser has already opened the new entry.

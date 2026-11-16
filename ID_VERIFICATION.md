# ID Verification

## Behavior

Registration accepts Buyer and Seller accounts and requires a supported ID type, readable front/back photos, and explicit processing consent. The server checks the actual image bytes, MIME type, pixel bounds, and file size, then rotates, strips metadata, and stores normalized JPEGs outside the public web directory.

When no provider is configured, local English OCR performs a name-consistency hint only. It never authenticates an ID. The account status remains `pending_review` until an authorized admin reviews the documents at **Admin → Seller Approvals → Pending identity verification**. Admin decisions are appended to the user's `idVerificationReviews` history; rejection decisions require a standard reason code and can include a note shown to the user. Buyers may still use buyer features and checkout; seller product creation and editing require both verified identity and seller approval.

When Sumsub is configured, the server creates an individual applicant, uploads both sides using the documented Sumsub API, requests a check, and waits for a signed `applicantReviewed` webhook. Only a completed `GREEN` provider result sets `verified`. `RED` results become `rejected`; Sumsub `RETRY` results allow resubmission. Provider outages keep documents in `pending_review` and enable retry.

Supported statuses: `not_submitted`, `pending`, `verified`, `pending_review`, and `rejected`. ID document references and legacy base64 fields are excluded from ordinary user queries and auth responses. Documents are streamed only through admin-authenticated routes with `Cache-Control: private, no-store`. The admin queue is served from `GET /api/admin/verifications/pending`, details from `GET /api/admin/verifications/:id`, protected front/back images from `GET /api/admin/verifications/:id/document/:docId`, and decisions from `PUT /api/admin/verifications/:id/review`. Rejections require `reasonCode` (`blurry_image`, `name_mismatch`, `expired_document`, `unsupported_document`, or `other`); `reasonNote` is optional and limited to 1000 characters. The signed-in status page displays the latest decision reason and offers the secure resubmission flow when retry is allowed.

Successful verification detail/image reads and review decisions are appended as JSON lines to the private, gitignored `logs/id-reviews.log`. The file rotates at 5 MiB and retains five rotated files. Entries contain only the timestamp, reviewer user ID, action, target user ID, and allowlisted rejection reason code; never add request bodies or applicant data to this log. Review notes are stripped of HTML/script markup and Philippine 09-prefixed 11-digit mobile sequences are masked before persistence, with Mongoose setters applying the same normalization to note fields. The admin panel revokes browser blob URLs and clears private image state on logout, page hide, and component cleanup; expired admin API sessions are logged out on HTTP 401. Browser cleanup reduces exposure but cannot guarantee memory zeroization, so keep devices managed and use short admin sessions.

## Sumsub Setup

Sumsub is optional and is currently unconfigured in this workspace. Do not set placeholder values. To enable it:

1. Create a Sumsub sandbox app token and an individual verification level that accepts the intended Philippine identity documents. Grant the app token permissions to create applicants, change applicant data, upload verification documents, and deactivate applicants for retention cleanup.
2. Set these backend-only environment variables in `.env` or the deployment secret manager:

   ```dotenv
   SUMSUB_APP_TOKEN=your-sandbox-app-token
   SUMSUB_SECRET_KEY=your-sandbox-secret-key
   SUMSUB_LEVEL_NAME=your-case-sensitive-level-name
   SUMSUB_WEBHOOK_SECRET=the-webhook-signing-secret
   ```

3. In Sumsub’s Webhook Manager, configure the public HTTPS URL `https://YOUR_HOST/api/webhooks/sumsub`, subscribe to user verification review events including `applicantReviewed`, select `HMAC_SHA256_HEX`, and set the same webhook secret as `SUMSUB_WEBHOOK_SECRET`.
4. Test in Sumsub sandbox first. All four settings are required; if any are absent, Havestra does not call Sumsub and uses `pending_review` instead.

Havestra uses Sumsub’s official [request signing](https://docs.sumsub.com/reference/authentication), [applicant creation](https://docs.sumsub.com/reference/create-applicant), [document upload](https://docs.sumsub.com/reference/add-verification-documents), [check request](https://docs.sumsub.com/reference/request-applicant-check), and [webhook digest verification](https://docs.sumsub.com/docs/webhook-manager) formats. Secrets never go to the browser. Only the raw-body HMAC digest is accepted for webhook state changes.

## Storage, Retention, And Migration

Set `ID_DOCUMENTS_DIR` to a private, durable directory or mounted volume outside the entire workspace. The server refuses paths inside the workspace because Vite has relaxed filesystem access in development. The default local path is under the service account's home directory (`~/.havestra/id-documents`). Restrict filesystem access to the backend service account and use encrypted disks/backups in production. If deploying to ephemeral/multi-instance infrastructure, configure shared private storage before enabling registrations.

ID images and OCR consistency hints expire after 90 days. A daily server cleanup deletes local private files, legacy embedded images, provider IDs, consent metadata, and OCR hints while preserving the final verification result/status. For configured Sumsub accounts, Havestra also requests applicant deactivation through Sumsub's official API. Sumsub documents this as deactivation, not hard deletion; configure the provider retention/data-processing terms for any further deletion requirement. Keep database and private-volume backups under the same restricted access policy.

Before upgrading an existing database, back it up and configure the final `ID_DOCUMENTS_DIR`. Then migrate embedded legacy ID images:

```powershell
pnpm db:migrate-id-documents
```

The command reports aggregate migrated/skipped/failed counts only. Investigate failed records through a secure admin process; do not export or print ID images. Do not run the migration against production until the private storage volume and backup/restore procedure are ready.

## Verification Tests

```powershell
pnpm test:server
pnpm exec tsc --noEmit --project tsconfig.json
pnpm exec tsc --noEmit --project server/tsconfig.json
pnpm run build
```

Manual checks:

1. With Sumsub variables absent, register a Buyer and Seller using clear JPEG/PNG/WebP front and back images and accept both terms and ID-processing consent. Registration completes without auto-login; the signed-in status page reports `pending_review` and clearly states OCR is not identity verification.
2. Try a renamed text file, unsupported image, corrupt image, undersized image, and a file over `MAX_FILE_SIZE`; the server must reject each and not create a user.
3. Sign in as an admin and review the ID through **Admin → Seller Approvals**. Verify or reject it. Rejecting enables secure resubmission; a normal Buyer can still use checkout.
4. Try to create/update a Seller product before identity verification and seller approval; the API must return 403. Verify the ID and approve the seller before publishing.
5. For Sumsub sandbox, verify `pending` remains pending, only a valid signed completed `GREEN` webhook changes status to verified, `RED/RETRY` enables resubmission, tampered signatures are rejected, and unsigned webhook requests never change status.
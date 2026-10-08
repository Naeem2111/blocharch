# Inbox and outbox file sharing

Private client files already land in a Google Drive folder per client. The UK client portal does not share files yet. This note is the build spec for that gap.

## What already works

Private projects store each file as `PrivateProjectDocument` and upload it to the client’s Drive folder when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` are set. Staff upload from the private project edit page. The client downloads from their portal at `/private/{slug}`. If Drive is not configured, files stay on local disk and are capped at 15MB. Drive uploads go direct from the browser so they are not cut off by the 4.5MB request limit.

## What is still missing

The UK portal at `/clients/{slug}` has no files section. Ops projects have no document table and no Drive folder on the client. Planner inbox and outbox cards also have no attachments, so a file shared with an athlete has to leave the board.

## Build

1. Add `OpsProjectDocument` with the same fields as the private document: name, mime type, size, Drive file id, visibility, and a portal download path.
2. Store a Drive folder id on `OpsClient`, created the first time someone uploads, using the same folder helper as private clients.
3. Staff upload and remove files from the ops project page. Clients see and download only files marked visible on `/clients/{slug}`.
4. On a planner card, allow attaching an existing project file or a new upload. The athlete inbox shows that file on the card. Do not create a second copy of the file.
5. Keep the private portal path as it is. UK and private stay separate folders so a private client file never appears on a UK portal.

## Out of scope

Email attachments, public links that work without the portal login, and a shared inbox that is not tied to a project.

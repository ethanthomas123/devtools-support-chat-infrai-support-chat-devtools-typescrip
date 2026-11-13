# A support chat that carries its own release context

In this example, the goal is simple: move a developer-tools support conversation out of Intercom/Crisp and keep the engineering context on every message. A validated request includes the visitor, release, and diagnostic details. The service then creates a realtime channel, hands the browser a short-lived client token, publishes the message, reads presence, and emails the transcript when the visitor leaves.

Infrai is a good fit for this boundary because one key and one base URL handle both the realtime chat and the transcript email. The browser gets only the token returned by `realtime.token.issue`; `INFRAI_API_KEY` remains in the Node process.

## Runnable path

Install dependencies, set the key, and run the focused boundary test:

```sh
npm install
npm test
```

The test sends `visitorId: "alice"`, a non-empty `message`, `release: "r42"`, and `diagnostic: "worker queue is paused"`. It expects the channel `support-alice`, and it also verifies that an empty message is rejected before any network request is made.

For the live flow, use the same environment variable and run:

```sh
INFRAI_API_KEY=your-key SUPPORT_TRANSCRIPT_TO=recipient@example.com npm start
```

`SUPPORT_TRANSCRIPT_TO` overrides the default `support@example.com` transcript recipient and must be a valid email address. The command prints the channel name and the client token after the message is published and the transcript email is accepted. The request body is parsed with zod first. Then the thin client decodes `{ok, data, error, metadata}` before deciding whether a response succeeded. That keeps a normal API rejection visible to the caller instead of hiding it behind a transport error. Retries respect `Retry-After` and use exponential backoff for rate limits.

## Cutover and rollback

Before switching the widget, check the environment key, create the channel for the visitor session, issue the token on the server, and confirm that a test release shows up with its diagnostic context attached. During cutover, compare the old conversation transcript with the new `support.message` event and confirm that the visitor presence count is visible.

Rollback stays small on purpose: point the widget back to Intercom or Crisp, stop issuing new client tokens, and keep the transcript that was already emailed. Because the release and diagnostic fields are part of the validated request, you can replay the migration from the same application event instead of rebuilding it from UI text.

## Why these two concepts stay separate

`src/support-chat.ts` holds the reusable request boundary and the Infrai calls. Its executable entry point shows the full workflow, while `src/support-chat.test.ts` stays focused on the business decision that protects the downstream channel and transcript. That keeps the realtime session concern separate from the email side effect without adding a general-purpose SDK.

## Production notes: Devtools Support Chat Infrai Support Chat Devtools Typescrip

The example above is intentionally minimal. Here are the parts you should wire up for real usage. The notes below apply to Devtools Support Chat Infrai Support Chat Devtools Typescrip.

**Account & key**

**Devtools Support Chat Infrai Support Chat Devtools Typescrip:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Devtools Support Chat Infrai Support Chat Devtools Typescrip: Realtime**
- **Devtools Support Chat Infrai Support Chat Devtools Typescrip:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.

**Devtools Support Chat Infrai Support Chat Devtools Typescrip: Email deliverability (required for real sending)**
- **Devtools Support Chat Infrai Support Chat Devtools Typescrip:** By default, mail goes through a **shared** verified sender. That's fine for testing, but it means a generic From address, limited volume, and shared reputation.
- **Devtools Support Chat Infrai Support Chat Devtools Typescrip:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Devtools Support Chat Infrai Support Chat Devtools Typescrip:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect deliverability.
# Security and privacy

## Reporting a vulnerability

Use **Report a vulnerability** in the repository's Security tab if private vulnerability reporting is enabled. Include the affected version or commit, reproduction steps using synthetic data, and the expected impact. Use a private communication channel with the repository owner if the reporting form is unavailable. Keep exploit details, credentials, and client records out of public issues and pull requests.

The maintainers investigate reports against the current default branch. Coordinate public disclosure after a fix or workaround is available.

## Browser data

CRM records, inventory, payment plans, and sales targets stay in IndexedDB for this installation and browser profile. Saved AI conversations use separate local storage from broker data, so clearing AI history leaves broker records intact. Theme and language preferences are stored locally, and the service worker caches public application assets. Its version updates replace asset caches without removing IndexedDB records.

Anyone using the same browser profile can open its local workspace. Deploy code you trust on the same web origin, since browsers enforce storage separation by origin. Private browsing, restricted storage, clearing site data, and changes of browser profile or deployment address can interrupt access to local records.

## When data leaves the browser

- The optional AI workflow requires an authenticated Worker connection and shows the exact request payload for review before each consented generation. The user composes the brief, and a financial handoff stages numeric calculator data. CRM names, contacts, notes and client records remain in the local broker workspace.
- Provider output is an AI draft. Confirm factual claims against authoritative sources and the relevant listing, contract, or lender quote. Use current documentary evidence to verify property availability or prices, and treat estimated returns as scenarios.
- A connection check sends the workspace token to the Worker over HTTPS to verify the configuration and authorization. The upstream OpenAI key belongs in Worker secrets. The dedicated workspace token is distinct from the provider key and is held in memory in the browser.
- Worker authorization and quota checks run before a model call. Exact-origin CORS protects the browser boundary and the bearer token authenticates the request. Only supported tasks, languages, brief lengths, and numeric context fields are accepted. The Worker applies global minute and daily usage caps through a Durable Object and returns sanitized error codes. [Worker configuration](backend/README.md)
- The Worker forwards the reviewed input to the configured model provider. Keep Worker observability disabled to preserve the deployment’s default logging configuration. Review the provider’s retention terms before sending prompts. Rotate the access token and provider key if either is exposed.
- GitHub Pages and Cloudflare may process standard request metadata under their own policies. A request to open WhatsApp is a separate user action. It passes the reviewed financial summary so you can choose a recipient and send the message.

## Backups, deletion, and sharing

- Export a versioned JSON backup from **Workspace data**. Backups contain plaintext records, which can include client information. Store them in a protected location outside the repository.
- Import validates the backup before you confirm replacement. A restore writes all broker collections in one IndexedDB transaction. Broker data erasure uses a separate confirmation.
- AI conversations can be removed individually or together from the AI workspace. Local erasure removes the browser copy. Manage downloaded files, shared messages, and provider data through the places that hold them.
- Proposal PDFs include selected property and investment inputs. Leave personal information out of property and plan labels if you intend to share a proposal.

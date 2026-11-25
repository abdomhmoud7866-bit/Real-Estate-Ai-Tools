# Security and privacy

## Reporting a vulnerability

Use **Report a vulnerability** in the repository's Security tab if private vulnerability reporting is enabled. Include the affected version or commit, reproduction steps using synthetic data, and the expected impact. Use a private communication channel with the repository owner if the reporting form is unavailable. Keep exploit details, credentials, and client records out of public issues and pull requests.

The maintainers investigate reports against the current default branch. Coordinate public disclosure after a fix or workaround is available.

## Browser data

The workspace stores CRM records, property inventory, payment plans, and sales targets in IndexedDB for this deployment and browser profile. Language and theme preferences are stored locally, and the service worker caches public application files for offline use. The app has no application backend, automatic sync, analytics, or AI credentials. GitHub Pages may process standard request metadata when serving public files under GitHub's privacy policy.

Anyone using the same browser profile can open its local workspace. Deploy code you trust on the same web origin, since browser storage is protected by origin. Use a trusted device and profile. Private browsing, restricted storage, clearing site data, or changing browser profiles or deployment addresses can interrupt access to local records.

## Backups, deletion, and sharing

- Export a versioned JSON backup from Workspace data. Keep the file private because it contains plaintext records, which can include client information. Store backups in a protected location outside the repository.
- Import accepts a validated backup after you confirm replacement. The workspace applies a restore as one IndexedDB transaction. Delete uses a separate confirmation to erase all broker records from the current workspace.
- Broker record deletion and browser site-data deletion apply to this local workspace. Remove any copies in downloaded backups, PDFs, and shared messages separately.
- Proposal PDFs include selected property and investment inputs. WhatsApp summaries contain selected financial figures. The proposal workflow excludes CRM records. Review the share preview, and leave personal information out of property and plan labels.
- Opening WhatsApp passes the reviewed summary to that service to prefill a message. You choose the recipient and send from WhatsApp.

Any future AI integration must hold provider credentials on the server and specify what information leaves the device before enabling requests.

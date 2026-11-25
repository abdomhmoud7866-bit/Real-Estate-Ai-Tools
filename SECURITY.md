# Security and privacy

## Reporting a vulnerability

Use **Report a vulnerability** in the repository's Security tab if private vulnerability reporting is enabled. Include the affected version or commit, reproduction steps using synthetic data, and the expected impact. Use a private communication channel with the repository owner if the reporting form is unavailable. Keep exploit details, credentials, and client records out of public issues and pull requests.

The maintainers investigate reports against the current default branch. Coordinate public disclosure after a fix or workaround is available.

## Browser data

The static workspace runs financial calculations in your browser. Calculator values are used in memory. Language and theme preferences are stored locally, and the service worker caches public application assets for offline use. The app has no application backend, telemetry, client records, or AI credentials. GitHub Pages may process standard request metadata when serving the application's public files under GitHub's privacy policy.

Clear site data in your browser to remove cached assets and saved workspace preferences. Files exported or printed by the browser are separate copies managed by the person who saved them.

Any future AI integration must keep provider credentials on the server and define which inputs leave the device before enabling requests. Client workflows must define storage, deletion, export, and data sharing before accepting personal information.

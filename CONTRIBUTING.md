> This is the mobile publishing edition. The development workflow below refers to the original full source archive, including its browser test suite and CI. For this edition run `npm test` to check the financial models.

# Contributing to THE SPIDER DXB

Financial fixes, Arabic translations, accessibility improvements, and verifiable UAE property workflows are welcome. Use a GitHub issue to coordinate larger changes to the product or financial models.

## Development

1. Fork the repository and create a branch from `main`.
2. With Node.js 22.12 or newer and Python 3 installed, run `npm ci` and `npm start`, then open [http://localhost:8000](http://localhost:8000).
3. Run `npm test` for the financial suite.
4. Install the test browser with `npx playwright install chromium`, then run `npm run test:e2e`.
5. Open a pull request that describes the behavior change and lists the checks you ran.

Keep browser assets and module imports relative so the app works at GitHub Pages repository paths. Keep launch commands, formula documentation, and translations in sync with behavior changes. Update the asset list and cache version in `sw.js` when changing precached files.

## Financial, accessibility, and privacy changes

- Document units, rounding, timing, and edge cases when changing a calculation. Include a worked example and a regression test for formula changes.
- Label fictional examples as illustrative. For verified data, include the publisher, coverage period, geography, and license or terms of use.
- Provide English and Arabic copy for new UI. Check keyboard interaction, focus visibility, narrow screens, and RTL layout.
- Use synthetic values in tests, issues, logs, and screenshots. Keep credentials, client details, and exports containing client information out of the repository.
- Report vulnerabilities privately using the [security policy](SECURITY.md).

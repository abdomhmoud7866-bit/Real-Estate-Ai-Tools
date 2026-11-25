# Development roadmap

## Milestone 1 · Financial workspace

Bring the existing rental yield and developer plan comparisons into THE SPIDER DXB. Add mortgage amortization, property comparison, resale scenarios, and cash flow projections. Keep calculations inspectable and testable, with static hosting on GitHub Pages.

Review this milestone against two criteria. A user can reproduce a result from the stated assumptions, and a contributor can verify the financial model and browser flows with automated tests.

## Milestone 2 · Scenario reuse and reporting

- Add a local property portfolio with explicit save, update, export, and delete actions.
- Extend investment reports with reusable scenario sets and detailed assumptions.
- Support irregular, contract-specific developer installments and validate schedule reconciliation.
- Evaluate public UAE property data sources for licensing, coverage, freshness, and source attribution before integration.

## Milestone 3 · Private client workflows

- Define the minimum information needed for client records and lead stages.
- Build local client and lead management with explicit export and deletion. Define how records are protected on shared devices.
- Keep personal information out of public URLs, telemetry, and financial report exports by default.

## Milestone 4 · Optional AI assistance

- Keep the calculators fully functional as a standalone static app.
- Offer property analysis and sales assistance only through an explicitly configured backend with server-side credentials and request limits.
- Ask the user to select what data is shared and distinguish model output from calculations and verified source data.
- Test authorization, secret handling, output reliability, and privacy before release.

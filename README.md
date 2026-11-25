# Real Estate AI Tools

An early-stage open-source project for practical real estate workflows, starting with UAE property investment and developer payment-plan analysis.

## Version 0.1 — working features

- Gross and net rental yield calculator
- Annual and monthly net rental income estimates
- Acquisition costs and vacancy adjustments
- Side-by-side developer payment plan comparison
- Booking, construction, handover and post-handover breakdowns
- Validation of payment percentages and inputs
- Responsive, dependency-free web interface

## Getting started

Open `index.html` in a modern web browser. No installation, API key or server is required. You can also publish it using GitHub Pages: Settings → Pages → Deploy from a branch → main / (root).

## Calculation assumptions

- Gross yield = annual rent / purchase price × 100.
- Net yield = (annual rent after vacancy − annual expenses) / (price + acquisition costs) × 100.
- Payment plan percentages must total 100%. Monthly amounts assume equal payments during each phase.
- All inputs are in AED unless otherwise stated. Default values are illustrative, not live market data. Financing, taxes and capital appreciation are not modeled.

## Roadmap

Future work may include Arabic localization, property comparison, public market data integration, AI-assisted analysis and lead management. These features are not yet implemented. Version 0.1 uses deterministic calculations and does not call an AI model.

## Privacy and contributions

Calculations run in the browser. This version does not send input data to a server or save it. Please do not include private client data in public issues. Suggestions and code contributions are welcome through GitHub issues and pull requests.

## License

See LICENSE (MIT). Educational planning tool; verify actual costs and contractual terms independently.

# THE SPIDER DXB

THE SPIDER DXB is an open-source real estate planning workspace for UAE brokers, investors and property consultants. Model an acquisition in AED, compare rental and payment assumptions, and see how financing and resale change the outcome.

## What you can do

| Tool | What it calculates |
| --- | --- |
| Investment and rental yield | Effective rent, annual and monthly net income, total acquisition cost, and gross and net yields |
| Mortgage and financing | Fixed-rate monthly payments, borrowing costs, and an amortization schedule |
| Developer payment plans | Side-by-side booking, construction, handover, and post-handover commitments with monthly installment schedules |
| Property comparison | Rental income, yields, and acquisition cost for two properties using the same underwriting model |
| Resale and appreciation | Projected sale price, selling costs, net sale proceeds, and holding-period return |
| Cash flow | Annual operating cash flow after debt service, cash-on-cash return, and an interactive projection chart |

The initial values are illustrative. The dashboard skyline is a generated illustration. Replace them with documented property, fee, and financing assumptions before sharing an analysis. The workspace has no verified market feed or AI integration.

Switch between English and Arabic, including a right-to-left layout, or choose a light or dark theme. Use the active tool's print option and choose **Save as PDF** in your browser's print dialog to keep a branded copy of the analysis. On HTTPS or localhost, a service worker caches the workspace for offline use after the first successful load and cache installation.

## Run locally

With Python 3 installed, serve the application from the repository root. The Node.js and npm dependencies are for development checks.

```sh
python3 -m http.server --bind 127.0.0.1 8000
```

The calculators use browser JavaScript modules, so open the workspace through the local HTTP server. If you have npm installed, `npm start` runs the same server. [Open the local workspace](http://localhost:8000)

## GitHub Pages

In the repository's Pages settings, select **Deploy from a branch**, then select your publishing branch and **/ (root)**. The app uses relative URLs so it can run under the repository path. GitHub Pages serves the application directly from the repository without a build step or environment secrets.

## Calculation assumptions

- **Rental yield.** Gross yield divides scheduled annual rent by the purchase price. Net yield divides effective annual rent after vacancy, less annual operating expenses, by the purchase price plus one-time acquisition costs. Monthly net income is the annual figure divided by 12.
- **Mortgage.** Principal is purchase price less down payment. The fixed annual nominal rate is divided by 12 for a fully amortizing loan with end-of-month payments. At 0% interest, principal is divided evenly by the loan term in months. The model excludes lender fees, early repayments, and eligibility checks.
- **Developer plans.** The four phase percentages must total 100%. Construction and post-handover balances are spread across the months entered. Booking falls in month zero, handover is due in the final construction month, and the post-handover schedule begins the following month. Payments reconcile to the purchase price to the nearest fil.
- **Resale.** The purchase price compounds at the annual appreciation assumption over the holding period. Selling costs reduce the projected sale price. Unlevered profit is net sale proceeds plus the same annual net rental income for each year held, less total acquisition cost. The holding-period return divides profit by acquisition cost.
- **Cash flow.** Rent and operating expenses start at the entered amounts and grow from year two. NOI is vacancy-adjusted rent less operating expenses. Annual cash flow subtracts scheduled mortgage payments from NOI. Upfront cash is down payment plus acquisition fees. Cumulative cash flow starts at negative upfront cash, and cash-on-cash return divides annual cash flow by upfront cash when that amount is positive.

Calculators use user-entered assumptions about fees, rents, rates, and timing. Confirm actual amounts against the sales contract, lender quote, and applicable rules. Figures support scenario planning and may differ from a valuation, tax assessment, or lender illustration.

For example, an illustrative AED 1,000,000 purchase with AED 80,000 annual rent, 5% vacancy, AED 12,000 annual expenses, and 4% acquisition fees has AED 64,000 annual net income. Gross yield is 8.00%, and net yield is AED 64,000 divided by AED 1,040,000, or 6.15%.

## Privacy

Calculations run in the browser. The app has no sign-in or analytics and sends no calculator values to an external service. See the [security policy](SECURITY.md) for storage details and private vulnerability reporting.

## Tests and mobile publishing layout

This mobile-upload edition preserves the application and financial models while placing runtime files at the repository root. To run the included financial unit tests with Node.js 22.12 or newer:

```sh
npm test
```

The original development archive contains the full Playwright browser test suite, dependency lockfile and GitHub Actions workflow, which are not included in this simplified publishing edition. Use that original layout for full development and continuous integration. The application entry point is `index.html`, financial models are in `finance.js`, and the offline cache is in `sw.js`.

See the [contribution guide](CONTRIBUTING.md), [changelog](CHANGELOG.md), and [development roadmap](ROADMAP.md). The project is released under the [MIT license](LICENSE).

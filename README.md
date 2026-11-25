# THE SPIDER DXB

THE SPIDER DXB 0.3.0 is an open-source real estate workspace for UAE brokers, investors and property consultants. Track leads and inventory, build developer payment schedules, and turn property and financing assumptions into a branded proposal. All currency amounts are in AED.

## Broker workspace

| Screen | What you can do |
| --- | --- |
| Clients | Track budgets, preferences, notes, follow-up dates, and lead stages from new to won or lost. Record closing dates and commission for completed deals. |
| Inventory | Maintain developer, project, location, unit type, area in square feet, asking price, availability, and handover date. |
| Custom payment plans | Add dated installments for off-plan milestones, handover, and post-handover payments. Save a plan after its installments reconcile to the purchase price. |
| Proposals | Select an inventory property, choose a saved plan when applicable, and combine the schedule with rent, expenses, acquisition costs, and a financing scenario. Print a branded report or review a financial summary before opening WhatsApp. |
| Commission | Estimate the gross commission, referral and co-broker shares, agent commission, and the brokerage's retained amount. |
| Sales performance | Compare won deals and gross commission with saved monthly targets. Review new leads, open pipeline, and closed-deal conversion. |
| Workspace data | Export an IndexedDB backup, import a validated backup, and delete all broker records from this browser. |

Switch between English and Arabic with right-to-left layout, or choose light or dark mode. Select **Print report** and choose **Save as PDF** in the browser's print options. On HTTPS or localhost, the service worker caches public application files for offline use after the first successful load.

## Financial tools

| Tool | What it calculates |
| --- | --- |
| Investment and rental yield | Effective rent, annual and monthly net income, total acquisition cost, and gross and net yields |
| Mortgage and financing | Fixed-rate monthly payments, borrowing costs, and an amortization schedule |
| Developer payment plans | Side-by-side booking, construction, handover, and post-handover commitments with monthly installment schedules |
| Property comparison | Rental income, yields, and acquisition cost for two properties using the same underwriting model |
| Resale and appreciation | Projected sale price, selling costs, net sale proceeds, and holding-period return |
| Cash flow | Annual operating cash flow after debt service, cash-on-cash return, and an interactive projection chart |

The initial financial values are illustrative. The dashboard skyline is a generated illustration. Use documented property, fee, and financing assumptions before sharing an analysis. The workspace has no verified market feed or AI integration.

## Run locally

With Python 3 installed, serve the application from the repository root. The Node.js and npm dependencies are for development checks.

```sh
python3 -m http.server --bind 127.0.0.1 8000
```

The calculators use browser JavaScript modules, so open the workspace through the local HTTP server. If you have npm installed, `npm start` runs the same server. [Open the local workspace](http://localhost:8000)

## Deployment packages

| ZIP | Contents |
| --- | --- |
| `THE-SPIDER-DXB-0.3.0-deployment.zip` | Flat, ready-to-upload GitHub Pages files with `index.html` at the root. |
| `THE-SPIDER-DXB-0.3.0-source.zip` | Complete editable project, unit and browser tests, documentation, dependency lockfile, and GitHub Actions CI. |
| `THE-SPIDER-DXB-0.3.0-test-suite.zip` | Separate copy of the tests and runner configuration. Extract it into the source tree to run the tests against the workspace. |

See [Deployment](DEPLOYMENT.md) for iPhone upload instructions. GitHub Pages serves the application from the repository root with no build step or runtime secrets.

## Calculation assumptions

- **Rental yield.** Gross yield divides scheduled annual rent by the purchase price. Net yield divides effective annual rent after vacancy, less annual operating expenses, by the purchase price plus one-time acquisition costs. Monthly net income is the annual figure divided by 12.
- **Mortgage.** Principal is purchase price less down payment. The fixed annual nominal rate is divided by 12 for a fully amortizing loan with end-of-month payments. At 0% interest, principal is divided evenly by the loan term in months. The model excludes lender fees, early repayments, and eligibility checks.
- **Developer plans.** The four phase percentages must total 100%. Construction and post-handover balances are spread across the months entered. Booking falls in month zero, handover is due in the final construction month, and the post-handover schedule begins the following month. Payments reconcile to the purchase price to the nearest fil.
- **Custom payment plans.** Each installment has its own amount, due date, and phase. Amounts use whole fils, and they must add up to the property price. The schedule sorts by due date. Enter dates and amounts from the actual developer terms.
- **Investment proposals.** Rental yields follow the same formula as the investment calculator. Financing uses the fixed-rate mortgage model. In a financed scenario, annual cash flow is annual net rental income less 12 monthly payments. Upfront cash is the down payment plus acquisition costs. Cash-on-cash return divides annual cash flow by upfront cash when that amount is positive. The developer schedule and financing scenario describe separate cash commitments.
- **Resale.** The purchase price compounds at the annual appreciation assumption over the holding period. Selling costs reduce the projected sale price. Unlevered profit is net sale proceeds plus the same annual net rental income for each year held, less total acquisition cost. The holding-period return divides profit by acquisition cost.
- **Cash flow.** Rent and operating expenses start at the entered amounts and grow from year two. NOI is vacancy-adjusted rent less operating expenses. Annual cash flow subtracts scheduled mortgage payments from NOI. Upfront cash is down payment plus acquisition fees. Cumulative cash flow starts at negative upfront cash, and cash-on-cash return divides annual cash flow by upfront cash when that amount is positive.
- **Commission.** Gross commission equals price multiplied by the negotiated rate. Referral and co-broker shares are percentages of the gross amount. The agent earns a percentage of the brokerage pool after those shares, and the brokerage retains the balance. Splits reconcile to the nearest fil.
- **Sales performance.** The dashboard groups new leads by UAE calendar month of creation and closed deals by their entered closing date. Closed conversion is won deals divided by won plus lost deals, and is unavailable when there are no closures. Monthly targets measure won deals and the gross brokerage commission entered on won deals. The open pipeline reflects the current CRM across all periods.

Calculators use user-entered assumptions about fees, rents, rates, and timing. Confirm actual amounts against the sales contract, lender quote, and applicable rules. Figures support scenario planning and may differ from a valuation, tax assessment, or lender illustration.

For example, an illustrative AED 1,000,000 purchase with AED 80,000 annual rent, 5% vacancy, AED 12,000 annual expenses, and 4% acquisition fees has AED 64,000 annual net income. Gross yield is 8.00%, and net yield is AED 64,000 divided by AED 1,040,000, or 6.15%.

At a negotiated 2% commission on an illustrative AED 1,000,000 sale, gross commission is AED 20,000. A 10% referral share and a 20% co-broker share leave AED 14,000 in the brokerage pool. A 50% agent share assigns AED 7,000 to the agent and leaves AED 7,000 with the brokerage.

## Privacy

Calculations and broker records stay in the browser. The workspace has no sign-in, analytics, or automatic sync. Data is scoped to the deployment address and your browser profile. Export a backup before changing devices, changing the site address, or clearing site data. A backup can contain private CRM information. Keep it off GitHub and review its contents before sharing the file.

WhatsApp sharing is optional and excludes CRM records. Review the investment figures before opening WhatsApp. You choose the recipient and send from WhatsApp. To share the full proposal, save the PDF and attach it yourself. See the [security policy](SECURITY.md) for storage details and private vulnerability reporting.

## Tests and source layout

From the complete source package, install Node.js 22.12 or newer and Python 3, then run the development checks.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
```

`index.html` is the application entry point. Runtime modules, styles, images, and the service worker are at the repository root to match the production paths. Financial and broker unit tests are in `finance.test.js` and `test/`. Playwright specs are in `e2e/`, and CI is in `.github/workflows/`.

See the [contribution guide](CONTRIBUTING.md), [changelog](CHANGELOG.md), and [development roadmap](ROADMAP.md). The project is released under the [MIT license](LICENSE).

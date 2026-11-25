import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cashFlow, investment, mortgage, paymentPlan, resale } from './finance.js';

const rental = { price: 1_000_000, rent: 80_000, expenses: 12_000, fees: 4, vacancy: 5 };
const plan = { price: 1_000_000, booking: 10, construction: 30, handover: 60, post: 0, months: 36, postMonths: 36 };
const loan = { price: 1_000_000, downPayment: 250_000, rate: 5, years: 25 };
const exit = { price: 1_000_000, fees: 4, appreciation: 5, years: 5, sellingCosts: 2, annualNet: 50_000 };
const projection = {
  price: 200_000, rent: 100_000, expenses: 10_000, fees: 4, vacancy: 10,
  downPayment: 80_000, rate: 0, loanYears: 1, years: 2, rentGrowth: 10, expenseGrowth: 5,
};

function closeTo(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} within ${tolerance} of ${expected}`);
}

test('investment separates gross rent, operating income and acquisition costs', () => {
  const result = investment(rental);
  assert.equal(result.total, 1_040_000);
  assert.equal(result.effectiveRent, 76_000);
  assert.equal(result.net, 64_000);
  assert.equal(result.grossYield, 8);
  closeTo(result.netYield, 6.153846153846154);
  closeTo(result.monthlyNet, 5333.333333333333);
});

test('investment preserves negative operating returns at full vacancy', () => {
  const result = investment({ ...rental, vacancy: 100 });
  assert.equal(result.effectiveRent, 0);
  assert.equal(result.net, -12_000);
  assert.ok(result.netYield < 0);
});

test('investment rejects missing, string, nonfinite and out-of-range inputs', () => {
  for (const fields of [{ price: 0 }, { rent: '80000' }, { fees: Infinity }, { vacancy: NaN }, { expenses: undefined }]) {
    assert.throws(() => investment({ ...rental, ...fields }), RangeError);
  }
});

test('developer plan preserves phase totals, average installments and handover timing', () => {
  const result = paymentPlan(plan);
  assert.equal(result.booking, 100_000);
  assert.equal(result.construction, 300_000);
  assert.equal(result.handover, 600_000);
  assert.equal(result.post, 0);
  assert.equal(result.before, 400_000);
  assert.equal(result.through, 1_000_000);
  closeTo(result.monthly, 8333.333333333333);
  assert.deepEqual(result.schedule[0], { month: 0, phase: 'booking', amount: 100_000, cumulative: 100_000 });
  assert.deepEqual(result.schedule.at(-2), { month: 36, phase: 'construction', amount: 8333.33, cumulative: 400_000 });
  assert.deepEqual(result.schedule.at(-1), { month: 36, phase: 'handover', amount: 600_000, cumulative: 1_000_000 });
});

test('developer installment schedule reconciles independently rounded amounts to the fil', () => {
  const price = 12_345.67;
  const result = paymentPlan({
    price, booking: 3.43, construction: 33.33, handover: 30.11, post: 33.13, months: 7, postMonths: 3,
  });
  assert.equal(result.schedule.at(-1).cumulative, price);
  assert.equal(result.schedule.at(-3).month, 8);
  assert.equal(result.schedule.at(-1).month, 10);
  const sumFils = result.schedule.reduce((total, row) => total + Math.round(row.amount * 100), 0);
  assert.equal(sumFils, 1_234_567);
  const postAmounts = result.schedule.filter(row => row.phase === 'post').map(row => row.amount);
  assert.deepEqual(postAmounts, [1363.38, 1363.37, 1363.37]);
});

test('developer plan handles half-fil rounding and very small individual installments', () => {
  const result = paymentPlan({ ...plan, price: 1.005, booking: 0, construction: 100, handover: 0, months: 240 });
  assert.equal(result.through, 1.01);
  assert.equal(result.schedule.length, 101);
  assert.equal(result.schedule.at(-1).cumulative, 1.01);
});

test('developer plan rejects invalid share totals, phase percentages and month counts', () => {
  assert.throws(() => paymentPlan({ ...plan, post: 1 }), { code: 'planTotal' });
  assert.throws(() => paymentPlan({ ...plan, handover: 101 }), { field: 'handover' });
  assert.throws(() => paymentPlan({ ...plan, months: 3.5 }), { field: 'months' });
  assert.throws(() => paymentPlan({ ...plan, postMonths: 241 }), { field: 'postMonths' });
});

test('fixed mortgage matches a standard amortization example', () => {
  const result = mortgage({ price: 100_000, downPayment: 0, rate: 6, years: 30 });
  closeTo(result.monthlyPayment, 599.5505251527524);
  closeTo(result.totalInterest, 115838.18905499086);
  closeTo(result.totalPaid, result.monthlyPayment * 360);
  assert.equal(result.loanToValue, 100);
  assert.equal(result.schedule.length, 360);
  assert.equal(result.schedule[0].interest, 500);
  assert.equal(result.schedule.at(-1).balance, 0);
  closeTo(result.schedule.reduce((total, row) => total + row.principal, 0), 100_000);
});

test('mortgage supports zero interest and all-cash purchases', () => {
  const result = mortgage({ price: 250_000, downPayment: 50_000, rate: 0, years: 10 });
  closeTo(result.monthlyPayment, 1666.6666666666667);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalPaid, 200_000);
  assert.equal(result.loanToValue, 80);
  assert.equal(result.schedule.at(-1).balance, 0);
  const cash = mortgage({ ...loan, downPayment: loan.price });
  assert.equal(cash.monthlyPayment, 0);
  assert.equal(cash.loanToValue, 0);
  assert.deepEqual(cash.schedule, []);
});

test('mortgage amortizes reliably near zero interest and at maximum allowed rate and term', () => {
  const nearZero = mortgage({ ...loan, rate: 1e-12 });
  closeTo(nearZero.monthlyPayment, nearZero.principal / (loan.years * 12));
  assert.ok(nearZero.totalInterest > 0);
  const long = mortgage({ price: 1e12, downPayment: 0, years: 50, rate: 100 });
  assert.ok(long.schedule.every(row => row.principal > 0 && row.balance >= 0));
  assert.equal(long.schedule.at(-1).balance, 0);
  closeTo(long.schedule.reduce((total, row) => total + row.principal, 0), 1e12, 0.01);
  closeTo(long.monthlyPayment * long.schedule.length, long.totalPaid, 1);
});

test('mortgage rejects financing above price and invalid rates and terms', () => {
  assert.throws(() => mortgage({ ...loan, downPayment: loan.price + 1 }), { field: 'downPayment' });
  assert.throws(() => mortgage({ ...loan, rate: -1 }), { field: 'rate' });
  assert.throws(() => mortgage({ ...loan, years: 51 }), { field: 'years' });
});

test('resale deducts acquisition and sale costs and includes net rental income', () => {
  const result = resale(exit);
  closeTo(result.salePrice, 1276281.5625);
  closeTo(result.sellingFees, 25525.63125);
  closeTo(result.netSale, 1250755.93125);
  assert.equal(result.initialCost, 1_040_000);
  assert.equal(result.totalRentalIncome, 250_000);
  closeTo(result.profit, 460755.93125);
  closeTo(result.roi, 44.30345492788461);
});

test('resale models price declines, zero terminal value and negative rental net', () => {
  const declined = resale({ ...exit, annualNet: 0, appreciation: -10, years: 2 });
  assert.equal(declined.salePrice, 810_000);
  assert.ok(declined.roi < 0);
  const zero = resale({ ...exit, appreciation: -100, years: 1, annualNet: -10_000 });
  assert.equal(zero.salePrice, 0);
  assert.equal(zero.profit, -1_050_000);
});

test('resale rejects appreciation below negative 100 percent', () => {
  assert.throws(() => resale({ ...exit, appreciation: -100.01 }), { field: 'appreciation' });
});

test('cash flow grows year-two operations, accounts for purchase costs and ends loan payments at term', () => {
  const result = cashFlow(projection);
  assert.equal(result.initialCash, 88_000);
  assert.equal(result.annualCashFlow, -40_000);
  closeTo(result.cashOnCash, -45.45454545454545);
  closeTo(result.cumulativeCashFlow, -39_500);
  assert.deepEqual(result.rows[0], {
    year: 1, effectiveRent: 90_000, expenses: 10_000, netOperatingIncome: 80_000,
    debtService: 120_000, cashFlow: -40_000, cumulativeCashFlow: -128_000,
  });
  assert.equal(result.rows[1].debtService, 0);
  assert.equal(result.rows[1].expenses, 10_500);
  closeTo(result.rows[1].cashFlow, 88_500);
});

test('cash flow distinguishes undefinable cash-on-cash returns from cash purchases', () => {
  assert.equal(cashFlow({ ...projection, fees: 0, downPayment: 0 }).cashOnCash, null);
  assert.equal(cashFlow({ ...projection, fees: 0, downPayment: Number.MIN_VALUE }).cashOnCash, null);
  const cash = cashFlow({ ...projection, fees: 0, downPayment: projection.price });
  assert.equal(cash.rows[0].debtService, 0);
  assert.equal(cash.cashOnCash, 40);
});

test('cash flow retains finite results at maximum positive growth and reports an invalid projection range', () => {
  const extreme = cashFlow({ ...projection, rent: 1e12, years: 50, rentGrowth: 100, expenseGrowth: -100 });
  assert.ok(Number.isFinite(extreme.cumulativeCashFlow));
  assert.equal(extreme.rows.at(-1).expenses, 0);
  assert.throws(() => cashFlow({ ...projection, years: 0 }), { field: 'years' });
});

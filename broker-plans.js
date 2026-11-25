import { investment, mortgage } from './finance.js';

export const planPhases = Object.freeze(['booking', 'construction', 'handover', 'post']);
export const planMaxRows = 240;
const maximumAmount = 1_000_000_000_000;

function planError(code, row) {
  const error = new RangeError(code);
  error.code = code;
  if (row !== undefined) error.row = row;
  return error;
}

function cleanText(value, limit, code, row) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) throw planError(code, row);
  return value.trim();
}

function fils(value, minimum, code, row) {
  if (!Number.isFinite(value) || value < minimum || value > maximumAmount) throw planError(code, row);
  const rounded = Math.round(value * 100);
  if (rounded / 100 !== value) throw planError(code, row);
  return BigInt(rounded);
}

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01') return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function measurePlan(price, amounts) {
  const target = fils(price, 1, 'planPrice');
  const assigned = amounts.reduce((total, value, index) => total + fils(value, 0, 'installmentAmount', index + 1), 0n);
  return { assigned: Number(assigned) / 100, remaining: Number(target - assigned) / 100 };
}

export function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') throw planError('planName');
  const name = cleanText(plan.name, 120, 'planName');
  const price = plan.price;
  const total = fils(price, 1, 'planPrice');
  if (!Array.isArray(plan.installments) || plan.installments.length < 1 || plan.installments.length > planMaxRows) {
    throw planError('planRows');
  }

  let assigned = 0n;
  const installments = plan.installments.map((entry, index) => {
    const row = index + 1;
    if (!entry || typeof entry !== 'object') throw planError('installmentLabel', row);
    const label = cleanText(entry.label, 100, 'installmentLabel', row);
    if (!validDate(entry.date)) throw planError('installmentDate', row);
    if (!planPhases.includes(entry.phase)) throw planError('installmentPhase', row);
    assigned += fils(entry.amount, 0.01, 'installmentAmount', row);
    return { label, date: entry.date, phase: entry.phase, amount: entry.amount };
  });
  if (assigned !== total) throw planError('planBalance');
  installments.sort((a, b) => a.date.localeCompare(b.date));
  return { name, price, installments };
}

function scheduleRows(valid) {
  let cumulative = 0;
  return valid.installments.map((entry) => {
    cumulative += Math.round(entry.amount * 100);
    return { ...entry, share: entry.amount / valid.price * 100, cumulative: cumulative / 100 };
  });
}

export function installmentSchedule(plan) {
  return scheduleRows(normalizePlan(plan));
}

export function analyzeProposal({ price, rent, expenses, fees, vacancy, plan, loan }) {
  const rental = investment({ price, rent, expenses, fees, vacancy });
  const rentalCosts = price * (fees / 100);
  let schedule = null;
  if (plan) {
    const valid = normalizePlan(plan);
    if (valid.price !== price) throw planError('planMismatch');
    schedule = scheduleRows(valid);
  }

  let financing = null;
  if (loan) {
    const result = mortgage({ ...loan, price });
    const initialCash = loan.downPayment + rentalCosts;
    const annualCashFlow = rental.net - result.monthlyPayment * 12;
    const cashOnCash = annualCashFlow / initialCash * 100;
    financing = {
      principal: result.principal, loanToValue: result.loanToValue, monthlyPayment: result.monthlyPayment,
      totalInterest: result.totalInterest, totalPaid: result.totalPaid, initialCash, annualCashFlow,
      cashOnCash: Number.isFinite(cashOnCash) ? cashOnCash : null,
    };
  }
  return { rental, rentalCosts, schedule, financing };
}

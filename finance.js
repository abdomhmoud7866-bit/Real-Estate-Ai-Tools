const MAX_AMOUNT = 1_000_000_000_000;
const MAX_YEARS = 50;
const MAX_PLAN_MONTHS = 240;
const PLAN_TOLERANCE = 0.000001;
const FILS_PER_AED = 100;

function roundToFils(amount) {
  const [mantissa, exponent = '0'] = amount.toString().split('e');
  return Math.round(Number(`${mantissa}e${Number(exponent) + 2}`));
}

function validateNumber(field, value, minimum, maximum, whole = false) {
  if (!Number.isFinite(value) || value < minimum || value > maximum || (whole && !Number.isInteger(value))) {
    const kind = whole ? 'a whole number' : 'a number';
    const error = new RangeError(`Enter ${kind} between ${minimum} and ${maximum} for ${field}.`);
    error.field = field;
    error.code = 'range';
    throw error;
  }
}

export function investment({ price, rent, expenses, fees, vacancy }) {
  validateNumber('price', price, 1, MAX_AMOUNT);
  validateNumber('rent', rent, 0, MAX_AMOUNT);
  validateNumber('expenses', expenses, 0, MAX_AMOUNT);
  validateNumber('fees', fees, 0, 100);
  validateNumber('vacancy', vacancy, 0, 100);

  const total = price * (1 + fees / 100);
  const effectiveRent = rent * (1 - vacancy / 100);
  const net = effectiveRent - expenses;
  return {
    total,
    effectiveRent,
    net,
    grossYield: rent / price * 100,
    netYield: net / total * 100,
    monthlyNet: net / 12,
  };
}

export function paymentPlan({ price, booking, construction, handover, post, months, postMonths }) {
  validateNumber('price', price, 1, MAX_AMOUNT);
  validateNumber('months', months, 1, MAX_PLAN_MONTHS, true);
  validateNumber('postMonths', postMonths, 1, MAX_PLAN_MONTHS, true);

  const phases = { booking, construction, handover, post };
  for (const [phase, percentage] of Object.entries(phases)) {
    validateNumber(phase, percentage, 0, 100);
  }
  const totalPercentage = booking + construction + handover + post;
  if (Math.abs(totalPercentage - 100) > PLAN_TOLERANCE) {
    const error = new RangeError('Each payment plan must total exactly 100%.');
    error.code = 'planTotal';
    throw error;
  }

  // Allocate by rounded cumulative share so the phase amounts add to the property price to the fil.
  const priceFils = roundToFils(price);
  const beforeFils = Math.round(priceFils * (booking + construction) / totalPercentage);
  const throughFils = Math.round(priceFils * (booking + construction + handover) / totalPercentage);
  const bookingFils = Math.round(priceFils * booking / totalPercentage);
  const constructionFils = beforeFils - bookingFils;
  const handoverFils = throughFils - beforeFils;
  const postFils = priceFils - throughFils;

  const schedule = [];
  let cumulative = 0;
  function addInstallments(phase, totalFils, firstMonth, count) {
    const installmentFils = Math.floor(totalFils / count);
    const extraFils = totalFils % count;
    for (let index = 0; index < count; index++) {
      const amount = installmentFils + Number(index < extraFils);
      if (amount > 0) {
        cumulative += amount;
        schedule.push({
          month: firstMonth + index,
          phase,
          amount: amount / FILS_PER_AED,
          cumulative: cumulative / FILS_PER_AED,
        });
      }
    }
  }
  addInstallments('booking', bookingFils, 0, 1);
  addInstallments('construction', constructionFils, 1, months);
  addInstallments('handover', handoverFils, months, 1);
  addInstallments('post', postFils, months + 1, postMonths);

  return {
    booking: bookingFils / FILS_PER_AED,
    construction: constructionFils / FILS_PER_AED,
    handover: handoverFils / FILS_PER_AED,
    post: postFils / FILS_PER_AED,
    before: beforeFils / FILS_PER_AED,
    through: throughFils / FILS_PER_AED,
    monthly: constructionFils / FILS_PER_AED / months,
    postMonthly: postFils / FILS_PER_AED / postMonths,
    schedule,
  };
}

export function mortgage({ price, downPayment, rate, years }) {
  validateNumber('price', price, 1, MAX_AMOUNT);
  validateNumber('downPayment', downPayment, 0, price);
  validateNumber('rate', rate, 0, 100);
  validateNumber('years', years, 1, MAX_YEARS, true);

  const principal = price - downPayment;
  const months = years * 12;
  const monthlyRate = rate / 1200;
  // log1p and expm1 retain precision when the nominal interest rate is close to zero.
  const logGrowth = Math.log1p(monthlyRate);
  const discountFactor = remainingMonths => -Math.expm1(-remainingMonths * logGrowth);
  const fullDiscount = discountFactor(months);
  const monthlyPayment = monthlyRate === 0
    ? principal / months
    : principal * (monthlyRate / fullDiscount);

  const schedule = [];
  let balance = principal;
  let totalInterest = 0;
  const paymentCount = principal > 0 ? months : 0;
  for (let month = 1; month <= paymentCount; month++) {
    const remaining = months - month;
    const interest = balance * monthlyRate;
    // The present value of the remaining payments avoids accumulated balance errors at high rates.
    const principalPaid = monthlyPayment * Math.exp(-(remaining + 1) * logGrowth);
    balance = monthlyRate === 0
      ? principal * (remaining / months)
      : principal * (discountFactor(remaining) / fullDiscount);
    totalInterest += interest;
    schedule.push({ month, payment: monthlyPayment, principal: principalPaid, interest, balance });
  }

  return {
    principal,
    monthlyPayment,
    totalInterest,
    totalPaid: principal + totalInterest,
    loanToValue: principal / price * 100,
    schedule,
  };
}

export function resale({ price, fees, appreciation, years, sellingCosts, annualNet = 0 }) {
  validateNumber('price', price, 1, MAX_AMOUNT);
  validateNumber('fees', fees, 0, 100);
  validateNumber('appreciation', appreciation, -100, 100);
  validateNumber('years', years, 1, MAX_YEARS, true);
  validateNumber('sellingCosts', sellingCosts, 0, 100);
  validateNumber('annualNet', annualNet, -MAX_AMOUNT, MAX_AMOUNT);

  const salePrice = price * (1 + appreciation / 100) ** years;
  const sellingFees = salePrice * sellingCosts / 100;
  const netSale = salePrice - sellingFees;
  const initialCost = price * (1 + fees / 100);
  const totalRentalIncome = annualNet * years;
  const profit = netSale - initialCost + totalRentalIncome;
  return { salePrice, sellingFees, netSale, initialCost, totalRentalIncome, profit, roi: profit / initialCost * 100 };
}

export function cashFlow({ price, rent, expenses, fees, vacancy, downPayment, rate, loanYears, years, rentGrowth, expenseGrowth }) {
  const base = investment({ price, rent, expenses, fees, vacancy });
  const loan = mortgage({ price, downPayment, rate, years: loanYears });
  validateNumber('years', years, 1, MAX_YEARS, true);
  validateNumber('rentGrowth', rentGrowth, -100, 100);
  validateNumber('expenseGrowth', expenseGrowth, -100, 100);

  const initialCash = downPayment + price * fees / 100;
  let cumulativeCashFlow = -initialCash;
  const rows = [];
  for (let year = 1; year <= years; year++) {
    const effectiveRent = base.effectiveRent * (1 + rentGrowth / 100) ** (year - 1);
    const annualExpenses = expenses * (1 + expenseGrowth / 100) ** (year - 1);
    const netOperatingIncome = effectiveRent - annualExpenses;
    const payments = loan.schedule.slice((year - 1) * 12, year * 12);
    const debtService = payments.reduce((total, payment) => total + payment.payment, 0);
    const annualCashFlow = netOperatingIncome - debtService;
    cumulativeCashFlow += annualCashFlow;
    rows.push({
      year,
      effectiveRent,
      expenses: annualExpenses,
      netOperatingIncome,
      debtService,
      cashFlow: annualCashFlow,
      cumulativeCashFlow,
    });
  }

  const annualCashFlow = rows[0].cashFlow;
  const cashOnCash = annualCashFlow / initialCash * 100;
  return {
    initialCash,
    annualCashFlow,
    cashOnCash: Number.isFinite(cashOnCash) ? cashOnCash : null,
    cumulativeCashFlow,
    rows,
  };
}

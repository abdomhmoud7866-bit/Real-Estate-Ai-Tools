import { investment, mortgage } from './finance.js';

const preferenceWeights = { location: 35, unitType: 35, keywords: 30 };
const MAX_MONEY = 1e12;
const MAX_SIZE = 1e8;

function normalized(value) {
  return String(value ?? '').normalize('NFKD').toLowerCase()
    .replace(/\p{M}|ـ/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/[٠-٩۰-۹]/gu, digit => String(digit.charCodeAt(0) & 15))
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function keywordTokens(value) {
  return [...new Set(normalized(value).split(' ').filter(term => term.length >= 2 || /^\d$/u.test(term)))].slice(0, 24);
}

function optionalNumber(value, max, field) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > max) throw new RangeError(field);
  return value;
}

export function rankInventory(properties, criteria = {}) {
  const budgetMin = optionalNumber(criteria.budgetMin, MAX_MONEY, 'budgetMin');
  const budgetMax = optionalNumber(criteria.budgetMax, MAX_MONEY, 'budgetMax');
  const minimumSize = optionalNumber(criteria.minimumSize, MAX_SIZE, 'minimumSize');
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) throw new RangeError('budgetRange');

  const location = normalized(criteria.location);
  const unitType = normalized(criteria.unitType);
  const terms = keywordTokens(criteria.keywords);
  const applicable = { location: !!location, unitType: !!unitType, keywords: terms.length > 0 };
  const weight = Object.entries(preferenceWeights).reduce((sum, [key, value]) => sum + (applicable[key] ? value : 0), 0);

  const rows = [];
  for (const property of properties) {
    if (property.availability !== 'available' && !(criteria.includeReserved && property.availability === 'reserved')) continue;
    if (budgetMin !== null && property.price < budgetMin) continue;
    if (budgetMax !== null && property.price > budgetMax) continue;
    if (minimumSize !== null && property.size < minimumSize) continue;

    const matchesLocation = applicable.location && normalized(property.location) === location;
    const matchesUnit = applicable.unitType && normalized(property.unitType) === unitType;
    const propertyTokens = new Set(
      [property.developer, property.project, property.location, property.unitType].flatMap(keywordTokens),
    );
    const keywordsMatched = terms.filter(term => propertyTokens.has(term)).length;
    const parts = {
      location: matchesLocation ? preferenceWeights.location : 0,
      unitType: matchesUnit ? preferenceWeights.unitType : 0,
      keywords: terms.length ? preferenceWeights.keywords * keywordsMatched / terms.length : 0,
    };
    const points = parts.location + parts.unitType + parts.keywords;
    rows.push({
      property, score: weight ? Math.round(100 * points / weight) : null,
      matchesLocation, matchesUnit, keywordsMatched,
    });
  }

  rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)
    || a.property.price - b.property.price
    || a.property.project.localeCompare(b.property.project));
  return { rows, applicable, keywordCount: terms.length };
}

function stressPercent(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError(field);
  return value;
}

function calculateDeal(inputs) {
  const result = investment(inputs);
  const loan = inputs.financed
    ? mortgage({ price: inputs.price, downPayment: inputs.downPayment, rate: inputs.rate, years: inputs.years })
    : { principal: 0, monthlyPayment: 0 };

  const annualDebt = loan.monthlyPayment * 12;
  const cashFlow = result.net - annualDebt;
  return {
    grossYield: result.grossYield,
    netYield: result.netYield,
    annualNet: result.net,
    monthlyNet: result.monthlyNet,
    acquisitionCost: result.total,
    loanAmount: loan.principal,
    monthlyPayment: loan.monthlyPayment,
    annualDebt,
    cashFlow,
    coverage: annualDebt > 0 ? result.net / annualDebt : null,
    maxVacancy: inputs.rent > 0 ? 100 * (1 - (inputs.expenses + annualDebt) / inputs.rent) : null,
  };
}

export function analyzeDeal(inputs, shocks) {
  const base = calculateDeal(inputs);
  const rentDrop = stressPercent(shocks.rentDrop, 'rentDrop');
  const vacancyRise = stressPercent(shocks.vacancyRise, 'vacancyRise');
  const expenseRise = stressPercent(shocks.expenseRise, 'expenseRise');
  const rateRise = stressPercent(shocks.rateRise, 'rateRise');
  const stressed = {
    ...inputs,
    rent: inputs.rent * (1 - rentDrop / 100),
    expenses: inputs.expenses * (1 + expenseRise / 100),
    vacancy: Math.min(100, inputs.vacancy + vacancyRise),
    rate: inputs.financed ? Math.min(100, inputs.rate + rateRise) : 0,
  };
  const downside = calculateDeal(stressed);
  const signals = [base.cashFlow < 0 ? 'baseDeficit' : 'baseCovered'];
  signals.push(downside.cashFlow < 0 ? 'stressDeficit' : 'stressCovered');
  if (base.coverage !== null && base.coverage < 1.2) signals.push('thinCoverage');
  if (inputs.rent === 0) signals.push('noRent');
  signals.push('verifyInputs');
  return {
    inputs: { ...inputs }, base, stressed, downside, signals,
    cashFlowChange: downside.cashFlow - base.cashFlow,
  };
}

export function numericDealContext(deal) {
  const { inputs, base } = deal;
  const context = {
    price: inputs.price, rent: inputs.rent, expenses: inputs.expenses, fees: inputs.fees, vacancy: inputs.vacancy,
    grossYield: base.grossYield, netYield: base.netYield, annualNet: base.annualNet, monthlyNet: base.monthlyNet,
    acquisitionCost: base.acquisitionCost, monthlyPayment: base.monthlyPayment, cashFlow: base.cashFlow,
    loanAmount: base.loanAmount, downPayment: inputs.financed ? inputs.downPayment : inputs.price,
  };
  if (inputs.financed) {
    context.interestRate = inputs.rate;
    context.termYears = inputs.years;
  }
  return context;
}

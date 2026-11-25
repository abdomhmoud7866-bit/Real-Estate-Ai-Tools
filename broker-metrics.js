const FILS_PER_AED = 100;
const RATE_SCALE = 10_000;
const FULL_SHARE = BigInt(100 * RATE_SCALE);
const MAX_AMOUNT = 1_000_000_000_000;
const monthPattern = /^(?:19\d\d|[2-9]\d{3})-(?:0[1-9]|1[0-2])$/;
const reportCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit',
});
const stageKeys = ['new', 'qualified', 'viewing', 'offer', 'won', 'lost'];

function decimalUnits(value, min, max, decimals, field) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(field);
  const text = value.toFixed(decimals);
  if (Number(text) !== value) throw new RangeError(field);
  return BigInt(text.replace('.', ''));
}

function roundedShare(fils, rate) {
  return (fils * rate + FULL_SHARE / 2n) / FULL_SHARE;
}

function aed(fils) {
  return Number(fils) / FILS_PER_AED;
}

/**
 * Allocate the estimated commission at fil precision, before tax and fees.
 * Referral and co-broker shares reference gross commission. The internal
 * agent share references the remaining house pool.
 */
export function calculateCommission({ price, rate, referral = 0, coBroker = 0, agent = 0 }) {
  const priceFils = decimalUnits(price, 1, MAX_AMOUNT, 2, 'price');
  const grossRate = decimalUnits(rate, 0, 100, 4, 'rate');
  const referralRate = decimalUnits(referral, 0, 100, 4, 'referral');
  const coBrokerRate = decimalUnits(coBroker, 0, 100, 4, 'coBroker');
  const agentRate = decimalUnits(agent, 0, 100, 4, 'agent');
  const externalRate = referralRate + coBrokerRate;
  if (externalRate > FULL_SHARE) throw new RangeError('externalSplit');

  const gross = roundedShare(priceFils, grossRate);
  const referralPayout = roundedShare(gross, referralRate);
  const totalExternal = roundedShare(gross, externalRate);
  const coBrokerPayout = totalExternal - referralPayout;
  const housePool = gross - totalExternal;
  const agentPayout = roundedShare(housePool, agentRate);
  const brokeragePayout = housePool - agentPayout;

  return {
    gross: aed(gross),
    referralPayout: aed(referralPayout),
    coBrokerPayout: aed(coBrokerPayout),
    housePool: aed(housePool),
    agentPayout: aed(agentPayout),
    brokeragePayout: aed(brokeragePayout),
  };
}

export function reportingMonth(date = new Date()) {
  const parts = reportCalendar.formatToParts(date);
  const year = parts.find((part) => part.type === 'year').value.padStart(4, '0');
  const month = parts.find((part) => part.type === 'month').value;
  return `${year}-${month}`;
}

function isCreatedInMonth(value, month) {
  const date = new Date(value);
  return typeof value === 'string' && !Number.isNaN(date.getTime()) && reportingMonth(date) === month;
}

/**
 * Count terminal closures by their entered closing date and new leads by
 * the UAE calendar month. Open leads reflect the current pipeline.
 */
export function calculatePerformance(clients, month) {
  if (!monthPattern.test(month)) throw new RangeError('month');
  const stages = Object.fromEntries(stageKeys.map((key) => [key, 0]));
  let newLeads = 0;
  let won = 0;
  let lost = 0;
  let grossCommissionFils = 0n;

  for (const client of clients) {
    if (!Object.hasOwn(stages, client.stage)) continue;
    stages[client.stage]++;
    if (isCreatedInMonth(client.createdAt, month)) newLeads++;
    if (client.closedAt?.slice(0, 7) !== month) continue;
    if (client.stage === 'won') {
      won++;
      grossCommissionFils += decimalUnits(client.grossCommission ?? 0, 0, MAX_AMOUNT, 2, 'grossCommission');
    } else if (client.stage === 'lost') {
      lost++;
    }
  }

  const openLeads = stages.new + stages.qualified + stages.viewing + stages.offer;
  const conversion = won + lost > 0 ? won / (won + lost) : null;
  return { newLeads, won, lost, openLeads, conversion, grossCommission: aed(grossCommissionFils), stages };
}

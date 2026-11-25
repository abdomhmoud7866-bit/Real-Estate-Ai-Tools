// Calculator results are staged in memory for review. No names, labels, IDs,
// notes, property records, or browser credentials cross this boundary.
const transferableTasks = new Set(['analysis', 'report', 'comparison']);
const fields = [
  'price', 'rent', 'expenses', 'fees', 'vacancy', 'grossYield', 'netYield', 'annualNet',
  'monthlyNet', 'acquisitionCost', 'downPayment', 'interestRate', 'termYears', 'monthlyPayment',
  'cashFlow', 'loanAmount', 'salePrice', 'netProfit', 'roi',
];
let pending;

export function stageAiContext(task, scenarios) {
  if (!transferableTasks.has(task) || !Array.isArray(scenarios) || !scenarios.length || scenarios.length > 3) {
    throw new TypeError('Invalid financial handoff.');
  }
  const context = scenarios.map(scenario => {
    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) throw new TypeError('Invalid scenario.');
    const values = fields.flatMap(key => {
      const value = Object.hasOwn(scenario, key) ? scenario[key] : undefined;
      return Number.isFinite(value) && Math.abs(value) <= 1e18 ? [[key, value]] : [];
    });
    if (!values.length) throw new TypeError('A handoff needs financial values.');
    return Object.fromEntries(values);
  });
  pending = { task, context };
}

export function takeAiContext() {
  const handoff = pending ?? null;
  pending = undefined;
  return handoff;
}

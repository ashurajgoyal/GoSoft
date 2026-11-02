/**
 * Payroll calculation. Pure function — unit tested. All statutory rules are configurable per company
 * (company.payrollSettings) so they can be updated when rates or ceilings change.
 */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const DEFAULT_PAYROLL_SETTINGS = {
  pfEnabled: true, pfEmployeeRate: 12, pfEmployerRate: 12, pfWageCeiling: 15000, pfApplyCeiling: true,
  esiEnabled: true, esiEmployeeRate: 0.75, esiEmployerRate: 3.25, esiWageLimit: 21000,
  ptEnabled: true,
  // Slabs on monthly gross: first slab whose upTo >= gross applies (null = no upper bound).
  ptSlabs: [{ upTo: 15000, amount: 0 }, { upTo: 20000, amount: 150 }, { upTo: null, amount: 200 }],
  tdsEnabled: true,
  overtimeMultiplier: 2,
  workingDaysMode: 'calendar', // calendar | fixed
  fixedWorkingDays: 26,
};

export function computePayslip(structure = {}, input = {}, settings = {}) {
  const s = { ...DEFAULT_PAYROLL_SETTINGS, ...settings };
  const totalDays = input.totalDays || 30;
  const paidDays = Math.max(0, Math.min(totalDays, input.paidDays ?? totalDays));
  const factor = totalDays ? paidDays / totalDays : 1;

  const basic = r2((Number(structure.basic) || 0) * factor);
  const hra = r2((Number(structure.hra) || 0) * factor);
  const allowances = (structure.allowances || []).map((a) => ({ name: a.name, amount: r2((Number(a.amount) || 0) * factor) }));
  const allowanceTotal = allowances.reduce((t, a) => t + a.amount, 0);

  const monthlyFixed = (Number(structure.basic) || 0) + (Number(structure.hra) || 0) + (structure.allowances || []).reduce((t, a) => t + (Number(a.amount) || 0), 0);
  const hourly = monthlyFixed / (totalDays * 8 || 1);
  const overtime = r2((Number(input.overtimeHours) || 0) * hourly * s.overtimeMultiplier);
  const bonus = r2(Number(input.bonus) || 0);
  const incentive = r2(Number(input.incentive) || 0);

  const gross = r2(basic + hra + allowanceTotal + overtime + bonus + incentive);

  const pfBase = s.pfApplyCeiling ? Math.min(basic, s.pfWageCeiling) : basic;
  const pfEmployee = s.pfEnabled && structure.pfApplicable !== false ? r2(pfBase * s.pfEmployeeRate / 100) : 0;
  const pfEmployer = s.pfEnabled && structure.pfApplicable !== false ? r2(pfBase * s.pfEmployerRate / 100) : 0;

  const esiEligible = s.esiEnabled && structure.esiApplicable !== false && monthlyFixed <= s.esiWageLimit;
  const esiEmployee = esiEligible ? Math.ceil(gross * s.esiEmployeeRate / 100) : 0;
  const esiEmployer = esiEligible ? Math.ceil(gross * s.esiEmployerRate / 100) : 0;

  let pt = 0;
  if (s.ptEnabled && structure.ptApplicable !== false) {
    const slab = (s.ptSlabs || []).find((sl) => sl.upTo === null || sl.upTo === undefined || gross <= sl.upTo);
    pt = slab ? Number(slab.amount) || 0 : 0;
  }
  const tds = s.tdsEnabled ? r2(Number(structure.tdsMonthly) || 0) : 0;
  const advance = r2(Number(input.advanceRecovery) || 0);
  const otherDeductions = r2(Number(input.otherDeductions) || 0);

  const deductions = [
    { name: 'Provident Fund', amount: pfEmployee },
    { name: 'ESI', amount: esiEmployee },
    { name: 'Professional Tax', amount: pt },
    { name: 'TDS', amount: tds },
    { name: 'Salary Advance Recovery', amount: advance },
    { name: 'Other Deductions', amount: otherDeductions },
  ].filter((d) => d.amount > 0);
  const totalDeductions = r2(deductions.reduce((t, d) => t + d.amount, 0));

  const earnings = [
    { name: 'Basic', amount: basic }, { name: 'HRA', amount: hra }, ...allowances,
    { name: 'Overtime', amount: overtime }, { name: 'Bonus', amount: bonus }, { name: 'Incentive', amount: incentive },
  ].filter((e) => e.amount > 0);

  return {
    totalDays, paidDays, lopDays: r2(totalDays - paidDays), earnings, deductions, gross, totalDeductions,
    netPay: r2(gross - totalDeductions), employer: { pf: pfEmployer, esi: esiEmployer }, ctcMonthly: r2(gross + pfEmployer + esiEmployer),
  };
}

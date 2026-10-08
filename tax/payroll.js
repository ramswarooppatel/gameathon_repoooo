// Statutory payroll maths for India. Pure: no DOM, no network. PLANNING ESTIMATES: rates and slabs change, state rules differ. Verify with a CA.
// Everything is rounded to whole rupees, the way a payslip is.
const R = Math.round;

export const PF = { rate: 0.12, ceiling: 15000, epsRate: 0.0833, epsMax: 1250, adminRate: 0.005, edliRate: 0.005 };
export const ESI = { ceiling: 21000, emp: 0.0075, er: 0.0325 };
export const STD_DEDUCTION = 75000;

// Professional tax per month. Slabs are simplified; states not listed fall back to the flat amount the user enters (or 0).
export const PT_STATES = { '27': 'Maharashtra', '29': 'Karnataka', '24': 'Gujarat', '33': 'Tamil Nadu', '07': 'Delhi (none)', none: 'Not applicable / enter flat' };
export function professionalTax(state, gross, month, flat = 0) {
  switch (state) {
    case '27': return gross <= 7500 ? 0 : gross <= 10000 ? 175 : month === 2 ? 300 : 200;
    case '29': return gross >= 25000 ? 200 : 0;
    case '24': return gross >= 12000 ? 200 : 0;
    case '33': return gross < 21000 ? 0 : gross <= 30000 ? 23 : gross <= 45000 ? 53 : gross <= 60000 ? 115 : gross <= 75000 ? 171 : 208;   // half-yearly slabs shown as monthly equivalents
    case '07': return 0;
    default: return R(+flat || 0);
  }
}

// New tax regime, salaried: standard deduction, slabs, section 87A rebate up to taxable 12 lakh, 4% cess. No marginal relief above 12 lakh.
const SLABS = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
export function slabTax(taxable) {
  let tax = 0, lo = 0;
  for (const [hi, rate] of SLABS) { if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * rate; lo = hi; }
  return tax;
}
export function annualTax(annualGross) {
  const taxable = Math.max(0, annualGross - STD_DEDUCTION), tax = slabTax(taxable);
  return R((taxable <= 1200000 ? 0 : tax) * 1.04);
}
export const tdsMonthly = (annualGross) => R(annualTax(annualGross) / 12);

// emp: { basic, hra, allowances, pf_on, pf_cap, esi_on, pt_state, pt_flat, tds_on, tds_fixed }  (monthly amounts)
// att: { days, lop, bonus, other_earn, advance, other_ded, reimb, month }
export function calcPayslip(emp, att) {
  const days = +att.days || 30, lop = Math.min(days, Math.max(0, +att.lop || 0)), ratio = (days - lop) / days;
  const basic = R((+emp.basic || 0) * ratio), hra = R((+emp.hra || 0) * ratio), allow = R((+emp.allowances || 0) * ratio);
  const bonus = R(+att.bonus || 0), other = R(+att.other_earn || 0), reimb = R(+att.reimb || 0);
  const fixedGross = basic + hra + allow, gross = fixedGross + bonus + other;

  const pfWage = emp.pf_on ? (emp.pf_cap === false ? basic : Math.min(basic, PF.ceiling)) : 0;
  const pfEmp = R(pfWage * PF.rate), pfEr = R(pfWage * PF.rate);
  const eps = emp.pf_on ? R(Math.min(pfWage, PF.ceiling) * PF.epsRate) : 0, epf = pfEr - eps;
  const pfAdmin = R(pfWage * PF.adminRate), edli = emp.pf_on ? R(Math.min(pfWage, PF.ceiling) * PF.edliRate) : 0;

  const esiOn = !!emp.esi_on && (+emp.basic + +emp.hra + +emp.allowances) <= ESI.ceiling;
  const esiEmp = esiOn ? Math.ceil(gross * ESI.emp) : 0, esiEr = esiOn ? Math.ceil(gross * ESI.er) : 0;
  const pt = professionalTax(emp.pt_state, gross, +att.month || 1, emp.pt_flat);
  const tds = emp.tds_on ? (emp.tds_fixed != null && emp.tds_fixed !== '' ? R(+emp.tds_fixed) : tdsMonthly(((+emp.basic || 0) + (+emp.hra || 0) + (+emp.allowances || 0)) * 12)) : 0;
  const advance = R(+att.advance || 0), otherDed = R(+att.other_ded || 0);
  const deductions = pfEmp + esiEmp + pt + tds + advance + otherDed, net = gross - deductions + reimb;
  const employer = { pf: pfEr, eps, epf, admin: pfAdmin + edli, esi: esiEr };
  return {
    days, lop, paidDays: days - lop,
    earnings: [['Basic', basic], ['HRA', hra], ['Other allowances', allow], ['Bonus', bonus], ['Other earnings', other]].filter(([, v]) => v),
    deductions: [['Provident fund', pfEmp], ['ESI', esiEmp], ['Professional tax', pt], ['Income tax (TDS)', tds], ['Advance recovery', advance], ['Other deductions', otherDed]].filter(([, v]) => v),
    gross, basic, hra, allow, bonus, other, reimb, pfWage, pfEmp, esiEmp, pt, tds, advance, otherDed, totalDeductions: deductions, net,
    employer, employerCost: gross + employer.pf + employer.admin + employer.esi + reimb,
  };
}

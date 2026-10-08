// Editable tax data. SIMULATION VALUES — verify with a Chartered Accountant.
export const GST_SLABS = [0, 5, 18, 40];
export const DEFAULT_RATE = 18;
export const GST_LATE_INTEREST_PA = 0.18; // interest on late tax payment
export const GST_LATE_PENALTY = 0.1;      // sim shortcut: penalty fraction of unpaid tax
export const DEADLINES = {                // day-of-month
  GSTR1: 11, GSTR1_QRMP: 13, GSTR3B: 20, CMP08: 18, TDS: 7, PF: 15, ESI: 15,
  ADVANCE_TAX: ['15 Jun', '15 Sep', '15 Dec', '15 Mar'],
};
export const STATE_CODES = { '27': 'Maharashtra', '29': 'Karnataka', '07': 'Delhi', '33': 'Tamil Nadu', '24': 'Gujarat' };

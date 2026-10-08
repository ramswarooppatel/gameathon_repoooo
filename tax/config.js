// Editable tax data. SIMULATION VALUES — verify with a Chartered Accountant.
export const GST_SLABS = [0, 5, 18, 40];
export const DEFAULT_RATE = 18;
export const GST_LATE_INTEREST_PA = 0.18; // interest on late tax payment
export const GST_LATE_PENALTY = 0.1;      // sim shortcut: penalty fraction of unpaid tax
export const DEADLINES = {                // day-of-month
  GSTR1: 11, GSTR1_QRMP: 13, GSTR3B: 20, CMP08: 18, TDS: 7, PF: 15, ESI: 15,
  ADVANCE_TAX: ['15 Jun', '15 Sep', '15 Dec', '15 Mar'],
};
export const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar',
  '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};
export const EWAY_THRESHOLD = 50000;   // consignment value above which an e-way bill is needed for goods (state rules may differ)
export const UNITS = ['NOS', 'KGS', 'MTR', 'LTR', 'BOX', 'PCS', 'SET', 'HRS', 'DAY', 'MON', 'OTH'];

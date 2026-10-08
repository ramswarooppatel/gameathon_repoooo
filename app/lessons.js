// Micro-lessons for small-business finance. Each: ~2 minutes to read + a 3-question quiz (pass with 2/3) -> 25 XP once.
// Plain-language and simplified; always confirm tax points with a Chartered Accountant.
export const LESSONS = [
  { id: 'cash-vs-profit', title: 'Profit is not cash', mins: 2, tag: 'Basics',
    body: ['Profit is what is left after costs when you record a sale. Cash is what is actually in your bank. If you sell ₹1,00,000 on 60-day credit but pay your costs this month, you are profitable on paper and short of cash.', 'Most small businesses do not fail for lack of sales. They fail when cash arrives later than bills fall due.'],
    takeaway: 'Plan around when money moves, not when invoices are written.',
    quiz: [
      { q: 'You sell ₹1,00,000 on 60-day credit and pay all your costs this month. What happens this month?', o: ['Profit on paper, but cash is down', 'Cash is up by ₹1,00,000', 'Nothing changes'], a: 0 },
      { q: 'Which habit best protects against running out of cash?', o: ['Booking more credit sales', 'Collecting on time and paying on schedule', 'Ignoring small bills'], a: 1 },
      { q: 'A good cash forecast uses…', o: ['Invoice dates only', 'Expected payment dates', 'Last year’s revenue'], a: 1 }] },
  { id: 'runway', title: 'Runway and your cash buffer', mins: 2, tag: 'Basics',
    body: ['Runway is how many months you could keep paying your bills with the cash you have: cash ÷ average monthly outflow. With ₹3,00,000 cash and ₹1,00,000 going out each month, you have 3 months.', 'A common target is three months. A study of US small firms found the median business held only 27 days of buffer, and one in four held 13 days or fewer (JPMorgan Chase Institute).'],
    takeaway: 'Know your runway number and review it weekly.',
    quiz: [
      { q: 'Cash ₹3,00,000 and monthly outflow ₹1,00,000. What is the runway?', o: ['1 month', '3 months', '30 months'], a: 1 },
      { q: 'Which action increases runway?', o: ['Paying every bill the day it arrives', 'Collecting overdue invoices faster', 'Hiring ahead of sales'], a: 1 },
      { q: 'Why aim for around three months of buffer?', o: ['It survives a slow quarter or a late payer', 'Tax law requires it', 'Banks ask for exactly that'], a: 0 }] },
  { id: 'gst-basics', title: 'GST in one minute', mins: 2, tag: 'GST',
    body: ['You collect GST on sales (output tax) and you can reduce it by the GST you paid on purchases (input tax credit). You pay the difference to the government: output tax − input credit.', 'Sales within your state carry CGST + SGST (half each). Sales to another state carry IGST (the full rate). Monthly filers typically file GSTR-1 by the 11th and GSTR-3B (with the tax payment) by the 20th, but dates can be extended, so check the portal.'],
    takeaway: 'GST you collected is not your income. Set it aside.',
    quiz: [
      { q: 'You sell ₹10,000 at 18% GST to a customer in another state. The tax is…', o: ['IGST ₹1,800', 'CGST ₹900 + SGST ₹900', 'No GST'], a: 0 },
      { q: 'Output tax ₹9,000 and input credit ₹4,000. You pay…', o: ['₹13,000', '₹5,000', '₹4,000'], a: 1 },
      { q: 'Which return is used to pay the tax?', o: ['GSTR-1', 'GSTR-3B', 'Neither'], a: 1 }] },
  { id: 'itc', title: 'Protect your input credit', mins: 2, tag: 'GST',
    body: ['Input credit lowers your GST bill, but only when the basics are right: a proper tax invoice with the supplier’s valid GSTIN, goods or services actually received, and the supplier having reported the sale in their own return.', 'A bill from a supplier without a GSTIN is a red flag. Fix it before you file, not after a notice.'],
    takeaway: 'Ask every supplier for a tax invoice with their GSTIN.',
    quiz: [
      { q: 'A supplier’s bill has no GSTIN. Your input credit is…', o: ['Safe', 'At risk', 'Doubled'], a: 1 },
      { q: 'Input credit reduces…', o: ['Your GST payable', 'Your salary costs', 'Your sales'], a: 0 },
      { q: 'The best way to protect credit is to…', o: ['Skip invoices for small purchases', 'Get a proper tax invoice with GSTIN', 'Pay in cash'], a: 1 }] },
  { id: 'msme-45', title: 'The 45-day rule for paying small suppliers', mins: 2, tag: 'Compliance',
    body: ['Under Section 43B(h) of the Income-tax Act, from 1 April 2024, if you owe a micro or small enterprise and do not pay within the agreed time (at most 45 days; 15 days if there is no written agreement), your tax deduction for that expense is allowed only when you actually pay.', 'It also pays to pay small suppliers promptly: it protects relationships and avoids interest disputes.'],
    takeaway: 'Track bills by vendor and pay small suppliers inside 45 days.',
    quiz: [
      { q: 'If you pay a small supplier after the limit, the deduction is…', o: ['Lost forever', 'Allowed only in the year you pay', 'Unchanged'], a: 1 },
      { q: 'The longest credit period counted for this rule is…', o: ['45 days', '90 days', '120 days'], a: 0 },
      { q: 'Which helps you comply?', o: ['Tracking due dates per vendor', 'Paying everyone at year end', 'Verbal agreements only'], a: 0 }] },
  { id: 'fraud', title: 'Spot payment fraud', mins: 2, tag: 'Safety',
    body: ['Common red flags: a request to change a supplier’s bank account over email or WhatsApp, pressure to pay urgently, the same invoice number twice, round amounts with no purchase order, and a GSTIN that fails its check.', 'Always verify a change by calling a number you already have, and require a second person to approve payments above a limit.'],
    takeaway: 'Verify bank-detail changes by phone, using a known number.',
    quiz: [
      { q: 'A supplier emails new bank details. First you…', o: ['Pay immediately', 'Call a number you already have to verify', 'Reply with your PAN'], a: 1 },
      { q: 'The same invoice number appears twice. Most likely…', o: ['A duplicate to check', 'A discount', 'A tax refund'], a: 0 },
      { q: 'A strong control for large payments is…', o: ['Approval above a limit', 'Faster payment', 'Cash only'], a: 0 }] },
  { id: 'margin', title: 'Margin vs markup', mins: 2, tag: 'Pricing',
    body: ['Markup is profit as a percentage of cost. Margin is profit as a percentage of the selling price. If an item costs ₹80 and sells for ₹100, profit is ₹20: markup 25%, margin 20%.', 'To earn a target margin, divide cost by (1 − margin). For a 20% margin on ₹80 cost: 80 ÷ 0.8 = ₹100.'],
    takeaway: 'Price from the margin you need, not from a guess.',
    quiz: [
      { q: 'Cost ₹80, price ₹100. The margin is…', o: ['20%', '25%', '80%'], a: 0 },
      { q: 'Cost ₹80, price ₹100. The markup is…', o: ['20%', '25%', '100%'], a: 1 },
      { q: 'Price for a 20% margin on ₹80 cost?', o: ['₹96', '₹100', '₹120'], a: 1 }] },
  { id: 'separate', title: 'Keep business and personal money apart', mins: 2, tag: 'Habits',
    body: ['Use a separate account for the business and pay yourself a fixed amount on a fixed date. It keeps your books clean, makes tax simpler, and shows you what the business really earns.', 'Treat GST you collected and advance tax as money you are holding for others, and move it to a reserve as you go.'],
    takeaway: 'Pay yourself a salary; park tax money in a reserve.',
    quiz: [
      { q: 'Why separate business and personal accounts?', o: ['Cleaner books and simpler tax', 'To avoid GST', 'Banks require it'], a: 0 },
      { q: 'A good way to pay yourself is…', o: ['Whenever cash looks high', 'A fixed amount on a fixed date', 'Never'], a: 1 },
      { q: 'GST collected from customers should be…', o: ['Treated as profit', 'Set aside in a reserve', 'Spent first'], a: 1 }] },
];
export const PASS = 2;
export const scoreQuiz = (lesson, answers) => lesson.quiz.reduce((n, q, i) => n + (answers[i] === q.a ? 1 : 0), 0);

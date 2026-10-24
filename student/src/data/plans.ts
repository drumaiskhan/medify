export interface Plan {
  id: string;
  durationMonths: number;
  name: string;
  price: string;
  billingText: string;
  features: string[];
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'quarterly',
    durationMonths: 3,
    name: 'Quarterly Access',
    price: 'PKR 1,000',
    billingText: 'One-time payment · 3 months of access',
    features: [
      'Full access to all published blocks in your selected year',
      'KMU modular objective alignment',
      'High-yield clinical tables & diagrams',
      'Highlight, search and resume where you stopped',
      'Save subjects for offline reading',
      'Mobile & desktop study reader'
    ]
  },
  {
    id: 'half-yearly',
    durationMonths: 6,
    name: 'Half-Yearly Access',
    price: 'PKR 2,000',
    billingText: 'One-time payment · 6 months of access',
    recommended: true,
    features: [
      'Full access to all published blocks in your selected year',
      'KMU modular objective alignment',
      'High-yield clinical tables & diagrams',
      'Highlight, search and resume where you stopped',
      'Save subjects for offline reading',
      'Ideal for mid-term modular assessments'
    ]
  },
  {
    id: 'annual',
    durationMonths: 12,
    name: 'Annual Pass',
    price: 'PKR 3,500',
    billingText: 'One-time payment · 12 months (Best Value)',
    features: [
      'Full 12 months of access for your academic year',
      'All published blocks of the year',
      'KMU modular objective alignment',
      'High-yield clinical tables & diagrams',
      'Highlight, search and resume where you stopped',
      'Save subjects for offline reading'
    ]
  }
];

// SiteProvider hydrates these defaults from the server-backed Admin Settings.
// Keep the same objects so existing checkout selections reflect current prices.
export function applyPlanSettings(prices?: Record<string, number>, details?: Record<string, Partial<Plan>>) {
  if ((!prices || typeof prices !== 'object') && (!details || typeof details !== 'object')) return;
  for (const plan of PLANS) {
    const detail = details?.[plan.id];
    if (detail) {
      if (typeof detail.name === 'string' && detail.name.trim()) plan.name = detail.name;
      if (typeof detail.billingText === 'string' && detail.billingText.trim()) plan.billingText = detail.billingText;
      if (Array.isArray(detail.features) && detail.features.length) plan.features = detail.features.filter((x): x is string => typeof x === 'string');
      if (typeof detail.recommended === 'boolean') plan.recommended = detail.recommended;
    }
    const price = prices?.[plan.id];
    if (Number.isInteger(price) && price >= 0 && price <= 1000000)
      plan.price = `PKR ${Number(price).toLocaleString('en-US')}`;
  }
}

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

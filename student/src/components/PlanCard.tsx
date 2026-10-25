import { Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Plan } from '../data/plans';
import { useAuth } from '../context/AuthContext';

interface PlanCardProps {
  plan: Plan;
  yearTitle?: string;
  onSelect?: (plan: Plan) => void;
}

export function PlanCard({ plan, yearTitle, onSelect }: PlanCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAction = () => {
    if (onSelect) {
      onSelect(plan);
    } else if (!user) {
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div
      className={`relative rounded-xl p-6 sm:p-7 flex flex-col justify-between transition-all bg-white border ${
        plan.recommended
          ? 'border-[#1b8e8e] shadow-md ring-1 ring-[#1b8e8e]'
          : 'border-[#cfdbe5] shadow-xs hover:border-[#1b8e8e]/50'
      }`}
    >
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1b8e8e] text-white px-3 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider shadow-xs">
          Recommended Choice
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-serif-heading text-lg font-bold text-[#0f2837]">
            {plan.name}
          </h3>
          <span className="text-xs font-semibold text-[#1b8e8e] bg-[#e8eef3] px-2 py-0.5 rounded">
            {plan.durationMonths} Months
          </span>
        </div>

        {yearTitle && (
          <p className="text-xs text-[#0f2837]/70 mb-3">
            Access to all modules in <span className="font-medium text-[#0f2837]">{yearTitle}</span>
          </p>
        )}

        <div className="my-5 pb-5 border-b border-[#e8eef3]">
          <div className="flex items-baseline gap-1">
            <span className="font-serif-heading text-3xl font-extrabold text-[#0f2837] tracking-tight">
              {plan.price}
            </span>
            <span className="text-xs text-slate-500 font-sans">
              /{plan.durationMonths === 12 ? 'year' : `${plan.durationMonths} mos`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{plan.billingText}</p>
        </div>

        <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleAction}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>{user ? 'Subscribe / Pay Now' : 'Sign in to Subscribe'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <p className="text-[11px] text-center text-slate-400 mt-1.5">
          Transfer via JazzCash or Meezan Bank
        </p>
      </div>
    </div>
  );
}

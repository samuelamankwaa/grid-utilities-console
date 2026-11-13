// Display helpers for labor roles. Role resolution and cost calculation live in src/utils/laborCost.ts.

export const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'General Foreman':
    case 'GForeman':
      return 'General Foreman';
    case 'Foreman':
      return 'Foreman';
    case 'Journeyman':
      return 'Journeyman Lineman';
    case 'Pole Truck Driver':
      return 'Pole Truck Driver';
    case 'Apprentice':
      return 'Apprentice Lineman';
    case 'Groundman':
      return 'Groundman';
    case 'Pole Truck Helper':
      return 'Pole Truck Helper';
    case 'unclassified':
    default:
      return 'Unclassified Rate';
  }
};

export const getRoleCategoryBadge = (role: string): string => {
  switch (role) {
    case 'General Foreman':
    case 'GForeman':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Foreman':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Journeyman':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Pole Truck Driver':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Apprentice':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Groundman':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Pole Truck Helper':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'unclassified':
    default:
      return 'bg-red-50 text-red-700 border-red-200 font-semibold';
  }
};

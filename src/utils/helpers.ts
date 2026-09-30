import { WorkOrder, Invoice, LaborRateCategory } from '../types/schemas';

// Default standard labor rate categories provided by client
export const DEFAULT_LABOR_RATE_CATEGORIES: LaborRateCategory[] = [
  { category_name: 'General Foreman', standard_rate: 58.49, ot_rate: 87.74, dt_rate: 116.98, benefits_rate: 25.22, match_tolerance: 0.20 },
  { category_name: 'Foreman', standard_rate: 57.30, ot_rate: 85.95, dt_rate: 114.60, benefits_rate: 24.90, match_tolerance: 0.20 },
  { category_name: 'Journeyman', standard_rate: 53.72, ot_rate: 80.58, dt_rate: 107.44, benefits_rate: 23.89, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Driver', standard_rate: 40.23, ot_rate: 60.35, dt_rate: 80.46, benefits_rate: 18.56, match_tolerance: 0.20 },
  { category_name: 'Apprentice', standard_rate: 37.60, ot_rate: 56.40, dt_rate: 75.20, benefits_rate: 15.48, match_tolerance: 0.20 },
  { category_name: 'Groundman', standard_rate: 26.94, ot_rate: 40.41, dt_rate: 53.88, benefits_rate: 14.66, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Helper', standard_rate: 15.00, ot_rate: 22.50, dt_rate: 30.00, benefits_rate: 9.48, match_tolerance: 0.20 },
];

// Helper to format currency
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
};

// Helper to format hours
export const formatHours = (val: number): string => {
  return (val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }) + ' hrs';
};

// Helper to get role rate information
export const getLaborRoleRates = (
  roleName: string,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES
): LaborRateCategory | undefined => {
  if (!roleName) return undefined;
  const norm = roleName.trim().toLowerCase();
  return categories.find((c) => {
    const cNorm = c.category_name.trim().toLowerCase();
    if (cNorm === norm) return true;
    if ((norm === 'gforeman' || norm === 'general foreman') && (cNorm === 'general foreman' || cNorm === 'gforeman')) return true;
    return false;
  });
};

// Helper to get hourly benefits rate for a role
export const getLaborRoleBenefitsRate = (
  roleName: string,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES
): number => {
  const role = getLaborRoleRates(roleName, categories);
  return role?.benefits_rate || 0;
};

// Calculate complete line labor cost for an entry (regular + OT + DT + Benefits)
export const calculateLaborEntryCost = (
  e: any,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES
): number => {
  if (e.line_labor_cost !== undefined && e.line_labor_cost !== null && !isNaN(Number(e.line_labor_cost)) && Number(e.line_labor_cost) > 0) {
    return Number(e.line_labor_cost);
  }
  const shiftHours = Number(e.shift_hours) || 0;
  const hourlyRate = Number(e.hourly_rate) || 0;
  const otHours = e.ot_hours !== undefined && e.ot_hours !== null && !isNaN(Number(e.ot_hours))
    ? Number(e.ot_hours)
    : (shiftHours > 8 ? parseFloat((shiftHours - 8).toFixed(2)) : 0);
  const dtHours = e.dt_hours !== undefined && e.dt_hours !== null && !isNaN(Number(e.dt_hours))
    ? Number(e.dt_hours)
    : 0;

  const regularHours = Math.max(0, parseFloat((shiftHours - otHours - dtHours).toFixed(2)));
  const regularCost = parseFloat((regularHours * hourlyRate).toFixed(2));
  const otCost = e.ot_cost !== undefined && e.ot_cost !== null && !isNaN(Number(e.ot_cost)) && Number(e.ot_cost) > 0
    ? Number(e.ot_cost)
    : parseFloat((otHours * hourlyRate * 1.5).toFixed(2));
  const dtCost = e.dt_cost !== undefined && e.dt_cost !== null && !isNaN(Number(e.dt_cost)) && Number(e.dt_cost) > 0
    ? Number(e.dt_cost)
    : parseFloat((dtHours * hourlyRate * 2.0).toFixed(2));

  const roleCat = e.role_category || 'unclassified';
  const benefitsRate = e.benefits_rate !== undefined && e.benefits_rate !== null && !isNaN(Number(e.benefits_rate)) && Number(e.benefits_rate) > 0
    ? Number(e.benefits_rate)
    : getLaborRoleBenefitsRate(roleCat, categories);

  const benefitsCost = e.benefits_cost !== undefined && e.benefits_cost !== null && !isNaN(Number(e.benefits_cost)) && Number(e.benefits_cost) > 0
    ? Number(e.benefits_cost)
    : parseFloat((shiftHours * benefitsRate).toFixed(2));

  return parseFloat((regularCost + otCost + dtCost + benefitsCost).toFixed(2));
};

// Known secondary / tier labor rate mappings for frontend classification
export interface LaborRateMapping {
  category_name: string;
  rate: number;
  match_tolerance?: number;
}

export const KNOWN_SECONDARY_LABOR_RATES: LaborRateMapping[] = [
  { category_name: 'Journeyman', rate: 54.57, match_tolerance: 0.20 },
  { category_name: 'Journeyman', rate: 51.16, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Driver', rate: 38.31, match_tolerance: 0.20 },
  { category_name: 'Apprentice', rate: 30.70, match_tolerance: 0.20 },
  { category_name: 'Groundman', rate: 25.66, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Helper', rate: 17.79, match_tolerance: 0.20 },
];

// Helper to match an actual hourly rate or WO assignment to a role category
export const classifyLaborRole = (
  hourlyRate: number,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES,
  employeeName?: string,
  workOrder?: { general_foreman?: string; foreman?: string },
  allGfNames?: Set<string>,
  allForemanNames?: Set<string>
): string => {
  const normEmp = employeeName ? employeeName.trim().toLowerCase() : '';

  // 1. Crew leadership matching by Employee Name / Work Order assignments (Highest Priority)
  if (normEmp) {
    if (
      (workOrder?.general_foreman && workOrder.general_foreman.trim().toLowerCase() === normEmp) ||
      (allGfNames && allGfNames.has(normEmp))
    ) {
      return 'General Foreman';
    }

    if (
      (workOrder?.foreman && workOrder.foreman.trim().toLowerCase() === normEmp) ||
      (allForemanNames && allForemanNames.has(normEmp))
    ) {
      return 'Foreman';
    }
  }

  // 2. Rate-based matching against configured rate categories with tolerance
  if (typeof hourlyRate === 'number' && !isNaN(hourlyRate) && hourlyRate > 0) {
    for (const cat of categories) {
      const tolerance = cat.match_tolerance !== undefined ? cat.match_tolerance : 0.20;
      if (Math.abs(hourlyRate - cat.standard_rate) <= tolerance) {
        return cat.category_name;
      }
    }

    // 3. Rate-based matching against secondary / tier rate schedules
    for (const mapping of KNOWN_SECONDARY_LABOR_RATES) {
      const tolerance = mapping.match_tolerance !== undefined ? mapping.match_tolerance : 0.20;
      if (Math.abs(hourlyRate - mapping.rate) <= tolerance) {
        return mapping.category_name;
      }
    }
  }

  return 'unclassified';
};

// Convert HH:MM (e.g. 08:30 or 8:45) or numbers/decimal strings to decimal hours (e.g. 8.5)
export const parseHoursToDecimal = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = val.toString().trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    return parseFloat((hours + minutes / 60).toFixed(2));
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

// Check if a work order status represents completed work
export const isWorkOrderCompleted = (status?: string | null): boolean => {
  if (!status) return false;
  return status === 'Field Complete' || status === 'CTCC Completed' || status === 'Ready to Bill';
};

// Format a work order row for consistent database upload and state ingestion
export const formatWorkOrderForUpload = (wo: any): WorkOrder => {
  const isCompleted = isWorkOrderCompleted(wo.status);
  return {
    work_order_number: String(wo.work_order_number).trim(),
    status: wo.status || 'Work Pending',
    general_foreman: wo.general_foreman || 'Unassigned GF',
    foreman: wo.foreman || 'Unassigned Foreman',
    area: wo.area || deriveArea(wo.address || '', wo.latitude, wo.longitude),
    address: wo.address || '',
    latitude: typeof wo.latitude === 'number' ? wo.latitude : (parseFloat(wo.latitude) || 29.7604),
    longitude: typeof wo.longitude === 'number' ? wo.longitude : (parseFloat(wo.longitude) || -95.3698),
    locate_renewal_date: wo.locate_renewal_date || null,
    date_work_completed: wo.date_work_completed || (isCompleted ? (wo.customer_need_date || '2026-08-15') : null),
    customer_need_date: wo.customer_need_date || null,
    locked_gates: !!wo.locked_gates,
    outage_required: !!wo.outage_required,
    permitting_needed: !!wo.permitting_needed,
    switching_required: !!wo.switching_required,
    traffic_control_needed: !!wo.traffic_control_needed,
    hydrovac_needed: !!wo.hydrovac_needed,
    tree_trimming_needed: !!wo.tree_trimming_needed,
  };
};

// Safe coordinate boundaries for Great Houston Area
export const HOUSTON_BOUNDS = {
  latMin: 29.5,
  latMax: 30.3,
  lngMin: -96.0,
  lngMax: -95.0,
};

// Helper to parse dates from numeric Excel format or standard date strings
export const parseExcelDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel epoch starts on Dec 30, 1899 due to 1900 leap year bug
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  try {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {}
  return null;
};

// Generate a deterministic synthetic match between Invoice and Work Orders
export const runSyntheticJoin = (
  invoices: any[],
  workOrders: WorkOrder[]
): Invoice[] => {
  if (workOrders.length === 0) return [];
  const validInvoices = (invoices || []).filter((inv) => {
    const invNum = inv['Invoice #'] || inv.invoice_number;
    return (
      invNum !== null &&
      invNum !== undefined &&
      String(invNum).trim() !== '' &&
      String(invNum).trim() !== '0' &&
      String(invNum).trim().toLowerCase() !== 'null' &&
      String(invNum).trim().toLowerCase() !== 'undefined'
    );
  });

  return validInvoices.map((inv) => {
    const po = inv['PO #'] || inv.po_number || '';
    const invoiceNumber = String(inv['Invoice #'] || inv.invoice_number || '').trim();
    const match = po.match(/WO_(\d+)_/);
    let woNumber = match ? match[1] : null;
    let linkSource: 'native' | 'synthetic' = 'native';

    let targetWO = workOrders.find((w) => w.work_order_number === woNumber);

    if (!targetWO) {
      linkSource = 'synthetic';
      // Seeded modulo hash based on PO batch number or invoice number
      const seedInput = match ? match[1] + invoiceNumber : invoiceNumber;
      let hash = 0;
      for (let i = 0; i < seedInput.length; i++) {
        hash = seedInput.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % workOrders.length;
      targetWO = workOrders[idx];
      woNumber = targetWO.work_order_number;
    }

    return {
      id: inv.id || crypto.randomUUID(),
      invoice_number: invoiceNumber,
      created_date: parseExcelDate(inv['Created Date'] || inv.created_date),
      status: inv.Status || inv.status || 'Unapproved',
      po_number: po,
      work_order_id: targetWO.id || null,
      work_order_number: woNumber,
      link_source: linkSource,
      total: parseFloat(inv.Total || inv.total || '0'),
      unanswered_comments: (inv['Unanswered Comments'] || inv.unanswered_comments) === 'true' || (inv['Unanswered Comments'] || inv.unanswered_comments) === true,
      dispute_reason: inv['Dispute Reason'] || inv.dispute_reason || null,
    };
  });
};

// Categorize and derive Region / Area from address field
export const deriveArea = (address: string, latitude?: number, longitude?: number): string => {
  if (latitude && longitude) {
    const lat = latitude;
    const lng = longitude;
    if (lat >= 29.5 && lat <= 30.1 && lng >= -96.0 && lng <= -95.6) return 'KATY';
    if (lat >= 29.9 && lat <= 30.15 && lng >= -95.75 && lng <= -95.5) return 'CYPRESS';
    if (lat >= 30.0 && lat <= 30.25 && lng >= -95.65 && lng <= -95.35) return 'TOMBALL';
    if (lat >= 29.7 && lat <= 29.9 && lng >= -95.65 && lng <= -95.4) return 'BEAR CREEK';
    if (lat >= 29.95 && lat <= 30.2 && lng >= -95.5 && lng <= -95.25) return 'SPRING';
    if (lat >= 29.6 && lat <= 29.85 && lng >= -95.55 && lng <= -95.35) return 'SPRING BRANCH';
  }
  const upper = address.toUpperCase();
  if (upper.includes('CYPRESS')) return 'CYPRESS';
  if (upper.includes('TOMBALL')) return 'TOMBALL';
  if (upper.includes('KATY')) return 'KATY';
  if (upper.includes('SPRING')) {
    if (upper.includes('77080') || upper.includes('77055') || upper.includes('SPRING BRANCH')) return 'SPRING BRANCH';
    return 'SPRING';
  }
  if (upper.includes('77084') || upper.includes('77095') || upper.includes('BEAR CREEK') || upper.includes('CLAY RD')) return 'BEAR CREEK';
  if (upper.includes('HOUSTON')) return 'HOUSTON';
  return 'HOUSTON';
};

export const getFilterFingerprint = (filters: any): string => {
  return JSON.stringify({
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    generalForeman: filters.generalForeman || 'All',
    foreman: filters.foreman || 'All',
    workOrderNumbers: filters.workOrderNumbers || [],
    area: filters.area || 'All',
    status: filters.status || 'All',
  });
};

// Strict email validator
export const validateEmailAddress = (val: string): string => {
  const trimmed = (val || '').trim();
  if (!trimmed) return 'Email address is required';

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address (e.g. name@company.com)';
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) return 'Invalid email format';
  const [localPart, domainPart] = parts;

  if (/^\d+$/.test(localPart)) {
    return 'Email username cannot consist only of numbers (e.g. 123@gmail.com is not allowed)';
  }

  if (localPart.length < 2) {
    return 'Email username must be at least 2 characters long';
  }

  const domainParts = domainPart.split('.');
  if (domainParts.some((p) => !p || /^\d+$/.test(p))) {
    return 'Please enter a valid domain name in email address';
  }

  return '';
};


// Authoritative reporting date selector for Work Orders:
// - Completed work metrics MUST use Fulcrum Completion Date (date_work_completed).
// - Open/pending work metrics use Customer Need Date (customer_need_date) or creation date.
// - CRITICAL: NEVER use Fulcrum's "Last Updated" (_server_updated_at / _updated_at) because
//   any minor comment or edit will modify that timestamp and incorrectly shift the record into another reporting period.
export const getWorkOrderReportingDate = (wo: any): string | null => {
  if (!wo) return null;

  // 1. If date_work_completed is present (completed work), use Fulcrum Completion Date
  if (wo.date_work_completed) {
    const completedDate = parseExcelDate(wo.date_work_completed);
    if (completedDate) return completedDate;
  }

  // 2. Fallback to customer_need_date for pending work or if completion date is missing
  if (wo.customer_need_date) {
    const needDate = parseExcelDate(wo.customer_need_date);
    if (needDate) return needDate;
  }

  // 3. Fallback to created_date / created_at (NEVER _server_updated_at)
  if (wo.created_date) {
    const cDate = parseExcelDate(wo.created_date);
    if (cDate) return cDate;
  }
  if (wo.created_at) {
    const cDate = parseExcelDate(wo.created_at);
    if (cDate) return cDate;
  }

  return null;
};

// Authoritative date selector for Invoices:
// Uses the invoice's created_date or created_at column.
export const getInvoiceDate = (inv: any): string | null => {
  if (!inv) return null;
  if (inv.created_date) {
    const parsed = parseExcelDate(inv.created_date);
    if (parsed) return parsed;
  }
  if (inv.created_at) {
    const parsed = parseExcelDate(inv.created_at);
    if (parsed) return parsed;
  }
  return null;
};

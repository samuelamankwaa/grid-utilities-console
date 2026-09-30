// Utility to generate and download clean, RFC-4180 compliant CSV template datasets
// Opens natively in Microsoft Excel, Google Sheets, and matches UploadModal requirements without heavy/vulnerable dependencies.

const downloadCsv = (filename: string, headers: string[], rows: Record<string, any>[]) => {
  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h] !== undefined ? row[h] : '')).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadWorkOrderTemplate = () => {
  const headers = [
    '_status', '_title', '_server_updated_at', '_updated_by', '_geometry', '_latitude', '_longitude',
    'general_foreman', 'foreman', 'work_order_number', 'address', 'customer_need_date',
    'date_locates_called_in', 'locate_ticket_number', 'expiration_date', 'locate_renewal_date',
    'renewal_expiration_date', 'switching_required_requested', 'so_', 'outage_required',
    'outage_notes', 'permitting_needed', 'locked_gates', 'traffic_control_needed',
    'traffic_control_notes', 'hydrovac_needed', 'hydrovac_notes', 'tree_trimming_needed',
    'notes', 'date_work_completed', 'post_construction_asbuilt', 'post_construction_notes'
  ];
  const sampleRow: Record<string, any> = {};
  headers.forEach((h) => { sampleRow[h] = ''; });
  sampleRow._status = 'Field Check';
  sampleRow.work_order_number = '123456789';
  sampleRow.general_foreman = 'Marlon Davis';
  sampleRow.foreman = 'Derek Mills';
  sampleRow.address = '7280 KATY FREEWAY, HOUSTON, TX 77080-3824';
  sampleRow._latitude = 30.0106;
  sampleRow._longitude = -95.4003;
  sampleRow.customer_need_date = '2026-08-20';
  sampleRow.switching_required_requested = 'no';
  sampleRow.outage_required = 'no';
  sampleRow.permitting_needed = 'yes';
  sampleRow.locked_gates = 'yes';
  sampleRow.traffic_control_needed = 'no';
  sampleRow.hydrovac_needed = 'no';
  sampleRow.tree_trimming_needed = 'no';

  downloadCsv('work_order_template.csv', headers, [sampleRow]);
};

export const downloadInvoiceTemplate = () => {
  const headers = ['Invoice #', 'Created Date', 'Status', 'PO #', 'Total', 'Unanswered Comments', 'Dispute Reason'];
  const sampleRow: Record<string, any> = {};
  headers.forEach((h) => { sampleRow[h] = ''; });
  sampleRow['Invoice #'] = '9999';
  sampleRow['Created Date'] = '2026-08-20';
  sampleRow.Status = 'Unapproved';
  sampleRow['PO #'] = 'WO_121213513_99999';
  sampleRow.Total = '4500.00';
  sampleRow['Unanswered Comments'] = 'false';

  downloadCsv('invoice_template.csv', headers, [sampleRow]);
};

export const downloadTimesheetTemplate = () => {
  const headers = [
    'Type',
    'First name',
    'Last name',
    'Start Date',
    'End Date',
    'In',
    'Out',
    'Shift hours',
    'Hourly rate (USD)',
    'OT hours',
    'OT cost',
    'Total double',
    'DT cost',
    'Benefits',
  ];
  const sampleRows = [
    {
      Type: '121213513',
      'First name': 'Carlos',
      'Last name': 'Rodriguez',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '17:30',
      'Shift hours': '10:30',
      'Hourly rate (USD)': 58.49,
      'OT hours': '01:30',
      'OT cost': 131.61,
      'Total double': '01:00',
      'DT cost': 116.98,
      Benefits: 264.81,
    },
    {
      Type: '121213513',
      'First name': 'Derek',
      'Last name': 'Mills',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '17:00',
      'Shift hours': '10:00',
      'Hourly rate (USD)': 57.30,
      'OT hours': '01:00',
      'OT cost': 85.95,
      'Total double': '01:00',
      'DT cost': 114.60,
      Benefits: 249.00,
    },
    {
      Type: '121213513',
      'First name': 'Aaron',
      'Last name': 'Miller',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '16:00',
      'Shift hours': '09:00',
      'Hourly rate (USD)': 53.72,
      'OT hours': '01:00',
      'OT cost': 80.58,
      'Total double': '00:00',
      'DT cost': 0.00,
      Benefits: 215.01,
    },
    {
      Type: '121213513',
      'First name': 'David',
      'Last name': 'Jenkins',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '16:00',
      'Shift hours': '09:00',
      'Hourly rate (USD)': 40.23,
      'OT hours': '01:00',
      'OT cost': 60.35,
      'Total double': '00:00',
      'DT cost': 0.00,
      Benefits: 167.04,
    },
    {
      Type: '121213513',
      'First name': 'Marcus',
      'Last name': 'Vance',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '15:00',
      'Shift hours': '08:00',
      'Hourly rate (USD)': 37.60,
      'OT hours': '00:00',
      'OT cost': 0.00,
      'Total double': '00:00',
      'DT cost': 0.00,
      Benefits: 123.84,
    },
    {
      Type: '121213513',
      'First name': 'Kyle',
      'Last name': 'Simmons',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '15:00',
      'Shift hours': '08:00',
      'Hourly rate (USD)': 26.94,
      'OT hours': '00:00',
      'OT cost': 0.00,
      'Total double': '00:00',
      'DT cost': 0.00,
      Benefits: 117.28,
    },
    {
      Type: '121213513',
      'First name': 'John',
      'Last name': 'Doe',
      'Start Date': '2026-08-10',
      'End Date': '2026-08-10',
      In: '07:00',
      Out: '15:00',
      'Shift hours': '08:00',
      'Hourly rate (USD)': 15.00,
      'OT hours': '00:00',
      'OT cost': 0.00,
      'Total double': '00:00',
      'DT cost': 0.00,
      Benefits: 75.84,
    },
  ];

  downloadCsv('connecteam_timesheet_template.csv', headers, sampleRows);
};

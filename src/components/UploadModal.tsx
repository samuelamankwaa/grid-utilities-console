import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseCSVAsync } from '../utils/parseCSV';
import {
  WorkOrderSchema,
  InvoiceSchema,
  MasterJoinedSchema,
  LaborEntrySchema,
} from '../types/schemas';
import {
  uploadWorkOrdersThunk,
  uploadInvoicesThunk,
  uploadJoinedMasterThunk,
  uploadTimesheetThunk,
} from '../store/dbSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { parseHoursToDecimal, parseExcelDate, classifyLaborRole, getLaborRoleBenefitsRate, DEFAULT_LABOR_RATE_CATEGORIES } from '../utils/helpers';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import {
  downloadWorkOrderTemplate,
  downloadInvoiceTemplate,
  downloadTimesheetTemplate,
} from '../utils/excelTemplates';

interface UploadModalProps {
  onClose: () => void;
}

const TIMESHEET_HEADER_MAP: Record<string, string> = {
  'First name': 'employee_first_name',
  'Last name': 'employee_last_name',
  'User Name': 'employee_name',
  'Employee Name': 'employee_name',
  Date: 'shift_date_raw',
  date: 'shift_date_raw',
  'Start Date': 'start_date_raw',
  'Start date': 'start_date_raw',
  'start date': 'start_date_raw',
  'Start': 'start_date_raw',
  'start': 'start_date_raw',
  'End Date': 'end_date_raw',
  'End date': 'end_date_raw',
  'end date': 'end_date_raw',
  'End': 'end_date_raw',
  'end': 'end_date_raw',
  'Shift Date': 'shift_date_raw',
  'Shift date': 'shift_date_raw',
  'shift date': 'shift_date_raw',
  shift_date: 'shift_date_raw',
  'Shift start': 'clock_in',
  'Shift Start': 'clock_in',
  'Shift end': 'clock_out',
  'Shift End': 'clock_out',
  Type: 'work_order_number',
  type: 'work_order_number',
  'Work Order': 'work_order_number',
  'Shift hours': 'shift_hours_raw',
  'Total hours': 'shift_hours_raw',
  'Total Hours': 'shift_hours_raw',
  'Total hours (inc. auto-deductions)': 'shift_hours_raw',
  'Regular hours': 'regular_hours_raw',
  'Regular Hours': 'regular_hours_raw',
  'Regular': 'regular_hours_raw',
  'Regular cost': 'regular_cost_raw',
  'Regular Cost': 'regular_cost_raw',
  'Regular pay': 'regular_cost_raw',
  'Regular Pay': 'regular_cost_raw',
  'Total cost': 'line_labor_cost_raw',
  'Total Cost': 'line_labor_cost_raw',
  'Labor cost': 'line_labor_cost_raw',
  'Labor Cost': 'line_labor_cost_raw',
  'Overtime hours': 'ot_hours_raw',
  'Overtime Hours': 'ot_hours_raw',
  'Overtime': 'ot_hours_raw',
  'overtime': 'ot_hours_raw',
  'OT hours': 'ot_hours_raw',
  'OT Hours': 'ot_hours_raw',
  'OT': 'ot_hours_raw',
  'OT cost': 'ot_cost_raw',
  'OT Cost': 'ot_cost_raw',
  ot_cost: 'ot_cost_raw',
  'Overtime cost': 'ot_cost_raw',
  'Overtime Cost': 'ot_cost_raw',
  'Overtime pay': 'ot_cost_raw',
  'Overtime Pay': 'ot_cost_raw',
  'Total double': 'dt_hours_raw',
  'total double': 'dt_hours_raw',
  'Total Double': 'dt_hours_raw',
  'Double time': 'dt_hours_raw',
  'Double Time': 'dt_hours_raw',
  'double time': 'dt_hours_raw',
  'DT hours': 'dt_hours_raw',
  'DT Hours': 'dt_hours_raw',
  'dt hours': 'dt_hours_raw',
  'DT': 'dt_hours_raw',
  'dt': 'dt_hours_raw',
  'Double overtime': 'dt_hours_raw',
  'Double Overtime': 'dt_hours_raw',
  'DT cost': 'dt_cost_raw',
  'DT Cost': 'dt_cost_raw',
  'Double time cost': 'dt_cost_raw',
  'Double Time Cost': 'dt_cost_raw',
  'Benefits': 'benefits_cost_raw',
  'benefits': 'benefits_cost_raw',
  'Benefit': 'benefits_cost_raw',
  'benefit': 'benefits_cost_raw',
  'Total benefits': 'benefits_cost_raw',
  'Total Benefits': 'benefits_cost_raw',
  'Benefits cost': 'benefits_cost_raw',
  'Benefits Cost': 'benefits_cost_raw',
  'Benefits rate': 'benefits_rate_raw',
  'Benefits Rate': 'benefits_rate_raw',
  'Hourly rate (USD)': 'hourly_rate',
  hourly_rate: 'hourly_rate',
  rate: 'hourly_rate',
};

export const UploadModal: React.FC<UploadModalProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const { workOrders, laborRateCategories, reconciliationSummary } = useSelector((state: RootState) => state.db);
  const [uploadType, setUploadType] = useState<'work_orders' | 'invoices' | 'timesheet' | 'master'>('work_orders');
  const [errorList, setErrorList] = useState<{ row: number; field: string; message: string }[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setErrorList([]);
    setProgress(null);
    setSuccessCount(null);

    try {
      const rawData = await parseCSVAsync(file);
      setProgress({ current: 0, total: rawData.length });

      if (rawData.length > 0) {
        const firstRow = rawData[0];
        if (firstRow['Patient MRN'] !== undefined || firstRow['call_outcome'] !== undefined) {
          setErrorList([
            {
              row: 0,
              field: 'Schema Check',
              message: 'Rejected: Medical call-center operations log uploaded instead of core console tables.',
            },
          ]);
          setProgress(null);
          return;
        }

        if (uploadType === 'timesheet') {
          const hasTypeCol = firstRow['Type'] !== undefined || firstRow['type'] !== undefined;
          const hasHoursCol =
            firstRow['Shift hours'] !== undefined ||
            firstRow['shift_hours'] !== undefined ||
            firstRow['Hours'] !== undefined;

          if (!hasTypeCol && !hasHoursCol) {
            setErrorList([
              {
                row: 0,
                field: 'Workbook Check',
                message:
                  'Rejected: Please upload the All Employees Connecteam export sheet containing Type (WO#) and Shift hours columns.',
              },
            ]);
            setProgress(null);
            return;
          }
        }
      }

      let schema: any;
      if (uploadType === 'work_orders') {
        schema = WorkOrderSchema;
      } else if (uploadType === 'invoices') {
        schema = InvoiceSchema;
      } else if (uploadType === 'timesheet') {
        schema = LaborEntrySchema;
      } else {
        schema = MasterJoinedSchema;
      }

      const validRows: any[] = [];
      const errors: { row: number; field: string; message: string }[] = [];
      const allGfNames = new Set(workOrders.map((w: any) => w.general_foreman?.trim().toLowerCase()).filter(Boolean));
      const allForemanNames = new Set(workOrders.map((w: any) => w.foreman?.trim().toLowerCase()).filter(Boolean));

      rawData.forEach((row, idx) => {
        const normalizedRow: Record<string, any> = {};

        Object.keys(row).forEach((key) => {
          let normalizedKey = key.trim();

          if (normalizedKey.startsWith('_')) {
            normalizedKey = normalizedKey.slice(1);
          }

          if (uploadType === 'work_orders' || uploadType === 'master') {
            const lowerKey = normalizedKey.toLowerCase().replace(/[\s_-]+/g, '_');
            if (lowerKey === 'work_order_number' || lowerKey === 'work_order_#' || lowerKey === 'work_order' || lowerKey === 'wo_#' || lowerKey === 'wo_number' || lowerKey === 'wo') normalizedKey = 'work_order_number';
            else if (lowerKey === 'status' || lowerKey === 'work_order_status' || lowerKey === 'wo_status') normalizedKey = 'status';
            else if (lowerKey === 'general_foreman' || lowerKey === 'gf' || lowerKey === 'general_foreman_name') normalizedKey = 'general_foreman';
            else if (lowerKey === 'foreman' || lowerKey === 'crew_leader' || lowerKey === 'foreman_name') normalizedKey = 'foreman';
            else if (lowerKey === 'address' || lowerKey === 'location' || lowerKey === 'job_address' || lowerKey === 'street_address') normalizedKey = 'address';
            else if (lowerKey === 'area' || lowerKey === 'region' || lowerKey === 'territory') normalizedKey = 'area';
            else if (lowerKey === 'invoice_#' || lowerKey === 'invoice_number' || lowerKey === 'invoice') normalizedKey = 'invoice_number';
            else if (lowerKey === 'invoice_status') normalizedKey = 'invoice_status';
            else if (lowerKey === 'po_#' || lowerKey === 'po_number' || lowerKey === 'po') normalizedKey = 'po_number';
            else if (lowerKey === 'invoice_total' || (uploadType === 'master' && lowerKey === 'total')) normalizedKey = 'total';
            else if (lowerKey === 'invoice_created_date' || lowerKey === 'invoice_date' || (uploadType === 'master' && lowerKey === 'created_date')) normalizedKey = 'created_date';
            else if (
              normalizedKey === 'Date Work Completed' ||
              normalizedKey === 'date_work_completed' ||
              normalizedKey === 'Completion Date' ||
              normalizedKey === 'completion_date' ||
              normalizedKey === 'Completed Date' ||
              normalizedKey === 'completed_date' ||
              normalizedKey === 'Fulcrum Completion Date' ||
              lowerKey === 'fulcrum_completion_date' ||
              lowerKey === 'date_work_completed'
            ) {
              normalizedKey = 'date_work_completed';
            }
          }

          if (uploadType === 'invoices') {
            const lowerKey = normalizedKey.toLowerCase();
            if (normalizedKey === 'Invoice #' || lowerKey === 'invoice_number' || lowerKey === 'invoice #' || lowerKey === 'invoice number' || lowerKey === 'invoice') normalizedKey = 'invoice_number';
            else if (normalizedKey === 'Created Date' || lowerKey === 'created date' || lowerKey === 'created_date' || lowerKey === 'date') normalizedKey = 'created_date';
            else if (normalizedKey === 'Status' || lowerKey === 'status' || lowerKey === 'invoice status') normalizedKey = 'status';
            else if (normalizedKey === 'PO #' || lowerKey === 'po #' || lowerKey === 'po_number' || lowerKey === 'po number' || lowerKey === 'po') normalizedKey = 'po_number';
            else if (normalizedKey === 'Total' || lowerKey === 'total' || lowerKey === 'amount' || lowerKey === 'invoice total' || lowerKey === 'invoice amount' || lowerKey === 'total amount') normalizedKey = 'total';
            else if (normalizedKey === 'Unanswered Comments' || lowerKey === 'unanswered comments' || lowerKey === 'unanswered_comments') normalizedKey = 'unanswered_comments';
            else if (normalizedKey === 'Dispute Reason' || lowerKey === 'dispute reason' || lowerKey === 'dispute_reason') normalizedKey = 'dispute_reason';
          }

          if (uploadType === 'timesheet') {
            if (TIMESHEET_HEADER_MAP[normalizedKey]) {
              normalizedKey = TIMESHEET_HEADER_MAP[normalizedKey];
            }
          }

          let value = row[key];
          if (typeof value === 'string') {
            value = value.trim();
          }
          normalizedRow[normalizedKey] = value;
        });

        if (uploadType === 'work_orders' || uploadType === 'master') {
          const rawWo = normalizedRow['work_order_number'] || normalizedRow['Work Order #'] || normalizedRow['WO #'] || normalizedRow['Work Order'];
          if (
            rawWo === null ||
            rawWo === undefined ||
            String(rawWo).trim() === '' ||
            String(rawWo).trim() === '0' ||
            String(rawWo).trim().toLowerCase() === 'null' ||
            String(rawWo).trim().toLowerCase() === 'undefined' ||
            String(rawWo).trim().toLowerCase() === 'n/a'
          ) {
            return; // Skip empty rows
          }
          normalizedRow['work_order_number'] = String(rawWo).trim();
        }

        if (uploadType === 'invoices') {
          const invNum = normalizedRow['invoice_number'] || normalizedRow['Invoice #'];
          if (
            invNum === null ||
            invNum === undefined ||
            String(invNum).trim() === '' ||
            String(invNum).trim() === '0' ||
            String(invNum).trim().toLowerCase() === 'null' ||
            String(invNum).trim().toLowerCase() === 'undefined' ||
            String(invNum).trim().toLowerCase() === 'n/a'
          ) {
            return; // Skip rows where invoice number is empty
          }
          normalizedRow['invoice_number'] = String(invNum).trim();
        }

        if (uploadType === 'timesheet') {
          const rawWo = normalizedRow['work_order_number'] || normalizedRow['Type'];
          if (!rawWo || rawWo === '0' || rawWo === '' || String(rawWo).toLowerCase().includes('no record')) {
            return;
          }

          const firstName = normalizedRow['employee_first_name'] || '';
          const lastName = normalizedRow['employee_last_name'] || '';
          const fullName = (firstName + ' ' + lastName).trim() || normalizedRow['employee_name'] || 'Field Employee';

          const shiftHours = parseHoursToDecimal(
            normalizedRow['shift_hours_raw'] || normalizedRow['shift_hours'] || normalizedRow['Hours'] || 0
          );
          const hourlyRate = parseFloat(normalizedRow['hourly_rate'] || normalizedRow['rate'] || 0);

          const otHours = normalizedRow['ot_hours_raw'] !== undefined
            ? parseHoursToDecimal(normalizedRow['ot_hours_raw'])
            : (shiftHours > 8 ? parseFloat((shiftHours - 8).toFixed(2)) : 0);

          const dtHours = normalizedRow['dt_hours_raw'] !== undefined
            ? parseHoursToDecimal(normalizedRow['dt_hours_raw'])
            : 0;

          const regularHours = normalizedRow['regular_hours_raw'] !== undefined
            ? parseHoursToDecimal(normalizedRow['regular_hours_raw'])
            : Math.max(0, parseFloat((shiftHours - otHours - dtHours).toFixed(2)));

          const regularCost = normalizedRow['regular_cost_raw'] !== undefined
            ? parseFloat(normalizedRow['regular_cost_raw']) || 0
            : parseFloat((regularHours * hourlyRate).toFixed(2));

          const otCost = normalizedRow['ot_cost_raw'] !== undefined
            ? parseFloat(normalizedRow['ot_cost_raw']) || 0
            : parseFloat((otHours * hourlyRate * 1.5).toFixed(2));

          const dtCost = normalizedRow['dt_cost_raw'] !== undefined
            ? parseFloat(normalizedRow['dt_cost_raw']) || 0
            : parseFloat((dtHours * hourlyRate * 2.0).toFixed(2));

          const activeCategories = laborRateCategories && laborRateCategories.length > 0 ? laborRateCategories : DEFAULT_LABOR_RATE_CATEGORIES;
          const parentWo = workOrders.find((w: any) => String(w.work_order_number).trim() === String(rawWo).trim());
          const roleCat = classifyLaborRole(
            hourlyRate,
            activeCategories,
            fullName,
            parentWo,
            allGfNames,
            allForemanNames
          );

          const roleBenefitsRate = normalizedRow['benefits_rate_raw'] !== undefined
            ? parseFloat(normalizedRow['benefits_rate_raw']) || 0
            : getLaborRoleBenefitsRate(roleCat, activeCategories);

          const benefitsCost = normalizedRow['benefits_cost_raw'] !== undefined
            ? parseFloat(normalizedRow['benefits_cost_raw']) || 0
            : parseFloat((shiftHours * roleBenefitsRate).toFixed(2));

          const calculatedTotalCost = parseFloat((regularCost + otCost + dtCost + benefitsCost).toFixed(2));
          const lineCost = normalizedRow['line_labor_cost_raw'] !== undefined
            ? parseFloat(normalizedRow['line_labor_cost_raw']) || 0
            : calculatedTotalCost;

          const rawStartDate = normalizedRow['start_date_raw'] || normalizedRow['shift_date_raw'] || normalizedRow['shift_date'];
          const rawEndDate = normalizedRow['end_date_raw'] || normalizedRow['start_date_raw'] || normalizedRow['shift_date_raw'] || normalizedRow['shift_date'];

          const parsedStartDate = parseExcelDate(rawStartDate) || (rawStartDate ? String(rawStartDate).trim() : null);
          const parsedEndDate = parseExcelDate(rawEndDate) || (rawEndDate ? String(rawEndDate).trim() : null);

          const fallbackDate = new Date().toISOString().split('T')[0];
          const finalStartDate = parsedStartDate || parsedEndDate || fallbackDate;
          const finalEndDate = parsedEndDate || parsedStartDate || fallbackDate;

          normalizedRow['work_order_number'] = String(rawWo).trim();
          normalizedRow['employee_name'] = fullName;
          normalizedRow['shift_hours'] = shiftHours;
          normalizedRow['hourly_rate'] = hourlyRate;
          normalizedRow['ot_hours'] = otHours;
          normalizedRow['ot_cost'] = otCost;
          normalizedRow['dt_hours'] = dtHours;
          normalizedRow['dt_cost'] = dtCost;
          normalizedRow['benefits_rate'] = roleBenefitsRate;
          normalizedRow['benefits_cost'] = benefitsCost;
          normalizedRow['line_labor_cost'] = lineCost;
          normalizedRow['start_date'] = finalStartDate;
          normalizedRow['end_date'] = finalEndDate;
          normalizedRow['shift_date'] = finalStartDate;
          normalizedRow['clock_in'] = normalizedRow['clock_in'] || null;
          normalizedRow['clock_out'] = normalizedRow['clock_out'] || null;
          normalizedRow['role_category'] = roleCat;
        }

        const parsed = schema.safeParse(normalizedRow);
        if (parsed.success) {
          validRows.push(parsed.data);
        } else {
          const err = parsed.error as any;
          if (err && err.issues) {
            err.issues.forEach((e: any) => {
              errors.push({
                row: idx + 1,
                field: e.path.join('.'),
                message: e.message,
              });
            });
          }
        }
        setProgress({ current: idx + 1, total: rawData.length });
      });

      if (errors.length > 0) {
        setErrorList(errors);
      } else {
        if (uploadType === 'work_orders') {
          await dispatch(uploadWorkOrdersThunk(validRows) as any).unwrap();
        } else if (uploadType === 'invoices') {
          await dispatch(uploadInvoicesThunk(validRows) as any).unwrap();
        } else if (uploadType === 'timesheet') {
          await dispatch(uploadTimesheetThunk(validRows) as any).unwrap();
        } else {
          await dispatch(uploadJoinedMasterThunk(validRows) as any).unwrap();
        }
        setSuccessCount(validRows.length);
      }
    } catch (err: any) {
      setErrorList([
        {
          row: 0,
          field: 'Persist DB',
          message: err.message || 'Failed to sync to Supabase database.',
        },
      ]);
    } finally {
      setProgress(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  return (
    React.createElement('div', { className: 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4' },
      React.createElement('div', { className: 'bg-white rounded-2xl max-w-xl w-full p-0 shadow-2xl overflow-hidden flex flex-col border border-slate-100' },
        React.createElement('div', { className: 'flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50' },
          React.createElement('div', null,
            React.createElement('h3', { className: 'text-base font-bold text-slate-800' }, 'Upload Console Datasets'),
            React.createElement('p', { className: 'text-xs text-slate-400 mt-0.5' }, 'Select table schema and upload standard CSV data')
          ),
          React.createElement('button', {
            onClick: onClose,
            className: 'text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors'
          },
            React.createElement(X, { className: 'w-5 h-5' })
          )
        ),
        React.createElement('div', { className: 'p-6 space-y-6' },
          React.createElement('div', { className: 'grid grid-cols-4 gap-2' },
            React.createElement('button', {
              onClick: () => setUploadType('work_orders'),
              className: 'py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'work_orders' ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            }, 'Work Orders'),
            React.createElement('button', {
              onClick: () => setUploadType('invoices'),
              className: 'py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'invoices' ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            }, 'Invoices'),
            React.createElement('button', {
              onClick: () => setUploadType('timesheet'),
              className: 'py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'timesheet' ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            },
              React.createElement('span', { className: 'flex items-center justify-center gap-1' },
                React.createElement(Clock, { className: 'w-3 h-3 text-purple-600' }),
                React.createElement('span', null, 'Timesheet')
              )
            ),
            React.createElement('button', {
              onClick: () => setUploadType('master'),
              className: 'py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'master' ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            }, 'Master Joined')
          ),
          React.createElement('div', {
            ...getRootProps(),
            className: 'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ' +
              (isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50')
          },
            React.createElement('input', { ...getInputProps() }),
            React.createElement(UploadCloud, { className: 'w-10 h-10 text-slate-400 mb-3' }),
            React.createElement('p', { className: 'text-sm font-semibold text-slate-700' }, 'Drag & drop your ' + uploadType.replace('_', ' ') + ' CSV file here'),
            React.createElement('p', { className: 'text-xs text-slate-400 mt-1' }, 'or click to browse from device')
          ),
          progress && React.createElement('div', { className: 'flex items-center gap-2.5 p-3.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-xs font-mono' },
            React.createElement('span', { className: 'animate-pulse' }, 'Processing...'),
            React.createElement('span', null, progress.current + ' / ' + progress.total + ' rows completed')
          ),
          successCount !== null && React.createElement('div', { className: 'space-y-3' },
            React.createElement('div', { className: 'flex items-center gap-2.5 p-3.5 bg-green-50 rounded-xl border border-green-100 text-green-800 text-xs font-medium' },
              React.createElement(CheckCircle, { className: 'w-4 h-4 text-green-600 shrink-0' }),
              React.createElement('span', null, 'Successfully parsed and saved ' + successCount + ' rows.')
            ),
            reconciliationSummary && React.createElement('div', { className: 'p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2 text-xs text-purple-900' },
              React.createElement('div', { className: 'flex items-center gap-1.5 font-bold uppercase tracking-wide text-purple-700 text-[11px]' },
                React.createElement(ArrowRight, { className: 'w-3.5 h-3.5' }),
                React.createElement('span', null, 'Scoped Reconciliation Summary')
              ),
              React.createElement('p', { className: 'text-slate-700 leading-relaxed font-medium' },
                React.createElement('span', { className: 'font-bold text-purple-800' }, reconciliationSummary.rowsAdded),
                ' rows processed affecting ',
                React.createElement('span', { className: 'font-bold text-slate-900' }, reconciliationSummary.affectedWorkOrdersCount),
                ' work orders.'
              ),
              React.createElement('div', { className: 'flex flex-wrap gap-2 pt-1 font-mono text-[11px]' },
                React.createElement('span', { className: 'px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-200' },
                  reconciliationSummary.movedToMarginCalculated + ' ready with margin calculated'
                ),
                React.createElement('span', { className: 'px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold border border-amber-200' },
                  reconciliationSummary.movedToAwaitingLabor + ' awaiting labor data'
                )
              )
            )
          ),
          errorList.length > 0 && React.createElement('div', { className: 'space-y-3' },
            React.createElement('div', { className: 'flex items-center gap-2 text-red-600 font-semibold text-xs' },
              React.createElement(AlertCircle, { className: 'w-4 h-4' }),
              React.createElement('span', null, 'Schema validation failed: ' + errorList.length + ' error(s) found')
            ),
            React.createElement('div', { className: 'border border-red-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto font-mono text-[10px]' },
              React.createElement('table', { className: 'w-full text-left bg-red-50/50' },
                React.createElement('thead', { className: 'bg-red-100/50 text-red-800' },
                  React.createElement('tr', null,
                    React.createElement('th', { className: 'p-2' }, 'Row'),
                    React.createElement('th', { className: 'p-2' }, 'Field'),
                    React.createElement('th', { className: 'p-2' }, 'Error message')
                  )
                ),
                React.createElement('tbody', { className: 'divide-y divide-red-100' },
                  errorList.map((err, i) =>
                    React.createElement('tr', { key: i, className: 'text-red-900' },
                      React.createElement('td', { className: 'p-2' }, err.row),
                      React.createElement('td', { className: 'p-2 font-bold' }, err.field),
                      React.createElement('td', { className: 'p-2' }, err.message)
                    )
                  )
                )
              )
            )
          )
        ),
        React.createElement('div', { className: 'px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs' },
          React.createElement('span', { className: 'text-slate-500 font-medium' }, 'Download sample template:'),
          React.createElement('div', { className: 'flex flex-wrap gap-2' },
            React.createElement('button', {
              onClick: downloadWorkOrderTemplate,
              className: 'flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm font-semibold text-slate-700'
            },
              React.createElement(FileText, { className: 'w-3.5 h-3.5 text-slate-400' }),
              React.createElement('span', null, 'Work Order')
            ),
            React.createElement('button', {
              onClick: downloadInvoiceTemplate,
              className: 'flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm font-semibold text-slate-700'
            },
              React.createElement(FileText, { className: 'w-3.5 h-3.5 text-slate-400' }),
              React.createElement('span', null, 'Invoice')
            ),
            React.createElement('button', {
              onClick: downloadTimesheetTemplate,
              className: 'flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer shadow-sm font-semibold text-purple-700'
            },
              React.createElement(Clock, { className: 'w-3.5 h-3.5 text-purple-500' }),
              React.createElement('span', null, 'Timesheet')
            )
          )
        )
      )
    )
  );
};
export default UploadModal;

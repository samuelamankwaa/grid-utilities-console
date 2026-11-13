import { describe, expect, it } from 'vitest';
import { formatWorkOrderForUpload, getInvoiceDate, normalizeDateForStorage, parseExcelDate, withDerivedCompletionDate } from './helpers';

describe('parseExcelDate', () => {
  it.each([
    [46212, '2026-07-09'], // Excel serial (Coupa "Created Date")
    ['46212', '2026-07-09'], // serial saved as text in a TEXT column
    [46212.75, '2026-07-09'], // serial with time of day
    ['2026-08-20', '2026-08-20'],
    ['2026-08-20 00:00:00', '2026-08-20'], // previously shifted to 08-19 east of UTC
    ['2026-08-20T23:30:00Z', '2026-08-20'],
    ['2026/08/20', '2026-08-20'],
    ['8/20/2026', '2026-08-20'], // previously 08-19 in Asia/Karachi
    ['08/20/2026 10:30', '2026-08-20'],
    ['8/20/26', '2026-08-20'],
    ['20/08/2026', '2026-08-20'], // day-first when unambiguous (previously null)
    ['Aug 20, 2026', '2026-08-20'],
  ])('%j -> %s', (input, expected) => {
    expect(parseExcelDate(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'not a date', '2026-02-30', '13/13/2026', 0, 42])('%j -> null', (input) => {
    expect(parseExcelDate(input)).toBeNull();
  });
});

describe('normalizeDateForStorage', () => {
  it('stores recognised dates as YYYY-MM-DD and keeps unrecognised text', () => {
    expect(normalizeDateForStorage(46212)).toBe('2026-07-09');
    expect(normalizeDateForStorage('8/20/2026')).toBe('2026-08-20');
    expect(normalizeDateForStorage('pending')).toBe('pending');
    expect(normalizeDateForStorage('')).toBeNull();
  });
});

describe('work order completion date', () => {
  it('stores only the real completion date from the file, never a guessed one', () => {
    const wo = formatWorkOrderForUpload({ work_order_number: '1', status: 'Ready to Bill', customer_need_date: '8/1/2026' });
    expect(wo.date_work_completed).toBeNull();
    expect(formatWorkOrderForUpload({ work_order_number: '2', status: 'Ready to Bill', date_work_completed: '46212' }).date_work_completed).toBe('2026-07-09');
  });

  it('applies the need-date fallback in memory for completed work orders only', () => {
    expect(withDerivedCompletionDate({ status: 'Ready to Bill', date_work_completed: null, customer_need_date: '2026-08-01' }).date_work_completed).toBe('2026-08-01');
    expect(withDerivedCompletionDate({ status: 'Work Pending', date_work_completed: null, customer_need_date: '2026-08-01' }).date_work_completed).toBeNull();
    expect(withDerivedCompletionDate({ status: 'Ready to Bill', date_work_completed: '2026-07-09', customer_need_date: '2026-08-01' }).date_work_completed).toBe('2026-07-09');
  });
});

describe('getInvoiceDate', () => {
  it('uses created_date, including legacy serial strings already in the database', () => {
    expect(getInvoiceDate({ created_date: '46212' })).toBe('2026-07-09');
    expect(getInvoiceDate({ created_date: null, created_at: '2026-08-20T03:00:00+00:00' })).toBe('2026-08-20');
  });
});

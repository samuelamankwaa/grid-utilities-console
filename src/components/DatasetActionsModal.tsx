import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { clearUploadedDatasetsThunk } from '../store/dbSlice';
import { resetFilters } from '../store/filtersSlice';
import type { AppDispatch, RootState } from '../store/store';

export function DatasetActionsModal({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const { currentUser, previewRole } = useSelector((state: RootState) => state.auth);
  const isLoading = useSelector((state: RootState) => state.db.status === 'loading');
  const role = previewRole ?? currentUser?.role;
  const canClear = role === 'Supervisor' || role === 'Admin';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = () => dialogRef.current?.close();

  const clearData = async () => {
    setClearing(true);
    setError(null);
    try {
      await dispatch(clearUploadedDatasetsThunk()).unwrap();
      dispatch(resetFilters());
      setConfirming(false);
      setCleared(true);
    } catch (error) {
      setError((error as { message?: string })?.message ?? 'Could not clear uploaded data.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dataset-actions-title"
      aria-describedby={confirming ? 'dataset-actions-warning' : undefined}
      onClose={onClose}
      onCancel={(event) => {
        if (clearing) event.preventDefault();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
    >
      <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <h2 id="dataset-actions-title" className="text-base font-bold">
          {confirming ? 'Clear all uploaded data?' : 'Data Actions'}
        </h2>
        <button type="button" aria-label="Close" disabled={clearing} onClick={close}
          className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="space-y-4 p-6">
        {confirming && (
          <p id="dataset-actions-warning" className="text-sm leading-relaxed text-slate-700">
            This permanently deletes all uploaded work orders, invoices, and Connecteam timesheets for everyone using this console.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {cleared && <p role="status" className="text-sm text-emerald-700">All uploaded data was cleared.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {confirming ? (
            <button key="cancel" type="button" autoFocus disabled={clearing}
              onClick={() => { setConfirming(false); setError(null); }}
              className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
          ) : (
            <button key="reset" type="button" autoFocus onClick={() => { dispatch(resetFilters()); close(); }}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" /> Reset Filters
            </button>
          )}
          {canClear && !cleared && (
            <button type="button" disabled={clearing || isLoading}
              onClick={confirming ? clearData : () => setConfirming(true)}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" /> {clearing ? 'Clearing…' : confirming ? 'Confirm Deletion' : 'Clear All Data'}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

import { useCallback } from 'react';

import { useToast } from '../../ui';
import { useDeleteVideos, type DeleteVideos } from './useDeleteVideos';

export type ToastedDeletionOptions = {
  /** Runs after the "deleted" toast, e.g. leave selection mode or navigate back. */
  onDeleted?: () => void;
  /** Runs after the "kept" toast (the OS dialog was dismissed). */
  onKept?: () => void;
};

/**
 * `useDeleteVideos` with the standard toast wording every screen uses — success, kept, and danger
 * tones — so callers only say what happens *after* the outcome is reported.
 */
export function useToastedDeletion({
  onDeleted,
  onKept,
}: ToastedDeletionOptions = {}): DeleteVideos {
  const toast = useToast();

  // Stable handlers — `useDeleteVideos` rebuilds `remove` whenever these change, and inline
  // arrows here would defeat every memo downstream of the returned object.
  return useDeleteVideos({
    onDeleted: useCallback(
      (message: string) => {
        toast.show(message, 'success');
        onDeleted?.();
      },
      [onDeleted, toast]
    ),
    onKept: useCallback(
      (message: string) => {
        toast.show(message);
        onKept?.();
      },
      [onKept, toast]
    ),
    onFailed: useCallback(
      (message: string) => toast.show(message, 'danger'),
      [toast]
    ),
  });
}

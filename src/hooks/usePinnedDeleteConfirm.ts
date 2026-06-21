import { useCallback, useEffect, useState } from "react";

export function usePinnedDeleteConfirm(
  clipId: number,
  pinned: boolean,
  onDelete: () => void,
) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [clipId, pinned]);

  const cancelDelete = useCallback(() => {
    setConfirming(false);
  }, []);

  const requestDelete = useCallback(() => {
    if (!pinned) {
      onDelete();
      return;
    }
    if (confirming) {
      onDelete();
      setConfirming(false);
      return;
    }
    setConfirming(true);
  }, [pinned, confirming, onDelete]);

  return { confirming, requestDelete, cancelDelete };
}

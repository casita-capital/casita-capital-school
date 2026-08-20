import { useCallback, useRef, useState } from 'react';

export function usePopover<T = HTMLElement>() {
  const anchorRef = useRef<T | null>(null);
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return {
    anchorRef,
    handleClose,
    handleOpen,
    handleToggle,
    open,
  };
}

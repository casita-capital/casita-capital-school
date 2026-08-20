import { useCallback, useState } from 'react';

export function useDialog<T = unknown>() {
  const [state, setState] = useState<{ open: boolean; data?: T }>({
    open: false,
    data: undefined,
  });

  const handleOpen = useCallback((data?: T) => {
    setState({
      open: true,
      data,
    });
  }, []);

  const handleClose = useCallback(() => {
    setState({
      open: false,
      data: undefined,
    });
  }, []);

  return {
    data: state.data,
    handleClose,
    handleOpen,
    open: state.open,
  };
}

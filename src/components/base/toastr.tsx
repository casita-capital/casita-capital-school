'use client';

import { Toaster } from 'react-hot-toast';

export function Toastr() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#141923',
          color: '#f4f5f7',
          border: '1px solid #1e2530',
          borderRadius: '6px',
        },
      }}
    />
  );
}

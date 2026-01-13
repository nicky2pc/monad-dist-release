import { useState } from 'react';

export function useMintPopup() {
  const [open, setOpen] = useState(false);
  
  const openMintPopup = () => setOpen(true);
  const closeMintPopup = () => {
    setOpen(false);    
  };
  
  return {
    open,
    openMintPopup,
    closeMintPopup
  };
} 
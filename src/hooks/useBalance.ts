import { useState } from 'react';
import { getFormattedBalance } from '../game/utils.ts';

export const useBalance = () => {
  const [balance, setBalance] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const updateBalance = async (wallet: any) => {
    if (!wallet) {
      console.error("No wallet found for balance update");
      return null;
    }
    
    setIsLoading(true);
    try {
      const formattedBalance = await getFormattedBalance(wallet);
      setBalance(formattedBalance);
      setIsLoading(false);
      return formattedBalance;
    } catch (error) {
      console.error("Error updating balance:", error);
      setBalance("Error");
      setIsLoading(false);
      return null;
    }
  };

  return {
    balance,
    isLoading,
    updateBalance
  };
}; 
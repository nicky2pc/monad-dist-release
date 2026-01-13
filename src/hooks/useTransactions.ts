import { useState, useEffect } from 'react';
import { CONFIG } from '../game/config.ts';
import { Transaction, UpdateTransactionCallback } from '../types.ts';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { simulateContract, writeContract } from 'wagmi/actions';
import { config } from '../providers/FrameWalletProvider';
import { MINT_CONTRACT_ABI } from '../constants/ABI';

const TRANSACTIONS_UPDATED_EVENT = 'transactions-updated';

const dispatchTransactionsUpdated = (transactions: Transaction[]) => {
  const event = new CustomEvent(TRANSACTIONS_UPDATED_EVENT, { detail: transactions });
  window.dispatchEvent(event);
};

let globalTransactions: Transaction[] = (() => {
  const savedTransactions = localStorage.getItem("transactions");
  if (!savedTransactions) return [];

  let parsedTransactions = JSON.parse(savedTransactions);

  parsedTransactions = parsedTransactions.map(tx => 
    (!tx.link || tx.link === "Pending...") ? { ...tx, link: "Not processed" } : tx
  );

  localStorage.setItem("transactions", JSON.stringify(parsedTransactions));
  return parsedTransactions;
})();

const updateGlobalTransactions = (newTransactions: Transaction[]) => {
  globalTransactions = newTransactions;
  localStorage.setItem("transactions", JSON.stringify(globalTransactions));
  dispatchTransactionsUpdated(globalTransactions);
};

interface TransactionsHookReturn {
  transactions: Transaction[];
  handleTotalScore: (score: number, isDead?: boolean, username?: string) => void;
  clearTransactions: () => void;
  updateTransactions: (transaction: Transaction, callback: UpdateTransactionCallback) => void;
  handleWagmiMint: () => Promise<{
    status: string;
    url?: string;
    error: string;
  }>;
  isWritePending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  writeHash?: `0x${string}`;
  writeError: Error | null;
  waitError: Error | null;
}

export const useTransactions = (): TransactionsHookReturn => {
  const {isConnected, address} = useAccount();
  const { writeContract, isPending: isWritePending, data: writeHash, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: waitError } = useWaitForTransactionReceipt({
    hash: writeHash,
  });
  
  const [transactions, setTransactions] = useState<Transaction[]>(globalTransactions);

  useEffect(() => {
    const handleTransactionsUpdated = (event: CustomEvent<Transaction[]>) => {
      if (event.detail) {
        setTransactions([...event.detail]);
      } else {
        setTransactions([...globalTransactions]);
      }
    };

    window.addEventListener(TRANSACTIONS_UPDATED_EVENT, handleTransactionsUpdated as EventListener);
    
    setTransactions([...globalTransactions]);
    
    return () => {
      window.removeEventListener(TRANSACTIONS_UPDATED_EVENT, handleTransactionsUpdated as EventListener);
    };
  }, []);

  const updateTransactions = (transaction: Transaction, callback: UpdateTransactionCallback) => {
    const { id, type } = transaction;
    
    const updated = [transaction, ...globalTransactions];
    if (updated.length > CONFIG.MAX_TRANSACTIONS) {
      updated.length = CONFIG.MAX_TRANSACTIONS;
    }
    
    updateGlobalTransactions(updated);

    callback()
      .then((data) => {
        const updatedTransactions = globalTransactions.map(tx => {
          if (tx.id === id && tx.type === type) {
            if (tx.type === "Faucet") {
              if (data?.tx) {
                return {
                  ...tx,
                  type: `Faucet: ${data.mon} MON`,
                  link: `https://testnet.monadexplorer.com/tx/${data.tx}`,
                  date: Date.now(),
                  error: ""
                };
              } else if (data?.error) {
                const formatSeconds = (seconds: number) => {
                  const totalSeconds = Math.floor(seconds);
                  
                  if (totalSeconds >= 86400) {
                    const days = Math.floor(totalSeconds / 86400);
                    const hours = Math.floor((totalSeconds % 86400) / 3600);
                    return `${days}d ${hours}h`;
                  }
                  else if (totalSeconds >= 3600) {
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const remainingSeconds = totalSeconds % 60;
                    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                  } else {
                    const minutes = Math.floor(totalSeconds / 60);
                    const remainingSeconds = totalSeconds % 60;
                    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                  }
                };
                return {
                  ...tx,
                  link: "",
                  date: Date.now(),
                  error: data.error + (data?.deadline_seconds ? " " + formatSeconds(data?.deadline_seconds) + " left" : "")
                };
              }
            }
            
            return {
              ...tx,
              link: data?.url ?? tx.link,
              date: Date.now(),
              error: data?.error ?? tx.error
            };
          }
          return tx;
        });
        
        updateGlobalTransactions(updatedTransactions);
      })
      .catch(() => {
        const updatedTransactions = globalTransactions.map(tx =>
          tx.id === id && tx.type === type
            ? { ...tx, link: "", date: Date.now(), error: tx.error ? tx.error : "Unexpected error" }
            : tx
        );
        
        updateGlobalTransactions(updatedTransactions);
      });
  };


  const handleWagmiMint = async () => {
    const transaction: Transaction = {
      id: Date.now(),
      type: `Mint`,
      link: "Pending...",
      date: Date.now(),
      error: "",
      userAddress: address || ""
    };

    // Add transaction immediately with pending status
    const updated = [transaction, ...globalTransactions];
    if (updated.length > CONFIG.MAX_TRANSACTIONS) {
      updated.length = CONFIG.MAX_TRANSACTIONS;
    }
    updateGlobalTransactions(updated);

    try {
      const { request } = await simulateContract(config, {
        address: "0x5d44635D3FfeFf64973c018F7Eb76DC2b27c071c" as `0x${string}`,
        abi: MINT_CONTRACT_ABI,
        functionName: 'mint',
        args: [address],
        chainId: 10143,
      });
      
      const txHash = await writeContract(request);

      // Update transaction with hash immediately
      const updatedWithHash = globalTransactions.map(tx =>
        tx.id === transaction.id ? {
          ...tx,
          link: `https://testnet.monadexplorer.com/tx/${txHash}`,
        } : tx
      );
      updateGlobalTransactions(updatedWithHash);

      return {
        status: 'pending',
        url: `https://testnet.monadexplorer.com/tx/${txHash}`,
        error: ''
      };
    } catch (error) {
      // Update transaction with error
      const updatedWithError = globalTransactions.map(tx =>
        tx.id === transaction.id ? {
          ...tx,
          link: "",
          error: error instanceof Error ? error.message : "Transaction failed"
        } : tx
      );
      updateGlobalTransactions(updatedWithError);

      return {
        status: 'error',
        error: error instanceof Error ? error.message : "Transaction failed"
      };
    }
  };

  const handleTotalScore = (score: number, isDead = false, username?: string) => {
    const transaction: Transaction = {
      id: Date.now(),
      type: isDead ? `Death: ${score}` : `Kill: ${score}`,
      link: "Pending...",
      date: Date.now(),
      error: ""
    };

    updateTransactions(transaction, () => {
      return import('../game/utils.ts').then(m => m.sendTransactionAsGuest({score, isDead, username}))
    });
  };

  const clearTransactions = () => {
    updateGlobalTransactions([]);
  };

  return {
    transactions,
    handleTotalScore,
    updateTransactions,
    clearTransactions,
    handleWagmiMint,
    isWritePending,
    isConfirming,
    isConfirmed,
    writeHash,
    writeError,
    waitError
  };
}; 
import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { monadTestnet } from "wagmi/chains";
import { useTransactions } from '../../hooks/useTransactions';
import { sdk } from '@farcaster/frame-sdk';

interface MintButtonProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

// Helper function to detect user rejection errors
function isUserRejectionError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString();
  const errorMessageLower = errorMessage.toLowerCase();
  
  // Check for common user rejection error patterns
  return (
    errorMessageLower.includes('user rejected') ||
    errorMessageLower.includes('user denied') ||
    errorMessageLower.includes('rejected by user') ||
    errorMessageLower.includes('transaction declined') ||
    errorMessageLower.includes('transaction was rejected') ||
    errorMessageLower.includes('user cancelled') ||
    errorMessageLower.includes('user canceled') ||
    errorMessageLower.includes('action_rejected') ||
    (error.code && (error.code === 4001 || error.code === 'ACTION_REJECTED'))
  );
}

export function MintButton({ onSuccess, onError }: MintButtonProps) {
  const { isConnected, address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();
  const [isLoadingTxData, setIsLoadingTxData] = useState(false);
  const [userRejected, setUserRejected] = useState(false);
  const [chainMismatch, setChainMismatch] = useState(false);
  const [wasMinted, setWasMinted] = useState(false);
  const { updateTransactions, handleWagmiMint, writeHash, isWritePending, isConfirming, isConfirmed, writeError, waitError } = useTransactions();
  const MINT_CONTRACT_ADDRESS = "0x5d44635D3FfeFf64973c018F7Eb76DC2b27c071c";

  const isPending = isLoadingTxData || isWritePending || isConfirming;
  const successHandled = useRef(false);

  const targetChainId = monadTestnet.id;

  // Reset wasMinted when wallet connection status changes
  useEffect(() => {
    if (!isConnected) {
      console.log('👋 Wallet disconnected, resetting mint state');
      setWasMinted(false);
    }
  }, [isConnected]);

  // Reset user rejected state when user tries again
  useEffect(() => {
    if ((userRejected || chainMismatch) && !isPending) {
      const timer = setTimeout(() => {
        setUserRejected(false);
        setChainMismatch(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [userRejected, chainMismatch, isPending]);

  useEffect(() => {
    if (isConfirmed && !successHandled.current) {
      successHandled.current = true;
      onSuccess();
      successHandled.current = false;
    }
  }, [isConfirmed, onSuccess]);

  useEffect(() => {
    if (writeError || waitError) {
      const error = writeError || waitError;
      if (isUserRejectionError(error)) {
        setUserRejected(true);
      } else if (error?.message?.includes('chain') && error?.message?.includes('does not match')) {
        // Handle specific chain mismatch error
        setChainMismatch(true);
        console.error('Chain mismatch error:', error);
      } else {
        onError(error?.message || 'Transaction failed');
      }
    }
  }, [writeError, waitError, onError]);

  // Cleanup effect that runs when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up MintButton component state');
      setIsLoadingTxData(false);
      setUserRejected(false);
      setWasMinted(false);
      setChainMismatch(false);
      successHandled.current = false;
    };
  }, []);

  const handleMint = async () => {
    try {
      setIsLoadingTxData(true);
      console.log('💫 Starting mint process');
      successHandled.current = false;
      setUserRejected(false);
      setChainMismatch(false);

      if (!isConnected || !address) {
        console.log('🔌 No wallet connection, initiating connect');
        connect({ connector: farcasterFrame() });
        return;
      }

      // Always attempt to switch chain when minting, even if chain IDs appear to match
      // This helps ensure proper network connection with Farcaster Frame
      console.log(`🔄 Ensuring correct chain. Current: ${chainId}, Target: ${targetChainId}`);
      try {
        switchChain({ chainId: targetChainId });
        console.log('✅ Chain switch successful');
      } catch (error) {
        console.error('❌ Chain switch failed:', error);
        if (!isUserRejectionError(error)) {
          // If automatic switching fails, we'll still try to proceed
          // Frame wallet can sometimes accept transactions on the right chain
          // even if the connected chain appears different
          console.log('Proceeding with transaction despite chain switch failure');
        } else {
          setUserRejected(true);
          console.log('👤 User rejected chain switch');
          setIsLoadingTxData(false);
          return;
        }
      }

      console.log('🚀 Initiating mint transaction');
      await handleWagmiMint();
      setWasMinted(true);
    } catch (error) {
      console.error('❌ Transaction error:', error);
      if (isUserRejectionError(error)) {
        console.log("👤 User rejected transaction");
        setUserRejected(true);
        setWasMinted(false);
      } else if (error instanceof Error && error.message.includes('chain') && error.message.includes('does not match')) {
        // Handle chain mismatch errors specifically
        setChainMismatch(true);
        console.error('Chain mismatch detected:', error.message);
        setWasMinted(false);
      } else {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong during minting";
        console.error('💥 Error details:', errorMessage);
        onError(errorMessage);
        setWasMinted(false);
      }
    } finally {
      console.log('🏁 Mint process completed');
      setIsLoadingTxData(false);
    }
  };

  return (
    <>
      <button 
        className={`mint-button ${isPending ? 'disabled' : ''} ${userRejected ? 'rejected' : ''} ${chainMismatch ? 'chain-error' : ''}`}
        onClick={(writeHash && wasMinted && isConnected) ? () => sdk.actions.openUrl(`https://testnet.monadexplorer.com/tx/${writeHash}`) : handleMint}
        disabled={isPending}
      >
        {!isConnected 
          ? "Connect Wallet" 
          : chainId !== targetChainId 
            ? "Switch Network" 
            : isPending
              ? "Processing..." 
              : userRejected
                ? "Transaction Canceled" 
                : chainMismatch
                  ? "Network Mismatch" 
                  : (writeHash && wasMinted)
                    ? "View Transaction"
                    : "Mint Now"}
      </button>
    </>
  );
} 
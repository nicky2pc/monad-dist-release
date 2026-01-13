import * as React from "react";
import { useMiniAppContext } from "../../hooks/useMiniAppContext";
import { parseEther } from "viem";
import { monadTestnet } from "viem/chains";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";

const WagmiLoginBtn = () => {
  const { isEthProviderAvailable } = useMiniAppContext();
  const { isConnected, address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: hash, sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();

  return (
        isConnected ? (
          <button
          className="login-btn"
          onClick={() => disconnect()}
        >
          Logout
        </button>
        ) : (
          isEthProviderAvailable ?
          (
            <button
              className="login-btn"
              onClick={() => connect({ connector: farcasterFrame() })}
            >
              Login
            </button>
          ) :
          (
            <p className="text-sm text-left">
              Wallet connection only via Warpcast
            </p>
          )
        )
  );
}

export default WagmiLoginBtn;
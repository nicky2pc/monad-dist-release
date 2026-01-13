import React from 'react';
import {PrivyProvider} from '@privy-io/react-auth';

export default function PrivyWalletProvider({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId="cm7qn49t001cqd4xbdns54wk6"
      config={{
        supportedChains: [
          {
            id: 10143,
            name: "Monad Testnet",
            rpcUrls: {
              default: {
                http: ["https://testnet-rpc.monad.xyz"],
                webSocket: ["wss://testnet-rpc.monad.xyz"],
              },
              public: {
                http: ["https://testnet-rpc.monad.xyz"],
                webSocket: ["wss://testnet-rpc.monad.xyz"],
              },
              custom: {
                http: ["https://monad-testnet.g.alchemy.com/v2/QPrKqxYEAiWyGgR7CgIFflRKproMwXXQ"],
                webSocket: ["wss://monad-testnet.g.alchemy.com/v2/QPrKqxYEAiWyGgR7CgIFflRKproMwXXQ"],
              },
            },
            blockExplorers: {
              default: {
                name: "Monad Explorer",
                url: "https://testnet.monadexplorer.com",
              },
            },
            nativeCurrency: {
              name: "Monad",
              symbol: "MON",
              decimals: 18,
            },
          },
        ],
        mfa: {
          noPromptOnMfaRequired: true,
        },
        appearance: {
          theme: 'light',
          accentColor: '#6e54ff',
          logo: '',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
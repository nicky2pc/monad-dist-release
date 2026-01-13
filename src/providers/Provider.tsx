import React from 'react';
import { ProvidersProps } from '../types.ts';
import { FrameMultiplierProvider } from './FrameMultiplierProvider.tsx';
import { FrameProvider } from './FarcasterProvider.tsx';
export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
      <FrameProvider>
        <FrameMultiplierProvider>
          {children}
        </FrameMultiplierProvider>
      </FrameProvider>
  );
};

export default Providers; 
import React, { useEffect } from 'react';
import './App.css';
import Game from './components/Game/Game.tsx';
import { Providers } from './providers/Provider.tsx';
import { sdk } from '@farcaster/frame-sdk';


function App() {
  return (
    <div className="App">
      <Providers>
        <Game />
      </Providers>
    </div>
  );
}

export default App;

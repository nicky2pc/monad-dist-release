import React from 'react';
import './App.css';
// import Game from './components/Game/Game.tsx';
import WalletActions from './components/Debug/WalletActions.tsx';
import { Providers } from './providers/Provider.tsx';
import LoginBtn from './components/LoginBtn/LoginBtn.tsx';
function App() {
  return (
    <div className="App">
      <Providers>
        {/* <LoginBtn /> */}
        <WalletActions />
      </Providers>
    </div>
  );
}

export default App;

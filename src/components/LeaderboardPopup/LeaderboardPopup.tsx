import React, { useState, useEffect } from 'react';
import { getLeaderBoard, getAuthLeaderBoard } from '../../game/utils.ts';
import { LeaderboardRecord, LeaderboardPopupProps, ApiError } from '../../types.ts';
import { useAccount } from 'wagmi';
const LeaderboardPopup: React.FC<LeaderboardPopupProps> = ({ isOpen, onClose }) => {
  const [guestLeaderboardData, setGuestLeaderboardData] = useState<LeaderboardRecord[]>([]);
  const [authLeaderboardData, setAuthLeaderboardData] = useState<LeaderboardRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'auth' | 'guest'>('auth');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const userId = localStorage.getItem("playerId") || "Unknown";
  const {address: userAddress, isConnected} = useAccount();
  const fetchAllLeaderboards = async () => {
    setIsLoading(true);
    setGuestErrorMessage(null);
    setAuthErrorMessage(null);
    
    try {
      const guestData = await getLeaderBoard();
      setGuestLeaderboardData(guestData);
    } catch (error) {
      if (error instanceof Error) {
        setGuestErrorMessage(error.message);
      } else if (typeof error === 'object' && error !== null) {
        const apiError = error as ApiError;
        setGuestErrorMessage(apiError.detail);
      } else {
        setGuestErrorMessage("Unknown error");
      }
    }
    
    try {
      const authData = await getAuthLeaderBoard();
      setAuthLeaderboardData(authData);
    } catch (error) {
      if (error instanceof Error) {
        setAuthErrorMessage(error.message);
      } else if (typeof error === 'object' && error !== null) {
        const apiError = error as ApiError;
        setAuthErrorMessage(apiError.detail);
      } else {
        setAuthErrorMessage("Unknown error");
      }
    }
    
    setIsLoading(false);
  };

  const fetchActiveLeaderboard = async () => {
    setIsLoading(true);
    
    if (activeTab === 'auth') {
      setAuthErrorMessage(null);
      try {
        const data = await getAuthLeaderBoard();
        setAuthLeaderboardData(data);
      } catch (error) {
        if (error instanceof Error) {
          setAuthErrorMessage(error.message);
        } else if (typeof error === 'object' && error !== null) {
          const apiError = error as ApiError;
          setAuthErrorMessage(apiError.detail);
        } else {
          setAuthErrorMessage("Unknown error");
        }
      }
    } else {
      setGuestErrorMessage(null);
      try {
        const data = await getLeaderBoard();
        setGuestLeaderboardData(data);
      } catch (error) {
        if (error instanceof Error) {
          setGuestErrorMessage(error.message);
        } else if (typeof error === 'object' && error !== null) {
          const apiError = error as ApiError;
          setGuestErrorMessage(apiError.detail);
        } else {
          setGuestErrorMessage("Unknown error");
        }
      }
    }
    
    setIsLoading(false);
  };
  useEffect(() => {
    if (!isConnected) {
      setActiveTab('guest');
    } else {
      setActiveTab('auth');
    }
  }, [isConnected])

  useEffect(() => {
   
    if (isOpen) {
      fetchAllLeaderboards();
    }
  }, [isOpen]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000); 
      })
      .catch(err => {
        console.error('Error copying text: ', err);
      });
  };

  if (!isOpen) return null;

  const currentLeaderboardData = activeTab === 'auth' ? authLeaderboardData : guestLeaderboardData;
  const currentErrorMessage = activeTab === 'auth' ? authErrorMessage : guestErrorMessage;

  const columnCount = activeTab === 'auth' ? 6 : 4;


  return (
    <div className="popup-overlay">
      <div className="popup-content" >
        <div className="popup-header">
          <h2>Leaderboard</h2>
        
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
        
        <div className="tabs">
          <button 
            className={`tab-button ${activeTab === 'auth' ? 'active' : ''}`} 
            onClick={() => setActiveTab('auth')}
          >
            Authorized players
          </button>
          <button 
            className={`tab-button ${activeTab === 'guest' ? 'active' : ''}`} 
            onClick={() => setActiveTab('guest')}
          >
            Guests
          </button>
        </div>
        
        <div className="table-wrapper" style={{ maxHeight: '700px', overflowY: 'auto' }}>
          <table className="transactions-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>Place</th>
                {
                  activeTab === 'auth' ? (
                    <th style={{ width: '20%' }}>X/Gmail</th>
                  ) : (
                    <th style={{ width: '25%' }}>Player ID</th>
                  )
                }
                
                <th style={{ width: '10%' }}>Score</th>
                {
                  activeTab === 'auth' && (
                    <th style={{ width: '15%' }}>All time score</th>
                  )
                }
                <th style={{ width: activeTab === 'auth' ? '50%' : '45%' }}>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {currentLeaderboardData.map((record, index) => {
                let playerId;
                let hashTx;
                if ( activeTab === 'auth' ) {
                  playerId = record.address;
                  hashTx = "https://testnet.monadexplorer.com/tx/" + record.hash_tx;
                } else {
                  playerId = record.id;
                  hashTx = record.url;
                }
                return (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    {
                      activeTab === 'auth' ? (
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.username ? (
                            record.username.startsWith('@') ? (
                              <a href={`https://x.com/${record.username.substring(1)}`} target="_blank" rel="noopener noreferrer">
                                {record.username}
                              </a>
                            ) : (
                              record.username
                            )
                          ) : "Unknown"}
                        </td>
                      ) : (
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(userId === playerId || userAddress === playerId) ? "You!🏆" : playerId}</td>
                      )
                    }
                    <td>{record.score}</td>
                    {
                      activeTab === 'auth' && (
                        <td>{record.total_score}</td>
                      )
                    }
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hashTx ? (
                        <a href={hashTx} target="_blank" rel="noopener noreferrer">
                          {hashTx}
                        </a>
                      ) : (
                        "Not processed"
                      )}
                    </td>
                  </tr>
                )
              })}
              {currentLeaderboardData.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={columnCount} style={{ textAlign: 'center', width: '100%' }}>
                    {currentErrorMessage || "No transactions to display"}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={columnCount} style={{ textAlign: 'center', width: '100%' }}>
                    Loading new transactions...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button className="refresh-button" onClick={fetchActiveLeaderboard} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
};

export default LeaderboardPopup; 
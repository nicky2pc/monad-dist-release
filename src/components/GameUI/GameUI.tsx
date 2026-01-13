import React from 'react';
import { GameUIProps } from '../../types.ts';
import './GameUI.css';

const GameUI: React.FC<GameUIProps> = ({
  killCount,
  buffTimerValue,
  soundBtnLabelOn,
  onSoundToggle,
  onStopGame,
  volume,
  onVolumeChange
}) => {
  return (
    <>
      <div className="game-ui-list kills-counter">
        <div className="game-ui">
          <div className="ui-counter">
            <span className="counter-label">Kills:</span>
            <span className="counter-value">{killCount}</span>
          </div>
        </div>
      </div>

      <div className="game-ui-list game-ui-list-bottom">
        
        {buffTimerValue ? (
          <div className="game-ui buff-timer">
            <div className="ui-counter">
              <span className="counter-label">Buff: </span>
              <span className="counter-value">{buffTimerValue}</span>
            </div>
          </div>
        ) : null}
          <div className="sound-setting">
            <button style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0, 0, 0, 0.3)",
              border: "none",
              padding: "8px 12px",
              borderRadius: "32px"
            }}>
              <span className="counter-label" style={{ color: "#fff" }}>
                🔊
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                style={{
                  width: "140px",
                  accentColor: "#6e54ff"
                }}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  onVolumeChange(value);
                  const audioElements = document.getElementsByTagName('audio');
                  Array.from(audioElements).forEach(audio => {
                    const baseVolume = parseFloat(audio.dataset.baseVolume || "0.05");
                    audio.volume = (value / 100) * baseVolume;
                  });
                }}
              />
            </button>
          </div>
        
          <div className="exit-setting">
            <button onClick={onStopGame}>
              <span className="counter-label">
                Stop
              </span>
            </button>
          </div>
        </div>
    </>
  );
};

export default GameUI; 
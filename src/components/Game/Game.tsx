import React, { useState, useRef, useEffect } from 'react';
import { CONFIG } from '../../game/config.ts';
import { Mondalak } from '../../game/classes/Mondalak.ts';
import { Bullet } from '../../game/classes/Bullet.ts';
import { GameState } from '../../types.ts';
import { Enemy } from '../../game/classes/Enemy.ts';
import { Heart } from '../../game/classes/Heart.ts';
import { Buff } from '../../game/classes/Heart.ts';
import createEnemy from '../../game/createEnemy.ts';
import { loadSounds, playRandomSound, playSound, getLeaderBoard, getAuthLeaderBoard } from '../../game/utils.ts';
import { useFrameMultiplier } from '../../providers/FrameMultiplierProvider.tsx';
import { useTransactions } from '../../hooks/useTransactions.ts';
import { useBalance } from '../../hooks/useBalance.ts';
import LeaderboardPopup from '../LeaderboardPopup/LeaderboardPopup.tsx';
import TransactionsTable from '../TransactionsTable/TransactionsTable.tsx';
import GameUI from '../GameUI/GameUI.tsx';
import LoginBtn from '../LoginBtn/LoginBtn.tsx';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import nipplejs, { JoystickManager, EventData, JoystickOutputData } from 'nipplejs';
import { useMintPopup } from '../../hooks/useMintPopup.ts';
import farcasterFrame from '@farcaster/frame-wagmi-connector';
import MintPopup from '../MintPopup/MintPopup.tsx';
import VConsole from 'vconsole';
import sdk from '@farcaster/frame-sdk';
import { useFrame } from '../../providers/FarcasterProvider.tsx';
import { isMobile } from 'react-device-detect';

//new VConsole();
const Game = () => {
  const {isConnected} = useAccount();
  const {connect} = useConnect();
  const { isSDKLoaded, isEthProviderAvailable, context, actions } = useFrame();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const explosions = useRef<{ x: number; y: number; frame: number, width: number, height: number }[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const playerTank = useRef<Mondalak | null>(null);
  const bullets = useRef<Bullet[]>([]);
  const isDead = useRef<boolean>(false);
  const audioPool = useRef<HTMLAudioElement[]>([]);
  const hearts = useRef<Heart[]>([]);
  const buffs = useRef<Buff[]>([]);
  const killCountRef = useRef<number>(0);
  const totalScoreRef = useRef<number>(0);
  const countdownRef = useRef<boolean>(false);
  const isSoundOn = useRef<boolean>(true);
  const buffTimerRef = useRef<NodeJS.Timeout | null>(null);
  const frameMultiplier = useFrameMultiplier(); 
  const { transactions, handleTotalScore, clearTransactions } = useTransactions();
  const joystickDirection = useRef<{ angle: number; force: number }>({ angle: 0, force: 0 });
  const { open, openMintPopup, closeMintPopup } = useMintPopup();
  const joystickRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<JoystickManager | null>(null);
  const shootingRef = useRef<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simulatedFullscreen, setSimulatedFullscreen] = useState(false);
  const [currentBodyScale, setCurrentBodyScale] = useState(1);

  // Define gameState here at the top with other state declarations
  const [gameState, setGameState] = useState<GameState>('menu');
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [sounds, setSounds] = useState<{ [key: string]: HTMLAudioElement[] } | null>(null);
  const [soundBtnLabelOn, setSoundBtnLabelOn] = useState(true);
  const [volume, setVolume] = useState(100);
  const volumeRef = useRef<number>(100);
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [buffTimerValue, setBuffTimerValue] = useState<number>(0);
  const [isStartButtonDisabled, setIsStartButtonDisabled] = useState(true);
  const [warpcastShareLoading, setWarpcastShareLoading] = useState(false);
  const [gameStat, setGameStat] = useState({
    totalScore: 0,
    killCount: 0,
    fireMondalakKillKount: 0,
    damageTaken: 0,
    damageGiven: 0,
    healsUsed: 0,
    buffsTaken: 0
  });
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  const [explosionFrames, setExplosionFrames] = useState<HTMLImageElement[]>([]);
  const bulletPoolRef = useRef<Bullet[]>([]);

  const isMobileDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    return (
      isMobile ||
      /iPhone|iPod|iPad|Android|BlackBerry|Opera Mini|IEMobile/i.test(userAgent) ||
      window.matchMedia('(pointer: coarse)').matches
    );
  };

  // Get the current scale applied to the body through CSS media queries
  const detectBodyScale = () => {
    const computedStyle = window.getComputedStyle(document.body);
    const transform = computedStyle.transform || computedStyle.webkitTransform;
    if (transform !== 'none') {
      const matrix = transform.match(/matrix\(([^)]+)\)/);
      if (matrix) {
        const values = matrix[1].split(',');
        // Scale factor is in position 0 of the matrix
        return parseFloat(values[0]);
      }
    }
    return 1; // Default scale if not transformed
  };

  // Update scale value when window resizes
  useEffect(() => {
    const updateBodyScale = () => {
      const scale = detectBodyScale();
      setCurrentBodyScale(scale);
    };

    updateBodyScale(); // Initial detection
    window.addEventListener('resize', updateBodyScale);
    
    return () => {
      window.removeEventListener('resize', updateBodyScale);
    };
  }, []);

  // Apply body scaling override when in simulated fullscreen
  useEffect(() => {
    if (simulatedFullscreen) {
      // Save the original body style
      document.body.classList.add('fullscreen');
      // Override body scaling
      return () => {
        // Restore original body style when exiting fullscreen
        document.body.classList.remove('fullscreen');
      };
    }
  }, [simulatedFullscreen]);

  const toggleFullscreen = () => {
    try {
      // Check if we're in a Farcaster Frame or other restricted context
      const isFrameRestricted = window.self !== window.top || !document.fullscreenEnabled;
      
      if (isFrameRestricted) {
        // Use simulated fullscreen
        setSimulatedFullscreen(!simulatedFullscreen);
        setIsFullscreen(!simulatedFullscreen);
        console.log('Using simulated fullscreen mode due to frame restrictions');
      } else {
        // Use native fullscreen API
        if (!document.fullscreenElement) {
          // Enter fullscreen
          if (gameContainerRef.current?.requestFullscreen) {
            gameContainerRef.current.requestFullscreen()
              .catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
                // Fallback to simulated fullscreen
                setSimulatedFullscreen(true);
                setIsFullscreen(true);
              });
          }
        } else {
          // Exit fullscreen
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      // Fallback to simulated mode
      setSimulatedFullscreen(!simulatedFullscreen);
      setIsFullscreen(!simulatedFullscreen);
    }
  };

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNativeFullscreen || simulatedFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [simulatedFullscreen]);

  const cleanupJoystickElements = () => {
    // First try to clean via the manager if it exists
    if (managerRef.current) {
      try {
        console.log('Destroying joystick via manager');
        managerRef.current.destroy();
        managerRef.current = null;
      } catch (e) {
        console.error('Error destroying joystick via manager:', e);
      }
    }
    
    // Then do a DOM-level cleanup to be extra thorough
    const nippleElements = document.getElementsByClassName('nipple');
    console.log(`Found ${nippleElements.length} nipple elements in DOM`);
    
    // Convert to array to avoid live collection issues when removing elements
    const elementsToRemove = Array.from(nippleElements);
    elementsToRemove.forEach((el, index) => {
      console.log(`Removing nipple element ${index + 1}/${elementsToRemove.length}`);
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    // Look for any other joystick-related elements that might be hanging around
    const possibleJoystickClasses = ['front', 'back', 'collection', 'nipple'];
    possibleJoystickClasses.forEach(className => {
      const elements = document.getElementsByClassName(className);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} additional '${className}' elements`);
        Array.from(elements).forEach(el => {
          if (el.classList.contains('nipple') || el.parentElement?.classList.contains('nipple')) {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }
        });
      }
    });
    
    // Verify cleanup was successful
    const remainingElements = document.getElementsByClassName('nipple');
    if (remainingElements.length > 0) {
      console.warn(`Still found ${remainingElements.length} nipple elements after cleanup`);
    } else {
      console.log('Joystick cleanup successful, no elements remaining');
    }
  };

  const initJoystick = () => {
    // Clean up any existing joystick elements first
    cleanupJoystickElements();

    // Wait a moment to ensure DOM is ready
    setTimeout(() => {
      const zone = document.getElementById('zone');
      if (!zone) {
        console.warn('Zone element not found for joystick');
        return;
      }

      console.log('Initializing joystick, fullscreen:', isFullscreen);
      try {
        // Check one more time before creating to ensure no elements exist
        const existingElements = document.getElementsByClassName('nipple');
        if (existingElements.length > 0) {
          console.warn(`Found ${existingElements.length} nipple elements right before creation, cleaning again`);
          cleanupJoystickElements();
        }
        
        managerRef.current = nipplejs.create({
          zone,
          mode: 'static',
          position: { left: '0%', top: '0%' },
          color: '#7663e0',
          size: 200,
        });

        managerRef.current.on('move', (evt: EventData, data: JoystickOutputData) => {
          if (data.angle?.degree) {
            joystickDirection.current = {
              angle: data.angle.degree,
              force: data.force || 1,
            };
          }
        });

        managerRef.current.on('end', () => {
          joystickDirection.current = { angle: 0, force: 0 };
        });
        
        // Verify only one joystick exists
        const joystickElements = document.getElementsByClassName('nipple');
        console.log(`After creation, found ${joystickElements.length} joystick elements`);
        
        console.log('Joystick successfully initialized');
      } catch (e) {
        console.error('Error initializing joystick:', e);
      }
    }, 250); // Slightly longer delay
  };

  useEffect(() => {
    const init = async () => {
      await sdk.actions.ready({ disableNativeGestures: true });
      console.log('SDK ready');
      if (isMobileDevice()) {
        // Initial joystick setup - no need to call initJoystick() here
        // We'll handle it in the fullscreen effect below
      }
    };
  
    init();
  
    return () => {
      if (managerRef.current) {
        console.log('Destroying nipplejs on component unmount');
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, []);

  // Handle joystick initialization/reinitialization when fullscreen changes
  useEffect(() => {
    // Only initialize joystick if in mobile and game is playing
    if (isMobileDevice() && gameState === 'playing') {
      console.log('Fullscreen changed, reinitializing joystick');
      cleanupJoystickElements();
      initJoystick();
    }
    
    return () => {
      cleanupJoystickElements();
    };
  }, [isFullscreen, gameState]);
  
  // Clean old joysticks when game state changes
  useEffect(() => {
    if (gameState !== 'playing') {
      console.log('Game state changed, cleaning up joystick');
      cleanupJoystickElements();
    } else if (gameState === 'playing' && isMobileDevice()) {
      console.log('Game state changed to playing, initializing joystick');
      cleanupJoystickElements();
      initJoystick();
    }
  }, [gameState]);

  type ImageCache = {
    enemies: {
      [key: string]: HTMLImageElement;
    }
    fire: {
      [key: string]: HTMLImageElement;
    }
    player: {
      [key: string]: HTMLImageElement;
    };
  };
  
  const imageCache = {
    enemies: {},  
    fire: {},
    player: {}
  } as ImageCache;

  const imageCacheRef = useRef<ImageCache>({
    enemies: {},
    fire: {},
    player: {},
  });  

  const updateGameStat = (
    key: keyof typeof gameStat,
    value: number | ((prev: number) => number)
  ) => {
    setGameStat(prev => ({
      ...prev,
      [key]: typeof value === "function" ? (value as (prev: number) => number)(prev[key]) : value
    }));
  };

  const startCountdown = () => {
    setGameState('countdown');
    countdownRef.current = true;
    setCountdownValue(3);

    let counter = 3;
    const countdownInterval = setInterval(() => {
      counter--;
      setCountdownValue(counter);

      if (counter <= 0) {
        clearInterval(countdownInterval);
        countdownRef.current = false;
        setGameState('playing');
      }
    }, 1000);
  };

  const startBuffTimer = (number: number, playerTank: React.RefObject<{ isBuffed: boolean }>) => {
    if (!playerTank.current || gameState !== "playing") return;

    setBuffTimerValue(number);
    playerTank.current.isBuffed = true;

    if (buffTimerRef.current) {
      clearInterval(buffTimerRef.current);
    }

    let counter = number;

    const buffCountDown = setInterval(() => {
      counter--;
      setBuffTimerValue(counter);

      if (counter <= 0) {
        clearInterval(buffCountDown);
        buffTimerRef.current = null;
        if (playerTank.current) {
          playerTank.current.isBuffed = false;
        }
      }
    }, 1000);

    buffTimerRef.current = buffCountDown;
  };

  const preloadImages = async () => {
    const imageCacheEnemies = {
      "default": [
        "/chars/10.svg",
        "/chars/11.svg",
        "/chars/12.svg",
        "/chars/13.svg",
        "/chars/14.svg",
      ],
    };
    const imageCacheFire = {
      "fire": ["/chars/8.svg"]
    };
  
    const imageCachePlayer = {
      "main": ["/chars/15.svg"]
    };
  
    const loadImage = (src: string) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    };
  
    const enemyImages = await Promise.all(
      Object.entries(imageCacheEnemies).flatMap(([key, srcList]) =>
        srcList.map(async (src, index) => {
          const img = await loadImage(src);
          imageCache.enemies[index] = img;
        })
      )
    );

    const enemyFireImages = await Promise.all(
      Object.entries(imageCacheFire).flatMap(([key, srcList]) =>
        srcList.map(async (src, index) => {
          const img = await loadImage(src);
          imageCache.fire[index] = img;
        })
      )
    );
  
    const playerImages = await Promise.all(
      Object.entries(imageCachePlayer).flatMap(([key, srcList]) =>
        srcList.map(async (src, index) => {
          const img = await loadImage(src);
          imageCache.player[index] =  img;
        })
      )
    );
  
    const explosionFramesArr = await Promise.all(
      Array.from({ length: 151 - 16 + 1 }, (_, i) => 16 + i).map(async (i) => {
        const img = await loadImage(`/explotion/frame(${i}).png`);
        return img;
      })
    );
  
    setExplosionFrames(explosionFramesArr);
    imageCacheRef.current = imageCache;
  };

  const toggleSound = () => {
    setSoundBtnLabelOn(!isSoundOn.current)
    isSoundOn.current = !isSoundOn.current;
  };

  const resetGameObjects = () => {
    playerTank.current = new Mondalak(
      canvasRef.current!.width / 2,
      canvasRef.current!.width / 2,
      true,
      CONFIG.BULLET_SPEED,
      CONFIG.FIRE_RATE,
      "#c005c7",
      "main",
      imageCacheRef.current.player[0]
    );

    bullets.current = [];
    hearts.current = [];
    buffs.current = [];
    buffTimerRef.current = null;

    updateGameStat("killCount", 0);
    updateGameStat("fireMondalakKillKount", 0);
    updateGameStat("damageTaken", 0);
    updateGameStat("damageGiven", 0);
    updateGameStat("totalScore", 0);
    updateGameStat("healsUsed", 0);
    updateGameStat("buffsTaken", 0);

    setBuffTimerValue(0);
    killCountRef.current = 0;
    totalScoreRef.current = 0;

    isDead.current = false;
    audioPool.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioPool.current = [];

    if (gameState === "countdown") {
      enemies.current = [];
      spawnEnemies(0);
    }

    if (bulletPoolRef.current.length === 0) {
      for (let i = 0; i < 50; i++) {
        bulletPoolRef.current.push(new Bullet(0, 0, 0, 0, '', 0, false, 0, ''));
      }
    }
  };

  const spawnEnemies = (killCount) => {
    if (!killCount) {
      createEnemy(enemies.current, 1, true, "default", frameMultiplier, imageCacheRef.current);
      return;
    }

    const maxEnemiesAllowed = Math.min(CONFIG.MAX_ENEMIES_BEGINNING + Math.floor(killCount / 10), CONFIG.MAX_ENEMIES);

    if (enemies.current.length < maxEnemiesAllowed) {
      const enemiesToSpawn = maxEnemiesAllowed - enemies.current.length;

      for (let i = 0; i < enemiesToSpawn; i++) {
        const spawnDelay = 150 + Math.random() * (430 - 150);
        setTimeout(() => {
          if (enemies.current.length < maxEnemiesAllowed) {
            const enemyType = Math.random() < 0.05 ? "fire" : "default";
            const difficulty = Math.min(Math.floor(killCount / 10), 10);
            const adjustedDifficulty = enemyType === "fire" ? difficulty * 10 : difficulty;
            enemies.current = createEnemy(enemies.current, adjustedDifficulty, false, enemyType, frameMultiplier, imageCacheRef.current);
          }
        }, spawnDelay);
      }
    }
  };

  const handleStopGame = async () => {
    const totalScore = totalScoreRef.current;
    handleTotalScore(totalScore, true, context?.user?.username);
    setGameState("gameover");
    if (totalScore > 1) {
      openMintPopup();
    }
  }

  useEffect(() => {
      loadSounds().then(loadedSounds => {
        Object.values(loadedSounds).forEach(categoryAudios => {
          categoryAudios.forEach(audio => {
            audio.volume = (volumeRef.current / 100) * 0.10;
          });
        });
        setSounds(loadedSounds);
      });
      
      preloadImages().then(() => {
        setAssetsLoaded(true);
      });
      
      setTimeout(() => {
        setIsStartButtonDisabled(false);
      }, 1000);
  }, []);

  useEffect(() => {
    if (gameState === "playing" || gameState === "countdown") {
      if ( assetsLoaded ) {
        resetGameObjects();
      } else {
        preloadImages().then(() => {
          setAssetsLoaded(true);
          resetGameObjects();
        });
      }

    } else {
      playerTank.current = null;
      enemies.current = [];
      bullets.current = [];
    }

  }, [gameState]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = CONFIG.CANVAS_WIDTH;
    canvasRef.current.height = CONFIG.CANVAS_HEIGHT;
  
    const keys = { w: false, a: false, s: false, d: false };
    const mouse = { x: 0, y: 0, shooting: false };
  
    const keyHandler = (e: KeyboardEvent, isKeyDown: boolean) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'ц':
          keys.w = isKeyDown;
          break;
        case 'a':
        case 'ф':
          keys.a = isKeyDown;
          break;
        case 's':
        case 'ы':
        case 'і':
          keys.s = isKeyDown;
          break;
        case 'd':
        case 'в':
          keys.d = isKeyDown;
          break;
      }
    };

    const getScale = () => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return rect.width / CONFIG.CANVAS_WIDTH;
    };

    const mouseMoveHandler = (e: MouseEvent) => {
      const scale = getScale();
      const rect = canvasRef.current!.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / scale;
      mouse.y = (e.clientY - rect.top) / scale;
    };
    

    const killEnemy = (enemy, enemyIndex) => {
      explosions.current.push({ x: enemy.x, y: enemy.y, frame: 16, width: 100, height: 96 });
      enemies.current.splice(enemyIndex, 1);

      setGameStat(prev => {
        const newKillCount = prev.killCount + 1;
        killCountRef.current = newKillCount;
        totalScoreRef.current = prev.totalScore + (enemy.type === "fire" ? 3 : 1);
        spawnEnemies(newKillCount);
        
        return {
          ...prev,
          totalScore: prev.totalScore + (enemy.type === "fire" ? 3 : 1),
          killCount: newKillCount,
          fireMondalakKillKount: enemy.type === "fire" ? prev.fireMondalakKillKount + 1 : prev.fireMondalakKillKount
        };
      });
      setTimeout(() => {
        const totalScore = totalScoreRef.current;
        if (!isConnected) {
          handleTotalScore(totalScore, false);
        }

      }, 0);

      audioPool.current = playRandomSound(sounds, "kill", isSoundOn.current, audioPool.current, volumeRef.current);
    };

    const updateGameState = () => {
      if (!playerTank.current || !canvasRef.current) return;
  
      let newX = playerTank.current.x;
      let newY = playerTank.current.y;
  
      if (isMobileDevice()) {
        // Mobile: Use joystick for movement and aiming
        if (joystickDirection.current.force > 0) {
          let angle = ((360 - joystickDirection.current.angle) % 360) * (Math.PI / 180);
          const speed = playerTank.current.speed * frameMultiplier;
          newX += Math.cos(angle) * speed;
          newY += Math.sin(angle) * speed;
  
          // Set tank angle for aiming
          playerTank.current.angle = ((360 - joystickDirection.current.angle) % 360) * (Math.PI / 180);
        }
      } else {
        // Desktop: Use WASD for movement and mouse for aiming
        if (keys.w) newY -= playerTank.current.speed * frameMultiplier;
        if (keys.s) newY += playerTank.current.speed * frameMultiplier;
        if (keys.a) newX -= playerTank.current.speed * frameMultiplier;
        if (keys.d) newX += playerTank.current.speed * frameMultiplier;
  
        const dx = mouse.x - playerTank.current.x;
        const dy = mouse.y - playerTank.current.y;
        playerTank.current.angle = Math.atan2(dy, dx);
      }
  
      newX = Math.max(45, Math.min(canvasRef.current!.width - 45, newX));
      newY = Math.max(45, Math.min(canvasRef.current!.height - 45, newY));
  
      playerTank.current.updatePosition(newX, newY);
  
      // Shooting logic
      const isShooting = isMobileDevice() ? shootingRef.current : mouse.shooting;
      if (isShooting && Date.now() - playerTank.current.lastShot > CONFIG.FIRE_RATE) {
        const barrelEndX = playerTank.current.x + Math.cos(playerTank.current.angle) * playerTank.current.barrelSize;
        const barrelEndY = playerTank.current.y + Math.sin(playerTank.current.angle) * playerTank.current.barrelSize;
  
        const audioPoolNew = playSound('/sound/shoot/shooooot.mp3', isSoundOn.current, audioPool.current, volumeRef.current - 4);
        audioPool.current = audioPoolNew;
  
        const bullet = new Bullet(
          barrelEndX,
          barrelEndY,
          playerTank.current.angle,
          playerTank.current.bulletSpeed * frameMultiplier,
          playerTank.current.bulletColor,
          playerTank.current.isBuffed ? 18 : 7,
          playerTank.current.isPlayer,
          playerTank.current.isBuffed ? 2 : 1,
          'player'
        );
        bullets.current.push(bullet);
        playerTank.current.lastShot = Date.now();
      }
  
      bullets.current = bullets.current.filter((bullet) => !bullet.isExpired);
      bullets.current.forEach((bullet) => bullet.update());
  
      bullets.current.forEach((bullet, bulletIndex) => {
        if (playerTank.current && !bullet.isExpired) {
          const dx = playerTank.current.x - bullet.x;
          const dy = playerTank.current.y - bullet.y;
          if (Math.sqrt(dx * dx + dy * dy) < 35) {
            const dead = playerTank.current.takeDamage(bullet.damage);
            bullets.current.splice(bulletIndex, 1);
            updateGameStat('damageTaken', (prev) => prev + bullet.damage);
            if (dead && !isDead.current) {
              const totalScore = totalScoreRef.current;
              handleTotalScore(totalScore, true, context?.user?.username);
              isDead.current = true;
              explosions.current.push({ x: playerTank.current.x, y: playerTank.current.y, frame: 16, width: 400, height: 395 });
              playRandomSound(sounds, 'death', isSoundOn.current, audioPool.current, volumeRef.current);
  
              setTimeout(() => {
                setGameState('gameover');
                if (totalScore > 1) {
                  openMintPopup();
                }
              }, 1000);
            } else {
              const audioPoolNew = playSound('/sound/applepay.mp3', isSoundOn.current, audioPool.current, volumeRef.current - 10);
              audioPool.current = audioPoolNew;
            }
          }
        }
  
        enemies.current.forEach((enemy, enemyIndex) => {
          if (bullet.isPlayer) {
            const dx = enemy.x - bullet.x;
            const dy = enemy.y - bullet.y;
            if (Math.sqrt(dx * dx + dy * dy) < enemy.width / 2) {
              const result = enemy.takeDamage(bullet.damage);
              bullets.current.splice(bulletIndex, 1);
              updateGameStat('damageGiven', (prev) => prev + bullet.damage);
  
              switch (result) {
                case 'drop_heart':
                  hearts.current.push(new Heart(enemy.x, enemy.y));
                  killEnemy(enemy, enemyIndex);
                  return;
                case 'drop_buff':
                  buffs.current.push(new Buff(enemy.x, enemy.y));
                  killEnemy(enemy, enemyIndex);
                  return;
                case false:
                  const pool = playRandomSound(sounds, 'hit', isSoundOn.current, audioPool.current, volumeRef.current);
                  audioPool.current = pool;
                  return;
              }
            }
          }
        });
      });
  
      hearts.current.forEach((heart, heartIndex) => {
        if (playerTank.current) {
          const dx = playerTank.current.x - heart.x;
          const dy = playerTank.current.y - heart.y;
  
          if (Math.sqrt(dx * dx + dy * dy) < playerTank.current.width / 2 && playerTank.current.health < playerTank.current.maxHealth) {
            hearts.current.splice(heartIndex, 1);
            const audioPoolNew = playSound('/sound/heal.mp3', isSoundOn.current, audioPool.current, volumeRef.current);
            audioPool.current = audioPoolNew;
            playerTank.current.heal();
            updateGameStat('healsUsed', (prev) => prev + 1);
          }
  
          const expired = heart.isExpired();
          if (expired) {
            hearts.current.splice(heartIndex, 1);
          }
        }
      });
  
      buffs.current.forEach((buff, buffIndex) => {
        if (playerTank.current) {
          const dx = playerTank.current.x - buff.x;
          const dy = playerTank.current.y - buff.y;
  
          if (Math.sqrt(dx * dx + dy * dy) < playerTank.current.width / 2) {
            buffs.current.splice(buffIndex, 1);
            const audioPoolNew = playSound('/sound/heal.mp3', isSoundOn.current, audioPool.current, volumeRef.current);
            audioPool.current = audioPoolNew;
            playerTank.current.isBuffed = true;
            startBuffTimer(10, playerTank);
            updateGameStat('buffsTaken', (prev) => prev + 1);
          }
  
          const expired = buff.isExpired();
          if (expired) {
            buffs.current.splice(buffIndex, 1);
          }
        }
      });
  
      enemies.current.forEach((enemy) => {
        const bullet = enemy.updateAI(playerTank.current!.x, playerTank.current!.y);
        if (bullet) {
          bullets.current.push(bullet);
        }
      });
  
      if (killCountRef.current > 10) {
        playerTank.current.maxHealth = 8;
      }
    };
  
    const gameLoop = () => {
      if (!playerTank.current) return;
  
      ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
      ctx.fillStyle = '#ffccff';
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
  
      const drawMap = (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#800080';
        for (let y = 0; y < CONFIG.MAP.length; y++) {
          for (let x = 0; x < CONFIG.MAP[y].length; x++) {
            if (CONFIG.MAP[y][x] === 1) {
              ctx.fillRect(x * CONFIG.CELL_SIZE, y * CONFIG.CELL_SIZE, CONFIG.CELL_SIZE - 1, CONFIG.CELL_SIZE - 1);
            }
          }
        }
      };
  
      drawMap(ctx);
  
      if (gameState === 'playing') {
        updateGameState();
      }
  
      playerTank.current.draw(ctx, isDead.current);
      enemies.current.forEach((enemy) => enemy.draw(ctx));
      bullets.current.forEach((bullet) => bullet.draw(ctx));
      hearts.current.forEach((heart) => heart.draw(ctx));
      buffs.current.forEach((buff) => buff.drawBuff(ctx));
  
      explosions.current.forEach((explosion, index) => {
        if (explosion.frame >= explosionFrames.length) {
          explosions.current.splice(index, 1);
          return;
        }
        ctx.drawImage(explosionFrames[explosion.frame], explosion.x - explosion.width / 2 + 10 / 2, explosion.y - explosion.height / 2 + 20 / 2, explosion.height, explosion.height);
        explosion.frame += Math.ceil(frameMultiplier);
      });
  
      requestAnimationFrame(gameLoop);
    };
  
    // Add event listeners for desktop controls
    if (!isMobileDevice()) {
      window.addEventListener('keydown', (e) => keyHandler(e, true));
      window.addEventListener('keyup', (e) => keyHandler(e, false));
      canvasRef.current.addEventListener('mousemove', mouseMoveHandler);
      canvasRef.current.addEventListener('mousedown', () => (mouse.shooting = true));
      canvasRef.current.addEventListener('mouseup', () => (mouse.shooting = false));
    }
  
    gameLoop();
  
    return () => {
      if (!isMobileDevice()) {
        window.removeEventListener('keydown', (e) => keyHandler(e, true));
        window.removeEventListener('keyup', (e) => keyHandler(e, false));
        canvasRef.current?.removeEventListener('mousemove', mouseMoveHandler);
        canvasRef.current?.removeEventListener('mousedown', () => (mouse.shooting = true));
        canvasRef.current?.removeEventListener('mouseup', () => (mouse.shooting = false));
      }
    };
  }, [gameState, isMobileDevice()]);

  const handleLogin = async () => {
    try {
  
      if (!isSDKLoaded || !isEthProviderAvailable || !context) {
        console.warn('SDK not ready or no eth provider');
        return;
      }
  
      const provider = sdk.wallet.ethProvider;
  
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      console.log('[🔑] User accounts:', accounts);
  
      await connect({
        connector: farcasterFrame(),
      });
  
    } catch (err) {
      console.error('🧨 Login error:', err);
    }
  };
  
  const handleVolumeChange = (value: number) => {
    setVolume(value); 
    volumeRef.current = value; 
    setSoundBtnLabelOn(value > 0);
    
    audioPool.current.forEach(audio => {
      audio.volume = (value / 100) * 0.10;
    });

    if (sounds) {
      Object.values(sounds).forEach(categoryAudios => {
        categoryAudios.forEach(audio => {
          audio.volume = (value / 100) * 0.10;
        });
      });
    }
  };
  
  if (!isEthProviderAvailable) {
   return (
     <div className="bg-mobile bg">
       <div className="mobile-warning">
         <h2>Browser is not supported</h2>
         <p>Launch this game on Warpcast to play.</p>
         <a className="warpcast-button" href="https://warpcast.com/miniapps/ywWY5OuZbl_0/monagayanimals" target="_blank" style={{  backgroundColor: '#472A91', color: 'white', display: 'flex', width: '300px', fontWeight: '500', marginTop: '10px', fontSize: '16px', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                 >
                   Play
                   </a>
       </div>
     </div>
   )
  }


  return (
    <>
    <div 
      ref={gameContainerRef} 
      className={`game-container`}
    >
      <div style={{
        position: 'relative',
        paddingBottom: '20px'
      }}>
        <canvas 
          ref={canvasRef} 
          width={CONFIG.CANVAS_WIDTH} 
          height={CONFIG.CANVAS_HEIGHT}
        ></canvas>
        {isMobileDevice() && (
          <>  
        <div
          id = 'zone'
          style={{
            pointerEvents: gameState === 'playing' ? 'auto' : 'none',
            visibility: gameState === 'playing' ? 'visible' : 'hidden'
          }}
        >
          <div
            ref={joystickRef}
            style={{
              width: '100%',
              height: '100%',
              
              background: 'rgba(0,0,0,0)',
              zIndex: 10,
            }}
          />
        </div>
        <button
          className='button-fire'
          style={{
            
            display: gameState === 'playing' ? 'block' : 'none',
          }}
          onTouchStart={() => (shootingRef.current = true)}
          onTouchEnd={() => (shootingRef.current = false)}
          onMouseDown={() => (shootingRef.current = true)}
          onMouseUp={() => (shootingRef.current = false)}
        >
        🎯
        </button>
        </>
        )}
        {
          gameState === "countdown" && (
            <>
              <div className="coundown bg">
                <h1>{countdownValue}</h1>
              </div>
            </>
          )
        }

      <LeaderboardPopup 
        isOpen={isLeaderboardOpen} 
        onClose={() => setIsLeaderboardOpen(false)} 
      />


        {gameState === 'playing' && (
          <GameUI
            killCount={gameStat.killCount}
            buffTimerValue={buffTimerValue}
            soundBtnLabelOn={soundBtnLabelOn}
            onSoundToggle={toggleSound}
            onStopGame={handleStopGame}
            volume={volume}
            onVolumeChange={handleVolumeChange}
          />
        )}
        {gameState === 'menu' && (
          <>
            <div className="bg">
              <h1 className='total-score h1'>Kill everyone <br /> Dodge everything</h1>
                <button disabled={isStartButtonDisabled} className="leaderboard-button" onClick={() => setIsLeaderboardOpen(true)}>
                  Leaderboard
                </button>
                <LoginBtn />

                <a 
                  href="https://x.com/solodaneth" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#000',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" fill="white"/>
                  </svg>
                </a>

              <div className="game-menu" style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection:"column" ,
                gap: "29px",
                top: isConnected ? "50%" : "54%"
              }}>
             
                <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
                flexDirection: "column"
              }} className="flex-wrapper">
                {!isConnected && (
                    <button className='ui-login-btn' style={{minWidth: "240px"}} onClick={handleLogin} disabled={!isEthProviderAvailable}>
                      Start / Login
                    </button>
                 )}  

                  <button className={"play-btn"} onClick={startCountdown} style={{minWidth: "240px"}} disabled={isStartButtonDisabled}>
                    {isConnected ? "Play" : "Play as a guest"}
                  </button>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}>
                  <button disabled={isStartButtonDisabled} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255, 255, 255, 0.6)",
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
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                    />
                  </button>
                  
                </div>
              </div>
            </div>

          </>
        )}

        {gameState === 'gameover' && (
          <>
            <div className="bg">
              <h1 className='total-score h1'>Your total score: {gameStat.totalScore}</h1>
              <button className="leaderboard-button" onClick={() => setIsLeaderboardOpen(true)}>
                  Leaderboard
                </button>
                <LoginBtn />
                
                <div className="fullscreen-btn-wrapper">
            
                </div>

              <div className="game-menu" style={{ display: 'flex', 
                alignItems: 'center',
                 justifyContent: 'center',
                 flexDirection: "column" ,
                 gap: "10px",
                 top: isConnected ? "50%" : "49%"
                   }}>
                  <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
              }} className="flex-wrapper">
                {!isConnected && (
                    <button className='ui-login-btn' onClick={handleLogin} disabled={!isEthProviderAvailable}>
                      Start / Login
                    </button>
                 )}  
                   <button className={"play-btn"} onClick={startCountdown} style={{width: isConnected ? '310px' : 'auto'}}>
                    {isConnected ? "Play again" : "Play as a guest"}
                  </button>
                  </div>
              
                  <button 
                    onClick={async () => {
                      const shareText = `I just scored ${gameStat.totalScore} points in monagayanimals built by @solodaneth on Monad testnet! Can you beat my score?`;
                      if (actions?.composeCast) {
                        try {
                          await actions.composeCast({ text: shareText, embeds: ['https://monagaynanimals.xyz/', 'https://warpcast.com/~/channel/monagayanimals'] });
                        } catch (error) {
                          console.error('Failed to cast:', error);
                        }
                      }
                    }}
                    style={{ marginLeft: '10px', backgroundColor: '#472A91', color: 'white', display: 'flex', width: '310px', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  >
                    Share on Warpcast
                    <img src="/warpcast.svg" alt="Warpcast logo" style={{ height: '20px', width: 'auto' }} />
                  </button>
                  <button 
                    onClick={async () => {
                      const text = `I just scored ${gameStat.totalScore} points in monagayanimals built by @solodanETH on the @monad_xyz testnet! Can you beat my score?`;
                      const url = "https://monagaynanimals.xyz/";
                      const encodedText = encodeURIComponent(text);
                      const encodedUrl = encodeURIComponent(url);
                      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

                      await sdk.actions.openUrl(twitterUrl);
                    }}
                    style={{ marginLeft: '10px', width: '310px', backgroundColor: '#000000', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  >
                    Share results on <img src="/x.jpg" alt="X logo" style={{ height: '20px', width: 'auto' }} />
                  </button>

              </div>

              <div className="game-stat">

                <div className="row">
                  <div className="col">
                    <span>Total kills: {gameStat.killCount}</span>
                    <span>Bosses killed: {gameStat.fireMondalakKillKount}</span>
                    <span>Damage dealt: {gameStat.damageGiven}</span>
                  </div>
                  <div className="col">
                    <span>Damage taken: {gameStat.damageTaken}</span>
                    <span>Heals used: {gameStat.healsUsed}</span>
                    <span>Buffs taken: {gameStat.buffsTaken}</span>
                  </div>
                </div>
              </div>
            </div>
          </>

        )}
        
        {gameState === 'playing' && (
          <div className="fullscreen-btn-wrapper-playing">
          <button
            onClick={toggleFullscreen}
            className="fullscreen-button-playing"
          >
                   <svg xmlns="http://www.w3.org/2000/svg"  fill="#FFFFFF" height="20px" width="20px" version="1.1" id="Capa_1" viewBox="0 0 384.97 384.97" xmlSpace="preserve">
                    <g xmlns="http://www.w3.org/2000/svg">
	<g id="Fullscreen_Exit">
		<path d="M264.943,156.665h108.273c6.833,0,11.934-5.39,11.934-12.211c0-6.833-5.101-11.85-11.934-11.838h-96.242V36.181    c0-6.833-5.197-12.03-12.03-12.03s-12.03,5.197-12.03,12.03v108.273c0,0.036,0.012,0.06,0.012,0.084    c0,0.036-0.012,0.06-0.012,0.096C252.913,151.347,258.23,156.677,264.943,156.665z"/>
		<path d="M120.291,24.247c-6.821,0-11.838,5.113-11.838,11.934v96.242H12.03c-6.833,0-12.03,5.197-12.03,12.03    c0,6.833,5.197,12.03,12.03,12.03h108.273c0.036,0,0.06-0.012,0.084-0.012c0.036,0,0.06,0.012,0.096,0.012    c6.713,0,12.03-5.317,12.03-12.03V36.181C132.514,29.36,127.124,24.259,120.291,24.247z"/>
		<path d="M120.387,228.666H12.115c-6.833,0.012-11.934,5.39-11.934,12.223c0,6.833,5.101,11.85,11.934,11.838h96.242v96.423    c0,6.833,5.197,12.03,12.03,12.03c6.833,0,12.03-5.197,12.03-12.03V240.877c0-0.036-0.012-0.06-0.012-0.084    c0-0.036,0.012-0.06,0.012-0.096C132.418,233.983,127.1,228.666,120.387,228.666z"/>
		<path d="M373.3,228.666H265.028c-0.036,0-0.06,0.012-0.084,0.012c-0.036,0-0.06-0.012-0.096-0.012    c-6.713,0-12.03,5.317-12.03,12.03v108.273c0,6.833,5.39,11.922,12.223,11.934c6.821,0.012,11.838-5.101,11.838-11.922v-96.242    H373.3c6.833,0,12.03-5.197,12.03-12.03S380.134,228.678,373.3,228.666z"/>
	</g>
  </g>

            </svg>
          </button>
          </div>
        )}
      </div>
      {!simulatedFullscreen && (
        <TransactionsTable transactions={transactions} clearTransactions={clearTransactions} key={transactions.length} />
      )}
    </div>
      <MintPopup open={open} onClose={closeMintPopup} />
</>
  );
};
export default Game;


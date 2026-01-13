import { v4 as uuidv4 } from 'uuid';
import { ethers } from "ethers";
import { LeaderboardResponse } from '../types';
import { SCORE_CONTRACT_ABI, MINT_CONTRACT_ABI } from '../constants/ABI.ts';
const SCORE_CONTRACT_ADDRESS = "0xF72e3EE1798eEE077d72912ED7245f3Dd2c72cF7"; 
const MINT_CONTRACT_ADDRESS = "0x5d44635D3FfeFf64973c018F7Eb76DC2b27c071c";

const lastNonceMap = new Map<string, number>();
let lastTotalMinted: bigint | null = null;

interface LastSuccessfulTx {
  address: string;
  score: number;
  hash: string;
  user?: string;
}
let lastSuccessfulTx: LastSuccessfulTx | null = null;
let scoreSubmitted = false;
let lastSubmittedHash: string | null = null;

export const getOrCreatePlayerId = (): string | null => {
  let id = localStorage.getItem('playerId');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('playerId', id ?? "");
  }
  return id;
};

const audioCache: { [src: string]: HTMLAudioElement } = {};

export const playSound = (
  src: string,
  isSoundOn: boolean,
  audioPool: HTMLAudioElement[],
  volume: number = 20
) => {
  if (!isSoundOn) return audioPool;
  if (volume < 0) volume = 0;

  let cachedAudio = audioCache[src];

  let audio: HTMLAudioElement;
  if (cachedAudio) {
    audio = cachedAudio.cloneNode(true) as HTMLAudioElement;
  } else {
    audio = new Audio(src);
    audioCache[src] = audio;
  }

  audio.volume = (volume / 100) * 0.15;
  audioPool.push(audio);
  audio.play();

  audio.onended = () => {
    audioPool = audioPool.filter(a => a !== audio);
  };

  return audioPool;
};

export const playRandomSound = (
  sounds: any,
  category: keyof typeof sounds,
  isSoundOn: boolean,
  audioPool: HTMLAudioElement[],
  volume: number = 20
) => {
  if (!isSoundOn || !sounds || !sounds[category] || sounds[category].length === 0)
    return audioPool;

  const randomIndex = Math.floor(Math.random() * sounds[category].length);
  const audio = sounds[category][randomIndex].cloneNode(true) as HTMLAudioElement;
  audio.volume = (volume / 100) * 0.50;
  audioPool.push(audio);
  audio.play();

  audio.onended = () => {
    audioPool = audioPool.filter(a => a !== audio);
  };

  return audioPool;
};

export const loadSounds = async () => {
  const soundLibrary: { [key: string]: HTMLAudioElement[] } = {
    kill: [],
    death: [],
    hit: [],
    shoot: []
  };

  for (let i = 1; i <= 11; i++) {
    const audio = new Audio(`/sound/kill/kill${i}.mp3`);
    audio.volume = 0.05;
    soundLibrary.kill.push(audio);
  }

  for (let i = 1; i <= 7; i++) {
    const audio = new Audio(`/sound/death/death${i}.mp3`);
    audio.volume = 0.02;
    soundLibrary.death.push(audio);
  }

  for (let i = 1; i <= 2; i++) {
    const audio = new Audio(`/sound/hit/hit${i}.mp3`);
    audio.volume = 0.01;
    soundLibrary.hit.push(audio);
  }

  const shootSounds = [
    new Audio(`/sound/shoot/shooooot.mp3`),
    new Audio(`/sound/shoot/shooooot1.mp3`),
    new Audio(`/sound/shoot/heal.mp3`)
  ];
  shootSounds.forEach(audio => {
    audio.volume = 0.01;
    soundLibrary.shoot.push(audio);
  });

  return soundLibrary;
};

export const MintWagmi = async (address: string) => {
  try {
    return {
      address: MINT_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINT_CONTRACT_ABI,
      functionName: 'mint',
      args: [address],
      chainId: 10143,
      value: ethers.parseEther("0.000001")
    };
  } catch (error) {
    console.error("Error preparing mint transaction:", error);
    throw error;
  }
}

export const sendTransaction = async (
  score: number,
  wallets: any[],
  authenticated: boolean,
  isDead = false,
  user: any,
  retryCount: number = 0,
): Promise<LeaderboardResponse> => {
  try {
    if (score === 1) {
      lastSuccessfulTx = null;
      scoreSubmitted = false;
      lastSubmittedHash = null;
    }

    if (!authenticated) {
      return { error: "User not authenticated" };
    }

    if (!wallets || wallets.length === 0) {
      return { error: "No wallet found" };
    }

    const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
    if (!privyWallet) {
      return { error: "Privy wallet not found" };
    }
    const ethereumProvider = await privyWallet.getEthereumProvider();
    const provider = new ethers.BrowserProvider(ethereumProvider);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    const balance = await provider.getBalance(userAddress);
    
    const contract = new ethers.Contract(SCORE_CONTRACT_ADDRESS, SCORE_CONTRACT_ABI, signer);
    
    const baseGasPrice = await provider.getFeeData();
    const gasPrice = baseGasPrice.gasPrice ?? ethers.parseUnits("0.0002", "ether");
    const estimatedGas = await contract.setScore.estimateGas("100");
    const gasLimit = Math.floor(Number(estimatedGas) * 1.20);
    
    const estimatedCost = gasPrice * BigInt(gasLimit);

    if (balance < estimatedCost) {
      if (score > 2 && lastSuccessfulTx && lastSuccessfulTx.address === userAddress && !scoreSubmitted && lastSuccessfulTx.hash !== lastSubmittedHash) {
        await setScoreOnDeath(lastSuccessfulTx.address, lastSuccessfulTx.score, lastSuccessfulTx.hash, user);
        scoreSubmitted = true;
        lastSubmittedHash = lastSuccessfulTx.hash;
      }
      return { error: "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>" };
    }

    let nonce: number;
    if (!lastNonceMap.has(userAddress)) {
      nonce = await provider.getTransactionCount(userAddress, "latest");
    } else {
      nonce = lastNonceMap.get(userAddress)! + 1;
    }
    
    lastNonceMap.set(userAddress, nonce);

    const txData = {
      to: SCORE_CONTRACT_ADDRESS,
      from: userAddress,
      nonce,
      gasLimit,
      gasPrice,
      chainId: 10143,
      data: contract.interface.encodeFunctionData("setScore", [`${score}`]),
    };

    const tx = await signer.sendTransaction(txData).catch(async (error) => {
      if (error.message.includes('json') || error.message.includes('JSON')) {
        console.error('JSON parsing error, retrying with delay...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return signer.sendTransaction(txData);
      }
      throw error;
    });

    const receipt = await tx.wait().catch(async (error) => {
      if (error.message.includes('json') || error.message.includes('JSON')) {
        console.error('JSON parsing error during receipt wait, retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return tx.wait();
      }
      throw error;
    });
    
    if (isDead && tx.hash && !scoreSubmitted && tx.hash !== lastSubmittedHash) {
      setScoreOnDeath(userAddress, score, tx.hash, user);
      scoreSubmitted = true;
      lastSubmittedHash = tx.hash;
    }

    lastSuccessfulTx = {
      address: userAddress,
      score: score,
      hash: tx.hash
    };

    return { 
      url: `https://testnet.monadexplorer.com/tx/${tx.hash}`,
      error: ""
    };
  } catch (error) {
    console.error("Err:", error);
    
    let errorMessage = "Unknown error";
    
    if (error instanceof Error) {
      const errorText = error.message.toLowerCase();
      const errorObject = error as any;
      
      if (retryCount < 2 && (
        errorText.includes("nonce") || 
        errorText.includes("replacement transaction underpriced") ||
        errorText.includes("transaction underpriced") ||
        errorText.includes("already known") ||
        errorText.includes("revert") ||
        errorText.includes("missing revert data") ||
        errorText.includes("json") ||
        errorText.includes("unexpected end") ||
        errorText.includes("failed to execute") ||
        (errorObject.code && (
          errorObject.code === "NONCE_EXPIRED" ||
          errorObject.code === "REPLACEMENT_UNDERPRICED" ||
          errorObject.code === "TRANSACTION_REPLACED" ||
          errorObject.code === "UNPREDICTABLE_GAS_LIMIT" ||
          errorObject.code === "SERVER_ERROR" ||
          errorObject.code === "NETWORK_ERROR" ||
          errorObject.code === "TIMEOUT"
        ))
      )) {
        console.log(`Retrying sendTransaction... Attempt ${retryCount + 1}, Error: ${errorObject.code || errorText}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return sendTransaction(score, wallets, authenticated, isDead, retryCount + 1, user);
      }
      
      if (errorObject.code) {
        switch (errorObject.code) {
          case "NONCE_EXPIRED":
            errorMessage = "Transaction sequence error. Please reload the page and try again.";
            break;
          case "REPLACEMENT_UNDERPRICED":
            errorMessage = "Gas price too low for replacement. Please try again.";
            break;
          case "TRANSACTION_REPLACED":
            errorMessage = "Transaction was replaced by another transaction.";
            break;
          case "UNPREDICTABLE_GAS_LIMIT":
            errorMessage = "Unable to estimate gas. The transaction may fail.";
            break;
          case "ACTION_REJECTED":
            errorMessage = "You rejected the transaction. Please try again.";
            break;
          case "INSUFFICIENT_FUNDS":
            errorMessage = "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>";
            break;
          case "SERVER_ERROR":
            errorMessage = "Server connection error. Please check your internet and try again.";
            break;
          case "NETWORK_ERROR":
            errorMessage = "Network connection error. Please check your internet and try again.";
            break;
          case "TIMEOUT":
            errorMessage = "Request timed out. Please try again.";
            break;
          default:
            if (errorText.includes("json") || errorText.includes("unexpected end")) {
              errorMessage = "Network error. Please reload the page and try again.";
            } else if (errorText.includes("insufficient balance") || errorText.includes("signer had insufficient balance")) {
              errorMessage = "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>";
            } else if (errorText.includes("replacement transaction underpriced")) {
              errorMessage = "Transaction nonce error. Please reload the page and try again.";
            } else if (errorText.includes("gas") || errorText.includes("fee")) {
              errorMessage = "Gas fee error. Network might be congested.";
            } else if (errorText.includes("rejected") || errorText.includes("denied")) {
              errorMessage = "Transaction was rejected. Please try again.";
            } else if (errorText.includes("timeout") || errorText.includes("timed out")) {
              errorMessage = "Transaction timed out. Network might be slow.";
            } else if (errorText.includes("network") || errorText.includes("connection")) {
              errorMessage = "Network connection error. Please check your internet.";
            } else if (errorText.includes("revert") || errorText.includes("missing revert data")) {
              errorMessage = "Missing revert data.";
            } else {
              errorMessage = error.message;
            }
        }
      } else {
        if (errorText.includes("json") || errorText.includes("unexpected end")) {
          errorMessage = "Network error. Please reload the page and try again.";
        } else if (errorText.includes("insufficient balance") || errorText.includes("signer had insufficient balance")) {
          errorMessage = "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>";
        } else if (errorText.includes("replacement transaction underpriced")) {
          errorMessage = "Transaction nonce error. Please reload the page and try again.";
        } else if (errorText.includes("gas") || errorText.includes("fee")) {
          errorMessage = "Gas fee error. Network might be congested.";
        } else if (errorText.includes("rejected") || errorText.includes("denied")) {
          errorMessage = "Transaction was rejected. Please try again.";
        } else if (errorText.includes("timeout") || errorText.includes("timed out")) {
          errorMessage = "Transaction timed out. Network might be slow.";
        } else if (errorText.includes("network") || errorText.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet.";
        } else if (errorText.includes("revert") || errorText.includes("missing revert data")) {
          errorMessage = "Missing revert data.";
        } else {
          errorMessage = error.message;
        }
      }
    }
    
    if (lastSuccessfulTx && lastSuccessfulTx.address && !scoreSubmitted && lastSuccessfulTx.hash !== lastSubmittedHash) {
      await setScoreOnDeath(lastSuccessfulTx.address, lastSuccessfulTx.score, lastSuccessfulTx.hash, lastSuccessfulTx.user);
      scoreSubmitted = true;
      lastSubmittedHash = lastSuccessfulTx.hash;
    }

    return { 
      error: error instanceof Error ? errorMessage : "Unknown error" 
    };
  }
};

export const setScoreOnDeath = async (address: string, score: number, hash_tx: string, user: any) => {
  if ( user.twitter_id ) {
    user = "@" + user.twitter.username;
  } else if (user.google.email) {
    user = user.google.email;
  } else {
    user = null;
  }

  const setScoreOnDeath = await fetch("https://gameapi.monadassistant.xyz/set_score", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      address: address,
      score: `${score}`,
      hash_tx: hash_tx,
      user: user
    })
  })

  if (!setScoreOnDeath.ok) {
    throw new Error(`Err: ${setScoreOnDeath.statusText}`);
  }

  const data = await setScoreOnDeath.json();
}

export const sendTransactionAsGuest = async ({score, isDead = false, username} : {score: number, isDead: boolean, username?: string}) => {
  try {
    const playerId = getOrCreatePlayerId();

    const reqData = {
      id: username ? username : playerId,
      score: `${score}`,
      isDead: isDead
    };    

    const response = await fetch("https://gameapi.monadassistant.xyz/set_score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reqData) as any
    });

    if (!response.ok) {
      return { error: `Server error ${response.statusText}`, link: "" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Err:", error);
    return { error: "Server error" };
  }
}

export const mint = async (
  wallets: any[],
  authenticated: boolean,
  retryCount: number = 0,
  baseTokenId: bigint | null = null
): Promise<LeaderboardResponse> => {
  let totalMinted: bigint;
  
  try {
    if (!authenticated) {
      return { error: "User not authenticated" };
    }

    if (!wallets || wallets.length === 0) {
      return { error: "No wallet found" };
    }

    const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
    if (!privyWallet) {
      return { error: "Privy wallet not found" };
    }
    
    const ethereumProvider = await privyWallet.getEthereumProvider();
    
    const privyProvider = new ethers.BrowserProvider(ethereumProvider);
    
    const signer = await privyProvider.getSigner();
    const userAddress = await signer.getAddress();

    const balance = await privyProvider.getBalance(userAddress);
    
    const contract = new ethers.Contract(MINT_CONTRACT_ADDRESS, MINT_CONTRACT_ABI, signer);
    const contractWithSigner = contract.connect(signer);

    const baseGasPrice = await privyProvider.getFeeData();
    const gasPrice = baseGasPrice.gasPrice ?? ethers.parseUnits("0.0002", "ether");
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    const hehash = ethers.solidityPackedKeccak256(
      ['uint256'],
      [timestamp]
    );

    try {
      const simpleMintFunction = contract.getFunction("simpleMint");
      const estimatedGas = await simpleMintFunction.estimateGas(userAddress, hehash, timestamp);
      const gasLimit = Math.floor(Number(estimatedGas) * 1.30);
      const estimatedCost = gasPrice * BigInt(gasLimit);

      if (balance < estimatedCost) {
        return { error: "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>" };
      }

      let nonce: number;
      if (!lastNonceMap.has(userAddress)) {
        nonce = await privyProvider.getTransactionCount(userAddress, "latest");
      } else {
        nonce = lastNonceMap.get(userAddress)! + 1;
      }
      
      lastNonceMap.set(userAddress, nonce);
      
      const txData = {
        to: MINT_CONTRACT_ADDRESS,
        from: userAddress,
        nonce,
        gasLimit,
        gasPrice,
        chainId: 10143,
        data: contract.interface.encodeFunctionData("simpleMint", [userAddress, hehash, timestamp]),
      };

      const tx = await signer.sendTransaction(txData).catch(async (error) => {
        console.error("Ошибка при отправке транзакции:", error);
        if (error.message.includes('json') || error.message.includes('JSON')) {
          console.error('JSON parsing error, retrying with delay...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return signer.sendTransaction(txData);
        }
        throw error;
      });

      const receipt = await tx.wait().catch(async (error) => {
        console.error("Ошибка при ожидании подтверждения:", error);
        if (error.message.includes('json') || error.message.includes('JSON')) {
          console.error('JSON parsing error during receipt wait, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return tx.wait();
        }
        throw error;
      });

      return { 
        url: `https://testnet.monadexplorer.com/tx/${tx.hash}`,
        userAddress: userAddress,
        error: ""
      };
    } catch (error) {
      console.error("Ошибка при оценке газа:", error);
      throw error;
    }
  } catch (error) {
    console.error("Err:", error);
    
    let errorMessage = "Unknown error";
    
    if (error instanceof Error) {
      const errorText = error.message.toLowerCase();
      const errorObject = error as any;
      
      console.log("Detailed error info:", {
        message: error.message,
        code: errorObject.code,
        data: errorObject.data,
        reason: errorObject.reason,
        errorArgs: errorObject.errorArgs,
        transaction: errorObject.transaction
      });
      
      if (retryCount < 10 && (
        errorText.includes("nonce") || 
        errorText.includes("replacement transaction underpriced") ||
        errorText.includes("transaction underpriced") ||
        errorText.includes("already known") ||
        errorText.includes("revert") ||
        errorText.includes("missing revert data") ||
        errorText.includes("json") ||
        errorText.includes("unexpected end") ||
        errorText.includes("failed to execute") ||
        (errorObject.code && (
          errorObject.code === "NONCE_EXPIRED" ||
          errorObject.code === "REPLACEMENT_UNDERPRICED" ||
          errorObject.code === "TRANSACTION_REPLACED" ||
          errorObject.code === "UNPREDICTABLE_GAS_LIMIT" ||
          errorObject.code === "SERVER_ERROR" ||
          errorObject.code === "NETWORK_ERROR" ||
          errorObject.code === "TIMEOUT"
        ))
      )) {
        console.log(`Retrying mint... Attempt ${retryCount + 1}, Error: ${errorObject.code || errorText}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const nextTokenId = baseTokenId !== null 
          ? baseTokenId + BigInt(retryCount + 1)
          : (lastTotalMinted !== null ? lastTotalMinted + BigInt(retryCount + 1) : BigInt(retryCount + 1));
        
        return mint(wallets, authenticated, retryCount + 1, nextTokenId);
      }
      
      if (errorObject.code) {
        switch (errorObject.code) {
          case "NONCE_EXPIRED":
            errorMessage = "Transaction sequence error. Please reload the page and try again.";
            break;
          case "REPLACEMENT_UNDERPRICED":
            errorMessage = "Gas price too low for replacement. Please try again.";
            break;
          case "TRANSACTION_REPLACED":
            errorMessage = "Transaction was replaced by another transaction.";
            break;
          case "UNPREDICTABLE_GAS_LIMIT":
            errorMessage = "Unable to estimate gas. The transaction may fail.";
            break;
          case "ACTION_REJECTED":
            errorMessage = "You rejected the transaction. Please try again.";
            break;
          case "INSUFFICIENT_FUNDS":
            errorMessage = "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>";
            break;
          case "SERVER_ERROR":
            errorMessage = "Server connection error. Please check your internet and try again.";
          case "NETWORK_ERROR":
            errorMessage = "Network connection error. Please check your internet and try again.";
            break;
          case "TIMEOUT":
            errorMessage = "Request timed out. Please try again.";
            break;
          default:
            if (errorText.includes("json") || errorText.includes("unexpected end")) {
              errorMessage = "Network error. Please reload the page and try again.";
            } else if (errorText.includes("insufficient balance") || errorText.includes("signer had insufficient balance")) {
              errorMessage = "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>";
            } else if (errorText.includes("replacement transaction underpriced")) {
              errorMessage = "Transaction nonce error. Please reload the page and try again.";
            } else if (errorText.includes("gas") || errorText.includes("fee")) {
              errorMessage = "Gas fee error. Network might be congested.";
            } else if (errorText.includes("rejected") || errorText.includes("denied")) {
              errorMessage = "Transaction was rejected. Please try again.";
            } else if (errorText.includes("timeout") || errorText.includes("timed out")) {
              errorMessage = "Transaction timed out. Network might be slow.";
            } else if (errorText.includes("network") || errorText.includes("connection")) {
              errorMessage = "Network connection error. Please check your internet.";
            } else if (errorText.includes("revert") || errorText.includes("missing revert data")) {
              errorMessage = "Missing revert data.";
            } else {
              errorMessage = error.message;
            }
        }
      } else {
        if (errorText.includes("json") || errorText.includes("unexpected end")) {
          errorMessage = "Network error. Please reload the page and try again.";
        } else if (errorText.includes("insufficient balance") || errorText.includes("signer had insufficient balance")) {
          errorMessage = "No MONs left, you can <a href='#' class='interactive-link' data-action='logout'>play as a guest</a> or <a href='#' class='interactive-link' data-action='faucet'>use Faucet</a>";
        } else if (errorText.includes("replacement transaction underpriced")) {
          errorMessage = "Transaction nonce error. Please reload the page and try again.";
        } else if (errorText.includes("gas") || errorText.includes("fee")) {
          errorMessage = "Gas fee error. Network might be congested.";
        } else if (errorText.includes("rejected") || errorText.includes("denied")) {
          errorMessage = "Transaction was rejected. Please try again.";
        } else if (errorText.includes("timeout") || errorText.includes("timed out")) {
          errorMessage = "Transaction timed out. Network might be slow.";
        } else if (errorText.includes("network") || errorText.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet.";
        } else if (errorText.includes("revert") || errorText.includes("missing revert data")) {
          errorMessage = "Missing revert data.";
        } else {
          errorMessage = error.message;
        }
      }
    }

    return { 
      error: error instanceof Error ? errorMessage : "Unknown error" 
    };
  }
};

export const getLeaderBoard = async () => {
  const response = await fetch("https://gameapi.monadassistant.xyz/get_top_10_scores_not_auth",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Error getting leaderboard: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

export const getAuthLeaderBoard = async () => {
  const response = await fetch("https://gameapi.monadassistant.xyz/get_top_10_scores_auth",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Error getting leaderboard: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

export const getFormattedBalance = async (wallet: any): Promise<string> => {
  try {
    if (!wallet) {
      console.error('No wallet provided to getFormattedBalance');
      return '0.0000';
    }
    
    const ethereumProvider = await wallet.getEthereumProvider();
    
    const provider = new ethers.BrowserProvider(ethereumProvider);
    
    const balance = await provider.getBalance(wallet.address);
    
    const formattedBalance = Number(ethers.formatEther(balance)).toFixed(4);
    
    return formattedBalance;
  } catch (error) {
    console.error('Error getting balance:', error);
    return '0.0000';
  }
}

export const faucet = async (address: string): Promise<LeaderboardResponse> => {
  try {
    const response = await fetch(`https://gameapi.monadassistant.xyz/crane_monad?address=${address}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      }
    }); 

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Faucet API error response:", errorText);
      throw new Error(`Error: ${response.statusText}. Details: ${errorText}`);
    }
    const data = await response.json();
    
    if (data && 'mon' in data) {
      return {
        ...data,
        error: ""
      };
    }  else {
      if ( data.deadline_seconds ) {
        return {
          ...data,
          error: "Faucet is on cooldown."
        };
      } else {
        return data
      }
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};
import { Enemy } from "./classes/Enemy.ts";
import { CONFIG } from "./config.ts";

const ENEMY_COLORS = ["#eb4034", "#635a19", "#b34a09", "#0a6349", "#0b1852", "#380613", "#000000"];

export default function createEnemy(enemiesRef, difficulty: number, firstPlayer: boolean, type: string, frameMultiplier: number, imageCache: any) {
  if (enemiesRef.length >= CONFIG.MAX_ENEMIES) {
    return enemiesRef;
  }
  
  const padding = 100;
  const randomX = padding + Math.random() * (CONFIG.CANVAS_WIDTH - padding * 2);
  const randomY = padding + Math.random() * (CONFIG.CANVAS_HEIGHT - padding * 2);

  let difficultyMultiplier = Math.min(1 + difficulty * 0.1, 2.5);

  const baseBulletSpeed = ( 1.2 + Math.random() * 1 ) * frameMultiplier;
  const baseFireRate = 2500 + Math.random() * 1500;
  const baseMoveSpeed = ( 0.3 + Math.random() * 0.4) * frameMultiplier;
  
  const bulletSpeed = type === "fire" ? 2 * frameMultiplier : Math.min(baseBulletSpeed * difficultyMultiplier, 4);
  const fireRate = type === "fire" ? 800 : Math.max(baseFireRate / difficultyMultiplier, 800);
  const moveSpeed = type === "fire" ? 5 * frameMultiplier : Math.min(baseMoveSpeed * difficultyMultiplier, 1.5);

  const enemyKeys = Object.keys(imageCache.enemies);
  const fireKeys = Object.keys(imageCache.fire);

  let characterImage;
  if (type === "fire" && fireKeys.length > 0) {
    characterImage = imageCache.fire[0];
  } else if (enemyKeys.length > 0) {
    const randomKey = enemyKeys[Math.floor(Math.random() * enemyKeys.length)];
    characterImage = imageCache.enemies[randomKey];
  }

  if (!characterImage) {
    console.error("Can't get image for monanimal type:", type);
  }

  const bulletColor = type === "fire" ? "orange" : ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];

  const spawnTime = firstPlayer ? Date.now() + 3000 : Date.now();
  
  enemiesRef.push(new Enemy(randomX, randomY, bulletSpeed, fireRate, moveSpeed, bulletColor, spawnTime, type, characterImage));
  
  return enemiesRef;
}

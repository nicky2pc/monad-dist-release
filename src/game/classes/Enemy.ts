import { Mondalak } from './Mondalak.ts';
import { CONFIG } from '../config.ts';
import { Bullet } from './Bullet.ts';

export class Enemy extends Mondalak {
  targetX: number;
  targetY: number;
  moveCooldown: number;
  moveSpeed: number;
  spawnTime: number;
  lastUpdateTime: number;
  
  constructor(x: number, y: number, bulletSpeed: number = CONFIG.BULLET_SPEED, fireRate: number = CONFIG.FIRE_RATE, moveSpeed: number = 1.5, bulletColor: string, spawnTime: number, type: string, characterImage: HTMLImageElement) {
    super(x, y, false, bulletSpeed, fireRate, bulletColor, type, characterImage);
    this.targetX = x;
    this.targetY = y;
    this.moveCooldown = Date.now() + this.getRandomCooldown(); 
    this.moveSpeed = moveSpeed;
    this.spawnTime = spawnTime;
    this.type = type;
    this.lastUpdateTime = performance.now();
  }

  updateAI(playerX: number, playerY: number): Bullet | null {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    this.angle = Math.atan2(dy, dx);

    if (Date.now() > this.moveCooldown) {
      this.targetX = this.x + (Math.random() - 0.5) * 400;
      this.targetY = this.y + (Math.random() - 0.5) * 400;
      this.moveCooldown = Date.now() + this.getRandomCooldown();

      this.targetX = Math.max(45, Math.min(CONFIG.CANVAS_WIDTH - 45, this.targetX));
      this.targetY = Math.max(45, Math.min(CONFIG.CANVAS_HEIGHT - 45, this.targetY));
    }

    const lerpFactor = this.moveSpeed * 0.01; 
    this.x = this.lerp(this.x, this.targetX, lerpFactor);
    this.y = this.lerp(this.y, this.targetY, lerpFactor);

    this.x = Math.max(45, Math.min(CONFIG.CANVAS_WIDTH - 45, this.x));
    this.y = Math.max(45, Math.min(CONFIG.CANVAS_HEIGHT - 45, this.y));

    if ((Date.now() - this.lastShot > this.fireRate) && (Date.now() - 700 > this.spawnTime)) {
      return this.shoot();
    }

    return null;
  }

  private lerp(start: number, end: number, factor: number): number {
    const clampedFactor = Math.min(1.0, Math.max(0.0, factor));
    return start + (end - start) * clampedFactor;
  }

  private getRandomCooldown(): number {
    return Math.floor(Math.random() * (1600 - 600) + 600);
  }
}

import { CONFIG } from '../config.ts';

export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spawnTime: number;
  bounces: number;
  speed: number;
  color: string;
  size: number; 
  isPlayer: boolean;
  damage: number;
  type: string;
  lastUpdateTime: number;
  
  constructor(x: number, y: number, angle: number, speed: number, color: string, size: number, isPlayer: boolean, damage: number, type: string) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.color = color;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.spawnTime = Date.now();
    this.bounces = 0;
    this.size = size;
    this.isPlayer = isPlayer; 
    this.damage = damage;
    this.type = type;
    this.lastUpdateTime = performance.now();
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.type === "fire") {
        ctx.shadowBlur = 10 + Math.sin(performance.now() / 100) * 5;
        ctx.shadowColor = "rgba(255, 100, 0, 0.8)";

        const gradient = ctx.createRadialGradient(this.x, this.y, this.size * 0.2, this.x, this.y, this.size);
        gradient.addColorStop(0, "yellow");
        gradient.addColorStop(0.5, "orange");
        gradient.addColorStop(1, "red");

        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = this.color;
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size + (this.type === "fire" ? Math.sin(performance.now() / 100) * 2 : 0), 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  update() {
    const now = performance.now();
    this.lastUpdateTime = now;
    
    const prevX = this.x;
    const prevY = this.y;

    this.x += this.vx;
    this.y += this.vy;

    this.checkWallCollision(prevX, prevY);
  }

  private checkWallCollision(prevX: number, prevY: number) {
    if (this.bounces >= CONFIG.MAX_BOUNCES) return;

    const nextCellX = Math.floor(this.x / CONFIG.CELL_SIZE);
    const nextCellY = Math.floor(this.y / CONFIG.CELL_SIZE);
    const prevCellX = Math.floor(prevX / CONFIG.CELL_SIZE);
    const prevCellY = Math.floor(prevY / CONFIG.CELL_SIZE);

    if (nextCellX < 0 || nextCellY < 0 || 
        nextCellY >= CONFIG.MAP.length || 
        nextCellX >= CONFIG.MAP[0].length) {
      return;
    }

    if (CONFIG.MAP[nextCellY][nextCellX] === 1) {
        const hitVertical = nextCellX !== prevCellX;
        const hitHorizontal = nextCellY !== prevCellY;

        if (hitVertical) this.vx *= -1;
        if (hitHorizontal) this.vy *= -1;

        this.bounces++;
        this.x = prevX - this.vx;
        this.y = prevY - this.vy;
    }
  }

  get isExpired() {
    return Date.now() - this.spawnTime > CONFIG.BULLET_LIFETIME || 
      this.bounces > CONFIG.MAX_BOUNCES;
  }
}

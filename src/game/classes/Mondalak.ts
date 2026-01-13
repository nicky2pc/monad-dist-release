import { CONFIG } from '../config.ts';
import { Bullet } from './Bullet.ts';

export class Mondalak {
  x: number;
  y: number;
  angle: number;
  speed: number;
  bulletSpeed: number;
  lastShot: number;
  isPlayer: boolean;
  fireRate: number;
  bulletColor: string;
  health: number;
  shakeOffsetX: number = 0; 
  shakeOffsetY: number = 0;
  maxHealth: number;
  barrelSize: number = 35;
  width: number = 70;  
  height: number = 35;
  hitboxRadius: number = 35;
  barrelThickness: number = 6;
  shootingAnimation: boolean = false;
  characterImage: HTMLImageElement;
  isBuffed: boolean;
  type: string;
  constructor(
    x: number,
    y: number,
    isPlayer: boolean,
    bulletSpeed: number = CONFIG.BULLET_SPEED,
    fireRate: number = CONFIG.FIRE_RATE,
    bulletColor: string,
    type: string,
    characterImage: HTMLImageElement,
  ) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = CONFIG.PLAYER_SPEED;
    this.bulletSpeed = bulletSpeed;
    this.fireRate = fireRate;
    this.lastShot = 0;
    this.isPlayer = isPlayer;
    this.bulletColor = bulletColor;
    this.health = isPlayer ? 4 : 2; 
    this.maxHealth = this.health; 
    this.isBuffed = false;
    this.type = type; 
    this.characterImage = characterImage;
    if (this.type === "fire") {
      this.width = this.width + 30
      this.height = this.height + 40
      this.health = 4
      this.maxHealth = 4
    }
  }
  draw(ctx: CanvasRenderingContext2D, isDead?: boolean) {
    ctx.save();
    if (isDead) return;

    ctx.translate(this.x + this.shakeOffsetX, this.y + this.shakeOffsetY);
    ctx.rotate(this.angle);
    let width = this.width;
    let height = this.height;
    if (this.isPlayer) {
      width = 70;
      height = 35;
    }

    ctx.scale(-1, 1); 
    ctx.drawImage(this.characterImage, -30, -15, width, height);

    this.drawHealthBar(ctx);

    ctx.restore();
  }

  drawHealthBar(ctx: CanvasRenderingContext2D) {
    const barWidth = 30;
    const barHeight = 4;
    const hpRatio = this.health / this.maxHealth;

    ctx.save();
    const translateY = this.type === "fire" ? 65 : 28; 
    ctx.translate(20, translateY); 

    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth / 2, 0, barWidth, barHeight);

    ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : hpRatio > 0.3 ? '#ff0' : '#f00';
    ctx.fillRect(-barWidth / 2, 0, barWidth * hpRatio, barHeight);

    ctx.restore();
  }

  heal() {
    if ( this.health < this.maxHealth ) {
      this.health++
    }
  }

  updatePosition(newX: number, newY: number) {
    this.x = newX;
    this.y = newY;
  }


  shoot(): Bullet | null {
    //Only for enemies
    if (Date.now() - this.lastShot > this.fireRate) {
      this.lastShot = Date.now();

      const barrelEndX = this.x + Math.cos(this.angle) * this.barrelSize;
      const barrelEndY = this.y + Math.sin(this.angle) * this.barrelSize;

      const bulletSize = this.type === "fire" ? 18 : 6;
      const bulletDamage = this.type === "fire" ? 4 : 1;

      return new Bullet(
          barrelEndX,  
          barrelEndY,  
          this.angle,
          this.bulletSpeed,
          this.bulletColor,
          bulletSize,
          this.isPlayer,
          bulletDamage,
          this.type
      );    }
    return null;
  }

  takeDamage(value): boolean | string {
    this.health -= value;
    this.applyShake();

    if (this.health <= 0) {
      if ( !this.isPlayer ) {
        const random = Math.floor(Math.random() * 10);
        if ( random > 7) { 
          return "drop_buff";
        }

        return "drop_heart"
      }
      return "explode"; 
    } 
   
    return false;
  }

  applyShake() {
    let shakeFrames = 6;
    let lastTime = 0;
    
    const shakeStep = (timestamp) => {
      if (!lastTime || timestamp - lastTime > 30) {
        this.shakeOffsetX = (Math.random() - 0.5) * 4;
        this.shakeOffsetY = (Math.random() - 0.5) * 4;
        shakeFrames--;
        lastTime = timestamp;
      }
      
      if (shakeFrames > 0) {
        requestAnimationFrame(shakeStep);
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    };
    
    requestAnimationFrame(shakeStep);
  }
}

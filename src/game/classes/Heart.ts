export class Heart {
  x: number;
  y: number;
  spawnTime: number;
  lifetime: number = 5000; 

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.spawnTime = Date.now();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍆", this.x, this.y);
  }

  isExpired(): boolean {
    return Date.now() - this.spawnTime > this.lifetime;
  }
}

export class Buff extends Heart {
  drawBuff(ctx: CanvasRenderingContext2D): void {
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍑", this.x, this.y);
  }
}
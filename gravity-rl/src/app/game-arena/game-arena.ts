import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import * as Matter from 'matter-js';
import { PhysicsEngineService } from '../physics-engine.service';
import { GameStateService, GameState } from '../game-state.service';
import { SkillsService } from '../skills.service';
import { InputController, ActionType } from '../input-controller.service';

export interface GameConfig {
  // Arena
  arenaWidth: number;
  arenaHeight: number;
  
  // Balls
  numObstacles: number;
  playerRadius: number;
  targetRadius: number;
  obstacleRadius: number;
  
  // Physics
  restitution: number;
  friction: number;
  airFriction: number;
  
  // Timer
  initialTime: number;
  timeBonus: number;
  
  // Skills
  brakeConstant: number;
  magnetizeRadius: number;
  magnetizeStrength: number;
  gravityBombDuration: number;
  gravityBombStrength: number;
}

@Component({
  selector: 'app-game-arena',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-arena.html',
  styleUrl: './game-arena.css'
})
export class GameArenaComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private subscriptions: Subscription[] = [];
  private isPaused: boolean = false;
  
  // Eating animation state
  private isEatingAnimation: boolean = false;
  private eatingAnimationProgress: number = 0;
  private eatingTargetBody: Matter.Body | null = null;
  private readonly EATING_DURATION = 1.5; // seconds
  private nomTexts: Array<{ x: number; y: number; opacity: number; age: number }> = [];
  private nomSpawnTimer: number = 0;
  private readonly NOM_SPAWN_INTERVAL = 0.15; // Spawn "NOM" text every 0.15 seconds
  
  // Spawn animation state
  private isSpawningAnimation: boolean = false;
  private spawnAnimationProgress: number = 0;
  private spawnTargetBody: Matter.Body | null = null;
  private readonly SPAWN_DURATION = 0.5; // seconds
  
  // Scoring system
  private totalScore: number = 0;
  private targetsEaten: number = 0;
  private currentTargetBonus: number = 0;
  private remainingBonusToAdd: number = 0;
  
  // Skill charge system
  private brakeCharge: number = 100; // 0-100
  private magnetizeCharge: number = 100; // 0-100
  private brakeRechargeTimer: number = 0; // Time until recharge starts
  private magnetizeRechargeTimer: number = 0; // Time until recharge starts
  
  // Magnetize wave animation
  private magnetizeWaves: Array<{ radius: number; opacity: number }> = [];
  private magnetizeWaveTimer: number = 0;
  private magnetizeAffectedBalls: Array<{ body: Matter.Body; forceMagnitude: number; distance: number }> = [];
  private readonly WAVE_SPAWN_INTERVAL = 0.2; // Spawn new wave every 0.2 seconds
  private readonly WAVE_COLLAPSE_SPEED = 150; // Pixels per second
  private readonly WAVE_MAX_RADIUS = 80; // Start radius (smaller than magnetize radius)
  
  // Gravity bomb charge system (3 independent charges)
  private gravityBombCharges: number[] = [100, 100, 100]; // 3 independent charges (0-100)
  private gravityBombRechargeTimers: number[] = [0, 0, 0]; // Time until each charge starts recharging
  private readonly GRAVITY_BOMB_RECHARGE_TIME = 10; // 10 seconds to fully recharge
  private readonly GRAVITY_BOMB_TRIGGER_INTERVAL = 0; // Start recharging immediately after use
  private gravityBombAffectedBalls: Map<number, Array<{ body: Matter.Body; forceMagnitude: number; distance: number }>> = new Map();
  
  // Poof animation for removed gravity bombs
  private poofEffects: Array<{ x: number; y: number; progress: number }> = [];
  private readonly POOF_DURATION = 0.3; // seconds
  
  private currentState: GameState = {
    balls: [],
    timer: 0,
    score: 0,
    activeSkills: [],
    isGameOver: false,
  };
  
  private gameConfig: GameConfig = {
    // Arena
    arenaWidth: 800,
    arenaHeight: 600,
    
    // Balls
    numObstacles: 5,
    playerRadius: 15,
    targetRadius: 15,
    obstacleRadius: 25,
    
    // Physics
    restitution: 1.0,
    friction: 0.0,
    airFriction: 0.0,
    
    // Timer
    initialTime: 30,
    timeBonus: 5,
    
    // Skills
    brakeConstant: 0.00001,
    magnetizeRadius: 120,
    magnetizeStrength: 0.75,
    gravityBombDuration: 3,
    gravityBombStrength: 0.1875, // Quarter of magnetize strength (0.75 / 4)
  };
  
  // Skill charge configuration
  private readonly BRAKE_COST_PER_USE = 0.25; // Charge depleted per frame when active (reduced by half)
  private readonly MAGNETIZE_COST_PER_USE = 0.5; // Charge depleted per frame when active
  private readonly RECHARGE_RATE = 10; // Charge restored per second
  private readonly TRIGGER_INTERVAL = 1.0; // Seconds before recharge starts after use
  private readonly BRAKE_TIME_SCALE = 0.3; // Slow physics to 30% speed when brake is active
  private brakePhysicsAccumulator: number = 0; // Accumulates time for physics updates during brake
  private previousPhysicsState: Map<number, { x: number; y: number }> = new Map(); // Previous positions for interpolation
  
  public timer$: Observable<number>;
  public score$: Observable<number>;
  
  constructor(
    private physics: PhysicsEngineService,
    private gameState: GameStateService,
    private skills: SkillsService,
    private input: InputController
  ) {
    // Create observables for timer and score from game state
    // These are connected to the template for reactive UI updates
    this.timer$ = this.gameState.state$.pipe(
      map(state => Math.round(state.timer))
    );
    this.score$ = this.gameState.state$.pipe(
      map(state => state.score)
    );
  }
  
  ngOnInit(): void {
    // Initialization will happen in ngAfterViewInit when canvas is available
  }
  
  ngAfterViewInit(): void {
    // Service initialization order is critical:
    // 1. Initialize physics engine first (creates the world)
    // 2. Set up input handlers (prepares event listeners)
    // 3. Subscribe to state changes (connects reactive streams)
    // 4. Start game loop (begins simulation)
    
    this.initializeGame();
    this.setupInputHandlers();
    
    // Subscribe to state changes for reactive rendering
    const stateSubscription = this.gameState.state$.subscribe(state => {
      this.currentState = state;
    });
    this.subscriptions.push(stateSubscription);
    
    this.startGameLoop();
  }
  
  ngOnDestroy(): void {
    // Cleanup order is important to prevent memory leaks:
    // 1. Cancel animation frame (stop game loop)
    // 2. Unsubscribe from all observables (stop reactive streams)
    // 3. Destroy physics engine (clean up Matter.js resources)
    
    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    
    // Unsubscribe from all observables
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    // Destroy physics engine
    this.physics.destroy();
  }
  
  /**
   * Initialize the game with all entities and configuration
   */
  private initializeGame(): void {
    // Get canvas context
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Failed to get canvas context');
      return;
    }
    this.ctx = context;
    
    // Set canvas dimensions (larger than arena to accommodate charge bars and score)
    const canvasMargin = 60; // Space for charge bars on sides
    const topMargin = 40; // Space for score at top
    canvas.width = this.gameConfig.arenaWidth + (canvasMargin * 2);
    canvas.height = this.gameConfig.arenaHeight + topMargin;
    
    // Initialize physics engine (arena is centered in canvas)
    this.physics.initialize({
      gravity: { x: 0, y: 0 },
      arenaWidth: this.gameConfig.arenaWidth,
      arenaHeight: this.gameConfig.arenaHeight,
      restitution: this.gameConfig.restitution,
      friction: this.gameConfig.friction,
      airFriction: this.gameConfig.airFriction,
    });
    
    // Configure skills service
    this.skills.setConfig({
      brakeConstant: this.gameConfig.brakeConstant,
      magnetizeRadius: this.gameConfig.magnetizeRadius,
      magnetizeStrength: this.gameConfig.magnetizeStrength,
      gravityBombDuration: this.gameConfig.gravityBombDuration,
      gravityBombStrength: this.gameConfig.gravityBombStrength,
      gravityBombRadius: this.gameConfig.playerRadius / 2, // Half of player radius
      gravityBombEffectRadius: 80, // Smaller than magnetize (120)
    });
    
    // Create player ball with random position and velocity
    const playerX = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
    const playerY = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
    const playerBall = this.physics.createBall({
      x: playerX,
      y: playerY,
      radius: this.gameConfig.playerRadius,
      mass: 1,
      isStatic: false,
      color: '#00ff00', // Green for player
      label: 'player',
    });
    // Give player a random initial velocity
    const playerVx = (Math.random() - 0.5) * 4;
    const playerVy = (Math.random() - 0.5) * 4;
    Matter.Body.setVelocity(playerBall, { x: playerVx, y: playerVy });
    
    // Create target ball with random position and velocity
    const targetX = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
    const targetY = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
    const targetBall = this.physics.createBall({
      x: targetX,
      y: targetY,
      radius: this.gameConfig.targetRadius,
      mass: 1,
      isStatic: false,
      color: '#ffff00', // Yellow for target
      label: 'target',
    });
    // Give target a random initial velocity
    const targetVx = (Math.random() - 0.5) * 4;
    const targetVy = (Math.random() - 0.5) * 4;
    Matter.Body.setVelocity(targetBall, { x: targetVx, y: targetVy });
    
    // Create N obstacle balls with random positions and velocities
    for (let i = 0; i < this.gameConfig.numObstacles; i++) {
      // Random position within arena bounds
      const x = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
      const y = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
      
      const obstacleBall = this.physics.createBall({
        x,
        y,
        radius: this.gameConfig.obstacleRadius,
        mass: 2,
        isStatic: false,
        color: '#ff0000', // Red for obstacles
        label: 'obstacle',
      });
      // Give each obstacle a random initial velocity
      const vx = (Math.random() - 0.5) * 4;
      const vy = (Math.random() - 0.5) * 4;
      Matter.Body.setVelocity(obstacleBall, { x: vx, y: vy });
    }
    
    // Initialize timer
    this.gameState.updateTimer(this.gameConfig.initialTime);
    
    // Initial state sync
    this.gameState.updateFromPhysics(this.physics.getBodies());
  }
  
  /**
   * Public interface for executing actions by ID
   * Used by both keyboard input and AI agents
   * @param actionID The action to execute (0=none, 1=brake, 2=magnetize, 3=gravity bomb)
   * @param position Optional position for gravity bomb
   */
  public executeAction(actionID: number, position?: Matter.Vector): void {
    const playerBody = this.physics.getBodyByLabel('player');
    
    if (!playerBody) {
      console.error('Player body not found');
      return;
    }
    
    switch (actionID) {
      case 0:
        // No action
        break;
        
      case 1:
        // Brake skill - check if charge is available
        if (this.brakeCharge > 0) {
          // Brake now slows down physics, not the player ball
          // The actual slowdown is applied in the update loop
          
          // Deplete charge
          this.brakeCharge = Math.max(0, this.brakeCharge - this.BRAKE_COST_PER_USE);
          // Reset recharge timer
          this.brakeRechargeTimer = this.TRIGGER_INTERVAL;
          // Mark skill as active
          this.gameState.setActiveSkill('brake', true);
        }
        break;
        
      case 2:
        // Magnetize skill - check if charge is available
        if (this.magnetizeCharge > 0) {
          const allBodies = this.physics.getBodies();
          this.magnetizeAffectedBalls = this.skills.applyMagnetize(playerBody, allBodies);
          // Deplete charge
          this.magnetizeCharge = Math.max(0, this.magnetizeCharge - this.MAGNETIZE_COST_PER_USE);
          // Reset recharge timer
          this.magnetizeRechargeTimer = this.TRIGGER_INTERVAL;
          // Mark skill as active
          this.gameState.setActiveSkill('magnetize', true);
        } else {
          this.magnetizeAffectedBalls = [];
        }
        break;
        
      case 3:
        // Gravity bomb skill - find first available charge
        let bombChargeIndex = -1;
        for (let i = 0; i < this.gravityBombCharges.length; i++) {
          if (this.gravityBombCharges[i] >= 100) {
            bombChargeIndex = i;
            break;
          }
        }
        
        if (bombChargeIndex >= 0 && position) {
          this.skills.createGravityBomb(position);
          // Deplete this charge slot
          this.gravityBombCharges[bombChargeIndex] = 0;
          // Start recharge timer for this slot
          this.gravityBombRechargeTimers[bombChargeIndex] = this.GRAVITY_BOMB_TRIGGER_INTERVAL;
        } else if (!position) {
          console.error('Gravity bomb requires a position');
        }
        break;
        
      default:
        // Invalid action ID - handle gracefully
        console.error(`Invalid action ID: ${actionID}. Valid range is 0-3.`);
        break;
    }
  }
  
  /**
   * Start the game loop using requestAnimationFrame
   */
  private startGameLoop(): void {
    let lastTime = performance.now();
    
    const gameLoop = (currentTime: number) => {
      // Calculate delta time in seconds
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      // Update game
      this.update(deltaTime);
      
      // Render
      this.render();
      
      // Continue loop
      this.animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    this.animationFrameId = requestAnimationFrame(gameLoop);
  }
  
  /**
   * Update game state each frame
   * @param deltaTime Time since last frame in seconds
   */
  private update(deltaTime: number): void {
    // Skip update if paused
    if (this.isPaused) {
      return;
    }
    
    // Handle eating animation (pauses physics but continues rendering)
    if (this.isEatingAnimation) {
      this.updateEatingAnimation(deltaTime);
      // Update game state from physics so rendering sees the shrinking ball
      const allBodies = this.physics.getBodies();
      this.gameState.updateFromPhysics(allBodies);
      // Don't continue to normal game logic
    } else if (this.isSpawningAnimation) {
      // Handle spawn animation (pauses physics but continues rendering)
      this.updateSpawnAnimation(deltaTime);
      // Update game state from physics so rendering sees the growing ball
      const allBodies = this.physics.getBodies();
      this.gameState.updateFromPhysics(allBodies);
      // Don't continue to normal game logic
    } else {
      // Normal game logic (only when NOT in eating or spawning animation)
      
      // Add 1 point per frame for survival
      this.totalScore += 1;
      
      // Check if skill keys are held and execute actions continuously
      if (this.input.isKeyHeld('Q')) {
        this.executeAction(1); // Brake
      }
      if (this.input.isKeyHeld('W')) {
        this.executeAction(2); // Magnetize
      }
      
      // Update skill charge recharge timers (this also updates wave animations)
      this.updateSkillCharges(deltaTime);
      
      // Check if brake is active
      let activeSkills: string[] = [];
      this.gameState.state$.subscribe(state => {
        activeSkills = state.activeSkills;
      }).unsubscribe();
      
      const brakeIsActive = activeSkills.includes('brake');
      
      // Update physics with frame skipping for brake slow-motion
      if (brakeIsActive) {
        // Accumulate time and only update physics when we've accumulated enough
        this.brakePhysicsAccumulator += deltaTime;
        const physicsFrameTime = 1 / 60; // 60 FPS
        const slowedFrameTime = physicsFrameTime / this.BRAKE_TIME_SCALE;
        
        if (this.brakePhysicsAccumulator >= slowedFrameTime) {
          // Save previous positions before update
          const allBodies = this.physics.getBodies();
          this.previousPhysicsState.clear();
          for (const body of allBodies) {
            this.previousPhysicsState.set(body.id, {
              x: body.position.x,
              y: body.position.y
            });
          }
          
          this.physics.update();
          this.brakePhysicsAccumulator -= slowedFrameTime;
        }
        
        // Interpolate positions for smooth rendering
        const interpolationFactor = this.brakePhysicsAccumulator / (physicsFrameTime / this.BRAKE_TIME_SCALE);
        const allBodies = this.physics.getBodies();
        for (const body of allBodies) {
          const prev = this.previousPhysicsState.get(body.id);
          if (prev) {
            // Interpolate between previous and current position
            const interpX = prev.x + (body.position.x - prev.x) * interpolationFactor;
            const interpY = prev.y + (body.position.y - prev.y) * interpolationFactor;
            // Temporarily set interpolated position for rendering
            (body as any)._renderX = interpX;
            (body as any)._renderY = interpY;
          }
        }
      } else {
        // Normal physics update every frame
        this.brakePhysicsAccumulator = 0;
        this.previousPhysicsState.clear();
        this.physics.update();
        
        // Clear interpolation flags
        const allBodies = this.physics.getBodies();
        for (const body of allBodies) {
          delete (body as any)._renderX;
          delete (body as any)._renderY;
        }
      }
      
      // Clear active skills after wave update (they'll be re-added next frame if keys are still held)
      this.gameState.setActiveSkill('brake', false);
      this.gameState.setActiveSkill('magnetize', false);
      
      // Update skills (gravity bombs)
      const allBodies = this.physics.getBodies();
      const bombUpdateResult = this.skills.updateGravityBombs(allBodies);
      this.gravityBombAffectedBalls = bombUpdateResult.affectedBallsMap;
      
      // Handle bombs that need to be removed (too close to balls)
      for (const bombSensor of bombUpdateResult.bombsToRemove) {
        // Add poof effect at bomb position
        this.poofEffects.push({
          x: bombSensor.position.x,
          y: bombSensor.position.y,
          progress: 0
        });
        // Remove the bomb
        this.skills.removeGravityBomb(bombSensor);
      }
      
      // Handle expired bombs (also show poof)
      const expiredBombs = this.skills.cleanupExpiredBombs();
      for (const bombSensor of expiredBombs) {
        // Add poof effect at bomb position
        this.poofEffects.push({
          x: bombSensor.position.x,
          y: bombSensor.position.y,
          progress: 0
        });
      }
      
      // Update poof effects
      this.poofEffects = this.poofEffects.filter(poof => {
        poof.progress += deltaTime / this.POOF_DURATION;
        return poof.progress < 1.0;
      });
      
      // Update game state from physics
      this.gameState.updateFromPhysics(allBodies);
      
      // Update timer countdown
      this.gameState.updateTimer(-deltaTime);
      
      // Handle collisions
      this.handleCollisions();
      
      // Check if timer expired
      let currentTimer = 0;
      this.gameState.state$.subscribe(state => {
        currentTimer = state.timer;
      }).unsubscribe();
      
      if (currentTimer <= 0) {
        this.resetEnvironment();
      }
    }
  }
  
  /**
   * Update skill charge levels and recharge timers
   * @param deltaTime Time since last frame in seconds
   */
  private updateSkillCharges(deltaTime: number): void {
    // Update brake recharge timer
    if (this.brakeRechargeTimer > 0) {
      this.brakeRechargeTimer -= deltaTime;
    } else if (this.brakeCharge < 100) {
      // Recharge brake
      this.brakeCharge = Math.min(100, this.brakeCharge + this.RECHARGE_RATE * deltaTime);
    }
    
    // Update magnetize recharge timer
    if (this.magnetizeRechargeTimer > 0) {
      this.magnetizeRechargeTimer -= deltaTime;
    } else if (this.magnetizeCharge < 100) {
      // Recharge magnetize
      this.magnetizeCharge = Math.min(100, this.magnetizeCharge + this.RECHARGE_RATE * deltaTime);
    }
    
    // Update gravity bomb recharge timers (3 independent charges)
    for (let i = 0; i < this.gravityBombCharges.length; i++) {
      if (this.gravityBombRechargeTimers[i] > 0) {
        this.gravityBombRechargeTimers[i] -= deltaTime;
      } else if (this.gravityBombCharges[i] < 100) {
        // Recharge this bomb slot (100% over 10 seconds = 10% per second)
        const rechargeRate = 100 / this.GRAVITY_BOMB_RECHARGE_TIME;
        this.gravityBombCharges[i] = Math.min(100, this.gravityBombCharges[i] + rechargeRate * deltaTime);
      }
    }
    
    // Get current active skills synchronously
    let activeSkills: string[] = [];
    this.gameState.state$.subscribe(state => {
      activeSkills = state.activeSkills;
    }).unsubscribe();
    
    // Update magnetize wave animation
    if (activeSkills.includes('magnetize')) {
      // Spawn first wave immediately if no waves exist
      if (this.magnetizeWaves.length === 0) {
        this.magnetizeWaves.push({
          radius: this.WAVE_MAX_RADIUS,
          opacity: 1.0
        });
        this.magnetizeWaveTimer = 0;
      }
      
      // Spawn new waves periodically
      this.magnetizeWaveTimer += deltaTime;
      if (this.magnetizeWaveTimer >= this.WAVE_SPAWN_INTERVAL) {
        this.magnetizeWaves.push({
          radius: this.WAVE_MAX_RADIUS,
          opacity: 1.0
        });
        this.magnetizeWaveTimer = 0;
      }
      
      // Update existing waves (collapse inward)
      this.magnetizeWaves = this.magnetizeWaves.filter(wave => {
        wave.radius -= this.WAVE_COLLAPSE_SPEED * deltaTime;
        wave.opacity = wave.radius / this.WAVE_MAX_RADIUS; // Fade as it collapses
        return wave.radius > 0; // Remove waves that reached center
      });
    } else {
      // Clear waves and affected balls when magnetize is not active
      this.magnetizeWaves = [];
      this.magnetizeAffectedBalls = [];
      this.magnetizeWaveTimer = 0;
    }
  }
  
  /**
   * Render the current game state to canvas
   */
  private render(): void {
    if (!this.ctx) {
      return;
    }
    
    const canvasMargin = 60; // Space for charge bars
    
    // Clear entire canvas and fill with background color for outside areas
    this.ctx.fillStyle = '#2a2a3a'; // Dark blue-gray background
    this.ctx.fillRect(0, 0, this.gameConfig.arenaWidth + (canvasMargin * 2), this.gameConfig.arenaHeight);
    
    // Render total score at the top center (before translating)
    const displayScore = Math.round(this.totalScore / 10);
    this.ctx.fillStyle = '#FFD700'; // Gold color
    this.ctx.font = 'bold 32px Impact, Arial Black, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(`SCORE: ${displayScore.toLocaleString()}`, (this.gameConfig.arenaWidth + canvasMargin * 2) / 2, 8);
    this.ctx.fillText(`SCORE: ${displayScore.toLocaleString()}`, (this.gameConfig.arenaWidth + canvasMargin * 2) / 2, 8);
    
    // Save context state
    this.ctx.save();
    
    // Translate to arena area (offset by margin and move down for score)
    this.ctx.translate(canvasMargin, 40);
    
    // Fill arena with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.gameConfig.arenaWidth, this.gameConfig.arenaHeight);
    
    // Draw arena boundaries
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(0, 0, this.gameConfig.arenaWidth, this.gameConfig.arenaHeight);
    
    // Render each ball at its current position (or interpolated position during brake)
    for (const ball of this.currentState.balls) {
      // Check if we have interpolated render position
      const bodies = this.physics.getBodies();
      const body = bodies.find(b => b.id.toString() === ball.id);
      const renderX = body && (body as any)._renderX !== undefined ? (body as any)._renderX : ball.x;
      const renderY = body && (body as any)._renderY !== undefined ? (body as any)._renderY : ball.y;
      
      this.ctx.beginPath();
      this.ctx.arc(renderX, renderY, ball.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = ball.color;
      this.ctx.fill();
      this.ctx.closePath();
    }
    
    // Render "NOM" text particles during eating animation
    if (this.nomTexts.length > 0) {
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      for (const nom of this.nomTexts) {
        // Draw text with bold outline for cartoon/anime effect
        this.ctx.font = 'bold 32px Impact, Arial Black, sans-serif';
        
        // Draw black outline (stroke)
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${nom.opacity})`;
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('NOM', nom.x, nom.y);
        
        // Draw yellow fill
        this.ctx.fillStyle = `rgba(255, 255, 0, ${nom.opacity})`;
        this.ctx.fillText('NOM', nom.x, nom.y);
      }
    }
    
    // Render skill visual indicators
    this.renderSkillIndicators();
    
    // Render poof effects
    this.renderPoofEffects();
    
    // Render pause indicator if paused
    if (this.isPaused) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.gameConfig.arenaWidth, this.gameConfig.arenaHeight);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('PAUSED', this.gameConfig.arenaWidth / 2, this.gameConfig.arenaHeight / 2);
      
      this.ctx.font = '24px Arial';
      this.ctx.fillText('Press S to resume', this.gameConfig.arenaWidth / 2, this.gameConfig.arenaHeight / 2 + 50);
    }
    
    // Restore context state
    this.ctx.restore();
    
    // Render skill charge bars (outside arena, no translation)
    this.renderChargeBars();
  }
  
  /**
   * Render charge bars for Brake and Magnetize skills
   */
  private renderChargeBars(): void {
    if (!this.ctx) {
      return;
    }
    
    const barWidth = 30;
    const barHeight = 200;
    const barMargin = 15;
    const barSpacing = 5; // Space between Q and W bars
    const topOffset = 40; // Offset for score display
    
    // Calculate positions for side-by-side bars on the left
    const barsStartY = topOffset + (this.gameConfig.arenaHeight - barHeight) / 2;
    const brakeX = barMargin;
    const magnetizeX = barMargin + barWidth + barSpacing;
    
    // Brake charge bar (Q)
    const brakeY = barsStartY;
    
    // Background
    this.ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    this.ctx.fillRect(brakeX, brakeY, barWidth, barHeight);
    
    // Charge level
    const brakeChargeHeight = (this.brakeCharge / 100) * barHeight;
    this.ctx.fillStyle = this.brakeCharge > 20 ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 100, 0, 0.8)';
    this.ctx.fillRect(brakeX, brakeY + barHeight - brakeChargeHeight, barWidth, brakeChargeHeight);
    
    // Border
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(brakeX, brakeY, barWidth, barHeight);
    
    // Label
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Q', brakeX + barWidth / 2, brakeY - 10);
    this.ctx.font = '12px Arial';
    this.ctx.fillText('Brake', brakeX + barWidth / 2, brakeY + barHeight + 15);
    
    // Magnetize charge bar (W) - next to brake bar
    const magnetizeY = barsStartY;
    
    // Background
    this.ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    this.ctx.fillRect(magnetizeX, magnetizeY, barWidth, barHeight);
    
    // Charge level
    const magnetizeChargeHeight = (this.magnetizeCharge / 100) * barHeight;
    this.ctx.fillStyle = this.magnetizeCharge > 20 ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 100, 0, 0.8)';
    this.ctx.fillRect(magnetizeX, magnetizeY + barHeight - magnetizeChargeHeight, barWidth, magnetizeChargeHeight);
    
    // Border
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(magnetizeX, magnetizeY, barWidth, barHeight);
    
    // Label
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('W', magnetizeX + barWidth / 2, magnetizeY - 10);
    this.ctx.font = '12px Arial';
    this.ctx.fillText('Magnetize', magnetizeX + barWidth / 2, magnetizeY + barHeight + 15);
    
    // Gravity bomb charges (3 circles horizontal, above Q and W bars)
    const bombRadius = 12;
    const bombSpacing = 30; // Horizontal spacing
    const bombY = barsStartY - 60; // Above the bars
    const bombStartX = barMargin + 2; // Align with left edge of bars
    
    for (let i = 0; i < 3; i++) {
      const bombX = bombStartX + i * bombSpacing;
      const charge = this.gravityBombCharges[i];
      
      // Background circle
      this.ctx.beginPath();
      this.ctx.arc(bombX, bombY, bombRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
      this.ctx.fill();
      this.ctx.closePath();
      
      // Charge level (pie chart)
      if (charge > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(bombX, bombY);
        this.ctx.arc(bombX, bombY, bombRadius, -Math.PI / 2, -Math.PI / 2 + (charge / 100) * Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fillStyle = charge >= 100 ? 'rgba(255, 0, 255, 0.8)' : 'rgba(150, 0, 150, 0.6)';
        this.ctx.fill();
      }
      
      // Border
      this.ctx.beginPath();
      this.ctx.arc(bombX, bombY, bombRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.closePath();
    }
    
    // Label for gravity bombs (above the circles)
    this.ctx.fillStyle = 'white';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Click: Gravity Bomb', bombStartX, bombY - bombRadius - 5);
  }
  
  /**
   * Render visual indicators for active skills
   */
  private renderSkillIndicators(): void {
    if (!this.ctx) {
      return;
    }
    
    // Find player ball
    const playerBall = this.currentState.balls.find(b => b.label === 'player');
    if (!playerBall) {
      return;
    }
    
    // Render magnetize wave effect (if there are any waves)
    if (this.magnetizeWaves.length > 0) {
      // Draw collapsing wave circles
      for (const wave of this.magnetizeWaves) {
        this.ctx.beginPath();
        this.ctx.arc(playerBall.x, playerBall.y, wave.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(0, 255, 255, ${wave.opacity * 0.6})`;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.closePath();
      }
      
      // Draw static outer radius indicator (faint)
      this.ctx.beginPath();
      this.ctx.arc(playerBall.x, playerBall.y, this.gameConfig.magnetizeRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      this.ctx.closePath();
    }
    
    // Render circles around affected balls (color indicates force strength)
    if (this.magnetizeAffectedBalls.length > 0) {
      for (const affected of this.magnetizeAffectedBalls) {
        const ball = this.currentState.balls.find(b => b.id === affected.body.id.toString());
        if (!ball) continue;
        
        // Calculate color intensity based on force (normalize to 0-1 range)
        // Stronger force = brighter/more opaque
        const maxForce = 0.01; // Approximate max force for normalization
        const intensity = Math.min(affected.forceMagnitude / maxForce, 1.0);
        
        // Color gradient: weak (cyan/blue) to strong (yellow/white)
        const r = Math.floor(intensity * 255);
        const g = 255;
        const b = Math.floor((1 - intensity) * 255);
        
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius + 5, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + intensity * 0.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
    
    // Render gravity bombs with animations
    const gravityBombs = this.skills.getGravityBombs();
    for (const bomb of gravityBombs) {
      // Render bomb center
      this.ctx.beginPath();
      this.ctx.arc(bomb.position.x, bomb.position.y, 7.5, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
      this.ctx.fill();
      this.ctx.closePath();
      
      // Render circles around affected balls
      const affectedBalls = this.gravityBombAffectedBalls.get(bomb.sensor.id) || [];
      for (const affected of affectedBalls) {
        const ball = this.currentState.balls.find(b => b.id === affected.body.id.toString());
        if (!ball) continue;
        
        // Calculate color intensity based on force
        const maxForce = 0.01;
        const intensity = Math.min(affected.forceMagnitude / maxForce, 1.0);
        
        // Color gradient: weak (purple/blue) to strong (magenta/white)
        const r = 255;
        const g = Math.floor((1 - intensity) * 100);
        const b = 255;
        
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius + 5, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + intensity * 0.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
    
    // Render brake effect (optional visual feedback)
    if (this.currentState.activeSkills.includes('brake')) {
      // Draw a small indicator near the player
      this.ctx.beginPath();
      this.ctx.arc(playerBall.x, playerBall.y - playerBall.radius - 10, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
      this.ctx.fill();
      this.ctx.closePath();
    }
  }
  
  /**
   * Render poof effects for removed gravity bombs
   */
  private renderPoofEffects(): void {
    if (!this.ctx) {
      return;
    }
    
    for (const poof of this.poofEffects) {
      // Calculate animation progress (0 to 1)
      const progress = poof.progress;
      
      // Expanding circle with fading opacity
      const maxRadius = 30;
      const radius = progress * maxRadius;
      const opacity = 1 - progress;
      
      // Draw expanding purple circle
      this.ctx.beginPath();
      this.ctx.arc(poof.x, poof.y, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(255, 0, 255, ${opacity * 0.8})`;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
      this.ctx.closePath();
      
      // Draw inner expanding circle for more effect
      const innerRadius = progress * maxRadius * 0.6;
      this.ctx.beginPath();
      this.ctx.arc(poof.x, poof.y, innerRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(255, 100, 255, ${opacity})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.closePath();
      
      // Draw "POOF!" text
      if (progress < 0.7) {
        const textOpacity = opacity * 1.5; // Fade faster than circles
        this.ctx.font = 'bold 20px Impact, Arial Black, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Draw black outline
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${textOpacity})`;
        this.ctx.lineWidth = 3;
        this.ctx.strokeText('POOF!', poof.x, poof.y);
        
        // Draw magenta fill
        this.ctx.fillStyle = `rgba(255, 0, 255, ${textOpacity})`;
        this.ctx.fillText('POOF!', poof.x, poof.y);
      }
    }
  }
  
  /**
   * Handle collisions between player and target
   */
  private handleCollisions(): void {
    const playerBody = this.physics.getBodyByLabel('player');
    const targetBody = this.physics.getBodyByLabel('target');
    
    if (!playerBody || !targetBody) {
      return;
    }
    
    // Calculate distance between player and target
    const dx = targetBody.position.x - playerBody.position.x;
    const dy = targetBody.position.y - playerBody.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if they are close enough (within 1.25x the sum of radii)
    const playerRadius = playerBody.circleRadius || 0;
    const targetRadius = targetBody.circleRadius || 0;
    const successDistance = (playerRadius + targetRadius) * 1.25;
    
    if (distance < successDistance) {
      // Success - add time bonus
      this.gameState.updateTimer(this.gameConfig.timeBonus);
      
      // Add score
      this.gameState.addScore(1);
      
      // Start eating animation
      this.startEatingAnimation(targetBody);
    }
  }
  
  /**
   * Start the eating animation
   * @param targetBody The target body to be eaten
   */
  private startEatingAnimation(targetBody: Matter.Body): void {
    this.isEatingAnimation = true;
    this.eatingAnimationProgress = 0;
    this.eatingTargetBody = targetBody;
    this.nomTexts = [];
    this.nomSpawnTimer = 0;
    
    // Calculate bonus for this target
    this.targetsEaten += 1;
    this.currentTargetBonus = 500 * this.targetsEaten;
    this.remainingBonusToAdd = this.currentTargetBonus;
    
    // Clear all active skill effects
    this.magnetizeWaves = [];
    this.magnetizeAffectedBalls = [];
    this.gameState.setActiveSkill('brake', false);
    this.gameState.setActiveSkill('magnetize', false);
  }
  
  /**
   * Update the eating animation
   * @param deltaTime Time since last frame in seconds
   */
  private updateEatingAnimation(deltaTime: number): void {
    if (!this.eatingTargetBody) {
      this.isEatingAnimation = false;
      return;
    }
    
    // Update progress
    this.eatingAnimationProgress += deltaTime / this.EATING_DURATION;
    
    // Calculate shrink scale (1.0 to 0.0)
    const shrinkScale = Math.max(0, 1 - this.eatingAnimationProgress);
    
    // Scale the target body
    if (shrinkScale > 0.01) {
      // Calculate current radius and target shrink
      const currentRadius = this.eatingTargetBody.circleRadius || this.gameConfig.targetRadius;
      const targetShrinkRadius = this.gameConfig.targetRadius * shrinkScale;
      const scaleRatio = targetShrinkRadius / currentRadius;
      
      if (scaleRatio > 0 && scaleRatio < 1) {
        Matter.Body.scale(this.eatingTargetBody, scaleRatio, scaleRatio);
      }
    }
    
    // Spawn "NOM" text particles around player ball
    const playerBody = this.physics.getBodyByLabel('player');
    if (playerBody) {
      this.nomSpawnTimer += deltaTime;
      if (this.nomSpawnTimer >= this.NOM_SPAWN_INTERVAL) {
        // Spawn new NOM text at random angle around player
        const angle = Math.random() * Math.PI * 2;
        const distance = this.gameConfig.playerRadius + 30 + Math.random() * 20; // 30-50 pixels from player edge
        const nomX = playerBody.position.x + Math.cos(angle) * distance;
        const nomY = playerBody.position.y + Math.sin(angle) * distance;
        
        this.nomTexts.push({
          x: nomX,
          y: nomY,
          opacity: 1.0,
          age: 0
        });
        
        // Add portion of bonus score with each NOM
        // Calculate how many NOMs will spawn during the eating animation
        const totalNoms = Math.floor(this.EATING_DURATION / this.NOM_SPAWN_INTERVAL);
        const scorePerNom = Math.ceil(this.currentTargetBonus / totalNoms);
        const scoreToAdd = Math.min(scorePerNom, this.remainingBonusToAdd);
        this.totalScore += scoreToAdd;
        this.remainingBonusToAdd -= scoreToAdd;
        
        this.nomSpawnTimer = 0;
      }
    }
    
    // Update existing NOM texts (fade out over 1.0 seconds)
    this.nomTexts = this.nomTexts.filter(nom => {
      nom.age += deltaTime;
      nom.opacity = Math.max(0, 1 - nom.age / 1.0);
      return nom.age < 1.0; // Remove after 1.0 seconds
    });
    
    // Animation complete
    if (this.eatingAnimationProgress >= 1.0) {
      // Remove the eaten target
      Matter.World.remove((this.physics as any).world, this.eatingTargetBody);
      
      // Start spawn animation for new target
      this.startSpawnAnimation();
      
      // Reset eating animation state
      this.isEatingAnimation = false;
      this.eatingAnimationProgress = 0;
      this.eatingTargetBody = null;
      this.nomTexts = [];
    }
  }
  
  /**
   * Start the spawn animation for a new target ball
   */
  private startSpawnAnimation(): void {
    // Create new target ball at small size
    const targetX = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
    const targetY = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
    const targetBall = this.physics.createBall({
      x: targetX,
      y: targetY,
      radius: 1, // Start very small
      mass: 1,
      isStatic: false,
      color: '#ffff00', // Yellow for target
      label: 'target',
    });
    const targetVx = (Math.random() - 0.5) * 4;
    const targetVy = (Math.random() - 0.5) * 4;
    Matter.Body.setVelocity(targetBall, { x: targetVx, y: targetVy });
    
    this.isSpawningAnimation = true;
    this.spawnAnimationProgress = 0;
    this.spawnTargetBody = targetBall;
  }
  
  /**
   * Update the spawn animation
   * @param deltaTime Time since last frame in seconds
   */
  private updateSpawnAnimation(deltaTime: number): void {
    if (!this.spawnTargetBody) {
      this.isSpawningAnimation = false;
      return;
    }
    
    // Update progress
    this.spawnAnimationProgress += deltaTime / this.SPAWN_DURATION;
    
    // Calculate grow scale (0.0 to 1.0)
    const growScale = Math.min(1.0, this.spawnAnimationProgress);
    
    // Scale the target body
    if (growScale < 1.0) {
      // Calculate current radius and target grow
      const currentRadius = this.spawnTargetBody.circleRadius || 1;
      const targetGrowRadius = this.gameConfig.targetRadius * growScale;
      const scaleRatio = targetGrowRadius / currentRadius;
      
      if (scaleRatio > 1) {
        Matter.Body.scale(this.spawnTargetBody, scaleRatio, scaleRatio);
        // Reset mass to 1 (scaling changes mass, we need to fix it)
        Matter.Body.setMass(this.spawnTargetBody, 1);
      }
    }
    
    // Animation complete
    if (this.spawnAnimationProgress >= 1.0) {
      // Ensure final mass is correct
      Matter.Body.setMass(this.spawnTargetBody, 1);
      
      // Update game state
      this.gameState.updateFromPhysics(this.physics.getBodies());
      
      // Reset spawn animation state
      this.isSpawningAnimation = false;
      this.spawnAnimationProgress = 0;
      this.spawnTargetBody = null;
    }
  }
  
  /**
   * Spawn a new target ball at a random position with random velocity
   * (Used for environment reset, not for eating animation)
   */
  private spawnNewTarget(): void {
    const targetX = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
    const targetY = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
    const targetBall = this.physics.createBall({
      x: targetX,
      y: targetY,
      radius: this.gameConfig.targetRadius,
      mass: 1,
      isStatic: false,
      color: '#ffff00', // Yellow for target
      label: 'target',
    });
    const targetVx = (Math.random() - 0.5) * 4;
    const targetVy = (Math.random() - 0.5) * 4;
    Matter.Body.setVelocity(targetBall, { x: targetVx, y: targetVy });
    
    // Update game state
    this.gameState.updateFromPhysics(this.physics.getBodies());
  }
  
  /**
   * Reset the environment to initial state
   */
  private resetEnvironment(): void {
    // Remove all existing balls from physics world
    this.physics.reset();
    
    // Reset skill charges
    this.brakeCharge = 100;
    this.magnetizeCharge = 100;
    this.brakeRechargeTimer = 0;
    this.magnetizeRechargeTimer = 0;
    this.gravityBombCharges = [100, 100, 100];
    this.gravityBombRechargeTimers = [0, 0, 0];
    
    // Reset scoring
    this.totalScore = 0;
    this.targetsEaten = 0;
    
    // Recreate player ball at random position with random velocity
    const playerX = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
    const playerY = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
    const playerBall = this.physics.createBall({
      x: playerX,
      y: playerY,
      radius: this.gameConfig.playerRadius,
      mass: 1,
      isStatic: false,
      color: '#00ff00',
      label: 'player',
    });
    const playerVx = (Math.random() - 0.5) * 4;
    const playerVy = (Math.random() - 0.5) * 4;
    Matter.Body.setVelocity(playerBall, { x: playerVx, y: playerVy });
    
    // Recreate target ball at random position with random velocity
    const targetX = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
    const targetY = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
    const targetBall = this.physics.createBall({
      x: targetX,
      y: targetY,
      radius: this.gameConfig.targetRadius,
      mass: 1,
      isStatic: false,
      color: '#ffff00',
      label: 'target',
    });
    const targetVx = (Math.random() - 0.5) * 4;
    const targetVy = (Math.random() - 0.5) * 4;
    Matter.Body.setVelocity(targetBall, { x: targetVx, y: targetVy });
    
    // Recreate N obstacle balls at random positions with random velocities
    for (let i = 0; i < this.gameConfig.numObstacles; i++) {
      const x = 100 + Math.random() * (this.gameConfig.arenaWidth - 200);
      const y = 100 + Math.random() * (this.gameConfig.arenaHeight - 200);
      
      const obstacleBall = this.physics.createBall({
        x,
        y,
        radius: this.gameConfig.obstacleRadius,
        mass: 2,
        isStatic: false,
        color: '#ff0000',
        label: 'obstacle',
      });
      const vx = (Math.random() - 0.5) * 4;
      const vy = (Math.random() - 0.5) * 4;
      Matter.Body.setVelocity(obstacleBall, { x: vx, y: vy });
    }
    
    // Reset timer to T seconds
    this.gameState.reset();
    this.gameState.updateTimer(this.gameConfig.initialTime);
    
    // Update state from physics
    this.gameState.updateFromPhysics(this.physics.getBodies());
  }
  
  /**
   * Set up input handlers for keyboard and mouse
   */
  private setupInputHandlers(): void {
    const canvas = this.canvasRef.nativeElement;
    
    // Subscribe to keyboard events (both keydown and keyup)
    const keydownHandler = (event: KeyboardEvent) => {
      // Handle pause toggle with 'S' key
      if (event.key.toLowerCase() === 's') {
        this.isPaused = !this.isPaused;
        return;
      }
      
      this.input.handleKeyboardEvent(event);
    };
    
    const keyupHandler = (event: KeyboardEvent) => {
      this.input.handleKeyboardEvent(event);
    };
    
    // Subscribe to mouse click events
    const clickHandler = (event: MouseEvent) => {
      this.input.handleMouseEvent(event, canvas);
    };
    
    // Add event listeners
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyupHandler);
    canvas.addEventListener('click', clickHandler);
    
    // Subscribe to InputController action$ observable (for gravity bomb clicks)
    const actionSubscription = this.input.action$.subscribe(action => {
      // Only handle gravity bomb from observable (Q and W are handled in update loop)
      if (action.type === 3) {
        this.executeAction(action.type, action.position);
      }
    });
    
    this.subscriptions.push(actionSubscription);
    
    // Store cleanup functions
    this.subscriptions.push({
      unsubscribe: () => {
        document.removeEventListener('keydown', keydownHandler);
        document.removeEventListener('keyup', keyupHandler);
        canvas.removeEventListener('click', clickHandler);
      }
    } as any);
  }
}

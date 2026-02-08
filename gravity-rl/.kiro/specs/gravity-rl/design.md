# Design Document: Project Gravity-RL

## Overview

Project Gravity-RL is an Angular-based physics game that uses Matter.js for 2D physics simulation. The architecture is designed with modularity and AI-readiness as core principles, allowing seamless transition from human keyboard control to reinforcement learning agents powered by TensorFlow.js.

The game operates in a zero-gravity environment where a player-controlled ball must collide with a target ball while navigating obstacles and using special skills. The design emphasizes:

- Clear separation between physics simulation, state management, and rendering
- Observable state streams for reactive UI and AI integration
- Action-based control interface compatible with both human and AI agents
- Elastic collision physics for predictable, deterministic behavior

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                   GameArenaComponent                     │
│  (Canvas Rendering + User Input + Game Loop)            │
└───────────┬─────────────────────────────────┬───────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐         ┌──────────────────────┐
│ PhysicsEngineService  │◄────────┤  GameStateService    │
│  (Matter.js World)    │         │  (Observable State)  │
└───────────────────────┘         └──────────────────────┘
            │                                 │
            │                                 ▼
            │                     ┌──────────────────────┐
            │                     │   InputController    │
            │                     │ (Keyboard/AI Switch) │
            │                     └──────────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐         ┌──────────────────────┐
│    SkillsService      │         │  TensorFlowService   │
│ (Brake/Magnet/Bomb)   │         │   (AI Agent - TBD)   │
└───────────────────────┘         └──────────────────────┘
```

### Service Responsibilities

**PhysicsEngineService**
- Initializes and manages the Matter.js Engine and World
- Creates and manages all physics bodies (balls, walls, sensors)
- Handles collision detection and response
- Runs the physics simulation loop
- Exposes methods for applying forces to bodies

**GameStateService**
- Maintains the current state of all game entities
- Provides observable streams of state changes
- Formats state as flat arrays for AI consumption
- Tracks game metadata (timer, score, active skills)

**SkillsService**
- Implements the three skill mechanics (Brake, Magnetize, Gravity Bomb)
- Calculates and applies forces based on skill logic
- Manages skill cooldowns and durations
- Handles temporary physics bodies (e.g., Gravity Bomb sensor)

**GameArenaComponent**
- Manages the HTML canvas and rendering context
- Subscribes to state changes and renders the current frame
- Handles user input (keyboard, mouse clicks)
- Orchestrates the game loop (timer, collision detection, reset)
- Exposes the executeAction(actionID) interface
- Manages pause state and prevents updates when paused

**InputController (Service)**
- Abstracts input sources (keyboard vs AI)
- Maps keyboard events to action IDs
- Provides a unified interface for action execution
- Allows runtime switching between input modes

**TensorFlowService (Placeholder)**
- Placeholder for future AI agent implementation
- Will consume observations from GameStateService
- Will call executeAction() based on model predictions
- Currently dormant with stub methods

## Components and Interfaces

### PhysicsEngineService

```typescript
interface PhysicsConfig {
  gravity: { x: number; y: number };
  arenaWidth: number;
  arenaHeight: number;
  restitution: number;
  friction: number;
  airFriction: number;
}

interface BallConfig {
  x: number;
  y: number;
  radius: number;
  mass: number;
  isStatic: boolean;
  color: string;
  label: string; // 'player', 'target', 'obstacle'
}

class PhysicsEngineService {
  private engine: Matter.Engine;
  private world: Matter.World;
  private runner: Matter.Runner;
  
  initialize(config: PhysicsConfig): void;
  createBall(config: BallConfig): Matter.Body;
  createWalls(width: number, height: number): Matter.Body[];
  applyForce(body: Matter.Body, force: Matter.Vector): void;
  getBodies(): Matter.Body[];
  getBodyByLabel(label: string): Matter.Body | undefined;
  update(): void; // Called each frame
  reset(): void;
  destroy(): void;
}
```

### GameStateService

```typescript
interface BallState {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface GameState {
  balls: BallState[];
  timer: number;
  score: number;
  activeSkills: string[];
  isGameOver: boolean;
}

class GameStateService {
  private stateSubject: BehaviorSubject<GameState>;
  public state$: Observable<GameState>;
  
  updateFromPhysics(bodies: Matter.Body[]): void;
  getObservationArray(): number[]; // Flat array for AI
  updateTimer(delta: number): void;
  addScore(points: number): void;
  setActiveSkill(skill: string, active: boolean): void;
  reset(): void;
}
```

### SkillsService

```typescript
interface SkillConfig {
  brakeConstant: number;
  magnetizeRadius: number;
  magnetizeStrength: number;
  gravityBombDuration: number;
  gravityBombStrength: number;
}

interface GravityBomb {
  position: Matter.Vector;
  createdAt: number;
  duration: number;
  sensor: Matter.Body;
}

class SkillsService {
  constructor(
    private physics: PhysicsEngineService,
    private config: SkillConfig
  ) {}
  
  applyBrake(playerBody: Matter.Body): void;
  applyMagnetize(playerBody: Matter.Body, allBodies: Matter.Body[]): Array<{ body: Matter.Body; forceMagnitude: number; distance: number }>;
  createGravityBomb(position: Matter.Vector): GravityBomb;
  updateGravityBombs(allBodies: Matter.Body[]): void;
  cleanupExpiredBombs(): void;
}
```

**Important Note on Magnetize Skill:**
The `applyMagnetize()` method applies magnetic forces using the inverse-square law F = G / r² (not gravitational, so mass-independent). It applies equal and opposite forces to both the player and affected balls (Newton's third law), creating a recoil effect. The method returns an array of affected balls with their force magnitudes for visual feedback rendering.

### GameArenaComponent

```typescript
@Component({
  selector: 'app-game-arena',
  template: `
    <div class="game-container">
      <canvas #gameCanvas></canvas>
      <div class="game-ui">
        <div class="timer">Time: {{ timer$ | async }}</div>
        <div class="score">Score: {{ score$ | async }}</div>
        <div class="controls">
          <p>Q: Brake | W: Magnetize | Click: Gravity Bomb | S: Pause</p>
        </div>
      </div>
    </div>
  `
})
class GameArenaComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef: ElementRef<HTMLCanvasElement>;
  
  private ctx: CanvasRenderingContext2D;
  private animationFrameId: number;
  private gameConfig: GameConfig;
  private isPaused: boolean;
  
  public timer$: Observable<number>;
  public score$: Observable<number>;
  
  // Skill charge system
  private brakeCharge: number;
  private magnetizeCharge: number;
  private brakeRechargeTimer: number;
  private magnetizeRechargeTimer: number;
  
  constructor(
    private physics: PhysicsEngineService,
    private gameState: GameStateService,
    private skills: SkillsService,
    private input: InputController
  ) {}
  
  ngOnInit(): void;
  ngOnDestroy(): void;
  
  // Public API for AI integration
  executeAction(actionID: number, position?: Matter.Vector): void;
  
  private initializeGame(): void;
  private startGameLoop(): void;
  private update(deltaTime: number): void;
  private updateSkillCharges(deltaTime: number): void;
  private render(): void;
  private renderChargeBars(): void;
  private handleCollisions(): void;
  private resetEnvironment(): void;
  private setupInputHandlers(): void;
  private togglePause(): void;
}
```

### InputController

```typescript
enum ActionType {
  NONE = 0,
  BRAKE = 1,
  MAGNETIZE = 2,
  GRAVITY_BOMB = 3
}

interface InputAction {
  type: ActionType;
  position?: Matter.Vector;
}

class InputController {
  private actionSubject: Subject<InputAction>;
  public action$: Observable<InputAction>;
  private inputMode: 'keyboard' | 'ai';
  
  setInputMode(mode: 'keyboard' | 'ai'): void;
  handleKeyboardEvent(event: KeyboardEvent): void;
  handleMouseEvent(event: MouseEvent, canvas: HTMLCanvasElement): void;
  triggerAction(action: InputAction): void; // For AI to call
}
```

## Data Models

### Ball Entity

Each ball in the game is represented by a Matter.js Body with additional metadata:

```typescript
interface BallEntity {
  body: Matter.Body;        // Physics body
  label: string;            // 'player', 'target', 'obstacle'
  color: string;            // Hex color for rendering
  radius: number;           // Visual radius
  isStatic: boolean;        // Whether it moves
}
```

### Game Configuration

```typescript
interface GameConfig {
  // Arena
  arenaWidth: number;       // Default: 800
  arenaHeight: number;      // Default: 600
  
  // Balls
  numObstacles: number;     // N obstacles
  playerRadius: number;     // Default: 15
  targetRadius: number;     // Default: 20
  obstacleRadius: number;   // Default: 25
  
  // Physics
  restitution: number;      // Default: 1.0 (elastic)
  friction: number;         // Default: 0.0
  airFriction: number;      // Default: 0.0
  
  // Timer
  initialTime: number;      // T seconds
  timeBonus: number;        // M seconds per target hit
  
  // Skills
  brakeConstant: number;    // Force multiplier (default: 0.00001)
  magnetizeRadius: number;  // Pixels (default: 120)
  magnetizeStrength: number;// Force constant (default: 0.75)
  gravityBombDuration: number; // X seconds
  gravityBombStrength: number; // Force multiplier
  
  // Skill Charge System
  brakeCostPerUse: number;      // Charge depleted per frame (default: 0.5)
  magnetizeCostPerUse: number;  // Charge depleted per frame (default: 0.5)
  rechargeRate: number;         // Charge restored per second (default: 10)
  triggerInterval: number;      // Seconds before recharge starts (default: 1.0)
}
```

### Skill Charge System

The Brake and Magnetize skills use a charge-based capacity system to prevent unlimited usage:

**Charge Mechanics:**
- Each skill has a charge level from 0-100
- Using a skill depletes charge per frame (Brake: 2/frame, Magnetize: 3/frame)
- Skills cannot be used when charge reaches 0
- After skill use, a trigger interval timer starts (default: 1 second)
- If the skill is used again before the timer expires, the timer resets to full duration
- Once the timer expires, charge regenerates at a configured rate (default: 10/second)

**Visual Representation:**
- Brake charge bar: Displayed on the left side of the arena (outside playing field)
- Magnetize charge bar: Displayed on the right side of the arena (outside playing field)
- Charge bars show current charge level with color coding:
  - Yellow/Cyan: Charge > 20%
  - Orange: Charge ≤ 20% (low warning)
- Canvas is expanded to accommodate charge bars (920x600 vs 800x600 arena)

**Magnetize Visual Effects:**
- Collapsing wave circles: Multiple cyan circles spawn at the magnetize radius and collapse inward toward the player
  - Wave spawn interval: 0.2 seconds
  - Wave max radius: 80 pixels
  - Wave collapse speed: 150 pixels/second
  - First wave spawns immediately when skill is activated
- Affected ball indicators: Colored circles appear around balls within magnetize radius
  - Color indicates force strength: cyan/blue (weak) to yellow/white (strong)
  - Opacity increases with force strength
  - Circles disappear immediately when skill is deactivated
```

### Observation Space Format

The observation space is a flat array suitable for neural network input:

```typescript
// For N obstacles + 1 target + 1 player = N+2 balls
// Each ball contributes 4 values: [x, y, vx, vy]
// Total length: (N+2) * 4

function getObservationArray(balls: BallState[]): number[] {
  const obs: number[] = [];
  
  // Always in consistent order: player, target, obstacles
  const player = balls.find(b => b.label === 'player');
  const target = balls.find(b => b.label === 'target');
  const obstacles = balls.filter(b => b.label === 'obstacle');
  
  obs.push(player.x, player.y, player.vx, player.vy);
  obs.push(target.x, target.y, target.vx, target.vy);
  
  obstacles.forEach(obs => {
    obs.push(obs.x, obs.y, obs.vx, obs.vy);
  });
  
  return obs;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Elastic Collision Energy Conservation

*For any* two balls that collide in the physics world, the total kinetic energy before collision should equal the total kinetic energy after collision (within numerical tolerance).

**Validates: Requirements 1.3**

### Property 2: Unique Ball Initialization Positions

*For any* game initialization, no two balls should occupy the same position (positions must be spatially separated by at least the sum of their radii).

**Validates: Requirements 2.4**

### Property 3: Complete State Tracking

*For any* ball present in the physics world, the Game_State_Service should maintain corresponding position (x, y) and velocity (vx, vy) data.

**Validates: Requirements 3.1**

### Property 4: Observation Array Format Consistency

*For any* game state with N obstacle balls, the observation array should have length (N+2) × 4, containing exactly 4 values per ball in the order: player, target, then obstacles.

**Validates: Requirements 3.2**

### Property 5: State Synchronization with Physics

*For any* physics simulation step, after the step completes, the Game_State_Service state should reflect the updated positions and velocities of all balls.

**Validates: Requirements 3.3**

### Property 6: Brake Skill Velocity Reduction

*For any* non-zero velocity of the Player_Ball, applying the Brake skill should reduce the velocity magnitude while preserving the direction vector (angle remains constant).

**Validates: Requirements 4.1, 4.2**

### Property 7: Magnetize Radius Detection and Force

*For any* ball configuration, when Magnetize is active, only balls within the specified radius should experience an attractive force, and that force should follow the inverse-square law F = G⋅m1⋅m2/r².

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 8: Gravity Bomb Universal Attraction

*For any* active Gravity_Bomb, all balls in the arena should experience an attractive force directed toward the bomb's center position.

**Validates: Requirements 6.2**

### Property 9: Invalid Action Error Handling

*For any* action ID outside the valid range [0, 3], calling executeAction should handle the error gracefully without crashing or corrupting game state.

**Validates: Requirements 7.6**

### Property 10: Input Translation Correctness

*For any* valid keyboard input, the InputController should translate it to the correct action ID (Brake→1, Magnetize→2, and mouse clicks→3).

**Validates: Requirements 8.4**

### Property 11: Collision Timer Bonus

*For any* timer value T, when the Player_Ball collides with the Target_Ball, the timer should increase by exactly M seconds (the configured bonus).

**Validates: Requirements 9.2**

### Property 12: Observation Format Independence

*For any* input mode (keyboard or AI), the Game_State_Service should produce observation arrays with identical format and structure.

**Validates: Requirements 11.3**

### Property 13: Rendering Synchronization

*For any* physics update, the rendering system should draw all balls at their current physics positions (no stale or desynchronized positions).

**Validates: Requirements 12.2**

### Property 14: Visual Distinction by Ball Type

*For any* two balls with different labels (player, target, obstacle), they should have different color values in their rendering properties.

**Validates: Requirements 12.3**

## Error Handling

### Physics Engine Errors

**Initialization Failures**
- If Matter.js fails to initialize, log the error and display a user-friendly message
- Provide fallback configuration values if custom config is invalid
- Validate arena dimensions are positive before creating walls

**Collision Detection Errors**
- If collision callbacks throw exceptions, log the error and continue simulation
- Implement try-catch around collision handlers to prevent game crashes
- Track collision errors and reset environment if errors exceed threshold

### State Management Errors

**State Synchronization Failures**
- If physics bodies and state service become desynchronized, trigger a state rebuild
- Implement periodic validation that all physics bodies have corresponding state entries
- Log warnings when state mismatches are detected

**Observable Stream Errors**
- Implement error handlers on all observable subscriptions
- If state stream errors, attempt to recover by rebuilding state from physics
- Provide default/fallback state values if state service fails

### Skill Execution Errors

**Invalid Skill Parameters**
- Validate skill parameters (radius, strength, duration) are within acceptable ranges
- Clamp force magnitudes to prevent physics instabilities
- If Gravity_Bomb creation fails, log error and continue without the bomb

**Force Application Failures**
- If applying force to a body fails, catch the exception and log it
- Validate bodies exist before applying forces
- Skip force application for destroyed or invalid bodies

### Input Handling Errors

**Invalid Action IDs**
- If executeAction receives an invalid ID, log a warning and perform no action
- Validate action IDs are in range [0, 3] before processing
- Provide clear error messages for debugging

**Mouse Coordinate Errors**
- If mouse coordinates are outside canvas bounds, clamp to canvas edges
- Validate coordinates are finite numbers before creating Gravity_Bomb
- Handle touch events on mobile devices gracefully

**Pause State Management**
- Pause state is managed locally in GameArenaComponent
- When paused, the update() method returns early, preventing all game logic execution
- Rendering continues even when paused to display the pause overlay
- Pause toggle is handled before other keyboard inputs to prevent skill activation while paused

### Configuration Errors

**Invalid Configuration Values**
- Validate all numeric config values are positive and finite
- Provide sensible defaults for missing configuration properties
- Log warnings when configuration is adjusted due to invalid values
- Prevent division by zero in force calculations (check for zero distances)

### Rendering Errors

**Canvas Context Errors**
- If canvas context cannot be obtained, display error message to user
- Validate canvas element exists before attempting to render
- Handle browser compatibility issues with canvas API

**Animation Frame Errors**
- If requestAnimationFrame fails, fall back to setTimeout
- Catch and log any errors in the render loop
- Ensure render errors don't crash the entire application

## Testing Strategy

### Dual Testing Approach

This project requires both **unit tests** and **property-based tests** for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property tests**: Verify universal properties across randomized inputs (minimum 100 iterations each)

Unit tests should focus on concrete scenarios and edge cases, while property tests validate that correctness properties hold across all possible inputs. Together, they provide both specific validation and general correctness guarantees.

### Property-Based Testing Configuration

**Library Selection**: Use **fast-check** for TypeScript/JavaScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must include a comment tag referencing the design property
- Tag format: `// Feature: gravity-rl-game, Property N: [property description]`
- Each correctness property from this design must be implemented as a single property-based test

**Example Property Test Structure**:
```typescript
// Feature: gravity-rl-game, Property 1: Elastic Collision Energy Conservation
it('should conserve kinetic energy in all collisions', () => {
  fc.assert(
    fc.property(
      fc.record({
        ball1: ballArbitrary(),
        ball2: ballArbitrary(),
      }),
      ({ ball1, ball2 }) => {
        const energyBefore = calculateKineticEnergy([ball1, ball2]);
        simulateCollision(ball1, ball2);
        const energyAfter = calculateKineticEnergy([ball1, ball2]);
        expect(energyAfter).toBeCloseTo(energyBefore, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Strategy

**PhysicsEngineService Tests**:
- Test initialization with zero gravity
- Test wall creation at correct positions
- Test ball creation with specified properties
- Test force application updates body velocity
- Test reset clears all bodies
- Edge case: applying force to non-existent body
- Edge case: creating balls with invalid parameters

**GameStateService Tests**:
- Test state updates from physics bodies
- Test observation array has correct length
- Test observation array ordering (player, target, obstacles)
- Test timer countdown
- Test score updates
- Test reset restores initial state
- Edge case: handling empty physics world
- Edge case: handling missing ball labels

**SkillsService Tests**:
- Test brake applies force opposite to velocity
- Test brake does nothing when velocity is zero (edge case)
- Test magnetize only affects balls within radius
- Test magnetize force follows inverse-square law
- Test gravity bomb creates sensor body
- Test gravity bomb cleanup after duration
- Test gravity bomb affects all balls
- Edge case: magnetize with zero distance (prevent division by zero)
- Edge case: multiple simultaneous gravity bombs

**GameArenaComponent Tests**:
- Test executeAction(0) performs no action
- Test executeAction(1) triggers brake
- Test executeAction(2) triggers magnetize
- Test executeAction(3) creates gravity bomb
- Test executeAction with invalid ID handles error
- Test collision detection triggers timer bonus
- Test timer reaching zero triggers reset
- Test reset restores initial game state
- Integration test: full game loop cycle

**InputController Tests**:
- Test keyboard 'Q' maps to action 1
- Test keyboard 'W' maps to action 2
- Test mouse click maps to action 3
- Test input mode switching
- Test invalid key presses are ignored
- Edge case: rapid repeated key presses
- Edge case: simultaneous key presses

### Integration Testing

**End-to-End Game Flow**:
- Initialize game → verify all entities created
- Apply skills → verify physics responds correctly
- Collision with target → verify timer increases
- Timer expires → verify environment resets
- Switch input modes → verify game continues functioning

**Service Integration**:
- PhysicsEngine + GameState synchronization
- GameState + Skills coordination
- InputController + GameArena communication
- All services working together in game loop

### Testing Priorities

**High Priority** (Must test):
1. Elastic collision energy conservation (Property 1)
2. State synchronization with physics (Property 5)
3. Skill force calculations (Properties 6, 7, 8)
4. Action execution interface (Property 9)
5. Collision detection and timer logic (Property 11)

**Medium Priority** (Should test):
1. Observation array format (Property 4)
2. Input translation (Property 10)
3. Visual distinction (Property 14)
4. Configuration validation
5. Error handling paths

**Lower Priority** (Nice to have):
1. Rendering synchronization (Property 13)
2. Performance benchmarks
3. Browser compatibility
4. Mobile touch input

### Test Data Generation

For property-based tests, generate random:
- Ball positions within arena bounds
- Ball velocities (magnitude and direction)
- Ball masses and radii
- Skill parameters (radius, strength, duration)
- Timer values
- Action sequences

Ensure generators produce valid inputs that respect physical constraints (e.g., balls don't overlap, velocities are finite, masses are positive).

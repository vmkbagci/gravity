# Gravity RL

A physics-based game built with Angular where you control a green ball and use special skills to catch a yellow target ball while avoiding red obstacle balls in a zero-gravity arena.

## Game Overview

Gravity RL is a skill-based physics game featuring:
- **Zero-gravity environment** with perfectly elastic collisions
- **Three unique skills** to manipulate physics and control the arena
- **Progressive difficulty** - obstacles increase as you score
- **Energy conservation** - realistic physics with no artificial speed limits
- **Interactive sliders** - tune game parameters in real-time

## Controls

- **Q**: Brake (slow-motion effect - slows entire physics to 30%)
- **W**: Magnetize (attract nearby balls with inverse-square law)
- **Click**: Place Gravity Bomb (static gravity well that bends trajectories)
- **S**: Pause/Resume
- **Any Key**: Start/Restart game

## Game Mechanics

### Objective
- Control the **green ball** (player)
- Catch the **yellow ball** (target) to score points
- Avoid **red balls** (obstacles)
- Survive as long as possible

### Scoring System
- **1 point per frame** (60 FPS) for survival
- **500 × N bonus** for catching the Nth target (1st=500, 2nd=1000, 3rd=1500, etc.)
- Score displayed is 1/10 of internal score (rounded)

### Timer
- **Initial time**: 60 seconds
- **Time bonus**: 25 seconds per target caught
- Game ends when timer reaches 0

### Progressive Difficulty
- Start with 4 red obstacle balls
- Every 5 targets caught, a new red ball spawns
- All balls spawn without overlapping

## Skills

### 1. Brake (Q Key)
- **Effect**: Slows entire physics simulation to 30% speed
- **Cost**: 0.25 charge per frame
- **Recharge**: 10% per second (after 1 second delay)
- **Physics**: Frame-skipping with interpolation for smooth 60 FPS rendering
- **Use**: Gives you time to plan and react

### 2. Magnetize (W Key)
- **Effect**: Attracts nearby balls toward player
- **Radius**: 120 pixels
- **Strength**: 0.75 (adjustable with slider)
- **Cost**: 0.5 charge per frame
- **Recharge**: 10% per second (after 1 second delay)
- **Physics**: Inverse-square law (F = G/r²), Newton's third law applies
- **Visual**: Collapsing wave circles, colored rings on affected balls

### 3. Gravity Bombs (Click)
- **Effect**: Static gravity wells that bend ball trajectories
- **Charges**: 3 independent charges
- **Recharge**: 10 seconds per charge
- **Duration**: 3 seconds per bomb
- **Radius**: 7.5 pixels (visual)
- **Effect Radius**: 80 pixels
- **Strength**: 1875 (adjustable with slider)
- **Physics**: 
  - Static (don't move)
  - Inverse-square law attraction
  - **Energy conservation**: Bends trajectory without changing speed
  - Formula: `v'' = (√(v²/v'²)) × v'` where v' includes force effect
- **Visual**: Purple/magenta circles, colored rings on affected balls

## Interactive Sliders

Adjust game parameters in real-time:

1. **Velocities** (0.5x - 1.5x): Ball spawn speeds
2. **Physics Speed** (0.5x - 1.5x): Simulation speed multiplier
3. **Magnetic Force** (0.5x - 1.5x): Magnetize skill strength
4. **Gravity Mines** (0.5x - 2.0x): Gravity bomb strength

## Physics Details

### Collision System
- **Perfectly elastic collisions** (restitution = 1.0)
- **Zero friction** (friction = 0.0, airFriction = 0.0)
- **Energy conservation** enforced for wall and ball-to-ball collisions
- **Manual collision handling** to prevent Matter.js energy loss

### Gravity Bomb Energy Conservation
To prevent infinite energy gain, gravity bombs use a special algorithm:
1. Store original velocity: `v = (vx, vy)`
2. Calculate force effect: `v' = v + (F/m) × Δt`
3. Normalize to conserve energy: `α = √(v²/v'²)`
4. Apply normalized velocity: `v'' = α × v'`

Result: Speed stays constant (`|v''| = |v|`), only direction changes.

## Animations

- **Eating animation**: Target shrinks over 1.5s with "NOM" text particles
- **Spawn animation**: New target grows from tiny to full size over 0.5s
- **Magnetize waves**: Collapsing circles (80px radius, 150px/s collapse speed)
- **Poof effects**: Expanding purple circles when bombs expire
- **Force indicators**: Colored rings around affected balls (intensity = force strength)

## Technical Stack

- **Framework**: Angular 21.0.2
- **Physics Engine**: Matter.js
- **Rendering**: HTML5 Canvas (920×640 pixels)
- **State Management**: RxJS Observables
- **Testing**: Vitest

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`.

## Building

To build the project:

```bash
npm run build
```

Build artifacts will be stored in the `dist/` directory.

## Running unit tests

To execute unit tests:

```bash
npm test
```

## Project Structure

```
src/app/
├── game-arena/          # Main game component (canvas rendering, game loop)
├── physics-engine.service.ts    # Matter.js wrapper, collision handling
├── game-state.service.ts        # Reactive state management
├── skills.service.ts            # Skill implementations (brake, magnetize, bombs)
├── input-controller.service.ts  # Keyboard/mouse input handling
└── game-config.service.ts       # Game configuration
```

## Configuration

Key game parameters (in `game-arena.ts`):

```typescript
{
  arenaWidth: 800,
  arenaHeight: 600,
  numObstacles: 4,
  playerRadius: 15,
  targetRadius: 15,
  obstacleRadius: 25,
  initialTime: 60,
  timeBonus: 25,
  brakeConstant: 0.00001,
  magnetizeRadius: 120,
  magnetizeStrength: 0.75,
  gravityBombDuration: 3,
  gravityBombStrength: 1875
}
```

## Additional Resources

For more information on Angular CLI: [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)

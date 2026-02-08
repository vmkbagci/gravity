# Requirements Document

## Introduction

Project Gravity-RL is a physics-based 2D game built with Angular and Matter.js that provides a foundation for future reinforcement learning integration. The game features a zero-gravity arena where a player-controlled ball must collide with a target ball while navigating around obstacle balls, using special skills like braking, magnetism, and gravity bombs. The architecture is designed to allow seamless transition from human keyboard control to AI-driven control via TensorFlow.js.

## Glossary

- **Game_Arena**: The Angular component that renders the Matter.js physics world on a canvas
- **Physics_Engine_Service**: The Angular service that manages the Matter.js world, bodies, and physics simulation
- **Game_State_Service**: The Angular service that tracks and exposes the observable state of all game entities
- **Player_Ball**: The ball controlled by the agent (human or AI) that must reach the target
- **Target_Ball**: The goal ball that the Player_Ball must collide with to score
- **Obstacle_Ball**: Static or dynamic balls that create challenges in the arena
- **Agent**: The controller of the Player_Ball (either human via keyboard or AI via TensorFlow.js)
- **Skill**: A special ability that the Agent can activate (Brake, Magnetize, Gravity_Bomb)
- **Action_Space**: The set of discrete actions available to the Agent (None, Brake, Magnetize, Gravity_Bomb)
- **Observation_Space**: The complete state representation of the game (positions and velocities of all balls)
- **Elastic_Collision**: A collision where restitution is 1.0 and no kinetic energy is lost

## Requirements

### Requirement 1: Physics World Initialization

**User Story:** As a developer, I want to initialize a Matter.js physics world with zero gravity, so that the game operates in a frictionless space environment.

#### Acceptance Criteria

1. WHEN the Physics_Engine_Service initializes THEN the system SHALL create a Matter.js world with gravity set to (0, 0)
2. WHEN the Physics_Engine_Service creates the world THEN the system SHALL configure a bounded rectangular 2D arena with walls
3. WHEN any ball collides with another object THEN the system SHALL apply elastic collision physics with restitution of 1.0 and friction of 0.0
4. WHEN the physics world is created THEN the system SHALL run the simulation at a consistent frame rate

### Requirement 2: Game Entity Management

**User Story:** As a developer, I want to create and manage different types of balls in the arena, so that the game has obstacles, a target, and a player.

#### Acceptance Criteria

1. WHEN the game initializes THEN the system SHALL create N Obstacle_Balls with static or dynamic mass and high bounciness
2. WHEN the game initializes THEN the system SHALL create exactly one Target_Ball with a distinct visual appearance
3. WHEN the game initializes THEN the system SHALL create exactly one Player_Ball controlled by the Agent
4. WHEN balls are created THEN the system SHALL assign each ball unique physical properties (position, velocity, mass, radius)
5. WHEN the Target_Ball is created THEN the system SHALL ensure it is visually distinguishable from other balls through color or styling

### Requirement 3: State Observation System

**User Story:** As an AI developer, I want to access the complete state of the game as a flat array, so that I can feed it to a reinforcement learning model.

#### Acceptance Criteria

1. WHEN the Game_State_Service tracks game state THEN the system SHALL maintain position (x, y) and velocity (vx, vy) for every ball
2. WHEN state is requested THEN the system SHALL provide the observation space as a flat numerical array
3. WHEN the physics simulation updates THEN the system SHALL update the Game_State_Service state synchronously
4. WHEN state changes occur THEN the system SHALL expose the state through an observable stream for reactive updates

### Requirement 4: Brake Skill Implementation

**User Story:** As a player, I want to use a brake skill to slow down my ball, so that I can control my momentum in the zero-gravity environment.

#### Acceptance Criteria

1. WHEN the Agent activates the Brake skill THEN the system SHALL apply a force of −v⋅k to the Player_Ball where v is current velocity and k is a constant
2. WHEN the Brake force is applied THEN the system SHALL reduce the Player_Ball velocity magnitude without changing its direction
3. WHEN the Player_Ball has zero velocity THEN the system SHALL not apply any Brake force
4. WHEN the Brake skill is used THEN the system SHALL deplete the Brake charge by a configured amount per frame
5. WHEN the Brake charge reaches zero THEN the system SHALL prevent the Brake skill from activating
6. WHEN the Brake skill is used THEN the system SHALL reset the recharge delay timer
7. WHEN the recharge delay timer expires THEN the system SHALL regenerate Brake charge at a configured rate
8. WHEN the Brake charge level changes THEN the system SHALL display the charge level on the left side of the arena

### Requirement 5: Magnetize Skill Implementation

**User Story:** As a player, I want to use a magnetize skill to attract nearby balls, so that I can manipulate the environment strategically.

#### Acceptance Criteria

1. WHEN the Agent activates the Magnetize skill THEN the system SHALL identify all balls within a specified radius of the Player_Ball
2. WHEN balls are within the magnetize radius THEN the system SHALL apply an attractive force using inverse-square law: F = G / r²
3. WHEN the attractive force is applied THEN the system SHALL apply equal and opposite forces to both balls (Newton's third law)
4. WHEN balls are outside the magnetize radius THEN the system SHALL not apply any magnetic force to those balls
5. WHEN the Magnetize skill is used THEN the system SHALL deplete the Magnetize charge by a configured amount per frame
6. WHEN the Magnetize charge reaches zero THEN the system SHALL prevent the Magnetize skill from activating
7. WHEN the Magnetize skill is used THEN the system SHALL reset the recharge delay timer
8. WHEN the recharge delay timer expires THEN the system SHALL regenerate Magnetize charge at a configured rate
9. WHEN the Magnetize charge level changes THEN the system SHALL display the charge level on the right side of the arena
10. WHEN the Magnetize skill is active THEN the system SHALL display collapsing wave circles around the Player_Ball
11. WHEN balls are affected by Magnetize THEN the system SHALL display colored circles around affected balls indicating force strength

### Requirement 6: Gravity Bomb Skill Implementation

**User Story:** As a player, I want to create a temporary gravity well that pulls all objects toward a point, so that I can create strategic opportunities.

#### Acceptance Criteria

1. WHEN the Agent activates the Gravity_Bomb skill THEN the system SHALL create a temporary Matter.js sensor body at the click location
2. WHEN the Gravity_Bomb is active THEN the system SHALL apply an attractive force to all balls toward the bomb center
3. WHEN the Gravity_Bomb duration expires THEN the system SHALL remove the sensor body and stop applying forces
4. WHEN the Gravity_Bomb is created THEN the system SHALL persist for exactly X seconds where X is configurable

### Requirement 7: Action Execution Interface

**User Story:** As an AI developer, I want a public function to execute actions by ID, so that an external AI agent can control the game.

#### Acceptance Criteria

1. THE Game_Arena SHALL expose a public function executeAction(actionID: number)
2. WHEN executeAction is called with actionID 0 THEN the system SHALL perform no action
3. WHEN executeAction is called with actionID 1 THEN the system SHALL activate the Brake skill
4. WHEN executeAction is called with actionID 2 THEN the system SHALL activate the Magnetize skill
5. WHEN executeAction is called with actionID 3 THEN the system SHALL activate the Gravity_Bomb skill
6. WHEN executeAction is called with an invalid actionID THEN the system SHALL handle the error gracefully

### Requirement 8: Human Input Handling

**User Story:** As a player, I want to control the Player_Ball using keyboard inputs, so that I can play the game manually before AI integration.

#### Acceptance Criteria

1. WHEN the player presses a designated key for Brake THEN the system SHALL call executeAction(1)
2. WHEN the player presses a designated key for Magnetize THEN the system SHALL call executeAction(2)
3. WHEN the player clicks on the canvas THEN the system SHALL call executeAction(3) with the click coordinates
4. WHEN keyboard input is received THEN the system SHALL translate it to the appropriate action ID
5. WHEN the player presses the pause key ('S') THEN the system SHALL toggle the pause state
6. WHEN the game is paused THEN the system SHALL stop all physics simulation, timer countdown, and skill updates
7. WHEN the game is paused THEN the system SHALL display a pause indicator overlay on the canvas
8. WHEN the player presses the pause key while paused THEN the system SHALL resume the game

### Requirement 9: Game Timer and Scoring System

**User Story:** As a player, I want a countdown timer that extends when I hit the target, so that the game has a clear objective and time pressure.

#### Acceptance Criteria

1. WHEN the game starts THEN the system SHALL initialize a countdown timer at T seconds
2. WHEN the Player_Ball collides with the Target_Ball THEN the system SHALL add M seconds to the timer
3. WHEN the timer reaches zero THEN the system SHALL call resetEnvironment()
4. WHEN the timer is running THEN the system SHALL display the remaining time to the player
5. WHEN a collision with the Target_Ball occurs THEN the system SHALL provide visual or audio feedback

### Requirement 10: Environment Reset

**User Story:** As a developer, I want to reset the game environment to initial conditions, so that the game can restart after completion or for training episodes.

#### Acceptance Criteria

1. WHEN resetEnvironment is called THEN the system SHALL remove all existing balls from the physics world
2. WHEN resetEnvironment is called THEN the system SHALL recreate all balls at their initial positions with zero velocity
3. WHEN resetEnvironment is called THEN the system SHALL reset the timer to T seconds
4. WHEN resetEnvironment is called THEN the system SHALL clear any active skills or temporary bodies

### Requirement 11: Modular Architecture for AI Integration

**User Story:** As a system architect, I want a modular architecture that separates input handling from game logic, so that I can easily swap human control for AI control.

#### Acceptance Criteria

1. WHEN the input source changes THEN the game logic and physics simulation SHALL remain unaffected
2. WHEN TensorFlow.js is integrated THEN the system SHALL use the same executeAction interface as keyboard input
3. WHEN the Game_State_Service provides observations THEN the system SHALL format them identically regardless of the controller type
4. THE system SHALL maintain clear separation between Physics_Engine_Service, Game_State_Service, and input handling

### Requirement 12: Canvas Rendering

**User Story:** As a player, I want to see the game rendered on a canvas, so that I can observe the physics simulation and game state visually.

#### Acceptance Criteria

1. WHEN the Game_Arena component initializes THEN the system SHALL create an HTML canvas element
2. WHEN the physics simulation updates THEN the system SHALL render all balls at their current positions
3. WHEN balls have different types THEN the system SHALL render them with distinct visual styles
4. WHEN skills are active THEN the system SHALL provide visual indicators (e.g., magnetize radius, collapsing wave circles, affected ball highlights, gravity bomb location)
5. WHEN the game state changes THEN the system SHALL update the canvas rendering at the physics frame rate
6. WHEN the canvas is rendered THEN the system SHALL display the arena boundaries with a visible border
7. WHEN the canvas is rendered THEN the system SHALL display charge bars for Brake and Magnetize skills outside the arena
8. WHEN charge levels change THEN the system SHALL update the visual charge bar indicators in real-time

### Requirement 13: TensorFlow.js Integration Readiness

**User Story:** As an AI developer, I want TensorFlow.js integrated but dormant, so that the codebase is ready for future RL agent development.

#### Acceptance Criteria

1. WHEN the application initializes THEN the system SHALL include TensorFlow.js as a dependency
2. THE system SHALL provide placeholder functions or services for future AI agent integration
3. WHEN the AI integration is activated THEN the system SHALL be able to receive observations from Game_State_Service
4. WHEN the AI integration is activated THEN the system SHALL be able to call executeAction with computed action IDs

### Requirement 14: Configuration Management

**User Story:** As a developer, I want configurable game parameters, so that I can tune the game difficulty and physics behavior without code changes.

#### Acceptance Criteria

1. THE system SHALL allow configuration of the number of Obstacle_Balls (N)
2. THE system SHALL allow configuration of the initial timer duration (T)
3. THE system SHALL allow configuration of the timer bonus on target hit (M)
4. THE system SHALL allow configuration of the Gravity_Bomb duration (X)
5. THE system SHALL allow configuration of skill parameters (brake constant, magnetize radius, gravity strength)
6. THE system SHALL allow configuration of arena dimensions and ball sizes

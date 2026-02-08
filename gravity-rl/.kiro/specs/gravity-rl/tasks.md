# Implementation Plan: Project Gravity-RL

## Overview

This implementation plan breaks down the Gravity-RL physics game into incremental coding tasks. The game is built with Angular and Matter.js, featuring a zero-gravity arena where a player-controlled ball navigates obstacles to reach a target using special skills. The architecture is designed for future AI/RL integration with TensorFlow.js.

The implementation follows a bottom-up approach: physics foundation → state management → skills → game logic → rendering → input handling → AI readiness.

## Tasks

- [x] 1. Set up Angular project structure and dependencies
  - Create new Angular project with TypeScript
  - Install Matter.js (`npm install matter-js @types/matter-js`)
  - Install fast-check for property-based testing (`npm install --save-dev fast-check`)
  - Install TensorFlow.js (`npm install @tensorflow/tfjs`)
  - Configure TypeScript compiler options for strict mode
  - Set up testing framework (Jasmine/Karma)
  - _Requirements: 13.1, 14.1-14.6_

- [x] 2. Implement PhysicsEngineService core functionality
  - [x] 2.1 Create PhysicsEngineService with Matter.js initialization
    - Define PhysicsConfig and BallConfig interfaces
    - Implement initialize() method with zero gravity configuration
    - Implement createWalls() method for bounded arena
    - Configure elastic collision properties (restitution=1.0, friction=0.0)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Write property test for elastic collision energy conservation
    - **Property 1: Elastic Collision Energy Conservation**
    - **Validates: Requirements 1.3**
    - Generate random ball pairs and verify kinetic energy conservation after collision
    - _Requirements: 1.3_

  - [x] 2.3 Implement ball creation and management methods
    - Implement createBall() method with BallConfig parameter
    - Implement getBodies() to retrieve all physics bodies
    - Implement getBodyByLabel() for finding specific balls
    - Implement applyForce() method for force application
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.4 Write property test for unique ball initialization positions
    - **Property 2: Unique Ball Initialization Positions**
    - **Validates: Requirements 2.4**
    - Generate random ball configurations and verify no overlapping positions
    - _Requirements: 2.4_

  - [x] 2.5 Write unit tests for PhysicsEngineService
    - Test initialization with zero gravity
    - Test wall creation at correct positions
    - Test ball creation with specified properties
    - Test force application updates body velocity
    - Edge case: applying force to non-existent body
    - Edge case: creating balls with invalid parameters
    - _Requirements: 1.1, 1.2, 1.3, 2.1-2.4_

  - [x] 2.6 Implement physics simulation loop methods
    - Implement update() method to step the physics simulation
    - Implement reset() method to clear all bodies
    - Implement destroy() method for cleanup
    - Configure consistent frame rate for simulation
    - _Requirements: 1.4_

- [x] 3. Implement GameStateService for state tracking
  - [x] 3.1 Create GameStateService with observable state management
    - Define BallState and GameState interfaces
    - Create BehaviorSubject for state management
    - Expose state$ observable for reactive updates
    - Implement reset() method to restore initial state
    - _Requirements: 3.1, 3.4_

  - [x] 3.2 Implement state synchronization with physics
    - Implement updateFromPhysics() to sync with Matter.js bodies
    - Extract position (x, y) and velocity (vx, vy) from physics bodies
    - Update state synchronously after each physics step
    - _Requirements: 3.1, 3.3_

  - [x] 3.3 Write property test for complete state tracking
    - **Property 3: Complete State Tracking**
    - **Validates: Requirements 3.1**
    - Generate random physics worlds and verify all balls are tracked in state
    - _Requirements: 3.1_

  - [x] 3.4 Write property test for state synchronization
    - **Property 5: State Synchronization with Physics**
    - **Validates: Requirements 3.3**
    - Generate random physics updates and verify state reflects changes
    - _Requirements: 3.3_

  - [x] 3.5 Implement observation array formatting for AI
    - Implement getObservationArray() to produce flat numerical array
    - Ensure consistent ordering: player, target, then obstacles
    - Format as [x, y, vx, vy] for each ball
    - _Requirements: 3.2_

  - [x] 3.6 Write property test for observation array format consistency
    - **Property 4: Observation Array Format Consistency**
    - **Validates: Requirements 3.2**
    - Generate random game states with varying obstacle counts and verify array length and structure
    - _Requirements: 3.2_

  - [x] 3.7 Implement game metadata tracking
    - Implement updateTimer() method for countdown
    - Implement addScore() method for score tracking
    - Implement setActiveSkill() for skill state tracking
    - Add isGameOver flag to GameState
    - _Requirements: 9.1, 9.4_

  - [x] 3.8 Write unit tests for GameStateService
    - Test state updates from physics bodies
    - Test observation array has correct length
    - Test observation array ordering (player, target, obstacles)
    - Test timer countdown
    - Test score updates
    - Test reset restores initial state
    - Edge case: handling empty physics world
    - Edge case: handling missing ball labels
    - _Requirements: 3.1-3.4, 9.1, 9.4_

- [x] 4. Checkpoint - Verify physics and state foundation
  - Ensure all tests pass for PhysicsEngineService and GameStateService
  - Verify physics simulation runs at consistent frame rate
  - Verify state synchronization works correctly
  - Ask the user if questions arise

- [x] 5. Implement SkillsService for game abilities
  - [x] 5.1 Create SkillsService with configuration
    - Define SkillConfig interface with all skill parameters
    - Define GravityBomb interface for bomb tracking
    - Inject PhysicsEngineService dependency
    - Initialize with configurable skill parameters
    - _Requirements: 4.1, 5.1-5.4, 6.1-6.4, 14.5_

  - [x] 5.2 Implement Brake skill
    - Implement applyBrake() method
    - Calculate force as −v⋅k where v is velocity and k is brake constant
    - Apply force opposite to velocity direction
    - Handle zero velocity case (no force applied)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.3 Write property test for brake velocity reduction
    - **Property 6: Brake Skill Velocity Reduction**
    - **Validates: Requirements 4.1, 4.2**
    - Generate random velocities and verify brake reduces magnitude while preserving direction
    - _Requirements: 4.1, 4.2_

  - [x] 5.4 Implement Magnetize skill
    - Implement applyMagnetize() method
    - Identify all balls within specified radius of player
    - Calculate attractive force using inverse-square law: F = G⋅m1⋅m2/r²
    - Apply forces only to balls within radius
    - Handle zero distance case to prevent division by zero
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.5 Write property test for magnetize radius detection and force
    - **Property 7: Magnetize Radius Detection and Force**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Generate random ball configurations and verify only balls within radius are affected
    - Verify force follows inverse-square law
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.6 Implement Gravity Bomb skill
    - Implement createGravityBomb() method
    - Create temporary Matter.js sensor body at specified position
    - Implement updateGravityBombs() to apply forces to all balls
    - Implement cleanupExpiredBombs() to remove expired bombs
    - Track bomb creation time and duration
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.7 Write property test for gravity bomb universal attraction
    - **Property 8: Gravity Bomb Universal Attraction**
    - **Validates: Requirements 6.2**
    - Generate random ball configurations and verify all balls experience force toward bomb
    - _Requirements: 6.2_

  - [x] 5.8 Write unit tests for SkillsService
    - Test brake applies force opposite to velocity
    - Test brake does nothing when velocity is zero (edge case)
    - Test magnetize only affects balls within radius
    - Test magnetize force follows inverse-square law
    - Test gravity bomb creates sensor body
    - Test gravity bomb cleanup after duration
    - Test gravity bomb affects all balls
    - Edge case: magnetize with zero distance (prevent division by zero)
    - Edge case: multiple simultaneous gravity bombs
    - _Requirements: 4.1-4.3, 5.1-5.4, 6.1-6.4_

- [x] 6. Implement InputController for input abstraction
  - [x] 6.1 Create InputController service
    - Define ActionType enum (NONE=0, BRAKE=1, MAGNETIZE=2, GRAVITY_BOMB=3)
    - Define InputAction interface with type and optional position
    - Create Subject for action stream
    - Expose action$ observable
    - Implement setInputMode() for keyboard/AI switching
    - _Requirements: 7.1-7.6, 8.1-8.4, 11.1-11.4_

  - [x] 6.2 Implement keyboard input handling
    - Implement handleKeyboardEvent() method
    - Map 'Q' key to BRAKE action (actionID 1)
    - Map 'W' key to MAGNETIZE action (actionID 2)
    - Ignore invalid key presses
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 6.3 Implement mouse input handling
    - Implement handleMouseEvent() method
    - Convert canvas click coordinates to world coordinates
    - Map mouse click to GRAVITY_BOMB action (actionID 3)
    - Include click position in action
    - _Requirements: 8.3_

  - [x] 6.4 Implement AI action trigger interface
    - Implement triggerAction() method for AI to call
    - Accept InputAction with type and optional position
    - Emit action through action$ observable
    - _Requirements: 11.2_

  - [x] 6.5 Write property test for input translation correctness
    - **Property 10: Input Translation Correctness**
    - **Validates: Requirements 8.4**
    - Generate random keyboard inputs and verify correct action ID mapping
    - _Requirements: 8.4_

  - [x] 6.6 Write unit tests for InputController
    - Test keyboard 'Q' maps to action 1
    - Test keyboard 'W' maps to action 2
    - Test mouse click maps to action 3
    - Test input mode switching
    - Test invalid key presses are ignored
    - Edge case: rapid repeated key presses
    - Edge case: simultaneous key presses
    - _Requirements: 8.1-8.4, 11.1-11.4_

- [x] 7. Implement GameArenaComponent core logic
  - [x] 7.1 Create GameArenaComponent with template and styling
    - Create component with canvas element
    - Add UI elements for timer and score display
    - Add controls information display (including pause key)
    - Style the game container and UI elements
    - Expand canvas to accommodate charge bars outside arena
    - _Requirements: 12.1, 12.6, 12.7_

  - [x] 7.2 Implement game initialization
    - Inject all required services (Physics, GameState, Skills, Input)
    - Define GameConfig interface with all configurable parameters
    - Implement initializeGame() method
    - Create player ball, target ball, and N obstacle balls
    - Ensure target ball has distinct visual appearance
    - Initialize timer to T seconds
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 14.1-14.6_

  - [x] 7.3 Implement executeAction public interface
    - Implement executeAction(actionID: number, position?: Vector) method
    - Handle actionID 0: no action
    - Handle actionID 1: call skills.applyBrake() if charge available
    - Handle actionID 2: call skills.applyMagnetize() if charge available
    - Handle actionID 3: call skills.createGravityBomb()
    - Handle invalid actionID with error logging
    - Deplete skill charge when Brake or Magnetize is used
    - Reset recharge timer when skills are used
    - _Requirements: 4.4, 4.5, 4.6, 5.5, 5.6, 5.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.4 Write property test for invalid action error handling
    - **Property 9: Invalid Action Error Handling**
    - **Validates: Requirements 7.6**
    - Generate random invalid action IDs and verify graceful error handling
    - _Requirements: 7.6_

  - [x] 7.5 Implement game loop
    - Implement startGameLoop() using requestAnimationFrame
    - Implement update() method for each frame
    - Update skill charges and recharge timers
    - Update physics simulation
    - Update skills (gravity bombs)
    - Update game state from physics
    - Update timer countdown
    - Call render() each frame
    - Skip all updates when game is paused
    - _Requirements: 1.4, 3.3, 4.7, 5.8, 8.6, 9.4_

  - [x] 7.6 Implement collision detection and handling
    - Implement handleCollisions() method
    - Detect collision between Player_Ball and Target_Ball
    - Add M seconds to timer on collision
    - Provide visual or audio feedback on collision
    - Update score on collision
    - _Requirements: 9.2, 9.5_

  - [x] 7.7 Write property test for collision timer bonus
    - **Property 11: Collision Timer Bonus**
    - **Validates: Requirements 9.2**
    - Generate random timer values and verify exact M second increase on collision
    - _Requirements: 9.2_

  - [x] 7.8 Implement environment reset
    - Implement resetEnvironment() method
    - Remove all existing balls from physics world
    - Recreate all balls at initial positions with zero velocity
    - Reset timer to T seconds
    - Clear active skills and temporary bodies
    - Reset score
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 7.9 Implement timer expiration handling
    - Check if timer reaches zero each frame
    - Call resetEnvironment() when timer expires
    - _Requirements: 9.3_

  - [x] 7.10 Wire up input handling
    - Implement setupInputHandlers() method
    - Subscribe to keyboard events and pass to InputController
    - Subscribe to mouse click events and pass to InputController
    - Subscribe to InputController action$ observable
    - Call executeAction() when actions are emitted
    - Handle pause toggle with 'S' key before other inputs
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 7.11 Write unit tests for GameArenaComponent
    - Test executeAction(0) performs no action
    - Test executeAction(1) triggers brake
    - Test executeAction(2) triggers magnetize
    - Test executeAction(3) creates gravity bomb
    - Test executeAction with invalid ID handles error
    - Test collision detection triggers timer bonus
    - Test timer reaching zero triggers reset
    - Test reset restores initial game state
    - Test pause toggle stops/resumes game updates
    - _Requirements: 7.1-7.6, 8.5-8.8, 9.2, 9.3, 10.1-10.4_

- [x] 8. Checkpoint - Verify game logic and input handling
  - Ensure all tests pass for SkillsService, InputController, and GameArenaComponent
  - Verify skills apply correct forces
  - Verify input handling works correctly
  - Verify game loop runs smoothly
  - Ask the user if questions arise

- [x] 9. Implement canvas rendering
  - [x] 9.1 Set up canvas rendering context
    - Get canvas element reference using ViewChild
    - Obtain 2D rendering context
    - Handle canvas context errors gracefully
    - Set canvas dimensions to match arena size
    - _Requirements: 12.1_

  - [x] 9.2 Implement ball rendering
    - Implement render() method
    - Clear canvas each frame
    - Subscribe to gameState.state$ observable
    - Render each ball at its current position
    - Use distinct colors for player, target, and obstacles
    - Draw circles with appropriate radius
    - _Requirements: 12.2, 12.3_

  - [x] 9.3 Write property test for visual distinction by ball type
    - **Property 14: Visual Distinction by Ball Type**
    - **Validates: Requirements 12.3**
    - Generate random ball configurations and verify different labels have different colors
    - _Requirements: 12.3_

  - [x] 9.4 Implement skill visual indicators
    - Render magnetize radius as a circle around player when active
    - Render gravity bomb location as a visual marker
    - Render brake effect (optional visual feedback)
    - _Requirements: 12.4_

  - [x] 9.5 Implement UI rendering
    - Display timer value from gameState.state$
    - Display score value from gameState.state$
    - Update UI elements reactively using Angular bindings
    - Display pause overlay when game is paused
    - Render charge bars for Brake and Magnetize skills
    - Display charge bars outside arena boundaries
    - Color-code charge bars based on charge level
    - _Requirements: 4.8, 5.9, 8.7, 9.4, 12.5, 12.7, 12.8_

  - [x] 9.6 Write property test for rendering synchronization
    - **Property 13: Rendering Synchronization**
    - **Validates: Requirements 12.2**
    - Generate random physics states and verify rendered positions match physics positions
    - _Requirements: 12.2_

  - [x] 9.7 Write unit tests for rendering
    - Test canvas context is obtained successfully
    - Test balls are rendered at correct positions
    - Test different ball types have different colors
    - Test skill indicators are rendered when active
    - Test pause overlay is displayed when paused
    - Edge case: rendering with missing canvas element
    - _Requirements: 8.7, 12.1-12.5_

- [x] 10. Implement configuration management
  - [x] 10.1 Create configuration service or constant
    - Define default GameConfig with all parameters
    - Number of obstacles (N): default 5
    - Initial timer (T): default 30 seconds
    - Timer bonus (M): default 5 seconds
    - Gravity bomb duration (X): default 3 seconds
    - Brake constant, magnetize radius, magnetize strength
    - Arena dimensions, ball sizes
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 10.2 Make configuration injectable
    - Allow configuration to be provided at module level
    - Support runtime configuration updates
    - Validate configuration values are positive and finite
    - Provide sensible defaults for missing properties
    - _Requirements: 14.1-14.6_

  - [x] 10.3 Write unit tests for configuration
    - Test default configuration values
    - Test configuration validation
    - Test invalid values are rejected or clamped
    - Edge case: negative or zero values
    - Edge case: missing configuration properties
    - _Requirements: 14.1-14.6_

- [x] 11. Implement TensorFlowService placeholder for AI integration
  - [x] 11.1 Create TensorFlowService with stub methods
    - Create service with TensorFlow.js imported
    - Implement placeholder predict() method
    - Implement placeholder train() method
    - Add comments indicating future implementation
    - _Requirements: 13.1, 13.2_

  - [x] 11.2 Wire TensorFlowService to game state
    - Subscribe to gameState.state$ observable
    - Convert state to observation array format
    - Add placeholder for calling executeAction() with predicted actions
    - _Requirements: 13.3, 13.4_

  - [x] 11.3 Write property test for observation format independence
    - **Property 12: Observation Format Independence**
    - **Validates: Requirements 11.3**
    - Generate random game states and verify observation format is identical for keyboard and AI modes
    - _Requirements: 11.3_

  - [x] 11.4 Write unit tests for TensorFlowService
    - Test service initializes without errors
    - Test placeholder methods exist and are callable
    - Test service can receive observations from GameStateService
    - Test service can call executeAction interface
    - _Requirements: 13.1-13.4_

- [x] 12. Integration and final wiring
  - [x] 12.1 Wire all services together in GameArenaComponent
    - Ensure all dependencies are properly injected
    - Verify service initialization order
    - Connect all observable streams
    - Ensure proper cleanup in ngOnDestroy
    - _Requirements: 11.4_

  - [x] 12.2 Implement lifecycle hooks
    - Implement ngOnInit to initialize game
    - Implement ngOnDestroy to cleanup resources
    - Cancel animation frame on destroy
    - Unsubscribe from all observables
    - Destroy physics engine
    - _Requirements: 1.4, 11.4_

  - [x] 12.3 Write integration tests
    - Test full game initialization flow
    - Test skill activation affects physics
    - Test collision detection and timer update
    - Test environment reset
    - Test input mode switching
    - Test end-to-end game loop cycle
    - _Requirements: 1.1-14.6_

- [x] 13. Final checkpoint - Comprehensive testing and validation
  - Run all unit tests and verify they pass
  - Run all property-based tests and verify they pass
  - Manually test the game in browser
  - Verify all skills work correctly
  - Verify collision detection works
  - Verify timer and reset functionality
  - Verify rendering is smooth and synchronized
  - Verify configuration can be adjusted
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and error conditions
- Checkpoints ensure incremental validation at key milestones
- The implementation uses TypeScript and Angular with Matter.js for physics
- TensorFlow.js is included but dormant, ready for future AI agent development
- Configuration is centralized and injectable for easy tuning

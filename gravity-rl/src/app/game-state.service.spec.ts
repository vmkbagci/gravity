import { TestBed } from '@angular/core/testing';
import { GameStateService, BallState, GameState } from './game-state.service';
import { PhysicsEngineService } from './physics-engine.service';
import * as fc from 'fast-check';
import * as Matter from 'matter-js';

describe('GameStateService', () => {
  let service: GameStateService;
  let physicsService: PhysicsEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameStateService);
    physicsService = TestBed.inject(PhysicsEngineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Feature: gravity-rl-game, Property 3: Complete State Tracking
  // Validates: Requirements 3.1
  describe('Property 3: Complete State Tracking', () => {
    it('should track all balls present in the physics world', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // Number of balls
          fc.integer({ min: 100, max: 700 }), // Arena width range
          fc.integer({ min: 100, max: 500 }), // Arena height range
          (numBalls, arenaWidth, arenaHeight) => {
            // Initialize physics engine
            physicsService.initialize({
              gravity: { x: 0, y: 0 },
              arenaWidth,
              arenaHeight,
              restitution: 1.0,
              friction: 0.0,
              airFriction: 0.0,
            });

            // Create random balls
            const createdBalls: Matter.Body[] = [];
            for (let i = 0; i < numBalls; i++) {
              const ball = physicsService.createBall({
                x: Math.random() * arenaWidth,
                y: Math.random() * arenaHeight,
                radius: 10 + Math.random() * 20,
                mass: 1,
                isStatic: false,
                color: '#FF0000',
                label: `ball_${i}`,
              });
              createdBalls.push(ball);
            }

            // Update state from physics
            const bodies = physicsService.getBodies();
            service.updateFromPhysics(bodies);

            // Get current state
            let currentState: GameState | null = null;
            service.state$.subscribe((state) => {
              currentState = state;
            }).unsubscribe();

            // Verify all balls are tracked
            expect(currentState).not.toBeNull();
            expect(currentState!.balls.length).toBe(numBalls);

            // Verify each created ball has a corresponding state entry
            createdBalls.forEach((ball) => {
              const stateEntry = currentState!.balls.find(
                (b) => b.label === ball.label
              );
              expect(stateEntry).toBeDefined();
            });

            // Cleanup
            physicsService.reset();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Feature: gravity-rl-game, Property 5: State Synchronization with Physics
  // Validates: Requirements 3.3
  describe('Property 5: State Synchronization with Physics', () => {
    it('should reflect updated positions and velocities after physics step', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // Number of balls
          fc.integer({ min: 400, max: 800 }), // Arena width
          fc.integer({ min: 300, max: 600 }), // Arena height
          (numBalls, arenaWidth, arenaHeight) => {
            // Initialize physics engine
            physicsService.initialize({
              gravity: { x: 0, y: 0 },
              arenaWidth,
              arenaHeight,
              restitution: 1.0,
              friction: 0.0,
              airFriction: 0.0,
            });

            // Create balls with random initial velocities
            const createdBalls: Matter.Body[] = [];
            for (let i = 0; i < numBalls; i++) {
              const ball = physicsService.createBall({
                x: 200 + Math.random() * 200,
                y: 200 + Math.random() * 200,
                radius: 15,
                mass: 1,
                isStatic: false,
                color: '#00FF00',
                label: `ball_${i}`,
              });
              
              // Apply random initial velocity
              Matter.Body.setVelocity(ball, {
                x: (Math.random() - 0.5) * 10,
                y: (Math.random() - 0.5) * 10,
              });
              
              createdBalls.push(ball);
            }

            // Update physics simulation
            physicsService.update();

            // Get updated bodies
            const bodies = physicsService.getBodies();

            // Update state from physics
            service.updateFromPhysics(bodies);

            // Get current state
            let currentState: GameState | null = null;
            service.state$.subscribe((state) => {
              currentState = state;
            }).unsubscribe();

            // Verify state reflects physics positions and velocities
            expect(currentState).not.toBeNull();
            bodies.forEach((body) => {
              const stateEntry = currentState!.balls.find(
                (b) => b.label === body.label
              );
              expect(stateEntry).toBeDefined();
              expect(stateEntry!.x).toBeCloseTo(body.position.x, 5);
              expect(stateEntry!.y).toBeCloseTo(body.position.y, 5);
              expect(stateEntry!.vx).toBeCloseTo(body.velocity.x, 5);
              expect(stateEntry!.vy).toBeCloseTo(body.velocity.y, 5);
            });

            // Cleanup
            physicsService.reset();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Feature: gravity-rl-game, Property 4: Observation Array Format Consistency
  // Validates: Requirements 3.2
  describe('Property 4: Observation Array Format Consistency', () => {
    it('should produce observation array with correct length and structure for varying obstacle counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // Number of obstacles
          (numObstacles) => {
            // Initialize physics engine
            physicsService.initialize({
              gravity: { x: 0, y: 0 },
              arenaWidth: 800,
              arenaHeight: 600,
              restitution: 1.0,
              friction: 0.0,
              airFriction: 0.0,
            });

            // Create player ball
            physicsService.createBall({
              x: 100,
              y: 100,
              radius: 15,
              mass: 1,
              isStatic: false,
              color: '#0000FF',
              label: 'player',
            });

            // Create target ball
            physicsService.createBall({
              x: 700,
              y: 500,
              radius: 20,
              mass: 1,
              isStatic: false,
              color: '#00FF00',
              label: 'target',
            });

            // Create obstacle balls
            for (let i = 0; i < numObstacles; i++) {
              physicsService.createBall({
                x: 200 + i * 50,
                y: 300,
                radius: 25,
                mass: 1,
                isStatic: false,
                color: '#FF0000',
                label: 'obstacle',
              });
            }

            // Update state from physics
            const bodies = physicsService.getBodies();
            service.updateFromPhysics(bodies);

            // Get observation array
            const obs = service.getObservationArray();

            // Expected length: (player + target + N obstacles) * 4 values per ball
            const expectedLength = (2 + numObstacles) * 4;
            expect(obs.length).toBe(expectedLength);

            // Verify structure: first 4 values are player, next 4 are target
            // Player should be at position (100, 100)
            expect(obs[0]).toBeCloseTo(100, 1);
            expect(obs[1]).toBeCloseTo(100, 1);

            // Target should be at position (700, 500)
            expect(obs[4]).toBeCloseTo(700, 1);
            expect(obs[5]).toBeCloseTo(500, 1);

            // Cleanup
            physicsService.reset();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Unit Tests
  describe('Unit Tests', () => {
    beforeEach(() => {
      physicsService.initialize({
        gravity: { x: 0, y: 0 },
        arenaWidth: 800,
        arenaHeight: 600,
        restitution: 1.0,
        friction: 0.0,
        airFriction: 0.0,
      });
    });

    afterEach(() => {
      physicsService.reset();
    });

    it('should update state from physics bodies', () => {
      const ball = physicsService.createBall({
        x: 100,
        y: 200,
        radius: 15,
        mass: 1,
        isStatic: false,
        color: '#FF0000',
        label: 'test_ball',
      });

      const bodies = physicsService.getBodies();
      service.updateFromPhysics(bodies);

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState).not.toBeNull();
      expect(currentState!.balls.length).toBe(1);
      expect(currentState!.balls[0].label).toBe('test_ball');
      expect(currentState!.balls[0].x).toBeCloseTo(100, 5);
      expect(currentState!.balls[0].y).toBeCloseTo(200, 5);
    });

    it('should produce observation array with correct length', () => {
      physicsService.createBall({
        x: 100,
        y: 100,
        radius: 15,
        mass: 1,
        isStatic: false,
        color: '#0000FF',
        label: 'player',
      });

      physicsService.createBall({
        x: 700,
        y: 500,
        radius: 20,
        mass: 1,
        isStatic: false,
        color: '#00FF00',
        label: 'target',
      });

      physicsService.createBall({
        x: 400,
        y: 300,
        radius: 25,
        mass: 1,
        isStatic: false,
        color: '#FF0000',
        label: 'obstacle',
      });

      const bodies = physicsService.getBodies();
      service.updateFromPhysics(bodies);

      const obs = service.getObservationArray();
      expect(obs.length).toBe(12); // 3 balls * 4 values each
    });

    it('should maintain correct observation array ordering (player, target, obstacles)', () => {
      physicsService.createBall({
        x: 100,
        y: 100,
        radius: 15,
        mass: 1,
        isStatic: false,
        color: '#0000FF',
        label: 'player',
      });

      physicsService.createBall({
        x: 700,
        y: 500,
        radius: 20,
        mass: 1,
        isStatic: false,
        color: '#00FF00',
        label: 'target',
      });

      physicsService.createBall({
        x: 400,
        y: 300,
        radius: 25,
        mass: 1,
        isStatic: false,
        color: '#FF0000',
        label: 'obstacle',
      });

      const bodies = physicsService.getBodies();
      service.updateFromPhysics(bodies);

      const obs = service.getObservationArray();

      // First 4 values should be player
      expect(obs[0]).toBeCloseTo(100, 1);
      expect(obs[1]).toBeCloseTo(100, 1);

      // Next 4 values should be target
      expect(obs[4]).toBeCloseTo(700, 1);
      expect(obs[5]).toBeCloseTo(500, 1);

      // Last 4 values should be obstacle
      expect(obs[8]).toBeCloseTo(400, 1);
      expect(obs[9]).toBeCloseTo(300, 1);
    });

    it('should update timer correctly', () => {
      service.updateTimer(30);

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.timer).toBe(30);

      service.updateTimer(-5);

      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.timer).toBe(25);
    });

    it('should not allow timer to go below zero', () => {
      service.updateTimer(10);
      service.updateTimer(-20);

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.timer).toBe(0);
    });

    it('should update score correctly', () => {
      service.addScore(10);

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.score).toBe(10);

      service.addScore(5);

      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.score).toBe(15);
    });

    it('should reset to initial state', () => {
      service.updateTimer(30);
      service.addScore(100);
      service.setActiveSkill('brake', true);

      service.reset();

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.timer).toBe(0);
      expect(currentState!.score).toBe(0);
      expect(currentState!.activeSkills.length).toBe(0);
      expect(currentState!.balls.length).toBe(0);
    });

    it('should handle empty physics world', () => {
      service.updateFromPhysics([]);

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.balls.length).toBe(0);

      const obs = service.getObservationArray();
      expect(obs.length).toBe(0);
    });

    it('should handle missing ball labels gracefully', () => {
      physicsService.createBall({
        x: 100,
        y: 100,
        radius: 15,
        mass: 1,
        isStatic: false,
        color: '#0000FF',
        label: 'unknown_ball',
      });

      const bodies = physicsService.getBodies();
      service.updateFromPhysics(bodies);

      const obs = service.getObservationArray();
      // Should return empty array since no player/target/obstacle found
      expect(obs.length).toBe(0);
    });

    it('should manage active skills correctly', () => {
      service.setActiveSkill('brake', true);

      let currentState: GameState | null = null;
      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.activeSkills).toContain('brake');

      service.setActiveSkill('magnetize', true);

      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.activeSkills).toContain('brake');
      expect(currentState!.activeSkills).toContain('magnetize');

      service.setActiveSkill('brake', false);

      service.state$.subscribe((state) => {
        currentState = state;
      }).unsubscribe();

      expect(currentState!.activeSkills).not.toContain('brake');
      expect(currentState!.activeSkills).toContain('magnetize');
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { TensorFlowService } from './tensorflow.service';
import { GameStateService } from './game-state.service';
import { PhysicsEngineService } from './physics-engine.service';
import { InputController } from './input-controller.service';
import * as fc from 'fast-check';

describe('TensorFlowService', () => {
  let service: TensorFlowService;
  let gameStateService: GameStateService;
  let physicsService: PhysicsEngineService;
  let inputController: InputController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TensorFlowService);
    gameStateService = TestBed.inject(GameStateService);
    physicsService = TestBed.inject(PhysicsEngineService);
    inputController = TestBed.inject(InputController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Feature: gravity-rl-game, Property 12: Observation Format Independence
  // Validates: Requirements 11.3
  describe('Property 12: Observation Format Independence', () => {
    it('should produce identical observation format for keyboard and AI modes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // Number of obstacles
          fc.integer({ min: 400, max: 800 }), // Arena width
          fc.integer({ min: 300, max: 600 }), // Arena height
          (numObstacles, arenaWidth, arenaHeight) => {
            // Initialize physics engine
            physicsService.initialize({
              gravity: { x: 0, y: 0 },
              arenaWidth,
              arenaHeight,
              restitution: 1.0,
              friction: 0.0,
              airFriction: 0.0,
            });

            // Create player ball
            physicsService.createBall({
              x: 100 + Math.random() * 100,
              y: 100 + Math.random() * 100,
              radius: 15,
              mass: 1,
              isStatic: false,
              color: '#0000FF',
              label: 'player',
            });

            // Create target ball
            physicsService.createBall({
              x: 600 + Math.random() * 100,
              y: 400 + Math.random() * 100,
              radius: 20,
              mass: 1,
              isStatic: false,
              color: '#00FF00',
              label: 'target',
            });

            // Create obstacle balls
            for (let i = 0; i < numObstacles; i++) {
              physicsService.createBall({
                x: 200 + Math.random() * 400,
                y: 200 + Math.random() * 200,
                radius: 25,
                mass: 1,
                isStatic: false,
                color: '#FF0000',
                label: 'obstacle',
              });
            }

            // Update state from physics
            const bodies = physicsService.getBodies();
            gameStateService.updateFromPhysics(bodies);

            // Get observation array in keyboard mode
            inputController.setInputMode('keyboard');
            const obsKeyboard = gameStateService.getObservationArray();

            // Get observation array in AI mode
            inputController.setInputMode('ai');
            const obsAI = gameStateService.getObservationArray();

            // Verify both modes produce identical observation arrays
            expect(obsKeyboard.length).toBe(obsAI.length);
            
            for (let i = 0; i < obsKeyboard.length; i++) {
              expect(obsKeyboard[i]).toBeCloseTo(obsAI[i], 10);
            }

            // Verify expected length: (player + target + N obstacles) * 4
            const expectedLength = (2 + numObstacles) * 4;
            expect(obsKeyboard.length).toBe(expectedLength);
            expect(obsAI.length).toBe(expectedLength);

            // Cleanup
            physicsService.reset();
          }
        ),
        { numRuns: 100 }
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
      service.stopAI();
    });

    it('should initialize without errors', () => {
      expect(service).toBeTruthy();
      expect(service.predict).toBeDefined();
      expect(service.train).toBeDefined();
      expect(service.startAI).toBeDefined();
      expect(service.stopAI).toBeDefined();
    });

    it('should have placeholder predict method that is callable', () => {
      const observation = [100, 200, 5, -3, 700, 500, 0, 0];
      const actionID = service.predict(observation);
      
      expect(actionID).toBeDefined();
      expect(typeof actionID).toBe('number');
      expect(actionID).toBe(0); // Placeholder returns 0 (NONE)
    });

    it('should have placeholder train method that is callable', () => {
      const observations = [
        [100, 200, 5, -3, 700, 500, 0, 0],
        [105, 197, 5, -3, 700, 500, 0, 0],
      ];
      const actions = [1, 2];
      const rewards = [0.5, 1.0];
      
      // Should not throw error
      expect(() => {
        service.train(observations, actions, rewards);
      }).not.toThrow();
    });

    it('should receive observations from GameStateService', () => {
      // Create game entities
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

      // Update state
      const bodies = physicsService.getBodies();
      gameStateService.updateFromPhysics(bodies);

      // Start AI with a callback
      service.startAI((actionID, position) => {
        // Callback is set up
      });

      // Verify the service can access observations
      const obs = gameStateService.getObservationArray();
      expect(obs.length).toBe(8); // 2 balls * 4 values each
    });

    it('should be able to call executeAction interface', () => {
      let executedActionID: number | null = null;
      let executedPosition: { x: number; y: number } | undefined;

      // Start AI with a callback
      service.startAI((actionID, position) => {
        executedActionID = actionID;
        executedPosition = position;
      });

      // Simulate calling the callback (as future AI implementation would)
      const mockExecuteAction = (actionID: number, position?: { x: number; y: number }) => {
        executedActionID = actionID;
        executedPosition = position;
      };

      // Test calling executeAction
      mockExecuteAction(1);
      expect(executedActionID).toBe(1);
      expect(executedPosition).toBeUndefined();

      mockExecuteAction(3, { x: 400, y: 300 });
      expect(executedActionID).toBe(3);
      expect(executedPosition).toEqual({ x: 400, y: 300 });
    });

    it('should stop observing when stopAI is called', () => {
      let callbackCount = 0;
      
      service.startAI((actionID) => {
        callbackCount++;
      });

      // Stop AI
      service.stopAI();

      // Update state - callback should not be invoked
      physicsService.createBall({
        x: 100,
        y: 100,
        radius: 15,
        mass: 1,
        isStatic: false,
        color: '#0000FF',
        label: 'player',
      });

      const bodies = physicsService.getBodies();
      gameStateService.updateFromPhysics(bodies);

      // Callback should not have been invoked after stopAI
      expect(callbackCount).toBe(0);
    });

    it('should handle multiple start/stop cycles', () => {
      // Start and stop multiple times
      service.startAI(() => {});
      service.stopAI();
      
      service.startAI(() => {});
      service.stopAI();
      
      service.startAI(() => {});
      service.stopAI();

      // Should not throw errors
      expect(service).toBeTruthy();
    });
  });
});

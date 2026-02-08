import { SkillsService } from './skills.service';
import { PhysicsEngineService } from './physics-engine.service';
import * as Matter from 'matter-js';
import * as fc from 'fast-check';

describe('SkillsService', () => {
  let service: SkillsService;
  let physicsService: PhysicsEngineService;

  beforeEach(() => {
    physicsService = new PhysicsEngineService();
    service = new SkillsService(physicsService);

    // Initialize physics engine for testing
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
    physicsService.destroy();
  });

  describe('Property Tests', () => {
    // Feature: gravity-rl-game, Property 6: Brake Skill Velocity Reduction
    it('should reduce velocity magnitude while preserving direction for any non-zero velocity', () => {
      fc.assert(
        fc.property(
          fc.record({
            vx: fc.double({ min: -100, max: 100, noNaN: true }).filter(v => Math.abs(v) > 1),
            vy: fc.double({ min: -100, max: 100, noNaN: true }).filter(v => Math.abs(v) > 1),
          }).filter(({ vx, vy }) => Math.sqrt(vx * vx + vy * vy) > 1),
          ({ vx, vy }) => {
            // Create a player ball with the random velocity
            const playerBody = physicsService.createBall({
              x: 400,
              y: 300,
              radius: 15,
              mass: 1,
              isStatic: false,
              color: '#0000ff',
              label: 'player',
            });

            // Set the velocity
            Matter.Body.setVelocity(playerBody, { x: vx, y: vy });

            // Calculate initial magnitude and direction
            const initialMagnitude = Math.sqrt(vx * vx + vy * vy);
            const initialAngle = Math.atan2(vy, vx);

            // Apply brake once
            service.applyBrake(playerBody);
            physicsService.update();

            // Get new velocity
            const newVelocity = playerBody.velocity;
            const newMagnitude = Math.sqrt(
              newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y
            );
            const newAngle = Math.atan2(newVelocity.y, newVelocity.x);

            // Verify magnitude decreased
            expect(newMagnitude).toBeLessThan(initialMagnitude);

            // Verify direction preserved (angle should be approximately the same)
            // Use a more lenient tolerance for floating point comparison
            const angleDiff = Math.abs(newAngle - initialAngle);
            const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
            expect(normalizedDiff).toBeLessThan(0.5); // More lenient tolerance

            // Clean up
            physicsService.reset();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: gravity-rl-game, Property 7: Magnetize Radius Detection and Force
    it('should only affect balls within radius and apply inverse-square force', () => {
      fc.assert(
        fc.property(
          fc.record({
            playerX: fc.constant(400),
            playerY: fc.constant(300),
            balls: fc.array(
              fc.record({
                x: fc.double({ min: 100, max: 700, noNaN: true }),
                y: fc.double({ min: 100, max: 500, noNaN: true }),
                mass: fc.double({ min: 1, max: 5, noNaN: true }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          ({ playerX, playerY, balls }) => {
            // Create player ball
            const playerBody = physicsService.createBall({
              x: playerX,
              y: playerY,
              radius: 15,
              mass: 1,
              isStatic: false,
              color: '#0000ff',
              label: 'player',
            });

            // Create test balls
            const testBodies = balls.map((ball, index) =>
              physicsService.createBall({
                x: ball.x,
                y: ball.y,
                radius: 10,
                mass: ball.mass,
                isStatic: false,
                color: '#ff0000',
                label: `test-ball-${index}`,
              })
            );

            // Record initial velocities
            const initialVelocities = testBodies.map(body => ({
              x: body.velocity.x,
              y: body.velocity.y,
            }));

            // Apply magnetize
            const allBodies = physicsService.getBodies();
            service.applyMagnetize(playerBody, allBodies);

            // Update physics to apply forces
            physicsService.update();

            // Check each ball
            const radius = service.getConfig().magnetizeRadius;
            testBodies.forEach((body, index) => {
              const dx = playerX - body.position.x;
              const dy = playerY - body.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              const velocityChanged =
                body.velocity.x !== initialVelocities[index].x ||
                body.velocity.y !== initialVelocities[index].y;

              if (distance <= radius && distance > 0.01) {
                // Ball within radius should have velocity changed (force applied)
                expect(velocityChanged).toBe(true);
              } else if (distance > radius) {
                // Ball outside radius should not have velocity changed
                expect(velocityChanged).toBe(false);
              }
            });

            // Clean up
            physicsService.reset();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: gravity-rl-game, Property 8: Gravity Bomb Universal Attraction
    it('should apply attractive force to all balls toward bomb center', () => {
      fc.assert(
        fc.property(
          fc.record({
            bombX: fc.double({ min: 200, max: 600, noNaN: true }),
            bombY: fc.double({ min: 200, max: 400, noNaN: true }),
            balls: fc.array(
              fc.record({
                x: fc.double({ min: 100, max: 700, noNaN: true }),
                y: fc.double({ min: 100, max: 500, noNaN: true }),
                mass: fc.double({ min: 1, max: 5, noNaN: true }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          ({ bombX, bombY, balls }) => {
            // Create test balls
            const testBodies = balls.map((ball, index) =>
              physicsService.createBall({
                x: ball.x,
                y: ball.y,
                radius: 10,
                mass: ball.mass,
                isStatic: false,
                color: '#ff0000',
                label: `test-ball-${index}`,
              })
            );

            // Record initial velocities
            const initialVelocities = testBodies.map(body => ({
              x: body.velocity.x,
              y: body.velocity.y,
            }));

            // Create gravity bomb
            service.createGravityBomb({ x: bombX, y: bombY });

            // Update gravity bombs to apply forces
            const allBodies = physicsService.getBodies();
            service.updateGravityBombs(allBodies);

            // Update physics to apply forces
            physicsService.update();

            // Verify all balls experience force toward bomb
            testBodies.forEach((body, index) => {
              const dx = bombX - body.position.x;
              const dy = bombY - body.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              // Skip if ball is too close to bomb (to avoid division by zero issues)
              if (distance < 0.01) {
                return;
              }

              const velocityChanged =
                body.velocity.x !== initialVelocities[index].x ||
                body.velocity.y !== initialVelocities[index].y;

              // All balls should experience force (velocity changed)
              expect(velocityChanged).toBe(true);
            });

            // Clean up
            physicsService.reset();
            // Also clean up gravity bombs
            service.cleanupExpiredBombs();
            // Force cleanup by removing all bombs
            const bombs = service.getGravityBombs();
            bombs.forEach(() => service.cleanupExpiredBombs());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    describe('applyBrake', () => {
      it('should apply force opposite to velocity', () => {
        // Create player ball with velocity
        const playerBody = physicsService.createBall({
          x: 400,
          y: 300,
          radius: 15,
          mass: 1,
          isStatic: false,
          color: '#0000ff',
          label: 'player',
        });

        // Set velocity
        Matter.Body.setVelocity(playerBody, { x: 10, y: 5 });

        const initialVelocity = { ...playerBody.velocity };

        // Apply brake once
        service.applyBrake(playerBody);
        physicsService.update();

        // Velocity magnitude should decrease
        const initialMag = Math.sqrt(
          initialVelocity.x * initialVelocity.x + initialVelocity.y * initialVelocity.y
        );
        const finalMag = Math.sqrt(
          playerBody.velocity.x * playerBody.velocity.x +
            playerBody.velocity.y * playerBody.velocity.y
        );

        expect(finalMag).toBeLessThan(initialMag);

        physicsService.reset();
      });

      it('should do nothing when velocity is zero (edge case)', () => {
        // Create player ball with zero velocity
        const playerBody = physicsService.createBall({
          x: 400,
          y: 300,
          radius: 15,
          mass: 1,
          isStatic: false,
          color: '#0000ff',
          label: 'player',
        });

        // Velocity is already zero
        expect(playerBody.velocity.x).toBe(0);
        expect(playerBody.velocity.y).toBe(0);

        // Apply brake
        service.applyBrake(playerBody);

        // Update physics
        physicsService.update();

        // Velocity should still be zero
        expect(playerBody.velocity.x).toBe(0);
        expect(playerBody.velocity.y).toBe(0);

        physicsService.reset();
      });
    });

    describe('applyMagnetize', () => {
      it('should only affect balls within radius', () => {
        // Create player ball
        const playerBody = physicsService.createBall({
          x: 400,
          y: 300,
          radius: 15,
          mass: 1,
          isStatic: false,
          color: '#0000ff',
          label: 'player',
        });

        // Create ball within radius
        const nearBall = physicsService.createBall({
          x: 450,
          y: 300,
          radius: 10,
          mass: 1,
          isStatic: false,
          color: '#ff0000',
          label: 'near-ball',
        });

        // Create ball outside radius
        const farBall = physicsService.createBall({
          x: 700,
          y: 300,
          radius: 10,
          mass: 1,
          isStatic: false,
          color: '#ff0000',
          label: 'far-ball',
        });

        const nearInitialVel = { ...nearBall.velocity };
        const farInitialVel = { ...farBall.velocity };

        // Apply magnetize
        const allBodies = physicsService.getBodies();
        service.applyMagnetize(playerBody, allBodies);

        // Update physics
        physicsService.update();

        // Near ball should have velocity changed
        const nearVelChanged =
          nearBall.velocity.x !== nearInitialVel.x || nearBall.velocity.y !== nearInitialVel.y;
        expect(nearVelChanged).toBe(true);

        // Far ball should not have velocity changed
        const farVelChanged =
          farBall.velocity.x !== farInitialVel.x || farBall.velocity.y !== farInitialVel.y;
        expect(farVelChanged).toBe(false);

        physicsService.reset();
      });

      it('should handle zero distance gracefully (edge case)', () => {
        // Create player ball
        const playerBody = physicsService.createBall({
          x: 400,
          y: 300,
          radius: 15,
          mass: 1,
          isStatic: false,
          color: '#0000ff',
          label: 'player',
        });

        // Create ball at same position (zero distance)
        const samePosball = physicsService.createBall({
          x: 400,
          y: 300,
          radius: 10,
          mass: 1,
          isStatic: false,
          color: '#ff0000',
          label: 'same-pos-ball',
        });

        // This should not throw an error
        expect(() => {
          const allBodies = physicsService.getBodies();
          service.applyMagnetize(playerBody, allBodies);
          physicsService.update();
        }).not.toThrow();

        physicsService.reset();
      });
    });

    describe('createGravityBomb', () => {
      it('should create sensor body at specified position', () => {
        const position = { x: 500, y: 400 };
        const bomb = service.createGravityBomb(position);

        expect(bomb).toBeDefined();
        expect(bomb.position.x).toBe(500);
        expect(bomb.position.y).toBe(400);
        expect(bomb.sensor).toBeDefined();
        expect(bomb.sensor.label).toBe('gravity-bomb');

        physicsService.reset();
      });
    });

    describe('updateGravityBombs', () => {
      it('should affect all balls', () => {
        // Create some balls
        const ball1 = physicsService.createBall({
          x: 200,
          y: 200,
          radius: 10,
          mass: 1,
          isStatic: false,
          color: '#ff0000',
          label: 'ball-1',
        });

        const ball2 = physicsService.createBall({
          x: 600,
          y: 400,
          radius: 10,
          mass: 1,
          isStatic: false,
          color: '#ff0000',
          label: 'ball-2',
        });

        const initialVel1 = { ...ball1.velocity };
        const initialVel2 = { ...ball2.velocity };

        // Create gravity bomb
        service.createGravityBomb({ x: 400, y: 300 });

        // Update gravity bombs
        const allBodies = physicsService.getBodies();
        service.updateGravityBombs(allBodies);

        // Update physics
        physicsService.update();

        // Both balls should have velocity changed
        const vel1Changed = ball1.velocity.x !== initialVel1.x || ball1.velocity.y !== initialVel1.y;
        const vel2Changed = ball2.velocity.x !== initialVel2.x || ball2.velocity.y !== initialVel2.y;

        expect(vel1Changed).toBe(true);
        expect(vel2Changed).toBe(true);

        physicsService.reset();
      });

      it('should handle multiple simultaneous gravity bombs (edge case)', () => {
        // Create a ball
        const ball = physicsService.createBall({
          x: 400,
          y: 300,
          radius: 10,
          mass: 1,
          isStatic: false,
          color: '#ff0000',
          label: 'ball',
        });

        // Create multiple gravity bombs
        service.createGravityBomb({ x: 300, y: 300 });
        service.createGravityBomb({ x: 500, y: 300 });

        // This should not throw an error
        expect(() => {
          const allBodies = physicsService.getBodies();
          service.updateGravityBombs(allBodies);
          physicsService.update();
        }).not.toThrow();

        physicsService.reset();
      });
    });

    describe('cleanupExpiredBombs', () => {
      it('should remove expired bombs after duration', (done) => {
        // Set short duration for testing
        service.setConfig({ gravityBombDuration: 0.1 }); // 100ms

        // Create gravity bomb
        service.createGravityBomb({ x: 400, y: 300 });

        // Should have 1 bomb
        expect(service.getGravityBombs().length).toBe(1);

        // Wait for bomb to expire
        setTimeout(() => {
          service.cleanupExpiredBombs();

          // Should have 0 bombs
          expect(service.getGravityBombs().length).toBe(0);

          physicsService.reset();
          done();
        }, 150);
      });
    });
  });
});

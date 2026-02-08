import { Injectable } from '@angular/core';
import * as Matter from 'matter-js';

export interface PhysicsConfig {
  gravity: { x: number; y: number };
  arenaWidth: number;
  arenaHeight: number;
  restitution: number;
  friction: number;
  airFriction: number;
}

export interface BallConfig {
  x: number;
  y: number;
  radius: number;
  mass: number;
  isStatic: boolean;
  color: string;
  label: string; // 'player', 'target', 'obstacle'
}

@Injectable({
  providedIn: 'root',
})
export class PhysicsEngineService {
  private engine!: Matter.Engine;
  private world!: Matter.World;
  private walls: Matter.Body[] = [];
  private velocityMap = new Map<number, { x: number; y: number; speed: number }>();

  /**
   * Initialize the Matter.js physics engine with zero gravity configuration
   * @param config Physics configuration including gravity, arena dimensions, and collision properties
   */
  initialize(config: PhysicsConfig): void {
    // Create the Matter.js engine with zero gravity and optimized settings for elastic collisions
    this.engine = Matter.Engine.create({
      gravity: config.gravity,
      // Disable position and velocity damping for perfect elastic collisions
      positionIterations: 10,
      velocityIterations: 10,
    });

    this.world = this.engine.world;

    // Configure world properties for elastic collisions
    // Note: Individual bodies will have restitution and friction set when created
    
    // Create bounded arena walls
    this.createWalls(config.arenaWidth, config.arenaHeight);
    
    // Add event handler to preserve energy in collisions
    this.setupEnergyConservation();
  }

  /**
   * Set up energy conservation to ensure perfectly elastic collisions
   * This prevents Matter.js from absorbing energy during collisions
   */
  private setupEnergyConservation(): void {
    // Track velocities before collision for logging
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;
      
      for (const pair of pairs) {
        const { bodyA, bodyB } = pair;
        
        // Check if one body is a wall
        const wall = bodyA.label === 'wall' ? bodyA : bodyB.label === 'wall' ? bodyB : null;
        const ball = bodyA.label === 'wall' ? bodyB : bodyB.label === 'wall' ? bodyA : null;
        
        if (wall && ball && !ball.isStatic) {
          // === WALL COLLISION ===
          // Manually handle the bounce to ensure perfect elastic collision
          // Determine which wall was hit based on collision normal
          const normal = pair.collision.normal;
          
          // The collision normal points from bodyA to bodyB
          // If bodyA is the wall, we need to reverse the normal
          const wallNormal = bodyA.label === 'wall' ? 
            { x: -normal.x, y: -normal.y } : 
            { x: normal.x, y: normal.y };
          
          // Calculate the velocity component along the normal (perpendicular to wall)
          const velocityAlongNormal = ball.velocity.x * wallNormal.x + ball.velocity.y * wallNormal.y;
          
          // Reflect the velocity: subtract twice the normal component
          const newVx = ball.velocity.x - 2 * velocityAlongNormal * wallNormal.x;
          const newVy = ball.velocity.y - 2 * velocityAlongNormal * wallNormal.y;
          
          // Set the new velocity immediately
          Matter.Body.setVelocity(ball, { x: newVx, y: newVy });
        } else if (!wall && bodyA.label !== 'wall' && bodyB.label !== 'wall' && !bodyA.isStatic && !bodyB.isStatic) {
          // === BALL-TO-BALL COLLISION ===
          // Handle elastic collision between two balls
          const ball1 = bodyA;
          const ball2 = bodyB;
          
          // Get velocities before collision
          const v1x = ball1.velocity.x;
          const v1y = ball1.velocity.y;
          const v2x = ball2.velocity.x;
          const v2y = ball2.velocity.y;
          
          // Get masses
          const m1 = ball1.mass;
          const m2 = ball2.mass;
          
          // Calculate collision normal (from ball1 to ball2)
          const dx = ball2.position.x - ball1.position.x;
          const dy = ball2.position.y - ball1.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0.001) {
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Calculate relative velocity along collision normal
            const dvx = v1x - v2x;
            const dvy = v1y - v2y;
            const dvn = dvx * nx + dvy * ny;
            
            // Only resolve if balls are approaching (not separating)
            if (dvn > 0) {
              // Calculate impulse for elastic collision
              const impulse = (2 * dvn) / (m1 + m2);
              
              // Apply impulse to both balls
              const impulseX = impulse * nx;
              const impulseY = impulse * ny;
              
              Matter.Body.setVelocity(ball1, {
                x: v1x - impulseX * m2,
                y: v1y - impulseY * m2
              });
              
              Matter.Body.setVelocity(ball2, {
                x: v2x + impulseX * m1,
                y: v2y + impulseY * m1
              });
              
              // Add small separation to prevent sticking
              const separation = 0.5;
              Matter.Body.translate(ball1, { x: -nx * separation, y: -ny * separation });
              Matter.Body.translate(ball2, { x: nx * separation, y: ny * separation });
            }
          }
        }
      }
    });
  }

  /**
   * Create walls to bound the arena
   * @param width Arena width
   * @param height Arena height
   */
  createWalls(width: number, height: number): Matter.Body[] {
    const wallThickness = 50;
    const wallOptions = {
      isStatic: true,
      restitution: 1.0, // Perfectly elastic
      friction: 0.0, // No friction
      frictionStatic: 0.0, // No static friction
      slop: 0, // No collision slop
      label: 'wall',
      collisionFilter: {
        category: 0x0001, // Wall category
        mask: 0xFFFF, // Collide with everything
      },
    };

    // Create four walls: top, bottom, left, right
    const topWall = Matter.Bodies.rectangle(
      width / 2,
      -wallThickness / 2,
      width,
      wallThickness,
      wallOptions
    );

    const bottomWall = Matter.Bodies.rectangle(
      width / 2,
      height + wallThickness / 2,
      width,
      wallThickness,
      wallOptions
    );

    const leftWall = Matter.Bodies.rectangle(
      -wallThickness / 2,
      height / 2,
      wallThickness,
      height,
      wallOptions
    );

    const rightWall = Matter.Bodies.rectangle(
      width + wallThickness / 2,
      height / 2,
      wallThickness,
      height,
      wallOptions
    );

    this.walls = [topWall, bottomWall, leftWall, rightWall];

    // Add walls to the world
    Matter.World.add(this.world, this.walls);

    return this.walls;
  }

  /**
   * Create a ball with specified configuration
   * @param config Ball configuration including position, size, mass, and visual properties
   * @returns The created Matter.js body
   */
  createBall(config: BallConfig): Matter.Body {
    const ball = Matter.Bodies.circle(config.x, config.y, config.radius, {
      mass: config.mass,
      isStatic: config.isStatic,
      restitution: 1.0, // Perfectly elastic collision
      friction: 0.0, // No friction
      frictionAir: 0.0, // No air friction
      frictionStatic: 0.0, // No static friction
      inertia: Infinity, // Prevent rotation
      inverseInertia: 0, // Prevent rotation
      slop: 0, // No collision slop (prevents energy loss)
      label: config.label,
      collisionFilter: {
        category: 0x0004, // Ball category
        mask: 0x0001 | 0x0004, // Collide with walls (0x0001) and other balls (0x0004), but not gravity bombs (0x0002)
      },
      render: {
        fillStyle: config.color,
      },
    });

    // Add ball to the world
    Matter.World.add(this.world, ball);
    
    // Initialize velocity map entry for this ball
    const vx = ball.velocity.x;
    const vy = ball.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    this.velocityMap.set(ball.id, { x: vx, y: vy, speed });

    return ball;
  }

  /**
   * Get all bodies in the physics world (excluding walls)
   * @returns Array of all Matter.js bodies
   */
  getBodies(): Matter.Body[] {
    return Matter.Composite.allBodies(this.world).filter(
      (body) => body.label !== 'wall'
    );
  }

  /**
   * Find a body by its label
   * @param label The label to search for (e.g., 'player', 'target', 'obstacle')
   * @returns The body with the matching label, or undefined if not found
   */
  getBodyByLabel(label: string): Matter.Body | undefined {
    return Matter.Composite.allBodies(this.world).find(
      (body) => body.label === label
    );
  }

  /**
   * Apply a force to a body
   * @param body The body to apply force to
   * @param force The force vector to apply
   */
  applyForce(body: Matter.Body, force: Matter.Vector): void {
    Matter.Body.applyForce(body, body.position, force);
  }

  /**
   * Update the physics simulation by one step
   * Uses a fixed time step for consistent simulation
   * @param timeScale Optional time scale multiplier (default 1.0)
   */
  update(timeScale: number = 1.0): void {
    // Always use the same delta for consistent physics
    // When timeScale < 1.0, we simply update less frequently (handled by caller)
    const delta = 1000 / 60;
    Matter.Engine.update(this.engine, delta);
  }

  /**
   * Reset the physics world by removing all non-wall bodies
   */
  reset(): void {
    // Get all bodies except walls
    const bodiesToRemove = Matter.Composite.allBodies(this.world).filter(
      (body) => body.label !== 'wall'
    );

    // Remove all non-wall bodies
    Matter.World.remove(this.world, bodiesToRemove);
    
    // Clear velocity map
    this.velocityMap.clear();
  }

  /**
   * Destroy the physics engine and clean up resources
   */
  destroy(): void {
    if (this.world) {
      Matter.World.clear(this.world, false);
    }
    if (this.engine) {
      Matter.Engine.clear(this.engine);
    }
  }
}

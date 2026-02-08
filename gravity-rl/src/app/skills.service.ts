import { Injectable } from '@angular/core';
import * as Matter from 'matter-js';
import { PhysicsEngineService } from './physics-engine.service';

export interface SkillConfig {
  brakeConstant: number;
  magnetizeRadius: number;
  magnetizeStrength: number;
  gravityBombDuration: number;
  gravityBombStrength: number;
  gravityBombRadius?: number; // Optional radius for gravity bombs
  gravityBombEffectRadius?: number; // Optional effect radius for gravity bombs
}

export interface GravityBomb {
  position: Matter.Vector;
  createdAt: number;
  duration: number;
  sensor: Matter.Body;
}

@Injectable({
  providedIn: 'root',
})
export class SkillsService {
  private gravityBombs: GravityBomb[] = [];

  constructor(private physics: PhysicsEngineService) {}

  /**
   * Initialize the skills service with configuration
   * @param config Skill configuration parameters
   */
  private config: SkillConfig = {
    brakeConstant: 0.001, // Reduced from 0.1 to prevent instability
    magnetizeRadius: 150,
    magnetizeStrength: 0.0001,
    gravityBombDuration: 3,
    gravityBombStrength: 0.0002,
    gravityBombRadius: 7.5, // Half of player radius (15 / 2)
    gravityBombEffectRadius: 80, // Smaller than magnetize (120)
  };

  /**
   * Set the skill configuration
   * @param config Skill configuration parameters
   */
  setConfig(config: Partial<SkillConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current skill configuration
   * @returns Current skill configuration
   */
  getConfig(): SkillConfig {
    return { ...this.config };
  }

  /**
   * Apply brake skill to slow down the player ball
   * Applies a force opposite to velocity: F = -v * k
   * @param playerBody The player ball body
   */
  applyBrake(playerBody: Matter.Body): void {
    const velocity = playerBody.velocity;
    
    // Handle zero velocity case - no force applied
    if (velocity.x === 0 && velocity.y === 0) {
      return;
    }

    // Calculate brake force: F = -v * k
    // The force should be proportional to velocity and opposite in direction
    // We scale by mass to get consistent deceleration
    const brakeForce = {
      x: -velocity.x * this.config.brakeConstant * playerBody.mass,
      y: -velocity.y * this.config.brakeConstant * playerBody.mass,
    };

    // Apply the brake force
    this.physics.applyForce(playerBody, brakeForce);
  }

  /**
   * Apply magnetize skill to attract nearby balls to the player
   * Uses inverse-square law: F = G / r^2
   * Applies equal and opposite forces (Newton's third law)
   * @param playerBody The player ball body
   * @param allBodies All bodies in the physics world
   * @returns Array of affected balls with their force magnitudes
   */
  applyMagnetize(playerBody: Matter.Body, allBodies: Matter.Body[]): Array<{ body: Matter.Body; forceMagnitude: number; distance: number }> {
    const playerPos = playerBody.position;
    const radius = this.config.magnetizeRadius;
    const G = this.config.magnetizeStrength;
    const affectedBalls: Array<{ body: Matter.Body; forceMagnitude: number; distance: number }> = [];

    // Find all balls within the magnetize radius
    for (const body of allBodies) {
      // Skip the player itself and walls
      if (body === playerBody || body.label === 'wall') {
        continue;
      }

      // Calculate distance to the body
      const dx = playerPos.x - body.position.x;
      const dy = playerPos.y - body.position.y;
      const distanceSquared = dx * dx + dy * dy;
      const distance = Math.sqrt(distanceSquared);

      // Handle zero distance case to prevent division by zero
      if (distance < 0.01) {
        continue;
      }

      // Check if body is within radius
      if (distance > radius) {
        continue;
      }

      // Calculate attractive force using inverse-square law: F = G / r^2
      const forceMagnitude = G / distanceSquared;

      // Calculate force direction (toward player)
      const forceX = (dx / distance) * forceMagnitude;
      const forceY = (dy / distance) * forceMagnitude;

      // Apply force to the other body (toward player)
      this.physics.applyForce(body, { x: forceX, y: forceY });
      
      // Apply equal and opposite force to player (Newton's third law)
      this.physics.applyForce(playerBody, { x: -forceX, y: -forceY });
      
      // Track affected ball
      affectedBalls.push({ body, forceMagnitude, distance });
    }
    
    return affectedBalls;
  }

  /**
   * Create a gravity bomb at the specified position
   * @param position The position to create the gravity bomb
   * @returns The created gravity bomb
   */
  createGravityBomb(position: Matter.Vector): GravityBomb {
    const radius = this.config.gravityBombRadius || 7.5;
    
    // Create a sensor body that detects collisions but doesn't respond physically
    const sensor = Matter.Bodies.circle(position.x, position.y, radius, {
      isSensor: true, // Sensor mode - detects collisions but no physical response
      isStatic: false, // Can move
      mass: 2, // Same mass as obstacles
      restitution: 1.0, // Perfectly elastic (for wall collisions)
      friction: 0.0,
      frictionAir: 0.0,
      label: 'gravity-bomb',
      collisionFilter: {
        category: 0x0002, // Gravity bomb category
        mask: 0x0001 | 0x0004, // Collide with walls (0x0001) and balls (0x0004)
      },
      render: {
        fillStyle: '#ff00ff',
      },
    });

    // Add sensor to the physics world
    Matter.World.add((this.physics as any).world, sensor);

    // Create gravity bomb object
    const bomb: GravityBomb = {
      position: sensor.position, // Use body's position (will update as it moves)
      createdAt: Date.now(),
      duration: this.config.gravityBombDuration * 1000, // Convert to milliseconds
      sensor,
    };

    this.gravityBombs.push(bomb);

    return bomb;
  }

  /**
   * Update all active gravity bombs and apply forces to balls
   * @param allBodies All bodies in the physics world
   * @returns Map of bomb IDs to arrays of affected balls, and array of bombs to remove
   */
  updateGravityBombs(allBodies: Matter.Body[]): { affectedBallsMap: Map<number, Array<{ body: Matter.Body; forceMagnitude: number; distance: number }>>; bombsToRemove: Matter.Body[] } {
    const G = this.config.gravityBombStrength;
    const effectRadius = this.config.gravityBombEffectRadius || 80;
    const mineRadius = this.config.gravityBombRadius || 7.5;
    const affectedBallsMap = new Map<number, Array<{ body: Matter.Body; forceMagnitude: number; distance: number }>>();
    const bombsToRemove: Matter.Body[] = [];

    for (const bomb of this.gravityBombs) {
      // Update bomb position from its body (it moves now)
      bomb.position = bomb.sensor.position;
      
      const affectedBalls: Array<{ body: Matter.Body; forceMagnitude: number; distance: number }> = [];
      let shouldRemoveBomb = false;
      
      // Apply attractive force to all balls within radius
      for (const body of allBodies) {
        // Skip walls and the bomb sensor itself
        if (body.label === 'wall' || body.label === 'gravity-bomb') {
          continue;
        }

        // Calculate distance to the bomb
        const dx = bomb.position.x - body.position.x;
        const dy = bomb.position.y - body.position.y;
        const distanceSquared = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSquared);

        // Handle zero distance case to prevent division by zero
        if (distance < 0.01) {
          continue;
        }
        
        // Safety check: if mine is too close to any ball, mark for removal
        const ballRadius = body.circleRadius || 15;
        const safetyThreshold = (mineRadius + ballRadius) * 1.5;
        if (distance < safetyThreshold) {
          shouldRemoveBomb = true;
          bombsToRemove.push(bomb.sensor);
          break; // No need to check other balls
        }
        
        // Check if body is within effect radius
        if (distance > effectRadius) {
          continue;
        }

        // Calculate attractive force using inverse-square law (mass-independent like magnetize)
        const forceMagnitude = G / distanceSquared;

        // Calculate force direction (toward bomb)
        const forceX = (dx / distance) * forceMagnitude;
        const forceY = (dy / distance) * forceMagnitude;

        // Apply force to the body (toward bomb)
        this.physics.applyForce(body, { x: forceX, y: forceY });
        
        // Apply equal and opposite force to bomb (Newton's third law)
        this.physics.applyForce(bomb.sensor, { x: -forceX, y: -forceY });
        
        // Track affected ball
        affectedBalls.push({ body, forceMagnitude, distance });
      }
      
      // Only add to affected balls map if bomb is not being removed
      if (!shouldRemoveBomb) {
        affectedBallsMap.set(bomb.sensor.id, affectedBalls);
      }
    }
    
    return { affectedBallsMap, bombsToRemove };
  }

  /**
   * Clean up expired gravity bombs
   * @returns Array of expired bomb sensors (for poof effects)
   */
  cleanupExpiredBombs(): Matter.Body[] {
    const now = Date.now();
    const expiredBombs: GravityBomb[] = [];

    // Find expired bombs
    for (const bomb of this.gravityBombs) {
      if (now - bomb.createdAt >= bomb.duration) {
        expiredBombs.push(bomb);
      }
    }

    const expiredSensors: Matter.Body[] = [];

    // Remove expired bombs
    for (const bomb of expiredBombs) {
      expiredSensors.push(bomb.sensor);
      
      // Remove sensor from physics world
      Matter.World.remove((this.physics as any).world, bomb.sensor);

      // Remove from array
      const index = this.gravityBombs.indexOf(bomb);
      if (index > -1) {
        this.gravityBombs.splice(index, 1);
      }
    }
    
    return expiredSensors;
  }

  /**
   * Remove a specific gravity bomb by its sensor body
   * @param sensorBody The sensor body of the bomb to remove
   */
  removeGravityBomb(sensorBody: Matter.Body): void {
    const bombIndex = this.gravityBombs.findIndex(bomb => bomb.sensor === sensorBody);
    if (bombIndex >= 0) {
      const bomb = this.gravityBombs[bombIndex];
      // Remove sensor from physics world
      Matter.World.remove((this.physics as any).world, bomb.sensor);
      // Remove from array
      this.gravityBombs.splice(bombIndex, 1);
    }
  }

  /**
   * Get all active gravity bombs
   * @returns Array of active gravity bombs
   */
  getGravityBombs(): GravityBomb[] {
    return [...this.gravityBombs];
  }
}

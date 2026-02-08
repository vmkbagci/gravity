import { Injectable, InjectionToken, Optional, Inject } from '@angular/core';

/**
 * Complete game configuration interface
 * Defines all configurable parameters for the Gravity-RL game
 */
export interface GameConfig {
  // Arena dimensions
  arenaWidth: number;       // Default: 800
  arenaHeight: number;      // Default: 600
  
  // Ball configuration
  numObstacles: number;     // N obstacles (default: 5)
  playerRadius: number;     // Default: 15
  targetRadius: number;     // Default: 20
  obstacleRadius: number;   // Default: 25
  
  // Physics properties
  restitution: number;      // Default: 1.0 (elastic)
  friction: number;         // Default: 0.0
  airFriction: number;      // Default: 0.0
  
  // Timer configuration
  initialTime: number;      // T seconds (default: 30)
  timeBonus: number;        // M seconds per target hit (default: 5)
  
  // Skill parameters
  brakeConstant: number;    // Force multiplier (default: 0.001)
  magnetizeRadius: number;  // Pixels (default: 150)
  magnetizeStrength: number;// Gravitational constant (default: 0.0001)
  gravityBombDuration: number; // X seconds (default: 3)
  gravityBombStrength: number; // Force multiplier (default: 0.0002)
}

/**
 * Injection token for providing custom game configuration
 */
export const GAME_CONFIG = new InjectionToken<Partial<GameConfig>>('GAME_CONFIG');

/**
 * Default game configuration values
 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  // Arena
  arenaWidth: 800,
  arenaHeight: 600,
  
  // Balls
  numObstacles: 5,
  playerRadius: 15,
  targetRadius: 20,
  obstacleRadius: 25,
  
  // Physics
  restitution: 1.0,
  friction: 0.0,
  airFriction: 0.0,
  
  // Timer
  initialTime: 30,
  timeBonus: 5,
  
  // Skills
  brakeConstant: 0.001,
  magnetizeRadius: 150,
  magnetizeStrength: 0.0001,
  gravityBombDuration: 3,
  gravityBombStrength: 0.0002,
};

/**
 * Service for managing game configuration
 * Provides centralized, validated, and injectable configuration
 */
@Injectable({
  providedIn: 'root',
})
export class GameConfigService {
  private config: GameConfig;

  constructor(@Optional() @Inject(GAME_CONFIG) customConfig?: Partial<GameConfig>) {
    this.config = { ...DEFAULT_GAME_CONFIG };
    if (customConfig) {
      this.setConfig(customConfig);
    }
  }

  /**
   * Get the current game configuration
   * @returns A copy of the current configuration
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Update the game configuration with partial values
   * Validates and merges with existing configuration
   * @param partialConfig Partial configuration to merge
   */
  setConfig(partialConfig: Partial<GameConfig>): void {
    const validatedConfig = this.validateConfig({
      ...this.config,
      ...partialConfig,
    });
    this.config = validatedConfig;
  }

  /**
   * Reset configuration to default values
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_GAME_CONFIG };
  }

  /**
   * Validate configuration values
   * Ensures all numeric values are positive and finite
   * @param config Configuration to validate
   * @returns Validated configuration with clamped/corrected values
   */
  private validateConfig(config: GameConfig): GameConfig {
    const validated = { ...config };

    // Validate arena dimensions (must be positive)
    validated.arenaWidth = this.ensurePositive(validated.arenaWidth, DEFAULT_GAME_CONFIG.arenaWidth);
    validated.arenaHeight = this.ensurePositive(validated.arenaHeight, DEFAULT_GAME_CONFIG.arenaHeight);

    // Validate ball configuration
    validated.numObstacles = Math.max(0, Math.floor(validated.numObstacles)); // Can be 0, must be integer
    validated.playerRadius = this.ensurePositive(validated.playerRadius, DEFAULT_GAME_CONFIG.playerRadius);
    validated.targetRadius = this.ensurePositive(validated.targetRadius, DEFAULT_GAME_CONFIG.targetRadius);
    validated.obstacleRadius = this.ensurePositive(validated.obstacleRadius, DEFAULT_GAME_CONFIG.obstacleRadius);

    // Validate physics properties (must be non-negative and finite)
    validated.restitution = this.ensureNonNegative(validated.restitution, DEFAULT_GAME_CONFIG.restitution);
    validated.friction = this.ensureNonNegative(validated.friction, DEFAULT_GAME_CONFIG.friction);
    validated.airFriction = this.ensureNonNegative(validated.airFriction, DEFAULT_GAME_CONFIG.airFriction);

    // Validate timer configuration (must be positive)
    validated.initialTime = this.ensurePositive(validated.initialTime, DEFAULT_GAME_CONFIG.initialTime);
    validated.timeBonus = this.ensurePositive(validated.timeBonus, DEFAULT_GAME_CONFIG.timeBonus);

    // Validate skill parameters (must be positive)
    validated.brakeConstant = this.ensurePositive(validated.brakeConstant, DEFAULT_GAME_CONFIG.brakeConstant);
    validated.magnetizeRadius = this.ensurePositive(validated.magnetizeRadius, DEFAULT_GAME_CONFIG.magnetizeRadius);
    validated.magnetizeStrength = this.ensurePositive(validated.magnetizeStrength, DEFAULT_GAME_CONFIG.magnetizeStrength);
    validated.gravityBombDuration = this.ensurePositive(validated.gravityBombDuration, DEFAULT_GAME_CONFIG.gravityBombDuration);
    validated.gravityBombStrength = this.ensurePositive(validated.gravityBombStrength, DEFAULT_GAME_CONFIG.gravityBombStrength);

    return validated;
  }

  /**
   * Ensure a value is positive and finite
   * @param value Value to check
   * @param defaultValue Default value to use if invalid
   * @returns Valid positive value
   */
  private ensurePositive(value: number, defaultValue: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn(`Invalid configuration value ${value}, using default ${defaultValue}`);
      return defaultValue;
    }
    return value;
  }

  /**
   * Ensure a value is non-negative and finite
   * @param value Value to check
   * @param defaultValue Default value to use if invalid
   * @returns Valid non-negative value
   */
  private ensureNonNegative(value: number, defaultValue: number): number {
    if (!Number.isFinite(value) || value < 0) {
      console.warn(`Invalid configuration value ${value}, using default ${defaultValue}`);
      return defaultValue;
    }
    return value;
  }
}

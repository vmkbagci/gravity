import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GameConfigService, DEFAULT_GAME_CONFIG, GAME_CONFIG, GameConfig } from './game-config.service';

describe('GameConfigService', () => {
  let service: GameConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Default Configuration', () => {
    it('should return default configuration values', () => {
      const config = service.getConfig();
      
      expect(config.arenaWidth).toBe(800);
      expect(config.arenaHeight).toBe(600);
      expect(config.numObstacles).toBe(5);
      expect(config.playerRadius).toBe(15);
      expect(config.targetRadius).toBe(20);
      expect(config.obstacleRadius).toBe(25);
      expect(config.restitution).toBe(1.0);
      expect(config.friction).toBe(0.0);
      expect(config.airFriction).toBe(0.0);
      expect(config.initialTime).toBe(30);
      expect(config.timeBonus).toBe(5);
      expect(config.brakeConstant).toBe(0.001);
      expect(config.magnetizeRadius).toBe(150);
      expect(config.magnetizeStrength).toBe(0.0001);
      expect(config.gravityBombDuration).toBe(3);
      expect(config.gravityBombStrength).toBe(0.0002);
    });

    it('should return a copy of the configuration', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration with partial values', () => {
      service.setConfig({ numObstacles: 10, initialTime: 60 });
      const config = service.getConfig();
      
      expect(config.numObstacles).toBe(10);
      expect(config.initialTime).toBe(60);
      expect(config.arenaWidth).toBe(800); // Other values unchanged
    });

    it('should reset to default values', () => {
      service.setConfig({ numObstacles: 10, initialTime: 60 });
      service.resetToDefaults();
      const config = service.getConfig();
      
      expect(config).toEqual(DEFAULT_GAME_CONFIG);
    });
  });

  describe('Configuration Validation', () => {
    it('should reject negative arena dimensions', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ arenaWidth: -100 });
      const config = service.getConfig();
      
      expect(config.arenaWidth).toBe(DEFAULT_GAME_CONFIG.arenaWidth);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject zero arena dimensions', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ arenaHeight: 0 });
      const config = service.getConfig();
      
      expect(config.arenaHeight).toBe(DEFAULT_GAME_CONFIG.arenaHeight);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject negative ball radii', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ playerRadius: -5 });
      const config = service.getConfig();
      
      expect(config.playerRadius).toBe(DEFAULT_GAME_CONFIG.playerRadius);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject negative timer values', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ initialTime: -10 });
      const config = service.getConfig();
      
      expect(config.initialTime).toBe(DEFAULT_GAME_CONFIG.initialTime);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject negative skill parameters', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ brakeConstant: -0.5 });
      const config = service.getConfig();
      
      expect(config.brakeConstant).toBe(DEFAULT_GAME_CONFIG.brakeConstant);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject infinite values', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ arenaWidth: Infinity });
      const config = service.getConfig();
      
      expect(config.arenaWidth).toBe(DEFAULT_GAME_CONFIG.arenaWidth);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject NaN values', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({ arenaHeight: NaN });
      const config = service.getConfig();
      
      expect(config.arenaHeight).toBe(DEFAULT_GAME_CONFIG.arenaHeight);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should allow zero obstacles', () => {
      service.setConfig({ numObstacles: 0 });
      const config = service.getConfig();
      
      expect(config.numObstacles).toBe(0);
    });

    it('should floor non-integer obstacle counts', () => {
      service.setConfig({ numObstacles: 7.8 });
      const config = service.getConfig();
      
      expect(config.numObstacles).toBe(7);
    });

    it('should allow zero friction and restitution', () => {
      service.setConfig({ friction: 0, restitution: 0 });
      const config = service.getConfig();
      
      expect(config.friction).toBe(0);
      expect(config.restitution).toBe(0);
    });
  });

  describe('Injectable Configuration', () => {
    it('should accept custom configuration at module level', () => {
      const customConfig: Partial<GameConfig> = {
        numObstacles: 8,
        initialTime: 45,
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: GAME_CONFIG, useValue: customConfig },
        ],
      });

      const customService = TestBed.inject(GameConfigService);
      const config = customService.getConfig();

      expect(config.numObstacles).toBe(8);
      expect(config.initialTime).toBe(45);
      expect(config.arenaWidth).toBe(DEFAULT_GAME_CONFIG.arenaWidth);
    });

    it('should work without custom configuration', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});

      const defaultService = TestBed.inject(GameConfigService);
      const config = defaultService.getConfig();

      expect(config).toEqual(DEFAULT_GAME_CONFIG);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing configuration properties', () => {
      const partialConfig = { numObstacles: 3 } as Partial<GameConfig>;
      service.setConfig(partialConfig);
      const config = service.getConfig();
      
      expect(config.numObstacles).toBe(3);
      expect(config.arenaWidth).toBe(DEFAULT_GAME_CONFIG.arenaWidth);
      expect(config.initialTime).toBe(DEFAULT_GAME_CONFIG.initialTime);
    });

    it('should handle empty configuration object', () => {
      service.setConfig({});
      const config = service.getConfig();
      
      expect(config).toEqual(DEFAULT_GAME_CONFIG);
    });

    it('should validate all properties when setting config', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setConfig({
        arenaWidth: -100,
        playerRadius: 0,
        initialTime: -5,
      });
      
      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });
  });
});

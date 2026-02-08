import { InputController, ActionType, InputAction } from './input-controller.service';
import * as fc from 'fast-check';

describe('InputController', () => {
  let service: InputController;

  beforeEach(() => {
    service = new InputController();
  });

  describe('Property-Based Tests', () => {
    // Feature: gravity-rl-game, Property 10: Input Translation Correctness
    it('should translate keyboard inputs to correct action IDs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Q', 'W', 'q', 'w'),
          (key) => {
            // Create a mock keyboard event
            const event = new KeyboardEvent('keydown', { key });
            
            // Track emitted actions
            let emittedAction: InputAction | null = null;
            const subscription = service.action$.subscribe(action => {
              emittedAction = action;
            });

            // Handle the keyboard event
            service.handleKeyboardEvent(event);

            // Verify correct action ID mapping
            const upperKey = key.toUpperCase();
            if (upperKey === 'Q') {
              expect(emittedAction).not.toBeNull();
              expect(emittedAction?.type).toBe(ActionType.BRAKE);
              expect(emittedAction?.type).toBe(1);
            } else if (upperKey === 'W') {
              expect(emittedAction).not.toBeNull();
              expect(emittedAction?.type).toBe(ActionType.MAGNETIZE);
              expect(emittedAction?.type).toBe(2);
            }

            subscription.unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    describe('Keyboard Input Handling', () => {
      it('should map Q key to BRAKE action (actionID 1)', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        const event = new KeyboardEvent('keydown', { key: 'Q' });
        service.handleKeyboardEvent(event);

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.BRAKE);
        expect(emittedAction?.type).toBe(1);
        expect(emittedAction?.position).toBeUndefined();

        subscription.unsubscribe();
      });

      it('should map W key to MAGNETIZE action (actionID 2)', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        const event = new KeyboardEvent('keydown', { key: 'W' });
        service.handleKeyboardEvent(event);

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.MAGNETIZE);
        expect(emittedAction?.type).toBe(2);
        expect(emittedAction?.position).toBeUndefined();

        subscription.unsubscribe();
      });

      it('should handle lowercase keys (q, w)', () => {
        let emittedActions: InputAction[] = [];
        const subscription = service.action$.subscribe(action => {
          emittedActions.push(action);
        });

        service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'q' }));
        service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'w' }));

        expect(emittedActions.length).toBe(2);
        expect(emittedActions[0].type).toBe(ActionType.BRAKE);
        expect(emittedActions[1].type).toBe(ActionType.MAGNETIZE);

        subscription.unsubscribe();
      });

      it('should ignore invalid key presses', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        const invalidKeys = ['A', 'B', 'C', 'X', 'Y', 'Z', '1', '2', 'Enter', 'Space'];
        invalidKeys.forEach(key => {
          service.handleKeyboardEvent(new KeyboardEvent('keydown', { key }));
        });

        expect(emittedAction).toBeNull();

        subscription.unsubscribe();
      });

      it('should handle rapid repeated key presses', () => {
        let emittedActions: InputAction[] = [];
        const subscription = service.action$.subscribe(action => {
          emittedActions.push(action);
        });

        // Simulate rapid Q key presses
        for (let i = 0; i < 10; i++) {
          service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'Q' }));
        }

        expect(emittedActions.length).toBe(10);
        emittedActions.forEach(action => {
          expect(action.type).toBe(ActionType.BRAKE);
        });

        subscription.unsubscribe();
      });

      it('should handle simultaneous key presses', () => {
        let emittedActions: InputAction[] = [];
        const subscription = service.action$.subscribe(action => {
          emittedActions.push(action);
        });

        // Simulate pressing Q and W in quick succession
        service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'Q' }));
        service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'W' }));
        service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'Q' }));

        expect(emittedActions.length).toBe(3);
        expect(emittedActions[0].type).toBe(ActionType.BRAKE);
        expect(emittedActions[1].type).toBe(ActionType.MAGNETIZE);
        expect(emittedActions[2].type).toBe(ActionType.BRAKE);

        subscription.unsubscribe();
      });
    });

    describe('Mouse Input Handling', () => {
      it('should map mouse click to GRAVITY_BOMB action (actionID 3)', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        // Create a mock canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        // Mock getBoundingClientRect
        const rect = { left: 10, top: 20, width: 800, height: 600 };
        canvas.getBoundingClientRect = () => rect as DOMRect;

        // Simulate mouse click at (100, 150) in client coordinates
        const event = new MouseEvent('click', { clientX: 110, clientY: 170 });
        service.handleMouseEvent(event, canvas);

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.GRAVITY_BOMB);
        expect(emittedAction?.type).toBe(3);
        expect(emittedAction?.position).toEqual({ x: 100, y: 150 });

        document.body.removeChild(canvas);
        subscription.unsubscribe();
      });

      it('should convert canvas click coordinates to world coordinates', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        const canvas = document.createElement('canvas');
        const rect = { left: 50, top: 100, width: 800, height: 600 };
        canvas.getBoundingClientRect = () => rect as DOMRect;

        // Click at (250, 350) in client coordinates
        // Should be (200, 250) in canvas coordinates
        const event = new MouseEvent('click', { clientX: 250, clientY: 350 });
        service.handleMouseEvent(event, canvas);

        expect(emittedAction?.position).toEqual({ x: 200, y: 250 });

        subscription.unsubscribe();
      });
    });

    describe('Input Mode Switching', () => {
      it('should start with keyboard input mode by default', () => {
        expect(service.getInputMode()).toBe('keyboard');
      });

      it('should switch to AI input mode', () => {
        service.setInputMode('ai');
        expect(service.getInputMode()).toBe('ai');
      });

      it('should switch back to keyboard input mode', () => {
        service.setInputMode('ai');
        service.setInputMode('keyboard');
        expect(service.getInputMode()).toBe('keyboard');
      });

      it('should allow multiple mode switches', () => {
        service.setInputMode('ai');
        expect(service.getInputMode()).toBe('ai');
        
        service.setInputMode('keyboard');
        expect(service.getInputMode()).toBe('keyboard');
        
        service.setInputMode('ai');
        expect(service.getInputMode()).toBe('ai');
      });
    });

    describe('AI Action Trigger Interface', () => {
      it('should trigger BRAKE action programmatically', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        service.triggerAction({ type: ActionType.BRAKE });

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.BRAKE);

        subscription.unsubscribe();
      });

      it('should trigger MAGNETIZE action programmatically', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        service.triggerAction({ type: ActionType.MAGNETIZE });

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.MAGNETIZE);

        subscription.unsubscribe();
      });

      it('should trigger GRAVITY_BOMB action with position', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        const position = { x: 300, y: 400 };
        service.triggerAction({ type: ActionType.GRAVITY_BOMB, position });

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.GRAVITY_BOMB);
        expect(emittedAction?.position).toEqual(position);

        subscription.unsubscribe();
      });

      it('should trigger NONE action', () => {
        let emittedAction: InputAction | null = null;
        const subscription = service.action$.subscribe(action => {
          emittedAction = action;
        });

        service.triggerAction({ type: ActionType.NONE });

        expect(emittedAction).not.toBeNull();
        expect(emittedAction?.type).toBe(ActionType.NONE);
        expect(emittedAction?.type).toBe(0);

        subscription.unsubscribe();
      });
    });
  });
});

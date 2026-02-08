import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * ActionType enum defines the discrete action space for the game.
 * These action IDs are used by both keyboard input and AI agents.
 */
export enum ActionType {
  NONE = 0,
  BRAKE = 1,
  MAGNETIZE = 2,
  GRAVITY_BOMB = 3
}

/**
 * InputAction represents a single action with optional position data.
 * Position is required for GRAVITY_BOMB actions (click location).
 */
export interface InputAction {
  type: ActionType;
  position?: { x: number; y: number };
}

/**
 * InputController abstracts input sources (keyboard vs AI) and provides
 * a unified interface for action execution. This allows seamless switching
 * between human control and AI control without changing game logic.
 */
@Injectable({
  providedIn: 'root'
})
export class InputController {
  private actionSubject = new Subject<InputAction>();
  public action$: Observable<InputAction> = this.actionSubject.asObservable();
  
  private inputMode: 'keyboard' | 'ai' = 'keyboard';
  
  // Track which keys are currently held down
  private keysHeld = new Set<string>();

  /**
   * Sets the input mode for the controller.
   * @param mode - Either 'keyboard' for human control or 'ai' for AI control
   */
  setInputMode(mode: 'keyboard' | 'ai'): void {
    this.inputMode = mode;
  }

  /**
   * Gets the current input mode.
   * @returns The current input mode ('keyboard' or 'ai')
   */
  getInputMode(): 'keyboard' | 'ai' {
    return this.inputMode;
  }
  
  /**
   * Check if a specific key is currently held down
   * @param key - The key to check (e.g., 'Q', 'W')
   * @returns true if the key is held, false otherwise
   */
  isKeyHeld(key: string): boolean {
    return this.keysHeld.has(key.toUpperCase());
  }

  /**
   * Handles keyboard events and translates them to actions.
   * Q key -> BRAKE (actionID 1)
   * W key -> MAGNETIZE (actionID 2)
   * Invalid keys are ignored.
   * 
   * @param event - The keyboard event to process
   */
  handleKeyboardEvent(event: KeyboardEvent): void {
    const key = event.key.toUpperCase();
    
    // Track key state
    if (event.type === 'keydown') {
      this.keysHeld.add(key);
    } else if (event.type === 'keyup') {
      this.keysHeld.delete(key);
    }
    
    let action: InputAction | null = null;
    
    switch (key) {
      case 'Q':
        action = { type: ActionType.BRAKE };
        break;
      case 'W':
        action = { type: ActionType.MAGNETIZE };
        break;
      default:
        // Ignore invalid key presses
        return;
    }
    
    if (action) {
      this.actionSubject.next(action);
    }
  }

  /**
   * Handles mouse click events and translates them to GRAVITY_BOMB actions.
   * Converts canvas click coordinates to world coordinates.
   * Accounts for canvas margins (60px sides, 40px top).
   * 
   * @param event - The mouse event to process
   * @param canvas - The canvas element to get coordinates relative to
   */
  handleMouseEvent(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Account for canvas margins (arena is offset by 60px left, 40px top)
    const canvasMargin = 60;
    const topMargin = 40;
    const arenaX = canvasX - canvasMargin;
    const arenaY = canvasY - topMargin;
    
    const action: InputAction = {
      type: ActionType.GRAVITY_BOMB,
      position: { x: arenaX, y: arenaY }
    };
    
    this.actionSubject.next(action);
  }

  /**
   * Triggers an action programmatically. This method is used by AI agents
   * to execute actions without keyboard/mouse input.
   * 
   * @param action - The action to trigger
   */
  triggerAction(action: InputAction): void {
    this.actionSubject.next(action);
  }
}

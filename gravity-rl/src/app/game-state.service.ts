import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as Matter from 'matter-js';

export interface BallState {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export interface GameState {
  balls: BallState[];
  timer: number;
  score: number;
  activeSkills: string[];
  isGameOver: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  private initialState: GameState = {
    balls: [],
    timer: 0,
    score: 0,
    activeSkills: [],
    isGameOver: false,
  };

  private stateSubject: BehaviorSubject<GameState>;
  public state$: Observable<GameState>;

  constructor() {
    this.stateSubject = new BehaviorSubject<GameState>(this.initialState);
    this.state$ = this.stateSubject.asObservable();
  }

  /**
   * Update state from physics bodies
   * Synchronizes the game state with the current physics simulation
   * @param bodies Array of Matter.js bodies to sync from
   */
  updateFromPhysics(bodies: Matter.Body[]): void {
    const currentState = this.stateSubject.value;
    
    const balls: BallState[] = bodies.map((body) => ({
      id: body.id.toString(),
      label: body.label,
      x: body.position.x,
      y: body.position.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      radius: body.circleRadius || 0,
      color: body.render.fillStyle || '#000000',
    }));

    this.stateSubject.next({
      ...currentState,
      balls,
    });
  }

  /**
   * Get observation array for AI consumption
   * Returns a flat numerical array with consistent ordering: player, target, then obstacles
   * Format: [x, y, vx, vy] for each ball
   * @returns Flat array of numbers representing the game state
   */
  getObservationArray(): number[] {
    const currentState = this.stateSubject.value;
    const obs: number[] = [];

    // Find player, target, and obstacles
    const player = currentState.balls.find((b) => b.label === 'player');
    const target = currentState.balls.find((b) => b.label === 'target');
    const obstacles = currentState.balls.filter((b) => b.label === 'obstacle');

    // Add player data (or zeros if not found)
    if (player) {
      obs.push(player.x, player.y, player.vx, player.vy);
    }

    // Add target data (or zeros if not found)
    if (target) {
      obs.push(target.x, target.y, target.vx, target.vy);
    }

    // Add obstacle data
    obstacles.forEach((obstacle) => {
      obs.push(obstacle.x, obstacle.y, obstacle.vx, obstacle.vy);
    });

    return obs;
  }

  /**
   * Update the timer by a delta value
   * @param delta Time change in seconds (can be negative for countdown)
   */
  updateTimer(delta: number): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      timer: Math.max(0, currentState.timer + delta),
    });
  }

  /**
   * Add points to the score
   * @param points Points to add to the current score
   */
  addScore(points: number): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      score: currentState.score + points,
    });
  }

  /**
   * Set the active state of a skill
   * @param skill Name of the skill
   * @param active Whether the skill is active
   */
  setActiveSkill(skill: string, active: boolean): void {
    const currentState = this.stateSubject.value;
    let activeSkills = [...currentState.activeSkills];

    if (active && !activeSkills.includes(skill)) {
      activeSkills.push(skill);
    } else if (!active) {
      activeSkills = activeSkills.filter((s) => s !== skill);
    }

    this.stateSubject.next({
      ...currentState,
      activeSkills,
    });
  }

  /**
   * Reset the game state to initial values
   */
  reset(): void {
    this.stateSubject.next({
      balls: [],
      timer: 0,
      score: 0,
      activeSkills: [],
      isGameOver: false,
    });
  }
}

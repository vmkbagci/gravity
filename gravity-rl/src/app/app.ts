import { Component } from '@angular/core';
import { GameArenaComponent } from './game-arena/game-arena';

@Component({
  selector: 'app-root',
  imports: [GameArenaComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}

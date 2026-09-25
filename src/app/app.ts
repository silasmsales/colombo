import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { AudioFeedbackService } from './services/audio.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  audio = inject(AudioFeedbackService);

  playClick() {
    this.audio.playClick();
  }
}

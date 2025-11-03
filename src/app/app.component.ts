import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FloorPlanComponent } from './components/floor-plan/floor-plan.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FloorPlanComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'my-floor-plan';
}
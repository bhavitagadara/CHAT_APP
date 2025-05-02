import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  loggedInUser: any = null;

  ngOnInit() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedUser = localStorage.getItem("user");
      this.loggedInUser = storedUser ? JSON.parse(storedUser) : null;
    }
  }
}

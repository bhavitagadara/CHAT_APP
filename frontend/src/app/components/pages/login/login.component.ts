import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { debounceTime, Subject } from 'rxjs';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent  implements OnInit {
  firstName: string = "";
  lastName: string = "";
  email: string = "";
  users: any[] = []; // Store all users
  private socket!: Socket;

private loginSubject = new Subject<any>();

constructor(private http: HttpClient, private router: Router ,@Inject(PLATFORM_ID) private platformId: Object) {
  this.loginSubject.pipe(debounceTime(500)).subscribe(credentials => {
    this.http.post('http://localhost:3002/login', credentials)
      .subscribe(res => {
        console.log("Logged in");
      });
  });
}

login() {
  if (!this.email.trim()) {
    console.error("Email is required!");
    return;
  }

  this.http.post('http://localhost:3002/login', { email: this.email }).subscribe(
    (res: any) => {
      console.log("Login successful", res);

      // 🔥 Ensure socket connects AFTER login
      this.socket = io('http://localhost:3002', { query: { email: this.email } });

      // 🔥 Store the user in localStorage for persistence
      localStorage.setItem("user", JSON.stringify(res.user));

      this.router.navigate(["/chat"]);
    },
    (error) => {
      console.error("Login failed", error);
      alert(error.error.message);  // Show error to user
    }
  );
}

  ngOnInit() {
    this.fetchUsers(); //  If fetchUsers() calls itself, it causes an infinite loop
  }

  
  private usersLoaded = false; // Prevent multiple calls

// fetchUsers() {
//   if (this.usersLoaded) return; //  Stop infinite calls
//   this.http.get('http://localhost:3002/users').subscribe((res: any) => {
//     this.users = res.users;
//     this.usersLoaded = true;
//   });
// }


fetchUsers() {
  if (this.usersLoaded) return;

  if (isPlatformBrowser(this.platformId)) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.email) {
      console.error("❌ No email found in localStorage");
      return;
    }

    this.http.get(`http://localhost:3002/users?email=${user.email}`).subscribe(
      (res: any) => {
        this.users = res.users;
        this.usersLoaded = true;
      },
      (error) => {
        console.error("❌ Failed to fetch users", error);
      }
    );
  } else {
    console.warn("🚨 Running in SSR mode, skipping localStorage access.");
  }
}
}

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket!: Socket;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      this.connect(); 
    }
  }

  private connect() {
    this.socket = io('http://localhost:3002');
  }

  sendMessage(message: string) {
    if (this.socket) {
      this.socket.emit('user-message', message);
    }
  }

  receiveMessages(): Observable<string> {
    return new Observable((observer) => {
      if (!this.socket) return; 
      this.socket.on('message', (message) => {
        observer.next(message);
      });
    });
  }
  
  
  getSocketId(): string {
    return this.socket?.id ?? ''; // Ensures it always returns a string
  }
  
}

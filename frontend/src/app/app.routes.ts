import { Routes } from '@angular/router';
import { ChatComponent } from './components/pages/chat/chat.component';
import { LoginComponent } from './components/pages/login/login.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' }, 
    { path: 'chat', component: ChatComponent },
    { path: 'login', component: LoginComponent },
];

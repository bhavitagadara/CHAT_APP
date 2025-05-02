import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef, HostListener, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { io } from 'socket.io-client';
import { FormsModule } from '@angular/forms';
import { ProfileComponent } from "../profile/profile.component";
import { ToastrService } from 'ngx-toastr';
import { EmojiEvent } from '@ctrl/ngx-emoji-mart/ngx-emoji';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { error } from 'console';

interface GroupMessage {
  sender: string;
  message: string;
  groupId: string;
  createdAt?: string; // Optional, if you're returning timestamps
  fileUrl?: string;   // Optional, in case you're sending files in group chat
}

interface FileMessage {
  sender: string;
  message: string;
  fileUrl: string;
  receiver?: string;
  groupId?: string;
}

interface VideoOfferPayload {
  offer: RTCSessionDescriptionInit;
  caller: string;
}

interface VideoAnswerPayload {
  answer: RTCSessionDescriptionInit;
}

interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
}

interface IncomingCallPayload {
  caller: string;
}
interface UserStatusEvent {
  email: string;
  lastSeen?: string;
}

interface TypingEvent {
  sender: string;
}
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, CommonModule, ProfileComponent, PickerModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit {
  socket: any;
  messages: { sender: string; message: string; _id?: string; fileUrl?: string; replyTo?: any; showOptions?: boolean }[] = [];
  message: string = "";
  users: any[] = [];
  selectedUser: any = null;
  loggedInUser: any = null;
  userMap: { [email: string]: string } = {}; // Map email to names
  selectedFile: File | null = null;
  fileUrl: string | null = null;
  replyingTo: any = null;
  shoeEmojiPicker = false;
  selectedMessageId: string = "";
  contacts: any[] = []; // List of users to forward messages to
  selectedContacts: any[] = []; // Users selected for forwarding
  selectedMessageToForward: any = null;
  showForwardModal: boolean = false;
  selectedMessages: string[] = [];
  isMultiSelectMode: boolean = false;
  selectedUserIds: string[] = [];

  groups: any[] = [];  // Stores all groups
  selectedGroup: any = null;  // Stores the currently selected group
  selectedMembers: any[] = [];  // Stores selected users for the new group
  showCreateGroupModal = false;
  groupName: string = ""; // the name of the group
  selectedUsers: any[] = []; // array of selected user IDs for the group
  currentUser: any = null;
  showGroupOptions: boolean = false;
  showGroupOptionsFor: string | null = null;
  loggedInUserEmail: string = ''; // Set this after login
  selectedGroupForRemoval: any = null;
  removableUsers: any[] = [];
  filteredUsersToAdd: any[] = [];
  allUsers: any[] = []; // Load from backend
  showAddUserModal: boolean = false;
  showViewMembersModal: boolean = false;
  showRemoveUserDropdown: boolean = false;
  localStream: MediaStream | undefined;
  remoteStream: MediaStream | undefined;
  peerConnection: RTCPeerConnection | undefined;
  callInProgress = false;
  selectedCallee: String | null = null;
  user: string = '';
  incomingCall: boolean = false;
  callerId: string = '';
  callerName: string = '';
  mediaError: boolean = false;
  mediaErrorMessage: string = '';
  typingUserName: string = '';
  isTyping: boolean = false;
  isTypingMap: { [email: string]: boolean } = {};
  //typingTimeout: any = null;
  //userStatusMap: { [email: string]: { status: string; lastSeen: string | null } } = {};
  typingUsers: { [email: string]: boolean } = {};
  typingTimeouts: { [email: string]: any } = {};
  userTypingStatus: string = '';
  userStatusMap: { [email: string]: { status: string, lastSeen?: string } } = {};
  typing: boolean = false;
  typingTimeout: any;

  constructor(private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private toaster: ToastrService,
  ) { }

  @ViewChild('chatContainer') chatContainer!: ElementRef

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        this.loggedInUser = JSON.parse(storedUser);
        console.log("Logged-in User:", this.loggedInUser);
      } else {
        console.error("No user found in local storage.");
      }

      if (this.loggedInUser && this.loggedInUser.email) {
        this.socket = io("http://localhost:3002", { query: { email: this.loggedInUser.email } });

        this.socket.on("connect", () => {
          console.log("Connected to Socket:", this.socket.id);
        });

        this.socket.on("activeUsers", (users: any[]) => {
          this.users = users;
          users.forEach(user => this.userMap[user.email] = `${user.firstName} ${user.lastName}`);
        });

        // this.socket.on("userStatusUpdate", (data: { email: string, status: string, lastSeen?: string }) => {
        //   if (!this.userStatusMap[data.email]) {
        //     this.userStatusMap[data.email] = { status: '', lastSeen: '' };
        //   }
        //   this.userStatusMap[data.email].status = data.status;
        //   console.log("this.userStatusMap[data.email].status:",this.userStatusMap[data.email].status)
        //   if (data.lastSeen) {
        //     this.userStatusMap[data.email].lastSeen = data.lastSeen;
        //   }
        // });



        //add a listene to remove the message
        this.socket.on("deleteMessage", (data: { messageId: string; sender: string; }) => {
          console.log("Message deleted :", data.messageId);
          this.messages = this.messages.filter(msg => msg._id !== data.messageId)

        })

        this.socket.on("groupMessagesDeleted", (data: { messageIds: string[] }) => {
          this.messages = this.messages.filter(m => !data.messageIds.includes(m._id ?? ""));
        });

        this.socket.on("messagesDeleted", (data: { messageIds: string[] }) => {
          this.messages = this.messages.filter(msg => !data.messageIds.includes(msg._id ?? ""));
        });

        this.socket.on("groupMessage", (data: GroupMessage) => {
          if (data.groupId === this.selectedGroup?._id) {
            this.messages.push(data);
          }
        });
        this.socket.on("receiveGroupMessage", (msg: any) => {
          if (this.selectedGroup && msg.groupId === this.selectedGroup._id) {
            this.messages.push(msg);
            this.scrollToBottom();
          } else {
            const username = this.getSenderName(msg.sender);
            console.log("username:", username);
            this.showToaster(`New Message from ${username}`, msg.message);
          }
        });

        this.socket.on("userRemovedFromGroup", (data: { success: boolean, userEmail: string, groupId: string, message?: string }) => {
          if (data.success) {
            console.log(`User ${data.userEmail} removed from group ${data.groupId}`);
            // Optionally update group member list in UI
          } else {
            alert(data.message || "Failed to remove user");
          }
        });

        // Listen to groupDeleted event
        this.socket.on("groupDeleted", (res: any) => {
          if (res.success) {
            this.toaster.success(res.message);
            this.fetchGroups(); // refresh sidebar groups
            if (this.selectedGroup && this.selectedGroup._id === res.groupId) {
              this.selectedGroup = null; // clear chat view
            }
          } else {
            this.toaster.error(res.message || "Failed to delete group.");
          }
        });

        // Fix: Check if `selectedGroup` exists before using `_id`
        if (this.selectedGroup && this.selectedGroup._id) {
          this.socket.on(`groupMessage-${this.selectedGroup._id}`, (data: any) => {
            console.log("New group message:", data);
          });
        }

        this.socket.on("privateMessage", (data: { sender: string; message: string; fileUrl?: string; replyTo?: any }) => {
          console.log("Received message:", data);

          if (data.sender === this.selectedUser?.email) {
            this.messages.push(data);
          } else {
            const username = this.getSenderName(data.sender);
            console.log("username:", username);
            this.showToaster(`New Message from ${username}`, data.message);

            // If the message contains a file, show the notification properly
            if (data.fileUrl) {
              console.log("File received:", data.fileUrl);
            }
          }
        });


        this.handleIncomingCall();

        this.socket.on('videoOffer', async ({ offer, caller }: VideoOfferPayload) => {
          if (!this.peerConnection) {
            this.setupPeerConnection(caller);
          }

          // Guard again after setup (just in case)
          if (!this.peerConnection) {
            console.error('PeerConnection still undefined after setup');
            return;
          }

          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          this.socket.emit('videoAnswer', {
            target: caller,
            answer
          });
        });


        this.socket.on('videoAnswer', async ({ answer }: VideoAnswerPayload) => {
          if (!this.peerConnection) return;
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        });


        this.socket.on('iceCandidate', async ({ candidate }: IceCandidatePayload) => {
          if (this.peerConnection && candidate) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });

        this.socket.on('incomingCall', ({ caller }: { caller: string }) => {
          console.log('[incomingCall] received from:', caller);
          this.incomingCall = true;
          this.callerId = caller;
          this.callerName = this.userMap[caller] || 'Unknown';
        });

        this.socket.on('callEnded', () => this.endCall());

        this.fetchUsers();
        this.fetchGroups();

        // this.socket.on("userTyping", (data: { from: string }) => {
        //   if (data.from === this.selectedUser?.email) {
        //     this.userTypingStatus = "Typing...";
        //   }
        // });

        // this.socket.on("userStopTyping", (data: { from: string }) => {
        //   if (data.from === this.selectedUser?.email) {
        //     this.userTypingStatus = "";
        //   }
        // });



      }
    }
  }

  // onTyping() {
  //   if (!this.selectedUser || !this.socket) return;

  //   if (!this.typing) {
  //     this.typing = true;
  //     this.socket.emit("userTyping", {
  //       from: this.loggedInUser.email,
  //       to: this.selectedUser.email
  //     });
  //   }

  //   clearTimeout(this.typingTimeout);
  //   this.typingTimeout = setTimeout(() => {
  //     this.typing = false;
  //     this.socket.emit("userStopTyping", {
  //       from: this.loggedInUser.email,
  //       to: this.selectedUser.email
  //     });
  //   }, 1000);
  // }

  openForwardModalMulti() {
    if (this.selectedMessages.length === 0) {
      console.warn("No messages selected for forwarding.");
      return;
    }

    // Fetch contacts before opening the modal
    this.http.get<any>(`http://localhost:3002/users?email=${this.loggedInUser.email}`).subscribe({
      next: (res) => {
        this.contacts = res.users;
        this.selectedContacts = this.contacts.map(contact => ({
          ...contact,
          selected: false
        }));

        // Show the modal after fetching users
        this.showForwardModal = true;
      },
      error: (error) => {
        console.error("Error fetching contacts:", error);
      }
    });
  }

  toggleMultiSelect() {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    this.selectedMessages = [];
  }

  toggleMessageSelection(messageId: string | undefined) {
    if (!messageId) return;
    const index = this.selectedMessages.indexOf(messageId);
    if (index === -1) {
      this.selectedMessages.push(messageId);
    } else {
      this.selectedMessages.splice(index, 1);
    }
  }

  forwardMessages() {
    if (this.selectedMessages.length === 0 || this.selectedContacts.length === 0) {
      console.error("No messages or recipients selected.");
      return;
    }

    const forwardData = {
      sender: this.loggedInUser.email,
      messageIds: this.selectedMessages, // Send multiple messages
      recipients: this.selectedContacts.map(user => user.email)
    };

    this.socket.emit("forwardMessages", forwardData);

    // Reset selection
    this.isMultiSelectMode = false;
    this.selectedMessages = [];
    this.selectedContacts = [];
    this.showForwardModal = false;
  }

  openEmojiPicker() {
    this.shoeEmojiPicker = !this.shoeEmojiPicker;
  }

  addEmoji(event: EmojiEvent) {
    this.message += event.emoji.native;
  }

  closeForwardModal() {
    this.showForwardModal = false;
    this.selectedMessageToForward = null;
  }

  toggleOptions(msg: any) {
    this.messages.forEach(m => {
      if (m !== msg) {
        m.showOptions = false;
      }
    });
    msg.showOptions = !msg.showOptions;
  }

  deleteMessages() {
    if (this.selectedMessages.length === 0) {
      console.error("No messages selected for deletion.");
      return;
    }

    if (this.selectedGroup) {
      this.socket.emit("deleteGroupMessages", {
        messageIds: this.selectedMessages,
        sender: this.loggedInUser.email
      });
    } else {
      this.socket.emit("deleteMessages", {
        messageIds: this.selectedMessages,
        sender: this.loggedInUser.email
      });
    }

    this.isMultiSelectMode = false;
    this.selectedMessages = [];
  }


  openForwardModal(msg: any) {
    this.selectedMessageToForward = msg; // Store the full message object
    this.showForwardModal = true;

    // Fetch contacts who can receive forwarded messages
    this.http.get<any>(`http://localhost:3002/users?email=${this.loggedInUser.email}`).subscribe({
      next: (res) => {
        this.contacts = res.users;
      },
      error: (error) => {
        console.error("Error fetching contacts:", error);
      }
    });
  }

  // Forward message
  forwardMessage() {
    const selectedUsers = this.contacts.filter(contact => contact.selected);
    if (selectedUsers.length === 0) return;

    const forwardData = {
      sender: this.loggedInUser.email,
      messageId: this.selectedMessageId,
      recipients: selectedUsers.map(user => user.email)
    };

    this.socket.emit("forwardMessage", forwardData);
    this.showForwardModal = false;
  }

  replyMessage(msg: any) {
    this.replyingTo = msg; // Store the full object, not just the ID
  }

  deleteMessage(messageId: string) {
    // Emit delete message event with messageId and sender email
    this.socket.emit("deleteMessage", { messageId, sender: this.loggedInUser.email });
  }

  onFileSelected(event: any) {
    if (event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
    }
  }

  uploadFile(event: any) {
    const file = event.target.files[0];

    if (!file) {
      console.error("No file selected.");
      return;
    }

    if (!this.selectedUser && !this.selectedGroup) {
      console.error("No recipient selected.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sender", this.loggedInUser.email);

    if (this.selectedUser) {
      formData.append("receiver", this.selectedUser.email);
    } else if (this.selectedGroup) {
      formData.append("groupId", this.selectedGroup._id);
    }

    this.http.post<{ fileUrl: string }>("http://localhost:3002/upload", formData).subscribe({
      next: (res) => {
        console.log("File uploaded:", res.fileUrl);

        const fileMessage: FileMessage = {
          sender: this.loggedInUser.email,
          message: "Sent a file",
          fileUrl: res.fileUrl
        };

        if (this.selectedUser) {
          fileMessage.receiver = this.selectedUser.email;
          this.socket.emit("sendMessage", fileMessage);
        } else if (this.selectedGroup) {
          fileMessage.groupId = this.selectedGroup._id;
          this.socket.emit("sendGroupMessage", fileMessage);
        }

        this.messages.push(fileMessage);
      },
      error: (error) => {
        console.log("Error uploading file:", error);
      }
    });

  }

  showToaster(title: string, message: string) {
    console.log("message and title : ", title, message)
    if (!title || !message) {
      console.error("Toastr Error: Title or message is missing.");
      return;
    }
    this.toaster.info(message, title, {
      timeOut: 3000,
      closeButton: true,
      progressBar: true
    })
    console.log("we got toaster message")
  }

  fetchUsers() {
    if (!this.loggedInUser || !this.loggedInUser.email) {
      console.error(" User email is missing");
      return;
    }

    const requestUrl = `http://localhost:3002/users?email=${encodeURIComponent(this.loggedInUser.email)}`;
    console.log("Sending GET request to:", requestUrl);

    this.http.get<any>(requestUrl).subscribe({
      next: (res) => {
        console.log(" Response received:", res);
        this.users = res.users;
        res.users.forEach((user: { email: string; firstName: string; lastName: string }) => {
          this.userMap[user.email] = `${user.firstName} ${user.lastName}`;
        });
      },
      error: (error) => {
        console.error("Error fetching users:", error);
      }
    });
  }

  getSenderName(email: string): string {
    return this.userMap[email] || email; // Default to email if name isn't found
  }

  selectUser(user: any) {
    this.selectedUser = user;
    this.messages = [];
    this.selectedGroup = null;

    this.http.get(`http://localhost:3002/chat-history?receiver=${user.email}&sender=${this.loggedInUser.email}`)
      .subscribe((res: any) => {
        this.messages = res.messages;
      });
  }

  getMessages() {
    if (!this.selectedUser) {
      console.error("No recipient selected for fetching messages.");
      return;
    }

    this.http.get(`http://localhost:3002/chat-history?receiver=${this.selectedUser.email}&sender=${this.loggedInUser.email}`)
      .subscribe(
        (res: any) => {
          console.log("Messages loaded:", res.messages);
          this.messages = res.messages; // Messages now include full replyTo objects
        },
        (error) => {
          console.error("Error fetching messages:", error);
        }
      );
  }

  confirmDelete(messageId: string) {
    if (confirm("Are you sure you want to delete this message?")) {
      this.deleteMessage(messageId);
    }
  }

  sendMessage() {
    if (!this.selectedUser || (!this.message.trim() && !this.selectedFile)) return;

    const chatMessage = {
      sender: this.loggedInUser.email,
      receiver: this.selectedUser.email,
      message: this.message,
      fileUrl: this.fileUrl ?? undefined,
      replyTo: this.replyingTo // Send full replyTo object instead of just an ID
    };

    this.socket.emit("sendMessage", chatMessage);
    this.messages.push(chatMessage);
    this.message = "";
    this.replyingTo = null;
    this.fileUrl = null;
    this.scrollToBottom();
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  // isImage(url: string): boolean {
  //   return /\.(jpg|jpeg|png|gif)$/i.test(url);
  // }
  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(url);
  }
  
  fetchGroups() {
    this.http.get<{ success: boolean, groups: any[] }>(`http://localhost:3002/groups/${this.loggedInUser.email}`)
      .subscribe({
        next: response => {
          if (response.success) {
            this.groups = response.groups;
            console.log("groups:", this.groups);
          } else {
            console.error("Failed to fetch groups:");
          }
        },
        error: err => {
          console.error("Error fetching groups:", err);
        }
      });

  }

  sendGroupMessage() {
    const msgData: any = {
      groupId: this.selectedGroup._id,
      sender: this.loggedInUser.email,
      message: this.message,
    };

    if (this.replyingTo) {
      msgData.replyTo = this.replyingTo; // can be full object or just ID
    }

    if (this.fileUrl) {
      msgData.fileUrl = this.fileUrl;
    }

    this.socket.emit("sendGroupMessage", msgData);
    this.messages.push(msgData);

    this.message = '';
    this.fileUrl = null;
    this.replyingTo = null;
  }

  selectGroup(group: any) {
    this.selectedGroup = group;
    this.messages = [];
    this.selectedUser = null;

    // Join the group room in Socket.IO
    this.socket.emit("joinGroup", group._id);

    // Fetch group chat history
    this.http.get<any[]>(`http://localhost:3002/group-messages?groupId=${group._id}`)
      .subscribe(
        response => {
          this.messages = response;
        },
        error => {
          console.error("Error fetching group messages:", error);
        }
      );
  }

  openCreateGroupModal() {
    // Fetch users before showing the modal
    this.http.get<{ users: any[] }>(`http://localhost:3002/users?email=${this.loggedInUser.email}`).subscribe({
      next: (res) => {
        this.selectedMembers = []; // Reset selected members
        this.contacts = res.users; // Store users in contacts
        this.showCreateGroupModal = true; // Show modal
      },
      error: (error) => {
        console.error("Error fetching users:", error);
      }
    });
  }

  // Close Create Group Modal
  closeCreateGroupModal() {
    this.showCreateGroupModal = false;
    this.groupName = "";
    this.selectedMembers = [];
  }

  toggleUserSelection(user: any): void {
    const index = this.selectedUsers.findIndex(u => u.email === user.email);
    if (index > -1) {
      this.selectedUsers.splice(index, 1); // Remove if already selected
    } else {
      this.selectedUsers.push(user); // Add if not already selected
    }
  }

  // Create Group
  createGroup(): void {
    if (!this.groupName) {
      console.error("Group name is required.");
      return;
    }

    // Initialize members array with the logged-in user's ID
    const members = [this.loggedInUser?._id];

    // Add selected users' IDs to the members array, avoiding duplicates
    this.selectedUsers.forEach(user => {
      if (user._id !== this.loggedInUser?._id && !members.includes(user._id)) {
        members.push(user._id);
      }
    });

    const groupData = {
      groupName: this.groupName,
      members: members,
      createdBy: this.loggedInUser?._id,
      admin: this.loggedInUser?._id,
    };

    this.http.post('http://localhost:3002/groups/create', groupData).subscribe({
      next: (res: any) => {
        console.log('Group created:', res);
        this.groups.push(res.group); // Update your group list
        this.closeCreateGroupModal();
      },
      error: (err) => {
        console.error('Error creating group:', err);
      }
    });
  }

  exitGroup(groupId: string): void {
    const userEmail = this.loggedInUser.email;
    this.socket.emit("exitGroup", { groupId, userEmail });

    this.socket.once("exitedGroup", (data: { success: boolean, groupId: string }) => {
      if (data.success && data.groupId === groupId) {
        this.groups = this.groups.filter(g => g._id !== groupId);
        this.selectedGroup = null;
      }
    });

    this.socket.once("userExitedGroup", (data: { groupId: string; userEmail: string }) => {
      console.log(`${data.userEmail} exited group ${data.groupId}`);
      // Optionally update the UI if the current user is not the one who exited
    });
  }

  // Optional: Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.position-relative')) {
      this.showGroupOptions = false;
    }
  }

  addUserToGroup(groupId: string): void {
    const userEmail = prompt('Enter the email of the user to add to the group:');
    if (!userEmail) return;

    this.http.post<any>('http://localhost:3002/groups/add-user', {
      groupId,
      userEmail
    }).subscribe({
      next: res => {
        if (res.success) {
          this.toaster.success('User added to group');
          this.viewGroupMembers(this.selectedGroup); // Refresh member list
        }
      },
      error: err => {
        console.error(err);
        this.toaster.error('Failed to add user to group');
      }
    });
  }

  toggleGroupOptions(groupId: string) {
    this.showGroupOptionsFor = this.showGroupOptionsFor === groupId ? null : groupId;
  }

  removeUserFromGroup(groupId: string, targetEmail: string) {
    this.http.post<any>('http://localhost:3002/groups/remove-user', {
      groupId,
      targetEmail
    }).subscribe({
      next: res => {
        if (res.success) {
          // If the removed user is currently selected, update UI
          if (this.selectedGroup && this.selectedGroup._id === groupId) {
            this.selectedGroup.members = this.selectedGroup.members.filter((m: any) => m.email !== targetEmail);
          }

          // Optionally refresh the group list
          this.fetchGroups();

          this.toaster.success('User removed from group');
        }
      },
      error: err => {
        console.error(err);
        this.toaster.error('Failed to remove user from group');
      }
    });
  }

  confirmAddUserToGroup(userEmail: string): void {
    this.http.post<any>('http://localhost:3002/groups/add-user', {
      groupId: this.selectedGroup._id,
      userEmail
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.toaster.success('User added to group');
          this.viewGroupMembers(this.selectedGroup); // Refresh
          this.showAddUserModal = false;
        }
      },
      error: (err) => {
        console.error('Add user failed', err);
        this.toaster.error('Failed to add user');
      }
    });
  }

  openAddUserModal(group: any) {
    this.selectedGroup = group;

    const memberEmails = group.members.map((m: any) => m.email);

    this.filteredUsersToAdd = this.users.filter((user: any) =>
      !memberEmails.includes(user.email)
    );

    this.showAddUserModal = true;
  }

  viewGroupMembers(group: any) {
    this.selectedGroup = group;
    this.showViewMembersModal = true;
  }

  openRemoveUserDialog(group: any) {
    this.selectedGroupForRemoval = group;
    // Admin should not remove themselves
    this.removableUsers = group.members.filter((member: any) => member.email !== group.adminEmail);
    this.showRemoveUserDropdown = true;
  }

  cancelUserRemoval() {
    this.selectedGroupForRemoval = null;
    this.removableUsers = [];
    this.showRemoveUserDropdown = false;
  }

  // Emit deleteGroup request
  deleteGroup(groupId: string) {
    this.socket.emit("deleteGroup", {
      groupId,
      requesterEmail: this.loggedInUser.email
    });
  }

  // Confirm dialog before deletion
  confirmDeleteGroup(group: any) {
    if (confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
      this.deleteGroup(group._id);
    }
  }

  //video call
  startCallHandler() {
    if (this.selectedUser) {
      this.startCall(this.selectedUser.email); // Use email to match server mapping
      this.initCall(this.selectedUser.email);  // Set up camera and connection
    }
  }

  startCall(calleeId: string) {
    this.selectedCallee = calleeId;
    this.socket.emit('startCall', {
      caller: this.loggedInUser.email,
      callee: calleeId
    });
  }

  //Listens for incoming calls from the server and prompts the user to accept/reject
  handleIncomingCall() {
    this.socket.on('incomingCall', ({ caller }: { caller: string }) => {
      this.incomingCall = true;
      this.callerId = caller;

      // Resolve name from userMap if available
      const name = this.userMap[caller] || "Unknown User";
      this.callerName = name;
    });

    // Optional: listen for rejection confirmation
    this.socket.on('callRejected', () => {
      this.callInProgress = false;
      this.toaster.warning('Call was rejected.');
    });
  }

  //This is called when the callee accepts the call
  async initCall(callerId: string) {
    this.callInProgress = true;

    try {
      const stream = await this.getMediaStream();
      if (!stream) {
        this.callInProgress = false;
        return;
      }

      this.localStream = stream;
      this.setupPeerConnection(callerId);

      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      this.socket.emit('videoOffer', {
        target: callerId,
        offer,
        caller: this.loggedInUser.email
      });

      this.attachVideoStream('localVideo', this.localStream);
    } catch (err) {
      console.error("initCall error:", err);
      this.callInProgress = false;
    }
  }

  async acceptCall(callerId: string) {
    this.incomingCall = false;
    this.callInProgress = true;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');

      if (!hasVideo && !hasAudio) {
        alert('No video/audio device found.');
        this.callInProgress = false;
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: hasVideo,
        audio: hasAudio,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      const localVideo = document.getElementById('localVideo') as HTMLVideoElement | null;
      if (localVideo && this.localStream) {
        localVideo.srcObject = this.localStream;
      }

      this.setupPeerConnection(callerId);

    } catch (err) {
      console.error('Media access error:', err);
      alert('Could not start video. Close other apps using the camera.');
      this.callInProgress = false;
    }
  }

  async getMediaStream(): Promise<MediaStream | null> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');

      if (!hasVideo && !hasAudio) {
        alert("No video or audio devices found.");
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: hasVideo,
        audio: hasAudio
      });

      return stream;
    } catch (err: any) {
      console.error("Media access error:", err.name, err.message);

      if (err.name === "NotReadableError") {
        alert("Camera is already in use by another application or browser tab. Please close them and try again.");
      } else if (err.name === "NotAllowedError") {
        alert("Permission to access camera/microphone was denied.");
      } else if (err.name === "NotFoundError") {
        alert("No camera or microphone found.");
      } else {
        alert("Media access error: " + err.message);
      }

      return null;
    }
  }

  attachVideoStream(elementId: string, stream: MediaStream) {
    const video = document.getElementById(elementId) as HTMLVideoElement | null;
    if (video) {
      video.srcObject = stream;
    } else {
      console.warn(`Video element #${elementId} not found`);
    }
  }

  rejectCall(callerId: string) {
    this.incomingCall = false;
    this.socket.emit("rejectCall", { caller: callerId });
  }


  //handles the WebRTC setup (ICE, offer/answer, track handling)
  setupPeerConnection(peerId: string) {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.peerConnection = new RTCPeerConnection(config);

    if (!this.localStream) {
      console.error('Local stream not ready.');
      return;
    }

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('iceCandidate', {
          target: peerId,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      this.remoteStream.addTrack(event.track);

      const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement | null;
      if (remoteVideo && this.remoteStream) {
        remoteVideo.srcObject = this.remoteStream;
      }
    };
  }

  endCall() {
    this.callInProgress = false;

    this.peerConnection?.close();
    this.peerConnection = undefined;

    this.localStream?.getTracks().forEach(track => track.stop());
    this.remoteStream?.getTracks().forEach(track => track.stop());

    this.localStream = undefined;
    this.remoteStream = undefined;

    const localVideo = document.getElementById('localVideo') as HTMLVideoElement | null;
    const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement | null;

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    if (this.selectedCallee) {
      this.socket.emit('endCall', { target: this.selectedCallee });
    }
  }

}

// Constants and Enums
const MESSAGE_ENUM = Object.freeze({
  SELF_CONNECTED: "SELF_CONNECTED",
  CLIENT_CONNECTED: "CLIENT_CONNECTED",
  CLIENT_DISCONNECTED: "CLIENT_DISCONNECTED",
  CLIENT_MESSAGE: "CLIENT_MESSAGE",
  GROUP_MESSAGE: "GROUP_MESSAGE",
  CREATE_GROUP: "CREATE_GROUP",
  JOIN_GROUP: "JOIN_GROUP",
  LEAVE_GROUP: "LEAVE_GROUP",
  GROUP_LIST: "GROUP_LIST",
  USER_LIST: "USER_LIST",
  IMAGE_MESSAGE: "IMAGE_MESSAGE",
  GROUP_IMAGE_MESSAGE: "GROUP_IMAGE_MESSAGE",
  TYPING_STARTED: "TYPING_STARTED",
  TYPING_STOPPED: "TYPING_STOPPED",
  GROUP_TYPING_STARTED: "GROUP_TYPING_STARTED",
  GROUP_TYPING_STOPPED: "GROUP_TYPING_STOPPED",
  REPLY_MESSAGE: 'reply_message',
  GROUP_REPLY_MESSAGE: 'group_reply_message',
  PRIVATE_MESSAGE: "PRIVATE_MESSAGE",
  PRIVATE_IMAGE_MESSAGE: "PRIVATE_IMAGE_MESSAGE",
  PRIVATE_TYPING_STARTED: "PRIVATE_TYPING_STARTED",
  PRIVATE_TYPING_STOPPED: "PRIVATE_TYPING_STOPPED",
  PRIVATE_REPLY_MESSAGE: "PRIVATE_REPLY_MESSAGE"
});

// State Management
const state = {
  currentUser: {
    id: null,
    name: null
  },
  currentChat: {
    type: 'global',
    id: null
  },
  messages: [],
  currentTypingUser: null,
  currentReply: null,
  typingTimeout: null,
  wsTimeout: null,
  availableGroups: []
};

// DOM References
const DOM = {
  username: null,
  userId: null,
  chatLog: null,
  chatInput: null,
  chatInputButton: null,
  usersList: null,
  groupsList: null,
  tabs: null,
  createGroupButton: null,
  chatTitle: null,
  imageUploadButton: null,
  imageUpload: null,
  imagePreview: null,
  previewImage: null,
  typingIndicator: null,
  typingUser: null,
  replyBar: null,
  replySender: null,
  replyContent: null,
  cancelReplyButton: null,
  createGroupModal: null,
  groupNameInput: null,
  createGroupConfirmButton: null,
  createGroupCancelButton: null,
  joinGroupModal: null,
  joinGroupList: null,
  joinGroupConfirmButton: null,
  joinGroupCancelButton: null
};

// WebSocket Management
let ws = null;

// Initialization
window.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  assignReferences();
  attachListeners();
  initializeWebSocket();
}

// WebSocket Functions
function initializeWebSocket() {
  ws = new WebSocket("ws://localhost:7777/ws");
  ws.onopen = handleWebSocketOpen;
  ws.onmessage = handleWebSocketMessage;
  ws.onerror = handleWebSocketError;
  ws.onclose = handleWebSocketClose;
}

function handleWebSocketOpen() {
  console.log('WebSocket connection established');
  requestUserList();
}

function handleWebSocketError(error) {
  console.error('WebSocket error:', error);
}

function handleWebSocketClose(event) {
  console.log('WebSocket connection closed:', event.code, event.reason);
}

function requestUserList() {
  sendWebSocketMessage({
    type: MESSAGE_ENUM.USER_LIST
  });
}

function sendWebSocketMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('Sending message:', message);
    ws.send(JSON.stringify(message));
  } else {
    console.error('WebSocket is not connected. Current state:', ws ? ws.readyState : 'not initialized');
  }
}

// Message Handling
function handleWebSocketMessage(evt) {
  const msg = JSON.parse(evt.data);
  
  switch (msg.type) {
    case MESSAGE_ENUM.SELF_CONNECTED:
      handleSelfConnected(msg);
      break;
    case MESSAGE_ENUM.USER_LIST:
      handleUserList(msg);
      break;
    case MESSAGE_ENUM.GROUP_LIST:
      handleGroupList(msg);
      break;
    case MESSAGE_ENUM.CLIENT_MESSAGE:
    case MESSAGE_ENUM.GROUP_MESSAGE:
    case MESSAGE_ENUM.PRIVATE_MESSAGE:
      handleChatMessage(msg);
      break;
    case MESSAGE_ENUM.IMAGE_MESSAGE:
    case MESSAGE_ENUM.GROUP_IMAGE_MESSAGE:
    case MESSAGE_ENUM.PRIVATE_IMAGE_MESSAGE:
      handleImageMessage(msg);
      break;
    case MESSAGE_ENUM.TYPING_STARTED:
    case MESSAGE_ENUM.GROUP_TYPING_STARTED:
    case MESSAGE_ENUM.PRIVATE_TYPING_STARTED:
      handleTypingStarted(msg);
      break;
    case MESSAGE_ENUM.TYPING_STOPPED:
    case MESSAGE_ENUM.GROUP_TYPING_STOPPED:
    case MESSAGE_ENUM.PRIVATE_TYPING_STOPPED:
      handleTypingStopped(msg);
      break;
    case MESSAGE_ENUM.REPLY_MESSAGE:
    case MESSAGE_ENUM.GROUP_REPLY_MESSAGE:
    case MESSAGE_ENUM.PRIVATE_REPLY_MESSAGE:
      handleReplyMessage(msg);
      break;
    case MESSAGE_ENUM.CLIENT_CONNECTED:
    case MESSAGE_ENUM.CLIENT_DISCONNECTED:
      handleConnectionEvent(msg);
      break;
  }
}

// Message Handlers
function handleSelfConnected(msg) {
  state.currentUser.id = msg.body.id;
  state.currentUser.name = msg.body.name;
  DOM.username.innerText = `Your display name is: ${msg.body.name}`;
  DOM.userId.innerText = `ID: ${msg.body.id}`;
}

function handleUserList(msg) {
  updateUserList(msg.users);
}

function handleGroupList(msg) {
  console.log('Received group list:', msg.groups);
  state.availableGroups = msg.groups;
  updateGroupList(msg.groups);
}

function handleChatMessage(msg) {
  if (shouldDisplayMessage(msg)) {
    printMessage(msg);
  }
}

function handleImageMessage(msg) {
  if (shouldDisplayMessage(msg)) {
    printImageMessage(msg);
  }
}

function handleTypingStarted(msg) {
  if (shouldDisplayTyping(msg)) {
    showTypingIndicator(msg.sender);
  }
}

function handleTypingStopped(msg) {
  if (shouldDisplayTyping(msg)) {
    hideTypingIndicator();
  }
}

function handleReplyMessage(msg) {
  if (shouldDisplayMessage(msg)) {
    printReplyMessage(msg);
  }
}

function handleConnectionEvent(msg) {
  logMessage(msg);
  requestUserList();
}

// Message Display Logic
function shouldDisplayMessage(msg) {
  switch (state.currentChat.type) {
    case 'global':
      return msg.type === MESSAGE_ENUM.CLIENT_MESSAGE || 
             msg.type === MESSAGE_ENUM.IMAGE_MESSAGE ||
             msg.type === MESSAGE_ENUM.REPLY_MESSAGE;
    case 'group':
      return (msg.type === MESSAGE_ENUM.GROUP_MESSAGE || 
              msg.type === MESSAGE_ENUM.GROUP_IMAGE_MESSAGE ||
              msg.type === MESSAGE_ENUM.GROUP_REPLY_MESSAGE) && 
              msg.groupId === state.currentChat.id;
    case 'user':
      return (msg.type === MESSAGE_ENUM.PRIVATE_MESSAGE || 
              msg.type === MESSAGE_ENUM.PRIVATE_IMAGE_MESSAGE ||
              msg.type === MESSAGE_ENUM.PRIVATE_REPLY_MESSAGE) && 
              (state.currentChat.id === msg.senderId || 
               state.currentChat.id === msg.recipientId);
    default:
      return false;
  }
}

function shouldDisplayTyping(msg) {
  switch (state.currentChat.type) {
    case 'global':
      return msg.type === MESSAGE_ENUM.TYPING_STARTED || 
             msg.type === MESSAGE_ENUM.TYPING_STOPPED;
    case 'group':
      return (msg.type === MESSAGE_ENUM.GROUP_TYPING_STARTED || 
              msg.type === MESSAGE_ENUM.GROUP_TYPING_STOPPED) && 
              msg.groupId === state.currentChat.id;
    case 'user':
      return (msg.type === MESSAGE_ENUM.PRIVATE_TYPING_STARTED || 
              msg.type === MESSAGE_ENUM.PRIVATE_TYPING_STOPPED) && 
              state.currentChat.id === msg.senderId;
    default:
      return false;
  }
}

// UI Functions
function printMessage(msg) {
  const messageEl = createMessageElement(msg);
  const textEl = document.createElement('div');
  textEl.classList.add('text');
  textEl.innerText = msg.body;
  
  messageEl.appendChild(textEl);
  appendMessageToChat(messageEl, msg);
}

function printImageMessage(msg) {
  const messageEl = createMessageElement(msg);
  const imageEl = document.createElement('img');
  imageEl.classList.add('message-image');
  imageEl.src = msg.imageData;
  imageEl.alt = 'Shared image';
  imageEl.onclick = () => showImagePreview(msg.imageData);
  
  messageEl.appendChild(imageEl);
  appendMessageToChat(messageEl, msg);
}

function printReplyMessage(msg) {
  const messageEl = createMessageElement(msg);
  messageEl.classList.add('reply');
  
  const replyToElement = createReplyToElement(msg.replyTo);
  const messageContent = createMessageContentElement(msg);
  
  messageEl.appendChild(replyToElement);
  messageEl.appendChild(messageContent);
  appendMessageToChat(messageEl, msg);
}

function createMessageElement(msg) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message');
  messageEl.classList.add(msg.sender === state.currentUser.name ? 'sent' : 'received');
  
  const senderEl = document.createElement('div');
  senderEl.classList.add('sender');
  senderEl.innerText = msg.sender;
  
  messageEl.appendChild(senderEl);
  return messageEl;
}

function createReplyToElement(replyTo) {
  const replyToElement = document.createElement('div');
  replyToElement.classList.add('reply-to');
  
  const senderSpan = document.createElement('span');
  senderSpan.classList.add('sender');
  senderSpan.textContent = replyTo.sender;
  
  const contentSpan = document.createElement('span');
  contentSpan.classList.add('content');
  
  if (replyTo.imageData) {
    const img = document.createElement('img');
    img.classList.add('image-preview');
    img.src = replyTo.imageData;
    contentSpan.appendChild(img);
  } else {
    contentSpan.textContent = replyTo.body;
  }
  
  replyToElement.appendChild(senderSpan);
  replyToElement.appendChild(document.createTextNode(': '));
  replyToElement.appendChild(contentSpan);
  
  return replyToElement;
}

function createMessageContentElement(msg) {
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  
  if (msg.imageData) {
    const img = document.createElement('img');
    img.src = msg.imageData;
    img.classList.add('message-image');
    img.onclick = () => window.open(msg.imageData, '_blank');
    messageContent.appendChild(img);
  } else {
    messageContent.textContent = msg.body;
  }
  
  return messageContent;
}

function appendMessageToChat(messageEl, msg) {
  DOM.chatLog.appendChild(messageEl);
  DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
  state.messages.push(msg);
}

// Chat Management
function sendMessage() {
  if (!DOM.chatInput.value.trim()) return;

  const msg = createMessageObject();
  sendWebSocketMessage(msg);
  
  DOM.chatInput.value = "";
  state.currentReply = null;
}

function createMessageObject() {
  const msg = {
    type: getMessageType(),
    body: DOM.chatInput.value
  };

  if (state.currentChat.type === 'group') {
    msg.groupId = state.currentChat.id;
  } else if (state.currentChat.type === 'user') {
    msg.recipientId = state.currentChat.id;
  }

  if (state.currentReply) {
    msg.type = getReplyMessageType();
    msg.replyTo = {
      sender: state.currentReply.sender,
      body: state.currentReply.body,
      imageData: state.currentReply.imageData
    };
  }

  return msg;
}

function getMessageType() {
  switch (state.currentChat.type) {
    case 'group': return MESSAGE_ENUM.GROUP_MESSAGE;
    case 'user': return MESSAGE_ENUM.PRIVATE_MESSAGE;
    default: return MESSAGE_ENUM.CLIENT_MESSAGE;
  }
}

function getReplyMessageType() {
  switch (state.currentChat.type) {
    case 'group': return MESSAGE_ENUM.GROUP_REPLY_MESSAGE;
    case 'user': return MESSAGE_ENUM.PRIVATE_REPLY_MESSAGE;
    default: return MESSAGE_ENUM.REPLY_MESSAGE;
  }
}

// Image Handling
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) {
    if (file) alert('Please select an image file');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const msg = {
      type: getImageMessageType(),
      imageData: e.target.result,
      imageType: file.type
    };

    if (state.currentChat.type === 'group') {
      msg.groupId = state.currentChat.id;
    } else if (state.currentChat.type === 'user') {
      msg.recipientId = state.currentChat.id;
    }

    sendWebSocketMessage(msg);
  };
  reader.readAsDataURL(file);
}

function getImageMessageType() {
  switch (state.currentChat.type) {
    case 'group': return MESSAGE_ENUM.GROUP_IMAGE_MESSAGE;
    case 'user': return MESSAGE_ENUM.PRIVATE_IMAGE_MESSAGE;
    default: return MESSAGE_ENUM.IMAGE_MESSAGE;
  }
}

// Typing Indicator
function handleTyping() {
  if (state.typingTimeout) {
    clearTimeout(state.typingTimeout);
  }

  const msg = {
    type: getTypingMessageType(true)
  };

  if (state.currentChat.type === 'group') {
    msg.groupId = state.currentChat.id;
  } else if (state.currentChat.type === 'user') {
    msg.recipientId = state.currentChat.id;
  }

  sendWebSocketMessage(msg);

  state.typingTimeout = setTimeout(() => {
    const stopMsg = {
      type: getTypingMessageType(false)
    };

    if (state.currentChat.type === 'group') {
      stopMsg.groupId = state.currentChat.id;
    } else if (state.currentChat.type === 'user') {
      stopMsg.recipientId = state.currentChat.id;
    }

    sendWebSocketMessage(stopMsg);
  }, 1000);
}

function getTypingMessageType(isStart) {
  const baseType = isStart ? 'TYPING_STARTED' : 'TYPING_STOPPED';
  switch (state.currentChat.type) {
    case 'group': return MESSAGE_ENUM[`GROUP_${baseType}`];
    case 'user': return MESSAGE_ENUM[`PRIVATE_${baseType}`];
    default: return MESSAGE_ENUM[baseType];
  }
}

// Chat Switching
function switchToGlobalChat() {
  switchChat({ type: 'global', id: null }, 'Global Chat');
}

function switchToUserChat(user) {
  switchChat({ type: 'user', id: user.id }, `Chat with ${user.name}`);
}

function switchToGroupChat(group) {
  // Join the group first
  joinGroup(group.id);
  // Then switch to the group chat
  switchChat({ type: 'group', id: group.id }, group.name);
}

function switchChat(newChat, title) {
  state.currentChat = newChat;
  DOM.chatTitle.innerText = title;
  clearActiveStates();
  event.currentTarget.classList.add('active');
  state.messages = [];
  DOM.chatLog.innerHTML = '';
}

// UI Updates
function updateUserList(users) {
  if (!users) return;
  
  DOM.usersList.innerHTML = '';
  addGlobalChatOption();
  users.forEach(addUserToList);
}

function addGlobalChatOption() {
  const globalChatEl = document.createElement('li');
  globalChatEl.classList.add('list-item');
  if (state.currentChat.type === 'global') {
    globalChatEl.classList.add('active');
  }
  globalChatEl.innerHTML = `
    <div class="avatar global">🌐</div>
    <div class="info">
      <div class="name">Global Chat</div>
    </div>
  `;
  globalChatEl.onclick = switchToGlobalChat;
  DOM.usersList.appendChild(globalChatEl);
}

function addUserToList(user) {
  if (user.id === state.currentUser.id) return;

  const userEl = document.createElement('li');
  userEl.classList.add('list-item');
  if (state.currentChat.type === 'user' && state.currentChat.id === user.id) {
    userEl.classList.add('active');
  }
  userEl.innerHTML = `
    <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
    <div class="info">
      <div class="name">${user.name}</div>
      <div class="status">Online</div>
    </div>
  `;
  userEl.onclick = () => switchToUserChat(user);
  DOM.usersList.appendChild(userEl);
}

function updateGroupList(groups) {
  if (!groups) {
    console.log('No groups to display');
    return;
  }
  
  console.log('Updating group list with:', groups);
  DOM.groupsList.innerHTML = '';
  groups.forEach(group => {
    console.log('Adding group to list:', group);
    addGroupToList(group);
  });
}

function addGroupToList(group) {
  console.log('Creating group element for:', group);
  const groupEl = document.createElement('li');
  groupEl.classList.add('list-item');
  if (state.currentChat.type === 'group' && state.currentChat.id === group.id) {
    groupEl.classList.add('active');
  }

  // Check if current user is a member of this group
  const isMember = group.members.includes(state.currentUser.name);

  groupEl.innerHTML = `
    <div class="avatar group">👥</div>
    <div class="info">
      <div class="name">${group.name}</div>
      <div class="members">${group.members.length} members</div>
    </div>
    <div class="group-actions">
      ${isMember ? 
        `<button class="leave-group-btn" data-group-id="${group.id}">Leave</button>` :
        `<button class="join-group-btn" data-group-id="${group.id}">Join</button>`
      }
    </div>
  `;

  // Add click handler for the group chat
  groupEl.querySelector('.info').onclick = () => switchToGroupChat(group);

  // Add click handler for join/leave button
  const actionButton = groupEl.querySelector('.join-group-btn, .leave-group-btn');
  actionButton.onclick = (e) => {
    e.stopPropagation(); // Prevent triggering the group chat switch
    const groupId = e.target.dataset.groupId;
    if (isMember) {
      leaveGroup(groupId);
    } else {
      joinGroup(groupId);
    }
  };

  DOM.groupsList.appendChild(groupEl);
}

// Utility Functions
function clearActiveStates() {
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));
}

function showTypingIndicator(username) {
  state.currentTypingUser = username;
  DOM.typingUser.textContent = username;
  DOM.typingIndicator.classList.add('active');
}

function hideTypingIndicator() {
  state.currentTypingUser = null;
  DOM.typingIndicator.classList.remove('active');
}

function showImagePreview(src) {
  DOM.previewImage.src = src;
  DOM.imagePreview.classList.add('active');
}

function hideImagePreview() {
  DOM.imagePreview.classList.remove('active');
}

function logMessage(msg) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('system-message');
  messageEl.innerText = `${msg.body.name} has ${msg.type === MESSAGE_ENUM.CLIENT_CONNECTED ? 'connected' : 'disconnected'}`;
  DOM.chatLog.appendChild(messageEl);
  DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
}

// Event Handlers
function handleKeyDown(evt) {
  if (evt.key === 'Enter' && DOM.chatInput.value.trim() !== '') {
    sendMessage();
  }
}

function startReply(message) {
  if (!message) return;
  
  state.currentReply = message;
  DOM.replyBar.classList.add('active');
  DOM.replySender.textContent = message.sender;
  
  if (message.imageData) {
    const img = document.createElement('img');
    img.className = 'image-preview';
    img.src = message.imageData;
    DOM.replyContent.innerHTML = '';
    DOM.replyContent.appendChild(img);
  } else {
    DOM.replyContent.textContent = message.body;
  }
  
  DOM.chatInput.focus();
}

function cancelReply() {
  state.currentReply = null;
  DOM.replyBar.classList.remove('active');
  DOM.replySender.textContent = '';
  DOM.replyContent.textContent = '';
}

// DOM References and Event Listeners
function assignReferences() {
  DOM.username = document.getElementById("username");
  DOM.userId = document.getElementById("user-id");
  DOM.chatLog = document.getElementById("chat-log");
  DOM.chatInput = document.getElementById("chat-input");
  DOM.chatInputButton = document.getElementById("chat-input-button");
  DOM.usersList = document.getElementById("users-list");
  DOM.groupsList = document.getElementById("groups-list");
  DOM.tabs = document.querySelectorAll(".tab");
  DOM.createGroupButton = document.getElementById("create-group-button");
  DOM.chatTitle = document.getElementById("chat-title");
  DOM.imageUploadButton = document.getElementById("image-upload-button");
  DOM.imageUpload = document.getElementById("image-upload");
  DOM.imagePreview = document.getElementById("image-preview");
  DOM.previewImage = document.getElementById("preview-image");
  DOM.typingIndicator = document.getElementById("typing-indicator");
  DOM.typingUser = document.querySelector(".typing-user");
  DOM.replyBar = document.getElementById('reply-bar');
  DOM.replySender = DOM.replyBar.querySelector('.reply-sender');
  DOM.replyContent = DOM.replyBar.querySelector('.reply-content');
  DOM.cancelReplyButton = document.getElementById('cancel-reply');
  DOM.createGroupModal = document.getElementById('create-group-modal');
  DOM.groupNameInput = document.getElementById('group-name-input');
  DOM.createGroupConfirmButton = document.getElementById('create-group-confirm');
  DOM.createGroupCancelButton = document.getElementById('create-group-cancel');
  DOM.joinGroupModal = document.getElementById('join-group-modal');
  DOM.joinGroupList = document.getElementById('join-group-list');
  DOM.joinGroupConfirmButton = document.getElementById('join-group-confirm');
  DOM.joinGroupCancelButton = document.getElementById('join-group-cancel');
}

function attachListeners() {
  DOM.chatInputButton.addEventListener('click', sendMessage);
  DOM.chatInput.addEventListener('keydown', handleKeyDown);
  DOM.chatInput.addEventListener('input', handleTyping);
  DOM.createGroupButton.addEventListener('click', showCreateGroupModal);
  DOM.createGroupConfirmButton.addEventListener('click', createGroup);
  DOM.createGroupCancelButton.addEventListener('click', hideCreateGroupModal);
  DOM.joinGroupConfirmButton.addEventListener('click', joinSelectedGroup);
  DOM.joinGroupCancelButton.addEventListener('click', hideJoinGroupModal);
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  DOM.imageUploadButton.addEventListener('click', () => DOM.imageUpload.click());
  DOM.imageUpload.addEventListener('change', handleImageUpload);
  DOM.imagePreview.addEventListener('click', hideImagePreview);
  DOM.cancelReplyButton.addEventListener('click', cancelReply);
  
  DOM.chatLog.addEventListener('click', handleChatLogClick);
}

function handleChatLogClick(event) {
  const messageElement = event.target.closest('.message');
  if (messageElement) {
    const messageIndex = Array.from(DOM.chatLog.children).indexOf(messageElement);
    if (messageIndex !== -1 && state.messages[messageIndex]) {
      startReply(state.messages[messageIndex]);
    }
  }
}

// Group Management
function createGroup() {
  const groupName = DOM.groupNameInput.value.trim();
  if (!groupName) {
    alert('Please enter a group name');
    return;
  }

  sendWebSocketMessage({
    type: MESSAGE_ENUM.CREATE_GROUP,
    groupName: groupName
  });

  // Request updated group list
  sendWebSocketMessage({
    type: MESSAGE_ENUM.GROUP_LIST
  });

  hideCreateGroupModal();
}

function joinGroup(groupId) {
  sendWebSocketMessage({
    type: MESSAGE_ENUM.JOIN_GROUP,
    groupId: groupId
  });
}

function leaveGroup(groupId) {
  sendWebSocketMessage({
    type: MESSAGE_ENUM.LEAVE_GROUP,
    groupId: groupId
  });
}

// Chat Switching
function switchTab(tabName) {
  DOM.tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  if (tabName === 'groups') {
    DOM.usersList.style.display = 'none';
    DOM.groupsList.style.display = 'block';
    // Request updated group list when switching to groups tab
    sendWebSocketMessage({
      type: MESSAGE_ENUM.GROUP_LIST
    });
  } else {
    DOM.usersList.style.display = 'block';
    DOM.groupsList.style.display = 'none';
  }
}

function showCreateGroupModal() {
  DOM.createGroupModal.classList.add('active');
  DOM.groupNameInput.value = '';
  DOM.groupNameInput.focus();
}

function hideCreateGroupModal() {
  DOM.createGroupModal.classList.remove('active');
}

function showJoinGroupModal() {
  DOM.joinGroupModal.classList.add('active');
  updateJoinGroupList();
}

function hideJoinGroupModal() {
  DOM.joinGroupModal.classList.remove('active');
}

function updateJoinGroupList() {
  DOM.joinGroupList.innerHTML = '';
  state.availableGroups.forEach(group => {
    if (!group.members.includes(state.currentUser.name)) {
      const groupEl = document.createElement('div');
      groupEl.classList.add('group-item');
      groupEl.innerHTML = `
        <input type="radio" name="group-select" value="${group.id}" id="group-${group.id}">
        <label for="group-${group.id}">
          <div class="group-name">${group.name}</div>
          <div class="group-members">${group.members.length} members</div>
        </label>
      `;
      DOM.joinGroupList.appendChild(groupEl);
    }
  });
}

function joinSelectedGroup() {
  const selectedGroup = document.querySelector('input[name="group-select"]:checked');
  if (selectedGroup) {
    joinGroup(selectedGroup.value);
    hideJoinGroupModal();
  }
}

// Add styles for the new buttons
const style = document.createElement('style');
style.textContent = `
  .group-actions {
    margin-left: auto;
    padding-left: 10px;
  }

  .join-group-btn, .leave-group-btn {
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
  }

  .join-group-btn {
    background-color: #4CAF50;
    color: white;
  }

  .join-group-btn:hover {
    background-color: #45a049;
  }

  .leave-group-btn {
    background-color: #f44336;
    color: white;
  }

  .leave-group-btn:hover {
    background-color: #da190b;
  }

  .list-item {
    display: flex;
    align-items: center;
    padding: 12px 20px;
  }

  .list-item .info {
    flex: 1;
    cursor: pointer;
  }
`;
document.head.appendChild(style);
A high-performance, scalable chat web application built using uWebSockets.js with support for:

🌐 Global Chat — All users can broadcast messages to everyone.

🔒 Private Chat — One-on-one encrypted messages.

👥 Group Chat — Invite-only or open-access group messaging.

🚀 Features
Built on ultra-fast uWebSockets.js

Global broadcast messaging

Private messaging (user-to-user)

Group chat rooms with member management

Realtime typing indicators and online presence (optional)

Lightweight frontend using vanilla JS / React (optional)

Scalable and efficient WebSocket architecture

🛠️ Tech Stack
Backend: Node.js + uWebSockets.js

Frontend: HTML/CSS/JavaScript (or React)

Protocol: JSON over WebSockets

## Getting started

Grab dependencies:
```sh
npm i
```

Start node server:
```sh
node src/server/server.js
```

Start web server:
```sh
# Python 2.x
python -m SimpleHTTPServer 8000 -d src/app
# Python 3.x
python3 -m http.server 8000 -d src/app
```
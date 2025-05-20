// Client-side JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const initialScreen = document.getElementById('initial-screen');
    const chatScreen = document.getElementById('chat-screen');
    const usernameInput = document.getElementById('username');
    const createRoomBtn = document.getElementById('create-room-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomIdDisplay = document.getElementById('room-id-display');
    const copyRoomIdBtn = document.getElementById('copy-room-id');
    const chatHistory = document.getElementById('chat-history');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const notifications = document.getElementById('notifications');

    // WebSocket connection
    let ws;
    let username;
    let currentRoomId;

    // Connect to WebSocket server
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('Connected to the WebSocket server');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
        
        ws.onclose = () => {
            showNotification('Connection closed. Trying to reconnect...', 'error');
            // Try to reconnect after 2 seconds
            setTimeout(connectWebSocket, 2000);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            showNotification('Connection error', 'error');
        };
    }

    // Initialize WebSocket connection
    connectWebSocket();

    // Handle messages from the server
    function handleServerMessage(data) {
        switch (data.type) {
            case 'room_created':
                currentRoomId = data.roomId;
                joinRoom();
                break;
                
            case 'chat_history':
                renderChatHistory(data.history);
                break;
                
            case 'new_message':
                renderMessage(data);
                scrollToBottom();
                break;
                
            case 'user_joined':
                renderSystemMessage(`${data.username} joined the room`);
                scrollToBottom();
                break;
                
            case 'user_left':
                renderSystemMessage(`${data.username} left the room`);
                scrollToBottom();
                break;
                
            case 'error':
                showNotification(data.message, 'error');
                break;
        }
    }

    // Create a new room
    createRoomBtn.addEventListener('click', () => {
        username = usernameInput.value.trim();
        
        if (!username) {
            showNotification('Please enter a username', 'error');
            return;
        }
        
        // Request room creation from the server
        ws.send(JSON.stringify({
            type: 'create_room'
        }));
    });

    // Join an existing room
    joinRoomBtn.addEventListener('click', () => {
        username = usernameInput.value.trim();
        currentRoomId = roomIdInput.value.trim();
        
        if (!username) {
            showNotification('Please enter a username', 'error');
            return;
        }
        
        if (!currentRoomId) {
            showNotification('Please enter a room ID', 'error');
            return;
        }
        
        joinRoom();
    });

    // Join the room
    function joinRoom() {
        // Send join room request
        ws.send(JSON.stringify({
            type: 'join_room',
            roomId: currentRoomId,
            username
        }));
        
        // Update UI
        roomIdDisplay.textContent = currentRoomId;
        initialScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();
        
        showNotification(`Joined room: ${currentRoomId}`, 'success');
    }

    // Send a message
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const content = messageInput.value.trim();
        
        if (!content) return;
        
        // Send the message to the server
        ws.send(JSON.stringify({
            type: 'send_message',
            content
        }));
        
        // Clear input
        messageInput.value = '';
        messageInput.focus();
    }

    // Copy room ID to clipboard
    copyRoomIdBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRoomId)
            .then(() => {
                showNotification('Room ID copied to clipboard', 'success');
            })
            .catch(() => {
                showNotification('Failed to copy Room ID', 'error');
            });
    });

    // Render chat history
    function renderChatHistory(history) {
        chatHistory.innerHTML = '';
        history.forEach(message => {
            if (message.type === 'new_message') {
                renderMessage(message);
            } else if (message.type === 'user_joined' || message.type === 'user_left') {
                renderSystemMessage(`${message.username} ${message.type === 'user_joined' ? 'joined' : 'left'} the room`);
            }
        });
        scrollToBottom();
    }

    // Render a single message
    function renderMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', message.username === username ? 'self' : 'other');
        
        const formattedTime = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="meta">
                <span class="username">${message.username === username ? 'You' : message.username}</span>
                <span class="time">${formattedTime}</span>
            </div>
            <div class="content">${escapeHtml(message.content)}</div>
        `;
        
        chatHistory.appendChild(messageElement);
    }

    // Render system message
    function renderSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('system-message');
        messageElement.textContent = text;
        chatHistory.appendChild(messageElement);
    }

    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.classList.add('notification', type);
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notifications.removeChild(notification);
            }, 300); // match the CSS transition duration
        }, 3000);
    }

    // Scroll chat history to bottom
    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
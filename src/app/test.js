// Test script for WebSocket connection stress testing
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

// Configuration
const TOTAL_CONNECTIONS = 500;
const CONNECTIONS_PER_BATCH = 50;
const BATCH_DELAY = 1000; // 1 second between batches
const MESSAGE_INTERVAL = 2000; // Send message every 2 seconds
const TEST_DURATION = 30000; // Run test for 30 seconds

// Statistics
let activeConnections = 0;
let successfulConnections = 0;
let failedConnections = 0;
let startTime = null;
let totalMessagesSent = 0;
let totalMessagesReceived = 0;
const connectedClients = new Set();

// Create WebSocket connections in batches
async function createConnections() {
    startTime = performance.now();
    console.log(`Starting stress test with ${TOTAL_CONNECTIONS} total connections`);
    console.log(`Creating ${CONNECTIONS_PER_BATCH} connections every ${BATCH_DELAY}ms`);

    for (let i = 0; i < TOTAL_CONNECTIONS; i += CONNECTIONS_PER_BATCH) {
        const batchSize = Math.min(CONNECTIONS_PER_BATCH, TOTAL_CONNECTIONS - i);
        await createBatch(batchSize);
        
        if (i + CONNECTIONS_PER_BATCH < TOTAL_CONNECTIONS) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
    }

    // Start sending periodic messages
    startMessageSending();

    // Run the test for the specified duration
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION));
    
    // Clean up and print results
    cleanup();
    printResults();
}

// Create a batch of connections
async function createBatch(batchSize) {
    const promises = [];
    
    for (let i = 0; i < batchSize; i++) {
        const promise = createConnection();
        promises.push(promise);
    }

    await Promise.all(promises);
}

// Create a single WebSocket connection
function createConnection() {
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:7777/ws');
        
        ws.on('open', () => {
            activeConnections++;
            successfulConnections++;
            connectedClients.add(ws);
            
            // Send initial test message
            sendGlobalMessage(ws, `Initial message from client ${successfulConnections}`);
            resolve();
        });

        ws.on('error', (error) => {
            console.error('Connection error:', error.message);
            failedConnections++;
            resolve();
        });

        ws.on('close', () => {
            activeConnections--;
            connectedClients.delete(ws);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (message.type === 'CLIENT_MESSAGE' || message.type === 'GROUP_MESSAGE') {
                    totalMessagesReceived++;
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });
    });
}

// Send a message to global chat
function sendGlobalMessage(ws, content) {
    if (ws.readyState === WebSocket.OPEN) {
        const message = {
            type: 'CLIENT_MESSAGE',
            body: content,
            sender: `TestUser${successfulConnections}`
        };
        
        ws.send(JSON.stringify(message));
        totalMessagesSent++;
    }
}

// Start sending periodic messages from all clients
function startMessageSending() {
    setInterval(() => {
        const timestamp = new Date().toISOString();
        connectedClients.forEach((ws, index) => {
            sendGlobalMessage(ws, `Periodic message from client ${index + 1} at ${timestamp}`);
        });
    }, MESSAGE_INTERVAL);
}

// Clean up all connections
function cleanup() {
    connectedClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
    connectedClients.clear();
}

// Print test results
function printResults() {
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds

    console.log('\nTest Results:');
    console.log('-------------');
    console.log(`Total connections attempted: ${TOTAL_CONNECTIONS}`);
    console.log(`Successful connections: ${successfulConnections}`);
    console.log(`Failed connections: ${failedConnections}`);
    console.log(`Active connections: ${activeConnections}`);
    console.log(`Total messages sent: ${totalMessagesSent}`);
    console.log(`Total messages received: ${totalMessagesReceived}`);
    console.log(`Test duration: ${duration.toFixed(2)} seconds`);
    console.log(`Average connections per second: ${(successfulConnections / duration).toFixed(2)}`);
    console.log(`Average messages per second: ${(totalMessagesSent / duration).toFixed(2)}`);
}

// Run the test
createConnections().catch(console.error); 
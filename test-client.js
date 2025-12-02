// Test client for Driver Safety Backend
const { io } = require('socket.io-client');
const readline = require('readline');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_DRIVERS = [
  { id: 'driver1', lat: 12.9716, lng: 77.5946 }, // Bangalore
  { id: 'driver2', lat: 12.9719, lng: 77.5947 }, // ~40m away from driver1
  { id: 'driver3', lat: 12.9721, lng: 77.5949 }, // ~80m away from driver1
  { id: 'driver4', lat: 12.9850, lng: 77.6090 }  // ~2km away from driver1
];

// Create socket connections for each test driver
const driverSockets = TEST_DRIVERS.map(driver => {
  const socket = io(SERVER_URL);
  
  // Handle connection
  socket.on('connect', () => {
    console.log(`${driver.id} connected`);
    
    // Register driver
    socket.emit('register', { driverId: driver.id });
  });

  // Handle registration confirmation
  socket.on('registered', (response) => {
    console.log(`${driver.id} registration response:`, response);
  });

  // Handle nearby alerts
  socket.on('nearby_alert', (alert) => {
    console.log(`${driver.id} received alert:`, alert);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`${driver.id} error:`, error);
  });

  return { socket, driver };
});

// Function to update driver location
function updateLocation(driverSocket, latitude, longitude) {
  const { driver, socket } = driverSocket;
  socket.emit('update_location', {
    driverId: driver.id,
    latitude,
    longitude
  });
}

// Function to send drowsy alert
function sendDrowsyAlert(driverSocket) {
  const { driver, socket } = driverSocket;
  socket.emit('drowsy_alert', {
    driverId: driver.id,
    latitude: driver.lat,
    longitude: driver.lng,
    alertType: 'drowsy'
  });
}

// Initialize readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Interactive test menu
function showMenu() {
  console.log('\n=== Test Menu ===');
  console.log('1. Update all drivers\' locations');
  console.log('2. Send drowsy alert from driver1');
  console.log('3. Send drowsy alert from driver2');
  console.log('4. Disconnect all drivers');
  console.log('5. Exit');
  
  rl.question('\nSelect an option (1-5): ', (answer) => {
    switch(answer) {
      case '1':
        driverSockets.forEach(ds => {
          updateLocation(ds, ds.driver.lat, ds.driver.lng);
        });
        console.log('Updated all driver locations');
        break;
        
      case '2':
        sendDrowsyAlert(driverSockets[0]); // driver1
        console.log('Sent drowsy alert from driver1');
        break;
        
      case '3':
        sendDrowsyAlert(driverSockets[1]); // driver2
        console.log('Sent drowsy alert from driver2');
        break;
        
      case '4':
        driverSockets.forEach(({ socket }) => socket.disconnect());
        console.log('Disconnected all drivers');
        break;
        
      case '5':
        console.log('Exiting...');
        driverSockets.forEach(({ socket }) => socket.disconnect());
        rl.close();
        process.exit(0);
        return;
        
      default:
        console.log('Invalid option');
    }
    
    showMenu();
  });
}

// Start the test
console.log('Starting test client...');
setTimeout(showMenu, 1000); // Give time for connections to establish
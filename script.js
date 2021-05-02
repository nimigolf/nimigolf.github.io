/* global AFRAME */
/* global CANNON */
/* global firebase */
/* global DEFAULT_HOLE */
/* global HOLES */

// get url pathname
function getParam(url, tag) {
  if (url.indexOf(`${tag}=`) > -1) {
    return url.split(`${tag}=`)[1].split('&')[0];
  }
  return null;
}

// This code runs when the page is loading, before the body is loaded.

const firebaseConfig = {
  apiKey: "AIzaSyA76jCY2eouHaiDOK4iTum7aUBJS_S6b9M",
  authDomain: "minigolf-bdba7.firebaseapp.com",
  databaseURL: "https://minigolf-bdba7-default-rtdb.firebaseio.com",
  projectId: "minigolf-bdba7",
  storageBucket: "minigolf-bdba7.appspot.com",
  messagingSenderId: "1013135860295",
  appId: "1:1013135860295:web:11fa33501c120b670c0762"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const url = document.location.href;
const roomCode = getParam(url, 'room');
const myPlayerId = localStorage.getItem('minigolf_user_id');
if (!roomCode || !myPlayerId) {
  document.location = './lobby';
}
console.log(`I am playing as ${myPlayerId}`);

let useLoopShotInteraction = localStorage.getItem('minigolf_use_loop_shot');

db.ref(`rooms/${roomCode}/hole`).once('value', (holeSnap) => {
  const holeVal = holeSnap.val() || DEFAULT_HOLE;
  console.log(`Loading hole: ${holeVal}`);
  const holeData = HOLES[holeVal];
  fetch(`/holes/${holeVal}.html`).then(async (res) => {
    const raw = await res.text();
    document.body.innerHTML = raw;
    loadGame(holeData);
  });
});

db.ref(`rooms/${roomCode}/started`).on('value', (startSnap) => {
  if (!startSnap.val()) {
    localStorage.setItem('minigolf_temp_room_id', roomCode);
    document.location = './lobby';
  }
});

// Code below is all wrapped inside the loadGame() method and will be
// called once the hole is loaded.

function loadGame(holeData) {

let latestTimestamp = 0;

const camera = document.getElementById('camera');
const ball = document.getElementById('ball');

const MIN_VALID_DIST = 10;
const MAX_MAG = 90;

let defaultPos = holeData.ballSpawn || {
  x: 0,
  y: 0.3,
  z: -4
};

const ballColors = [
  '#60AFFF', // blue
  '#EE6C4D', // orange
  '#35CE8D', // green
  '#F9DB6D', // yellow
  '#745C97', // purple
  '#F896D8' // pink
];

let state = {
  currentPlayer: null,
  latest: {},
  players: {},
  positions: {},
  order: {},
  balls: {
    [myPlayerId]: ball,
  },
};

waitForPlayers(myPlayerId).then(() => {
  ball.setAttribute('color', state.players[myPlayerId].color);
});
  
// waitForBody(ball).then(() => {
//   ball.body.fixedRotation = true;
//   ball.body.updateMassProperties();
// });

// Listen for events and update game state

const updateState = (e) => {
  if (e.timestamp <= latestTimestamp) {
    return;
  }
  if (e.type === 'started_shot') {
    state.currentPlayer = e.playerId;
    waitForPlayers(e.playerId).then(() => {
      announce(`${state.players[e.playerId].name} is taking a shot.`);
    });
  }
  if (e.type === 'finished_shot') {
    waitForPlayers(state.currentPlayer).then(() => {
      announce(`${state.players[state.currentPlayer].name} finished their shot.`);
      state.currentPlayer = null;
    });
  }
  if (e.type === 'cancelled_shot') {
    waitForPlayers(state.currentPlayer).then(() => {
      announce(`${state.players[state.currentPlayer].name} cancelled their shot.`);
      state.currentPlayer = null;
    });
  }
  if (e.type === 'completed_hole') {
    waitForPlayers(e.playerId).then(() => {
      announce(`${state.players[e.playerId].name} got their ball in the hole!`);
    });
  }
  if (e.type === 'joined') {
    console.log(`${e.playerId} join ${e.timestamp}`);
  }
  if (e.type === 'shot_ball') {
    if (e.timestamp > latestTimestamp) {
      const playerEl = state.balls[e.playerId];
      if (playerEl && playerEl.body) {
        resetBody(playerEl.body);
        playerEl.body.position.set(e.px, e.py, e.pz);
        playerEl.body.applyImpulse(
          new CANNON.Vec3(e.x, e.y, e.z),
          new CANNON.Vec3(e.ix, e.iy, e.iz)
        );
      }
    }
  }
};

// Initial database connection

db.ref(`events/${roomCode}`).once('value', (roomSnap) => {
  
  // Create or get room.
  const roomEvents = roomSnap.val();
  if (!roomEvents) {
    pushEventToRoom({ type: 'started' });
  } else {
    for (let key in roomEvents) {
      const val = roomEvents[key];
      if (val.timestamp > latestTimestamp) {
        latestTimestamp = val.timestamp;
      }
    }
  }
  
  // Get player information
  db.ref(`rooms/${roomCode}`).once('value', (lobbySnap) => {
    const lobbyVal = lobbySnap.val() || {};
    state.players = lobbyVal.players || {};
    let i = 0;
    for (let pid in state.players) {
      state.order[pid] = i;
      i++;
    }
    if (myPlayerId in state.players) {
      updateDefaultPos(state.order[myPlayerId], Object.keys(state.players).length);
    } else {
      ball.parentNode.removeChild(ball);
    }
  });
  
  // Listen for updates.
  db.ref(`events/${roomCode}`).orderByChild('timestamp').on('child_added', (eventSnap) => {
    const roomEvent = eventSnap.val();
    updateState(roomEvent);
  });
  
  // Listen for player ball positions
  db.ref(`positions/${roomCode}`).on('value', async (posSnap) => {
    const roomPosMap = posSnap.val() || {};
    // Check each player and update their position
    for (let playerId in roomPosMap) {
      const pos = roomPosMap[playerId];
      if (!(playerId in state.balls)) {
        await spawnPlayer(playerId, pos);
      }
      const playerEl = state.balls[playerId];
      await waitForBody(playerEl);
      resetBody(playerEl.body);
      playerEl.body.position.set(pos.x, pos.y, pos.z);
    }
    // Announce your ball position to the room
    if (!(myPlayerId in roomPosMap)) {
      addMyBallToRoomOnce();
    }
  });
  
});

// Send heartbeat to let other clients know I am still connected to the room
setInterval(() => {
  if (myPlayerId in state.players) {
    db.ref(`heartbeat/${roomCode}/${myPlayerId}`).set(firebase.database.ServerValue.TIMESTAMP);
  }
}, 2000);

// Listen for heartbeats from other players
db.ref(`heartbeat/${roomCode}`).on('value', (snap) => {
  const heart = snap.val();
  if (state.currentPlayer !== null && heart) {
    const beats = Object.keys(heart).map((pid) => {
      return { pid, time: heart[pid] }
    });
    const mostRecentTime = beats.reduce((mostRecent, { pid, time }) => {
      return Math.max(mostRecent, time);
    }, 0);
    if (!(state.currentPlayer in heart)
        || (mostRecentTime - heart[state.currentPlayer]) > 5000) {
      waitForPlayers(state.currentPlayer).then(() => {
        console.log(`Lost connection to ${state.currentPlayer}.`);
        announce(`Lost connection to ${state.players[state.currentPlayer].name}.`);
        state.currentPlayer = null;
      });    
    }
  }
});

// Check if ball falls into hole

const hole = document.getElementById('hole');
hole.addEventListener('collide', (e) => {
  if (e.detail.body.id === ball.body.id) {
    console.log('Ball fell in the hole.');
    pushEventToRoom({ type: 'completed_hole' });
    // Send ball back to start
    resetBody(ball.body);
    ball.body.position.set(defaultPos.x, defaultPos.y, defaultPos.z);
    pushPositionToRoom(myPlayerId, {
      x: defaultPos.x,
      y: defaultPos.y,
      z: defaultPos.z
    });
  }
});
  
// Listen for aim

db.ref(`aim/${roomCode}`).on('value', (aimSnap) => {
  const aimVal = aimSnap.val();
  if (aimVal) {
    displayVector(aimVal);
  } else {
    hideVector();
  }
});

// Listen for shots and push state afterwards

let isAiming = false;
let mouseA;
let mouseB;
let mouse;
let startedHolding = Date.now();
let stoppedHolding = Date.now();


document.body.addEventListener('mousemove', (e) => {
  if (!useLoopShotInteraction) {
    mouse = e;
    if (isAiming) {
      if (isValidShot(mouseA, mouse)) {
        const vec = getShotVector(mouseA, mouse);
        const { x, y, z } = ball.body.position;
        const from = { x, y, z };
        announce(`Power: ${getMagnitude(vec).toFixed(0)}`);
        pushAimToRoom(from, vec);
      } else {
        releaseAimFromRoom();
      }
    }
  }
});



ball.addEventListener('mousedown', (e) => {
  if (!useLoopShotInteraction) {
    if (!(myPlayerId in state.players)) {
      return;
    }
    const freeToShoot = state.currentPlayer === null;
    if (freeToShoot) {
      isAiming = true;
      mouseA = mouse;
      camera.setAttribute('look-controls', { enabled: false });
      pushEventToRoom({
        type: 'started_shot'
      });
    } else {
      console.log(`Someone else is shooting right now: ${state.currentPlayer}`);
    }
  }
});

ball.addEventListener('mouseup', (e) => {
  if (!useLoopShotInteraction) {
    if (!isAiming) {
      return;
    }
    mouseB = mouse;
    isAiming = false;
    camera.setAttribute('look-controls', { enabled: true });
    releaseAimFromRoom();
    if (!isValidShot(mouseA, mouseB)) {
      pushEventToRoom({
        type: 'cancelled_shot'
      });
      console.log('Cancelled shot.');
      return;
    }
    const vec = getShotVector(mouseA, mouseB);
    announce(`Power: ${getMagnitude(vec).toFixed(0)}`);
    const pos = getPos(myPlayerId);
    const imp = getImpulsePoint(vec, pos);
    const se = {
      type: 'shot_ball',
      x: vec.x,
      y: vec.y,
      z: vec.z,
      px: pos.x,
      py: pos.y,
      pz: pos.z,
      ix: imp.x,
      iy: imp.y,
      iz: imp.z
    };
    pushEventToRoom(se);
    resetBody(ball.body);
    ball.body.position.set(se.px, se.py, se.pz);
    ball.body.applyImpulse(
      new CANNON.Vec3(se.x, se.y, se.z),
      new CANNON.Vec3(se.ix, se.iy, se.iz)
    );
    waitForAllBallsToStop(() => {
      console.log('All balls at rest after shot by', myPlayerId, 'at', Date.now());
      for (let pid in state.balls) {
        const pos = getPos(pid);
        pushPositionToRoom(pid, {
          x: pos.x,
          y: pos.y,
          z: pos.z
        });
        resetBody(state.balls[pid].body);
        state.balls[pid].body.position.set(pos.x, pos.y, pos.z);
      }
      pushEventToRoom({
        type: 'finished_shot'
      });
    });
  }
});

setInterval(() => {
  if (useLoopShotInteraction) {
    if (isAiming) {
        stoppedHolding = Date.now();
        const timeHeld = (stoppedHolding - startedHolding);
        const vec = getShotVectorAlongCamera(timeHeld);
        const { x, y, z } = ball.body.position;
        const from = { x, y, z };
        announce(`Power: ${getMagnitude(vec).toFixed(0)}`);
        pushAimToRoom(from, vec);
    }
  }
}, 10);

document.addEventListener('keydown', (e) => {
  if (useLoopShotInteraction) {
    if (e.code !== "Space") {
      return;
    }
    if (!(myPlayerId in state.players)) {
      return;
    }
    const freeToShoot = state.currentPlayer === null;
    if (freeToShoot) {
      isAiming = true;
      startedHolding = Date.now();
      pushEventToRoom({
        type: 'started_shot'
      });
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (useLoopShotInteraction) {
    if (e.code !== "Space") {
      return;
    }
    if (!isAiming) {
      return;
    }
    isAiming = false;
    releaseAimFromRoom();
    const timeHeld = (stoppedHolding - startedHolding);
    const vec = getShotVectorAlongCamera(timeHeld);
    announce(`Power: ${getMagnitude(vec).toFixed(0)}`);
    const pos = getPos(myPlayerId);
    const imp = getImpulsePoint(vec, pos);
    const se = {
      type: 'shot_ball',
      x: vec.x,
      y: vec.y,
      z: vec.z,
      px: pos.x,
      py: pos.y,
      pz: pos.z,
      ix: imp.x,
      iy: imp.y,
      iz: imp.z
    };
    pushEventToRoom(se);
    resetBody(ball.body);
    ball.body.position.set(se.px, se.py, se.pz);
    ball.body.applyImpulse(
      new CANNON.Vec3(se.x, se.y, se.z),
      new CANNON.Vec3(se.ix, se.iy, se.iz)
    );
    waitForAllBallsToStop(() => {
      console.log('All balls at rest after shot by', myPlayerId, 'at', Date.now());
      for (let pid in state.balls) {
        const pos = getPos(pid);
        pushPositionToRoom(pid, {
          x: pos.x,
          y: pos.y,
          z: pos.z
        });
        resetBody(state.balls[pid].body);
        state.balls[pid].body.position.set(pos.x, pos.y, pos.z);
      }
      pushEventToRoom({
        type: 'finished_shot'
      });
    });
  }
});
  
const helpControlsEl = document.getElementById('help-controls');
const toggleShootEl = document.createElement('span');
const shootMode = useLoopShotInteraction
  ? 'Hold space bar, then release.'
  : 'Pull on ball, then release.';
toggleShootEl.innerText = `To Putt: ${shootMode}`;
helpControlsEl.prepend(document.createElement('br'));
helpControlsEl.prepend(toggleShootEl);


const defaultCameraRotation = { x: -45, y: 0, z: 0 };

document.addEventListener('keydown', (e) => {
  // Place ball back at starting point
  if (e.code === 'KeyP' || e.key === 'p') {
    resetBody(ball.body);
    ball.body.position.set(defaultPos.x, defaultPos.y, defaultPos.z);
    pushPositionToRoom(myPlayerId, {
      x: defaultPos.x,
      y: defaultPos.y,
      z: defaultPos.z
    });
  }
  // Teleport to my ball
  if (e.code === 'KeyT' || e.key === 't') {
    const pos = getPos(myPlayerId);
    camera.setAttribute('position', {
      x: pos.x,
      y: pos.y + 5,
      z: pos.z + 4
    });
    // For some reason, camera can't look up if we set this
    // camera.setAttribute('rotation', defaultCameraRotation);
  }
  if (e.code === 'KeyQ' || e.key === 'q') {
    isAiming = false;
    camera.setAttribute('look-controls', { enabled: true });
    releaseAimFromRoom();
    pushEventToRoom({
      type: 'cancelled_shot'
    });
    console.log('Cancelled shot.');
  }
  if (e.code === 'KeyK' || e.key === 'k') {
    useLoopShotInteraction = !useLoopShotInteraction;
    localStorage.setItem('minigolf_use_loop_shot', useLoopShotInteraction);
    const newShootMode = useLoopShotInteraction
      ? 'Hold space bar, then release.'
      : 'Pull on ball, then release.';
    toggleShootEl.innerText = `To Putt: ${newShootMode}`;
  }
});

// Helper Functions

function pushEventToRoom(data) {
  return db.ref(`events/${roomCode}`).push({
    playerId: myPlayerId,
    ...data,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
};

function pushPositionToRoom(playerId, pos) {
  return db.ref(`positions/${roomCode}/${playerId}`).set(pos);
}

function pushAimToRoom(from, vec) {
  return db.ref(`aim/${roomCode}`).set({
    fx: from.x,
    fy: from.y,
    fz: from.z,
    vx: vec.x,
    vy: vec.y,
    vz: vec.z
  });
}

function releaseAimFromRoom() {
  return db.ref(`aim/${roomCode}`).remove();
}

async function waitForCondition(checkCondition, ms) {
  return new Promise((resolve, reject) => {
    if (checkCondition()) {
      resolve();
    } else {
      const interval = setInterval(() => {
        if (checkCondition()) {
          clearInterval(interval);
          resolve();
        }
      }, ms);
    }
  });
}

async function waitForBody(el, ms) {
  return waitForCondition(() => {
    return el.body;
  }, ms);
}

async function waitForPlayers(pid, ms) {
  return waitForCondition(() => {
    return pid in state.players;
  }, ms);
}

async function spawnPlayer(playerId, pos) {
  console.log(`Spawning player ${playerId}`);
  const scene = document.getElementById('scene');
  const player = document.createElement('a-sphere');
  player.setAttribute('dynamic-body', 'linearDamping: 0.5; angularDamping: 0.5;');
  player.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  player.setAttribute('radius', '0.25');
  waitForPlayers(playerId).then(() => {
    player.setAttribute('color', state.players[playerId].color);
  });
  scene.appendChild(player);
  // This hangs forever if you're a spectator and I have no idea why...
  await waitForBody(player);
  state.balls[playerId] = player;
  // player.body.fixedRotation = true;
  // player.body.updateMassProperties();
}

let isInRoom = false;

async function addMyBallToRoomOnce() {
  if (!(myPlayerId in state.players)) {
    return;
  }
  if (isInRoom) {
    return;
  }
  isInRoom = true;
  pushEventToRoom({ type: 'joined' });
  await waitForBody(ball);
  resetBody(ball.body);
  ball.body.position.set(defaultPos.x, defaultPos.y, defaultPos.z);
  pushPositionToRoom(myPlayerId, {
    x: defaultPos.x,
    y: defaultPos.y,
    z: defaultPos.z
  });
}
  
function getMagnitude({ x, y, z}) {
  return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2));
}

function isValidShot(posA, posB) {
  const dY = posB.clientY - posA.clientY;
  const dX = posB.clientX - posA.clientX;
  const mag = Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2));
  return mag >= MIN_VALID_DIST;
}

// Linear loop
// j\left(x,m\right)=\min\left(\operatorname{mod}\left(x,\ 2m\right),\ m\right)-\max\left(\operatorname{mod}\left(x,\ 2m\right),\ m\right)+m
// j(x, m) = min(mod(x, 2m) m) - max(mod(x, 2m), m) + m

// Sine loop
// \frac{1}{2}\left(M\cdot\sin\left(\frac{\pi\left(x-2\right)}{M}\right)+M\right)
// 0.5 * (M * sin((pi*(x - 2))/M) + M)

function thePowerBarGoesUpAndDownSine(x, m) {
  const theta = (Math.PI / m) * (x - 2);
  const out = (m * Math.sin(theta)) + m;
  return 0.5 * out;
}
  
function thePowerBarGoesUpAndDownLine(x, m) {
  const rem = x % (2 * m);
  const up = Math.min(rem, m);
  const down = Math.max(rem, m);
  return up - down + m;
}
  
function getShotVectorAlongCamera(timeHeldMs) {
  const timeHeld = timeHeldMs / 25;
  // Rotate the drag angle to account for the camera rotation
  // so that the shot will be aimed opposite the direction
  // the user drags on the screen
  const camRot = camera.getAttribute('rotation');
  const theta = (Math.PI * camRot.y) / 180;
  const mag = thePowerBarGoesUpAndDownLine(timeHeld, MAX_MAG);
  const posB = {
    x: 10 * Math.sin(theta),
    y: 0,
    z: 10 * Math.cos(theta)
  }
  const posA = getPos(myPlayerId);
  const dZ = posB.z + posA.z;
  const dX = posB.x + posA.x;
  // let out = new CANNON.Vec3(-1 * dX, posA.y, dZ);
  let out = new CANNON.Vec3(-1 * posB.x, 0, -1* posB.z);
  out.normalize();
  out = out.mult(mag);
  return {
    x: out.x,
    y: out.y,
    z: out.z
  };
}
  
function getShotVector(posA, posB) {
  const k = 0.5;
  const dY = posB.clientY - posA.clientY;
  const dX = posB.clientX - posA.clientX;
  const drag = {
    x: -1 * dX,
    y: 0,
    z: -1 * dY
  };
  // Rotate the drag angle to account for the camera rotation
  // so that the shot will be aimed opposite the direction
  // the user drags on the screen
  const camRot = camera.getAttribute('rotation');
  const theta = (Math.PI * camRot.y) / 180;
  const dir = {
    x: (drag.x * Math.cos(theta)) + (drag.z * Math.sin(theta)),
    y: drag.y,
    z: (-1 * drag.x * Math.sin(theta)) + (drag.z * Math.cos(theta))
  };
  const vec = new CANNON.Vec3(dir.x, dir.y, dir.z);
  const mag = (k * vec.norm()) - MIN_VALID_DIST;
  vec.normalize();
  // console.log(mag, Math.sqrt(shotFactor * mag));
  // const out = vec.mult(Math.sqrt(shotFactor * mag));
  const out = vec.mult(Math.min(Math.max(0, mag), MAX_MAG));
  return {
    x: out.x,
    y: out.y,
    z: out.z
  };
}

const ballRadius = 0.25;

function getImpulsePoint(shot, center) {
  const shotNorm = new CANNON.Vec3(shot.x, shot.y, shot.z);
  shotNorm.normalize();
  const ballCenter = new CANNON.Vec3(center);
  const impulsePoint = ballCenter.vsub(shotNorm.mult(ballRadius));
  const out = {
    x: impulsePoint.x,
    y: center.y,
    z: impulsePoint.z
  };
  return out;
}

function updateDefaultPos(order, nPlayers) {
  defaultPos.x = order - (nPlayers / 2) + 0.5;
}

let secretPosMap = {};
setInterval(() => {
  for (let pid in state.balls) {
    const playerEl = state.balls[pid];
    if (playerEl.body && playerEl.body.position) {
      const vec = playerEl.body.position;
      secretPosMap[pid] = {
        x: vec.x,
        y: vec.y,
        z: vec.z
      };
    }
  }
}, 500);

function getPos(playerId) {
  if (playerId in secretPosMap) {
    return secretPosMap[playerId];  
  }
  console.error(`Body for ${playerId} not yet loaded.`);
  return null;
}

function waitForAllBallsToStop(callback) {
  const stopped = 0.5;
  const interval = setInterval(() => {
    let stillMoving = false;
    // Check all balls to see if even one is still moving.
    for (let pid in state.balls) {
      const playerEl = state.balls[pid];
      const vel = playerEl.body.velocity;
      if (Math.abs(vel.x) > stopped || Math.abs(vel.y) > stopped || Math.abs(vel.z) > stopped) {
        stillMoving = true;
        break;
      }
    }
    // If not a single ball is still moving, run callback.
    if (!stillMoving) {
      clearInterval(interval);
      if (callback) {
        callback();
      }
    }
  }, 500);
}

const vector = document.getElementById('vector');

function displayVector(aim) {
  const k = 0.5;
  const { fx, fy, fz, vx, vy, vz } = aim;
  let vec = new CANNON.Vec3(vx, vy, vz);
  const mag = vec.norm();
  vec.normalize();
  vec = vec.mult(Math.sqrt(mag));
  vector.setAttribute('visible', true);
  vector.setAttribute('line', `start: ${fx} ${fy} ${fz}; end: ${fx+vec.x} ${fy} ${fz+vec.z}; color: #000`);
}

function hideVector() {
  vector.setAttribute('visible', false);
}

// https://github.com/schteppe/cannon.js/issues/215
function resetBody(body) {
  // Position
  body.position.setZero();
  body.previousPosition.setZero();
  body.interpolatedPosition.setZero();
  body.initPosition.setZero();

  // orientation
  body.quaternion.set(0,0,0,1);
  body.initQuaternion.set(0,0,0,1);
  body.previousQuaternion.set(0,0,0,1);
  body.interpolatedQuaternion.set(0,0,0,1);

  // Velocity
  body.velocity.setZero();
  body.initVelocity.setZero();
  body.angularVelocity.setZero();
  body.initAngularVelocity.setZero();

  // Force
  body.force.setZero();
  body.torque.setZero();

  // Sleep state reset
  body.sleepState = 0;
  body.timeLastSleepy = 0;
  body._wakeUpAfterNarrowphase = false;
}

const announceEl = document.getElementById('announce');

function announce(text) {
  announceEl.innerText = text;  
}

// Code for different surfaces
// console.log(CANNON);

// const world = new CANNON.World();

// const grassMaterial = new CANNON.Material('grassMaterial');
// const sandMaterial = new CANNON.Material('sandMaterial');
// const ballMaterial = new CANNON.Material('ballMaterial');

// const ballGrassCM = new CANNON.ContactMaterial(ballMaterial, grassMaterial, {
//   friction: 0.1
// });

// const ballSandCM = new CANNON.ContactMaterial(ballMaterial, sandMaterial, {
//   friction: 10
// });

// world.addContactMaterial(grassMaterial);
// world.addContactMaterial(sandMaterial);
// world.addContactMaterial(ballMaterial);

}

// Custom A-Frame Components

AFRAME.registerComponent('spinning-trap', {
  schema: {
    direction: { type: 'number', default: 1 },
    rate: { type: 'number', default: 0.5 }
  },
  tick: function (time, timeDelta) {
    const { direction, rate } = this.data;
    const rot = this.el.getAttribute('rotation');
    const out = {
      ...rot,
      y: (rot.y + (direction * rate) % 360)
    };
    this.el.setAttribute('rotation', out);
  }
});

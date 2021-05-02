/* global THREE */
/* global Ammo */
/* global AmmoDebugDrawer */
/* global firebase */
/* global loadCourse */
/* global HOLES */

// ---- init firebase ----
function getParam(url, tag) {
  if (url.indexOf(`${tag}=`) > -1) {
    return url.split(`${tag}=`)[1].split('&')[0];
  }
  return null;
}

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

// ---- game state variables ---

let latestTimestamp = 0;

let defaultPos = {x: 1, y: 0.5, z: 1};
let state = {
  currentPlayer: null,
  latest: {},
  players: {},
  positions: {},
  order: {},
  balls: {},
};

// ---- init three.js ----
const clock = new THREE.Clock();

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const controls = new THREE.FirstPersonControls(camera, renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x999999);
const loader = new THREE.GLTFLoader();
const raycaster = new THREE.Raycaster();
const raycastMouse = new THREE.Vector2();


const interactables = [];
const rigidBodies = [];

let physicsWorld;
let tmpTransform;
let debug;

let ballRef;

// const platform = 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2FMonkey.glb?v=1616882973713';
// const platform = 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fplatform.glb?v=1616914522717';
const platform = 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Ftriangle1.glb?v=1617076191201';

const matrix = [
  {x: 1, y: 2, z: 1},
  {x: 0, y: 0, z: 0},
  {x: 1, y: 1, z: 1},
];

// Ammo.js initialization
Ammo().then( start );

function start() {
  initDatabase();
  tmpTransform = new Ammo.btTransform();
  setupPhysics();
  setupGraphics();
  
  // loadGLB(platform, ...matrix);
  
  
  // createBall();
  // createHole();
  
  // setupContactCallback();
  
  // registerEventListener();
  // animate();
}

const helper = createHelper();

async function initCourse(courseId) {
  await loadCourse(courseId, HOLES[courseId] || {}, helper);
  // debug.disable();
  debug.enable();
  setupContactCallback();
  registerEventListener();
  animate();
}

function initDatabase() {
  // route back to lobby when host changes course
  db.ref(`rooms/${roomCode}/started`).on('value', (startSnap) => {
    if (!startSnap.val()) {
      localStorage.setItem('minigolf_temp_room_id', roomCode);
      document.location = './lobby';
    }
  });
  
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
    db.ref(`rooms/${roomCode}`).once('value', async (lobbySnap) => {
      const lobbyVal = lobbySnap.val() || {};
      await initCourse(lobbyVal.hole);
      state.players = lobbyVal.players || {};
      let i = 0;
      for (let pid in state.players) {
        state.order[pid] = i;
        i++;
      }
      if (myPlayerId in state.players) {
        updateDefaultPos(state.order[myPlayerId], Object.keys(state.players).length);
      }
      initRoomListeners();
    });
    
    function initRoomListeners() {
  
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
            createBall(playerId, pos);
          }
          const playerBall = state.balls[playerId];
          resetBody(playerBall);
          resetPosition(playerBall, pos);
        }
        // Announce your ball position to the room
        if (!(myPlayerId in roomPosMap) || !ballRef) {
          createBall(myPlayerId, defaultPos);
          resetBody(ballRef);
          resetPosition(ballRef, defaultPos);
          // reset position here?
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
          displayShotVector(aimVal);
        } else {
          hideShotVector();
        }
      });

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
            console.log(`Lost connection to ${state.currentPlayer}.`);
            announce(`Lost connection to ${state.players[state.currentPlayer].name}.`);
            state.currentPlayer = null;
          }
        }
      });
    
    }
  
  });
}

// ---- Firebase helper functions ----

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

// ---- Game helper functions ----

function updateDefaultPos(order, nPlayers) {
  defaultPos.x = order - (nPlayers / 2) + 0.5;
}

function updateState(e) {
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
    // console.log(`${e.playerId} join ${e.timestamp}`);
  }
  if (e.type === 'shot_ball') {
    if (e.timestamp > latestTimestamp) {
      const playerBall = state.balls[e.playerId];
      resetBody(playerBall);
      resetPosition(playerBall, { x: e.px, y: e.py, z: e.pz });
      applyImpulse(playerBall, { x: e.x, y: e.y, z: e.z });
    }
  }
}

const announceEl = document.getElementById('announce');

function announce(text) {
  announceEl.innerText = text;  
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

// ---- Three js functions ----

// load blender objects
function loadGLB(data) {
  console.log(data);
  let fileURL = data.assetUrl;
  let position = data.position;
  let rotation = data.rotation;
  let scale = data.scale;
  // ref to the mesh object
  let mesh;
  loader.load(
    // GLTF/GLB mesh URL
    fileURL,
    // callback when mesh is loaded
    function (glb) {
      mesh = glb.scene;
      mesh.position.set(position.x, position.y, position.z);
      mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      mesh.scale.set(scale.x, scale.y, scale.z);
      scene.add(mesh);
      // console.log(mesh);
      // addPhysics(mesh, 'convex', 'static');
      addTriangleMesh(mesh);
    }
  )
}


function setupPhysics() {
  const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  const overlappingPairCache = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
  physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));
  physicsWorld.debugDrawWorld();
  debug = new THREE.AmmoDebugDrawer(scene, physicsWorld, { debugDrawMode: 3 });
  debug.enable();
}

function setupGraphics() {
  // initial camera location
  camera.position.z = 14;
  camera.position.y = 8;
  camera.position.x = 0;
  // camera.rotation.y = Math.PI / 2;
  camera.rotateX(- Math.PI / 4);
  // controls.listenToKeyEvents( window );
  
  // renderer settings
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0.0);
  document.body.appendChild(renderer.domElement);

  // scene lighting
  scene.add(ambientLight);
  const lights = [];
  lights[0] = new THREE.DirectionalLight(0xffffff, 0.5);
  lights[0].position.set(1, 0, 0);
  lights[1] = new THREE.DirectionalLight(0x11E8BB, 0.5);
  lights[1].position.set(0.75, 1, 0.5);
  lights[2] = new THREE.DirectionalLight(0x8200C9, 0.5);
  lights[2].position.set(-0.75, -1, 0.5);
  scene.add(lights[0]);
  scene.add(lights[1]);
  scene.add(lights[2]);
  
  // draw aiming lines
  const shotMaterial = new THREE.LineBasicMaterial( { color: 0x0000ff } );
  const shotPoints = [new THREE.Vector3( -10, 0, 0 ), new THREE.Vector3( 0, 10, 0 )];
  const shotGeometry = new THREE.BufferGeometry().setFromPoints( shotPoints );
  lineObj = new THREE.Line( shotGeometry, shotMaterial );
  hideShotVector()
  scene.add( lineObj );
  
  // Not in use at the moment - use to debug raycast click from camera to click location
  const selectMaterial = new THREE.LineBasicMaterial( { color: 0xaaaaaa } );
  const selectPoints = [new THREE.Vector3(), new THREE.Vector3()];
  const selectGeometry = new THREE.BufferGeometry().setFromPoints( selectPoints );
  raycastLine = new THREE.Line( selectGeometry, selectMaterial );
  hideSelectVector();
  scene.add( raycastLine );
}

function addTriangleMesh(mesh) {
  // An object's geometry attributes are store with respect to the orgin
  // w/o any position/rotation/scale vector applied to it
  const getObjectTransformOffset = (x, y, z) => {
    let vertex = [x, y, z];
    vertex[0] *= mesh.scale.x;
    vertex[1] *= mesh.scale.y;
    vertex[2] *= mesh.scale.z;
    vertex[0] += mesh.position.x;
    vertex[1] += mesh.position.y;
    vertex[2] += mesh.position.z;
    return vertex;
  }
  
  let physicsMesh = new Ammo.btTriangleMesh(true, true);
  
  const vertexPos = mesh.children[0].geometry.attributes.position.array;
  const indexArray = mesh.children[0].geometry.index.array;
  let tmpTriangle = [];
  
  for (let i = 0; i < indexArray.length; i++) {
    let idx = indexArray[i];
    let vertex = getObjectTransformOffset(vertexPos[3*idx], vertexPos[3*idx+1], vertexPos[3*idx+2]);
    
    tmpTriangle.push(new Ammo.btVector3(...vertex));
    if (tmpTriangle.length === 3) {
      physicsMesh.addTriangle(tmpTriangle[0], tmpTriangle[1], tmpTriangle[2]);
      tmpTriangle = [];
    }
  }
  
  let meshCollider = new Ammo.btBvhTriangleMeshShape(physicsMesh, true, true);
  
  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(0, 0, 0));

  let mass = 0;
  let localInertia = new Ammo.btVector3(0, 0, 0);
  meshCollider.calculateLocalInertia(mass, localInertia);

  let motionState = new Ammo.btDefaultMotionState(transform);
  let rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, meshCollider, localInertia);
  let body = new Ammo.btRigidBody(rigidBodyInfo);
  physicsWorld.addRigidBody(body);
  body.activate();
  
}

function addPhysics(mesh, shape, type) {
  // console.log(`Adding physics for ${type} object of shape ${shape}`);
  let position = mesh.position.clone();
  let scale = mesh.scale.clone();
  let quaternion = {x: 0, y: 0, z: 0, w: 1};
  let mass = 1;
  
  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin( new Ammo.btVector3(position.x, position.y, position.z) );
  transform.setRotation( new Ammo.btQuaternion( quaternion.x, quaternion.y, quaternion.z, quaternion.w ) );
  let motionState = new Ammo.btDefaultMotionState( transform );
  
  
  let colliderShape;
  // console.log(shape);
  if (shape == 'convex') {
    // console.log(mesh.children[0])
    colliderShape = new Ammo.btConvexHullShape();
    let childMesh = mesh.children[0];
    if (childMesh.geometry.isBufferGeometry) {
      const vertPos = childMesh.geometry.attributes.position;
      const tempVec = new THREE.Vector3();
      for ( let i = 0, l = vertPos.count; i < l; i ++ ) {
        tempVec.fromBufferAttribute( vertPos, i );
        tempVec.applyMatrix4( childMesh.matrixWorld );
        colliderShape.addPoint(new Ammo.btVector3(tempVec.x, tempVec.y, tempVec.z));
      }
    }
  }
  else if (shape == 'plane') {
    colliderShape = new Ammo.btBoxShape( new Ammo.btVector3( 3*mesh.scale.x, 2*mesh.scale.y, 3*mesh.scale.z ) );  
    // colliderShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(scale.x, scale.y, scale.z ), 0);
  } else if (shape == 'sphere') {
    colliderShape = new Ammo.btSphereShape( scale.x ); // takes radius
  } else {
    // console.log(`Could not find a collider for the shape ${shape}`);
  }
  
  let localInertia = new Ammo.btVector3( 0, 0, 0 );
  if (type == 'dynamic') {
    colliderShape.calculateLocalInertia( mass, localInertia );  
  } else if (type == 'static') {
    colliderShape.calculateLocalInertia( 0, localInertia );  
  } else {
    // console.log(`Could not find inertia information for ${type} type`);
  }
  
  let rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colliderShape, localInertia );
  let body = new Ammo.btRigidBody( rigidBodyInfo );
  
  
  if (type == 'static') {
    body.setFriction(4);
    body.setRollingFriction(10);
    physicsWorld.addCollisionObject(body);
    body.activate();
  }
  
  // make circular reference - lolz
  mesh.userData.physicsBody = body;
  body.threeObject = mesh;
  
  if (type == 'dynamic') {
    body.setRollingFriction(0.0025);
    rigidBodies.push(mesh); 
    physicsWorld.addRigidBody( body );
    body.activate();
  }
  
  // console.log(mesh);
  // console.log(mesh.position);
  // console.log(mesh.scale);
  // console.log(mesh.quaternion);
  
  return body;
};

function setBallSpawn(newDefaultPos) {
  defaultPos = newDefaultPos;
}

function createHelper() {
  return {
    loadGLB,
    addToScene,
    setBallSpawn,
    createHole,
    showDebug: (flag) => {
      if (flag) {
        debug.enable();
      } else {
        debug.disable();
      }
    }
  };
}

function addToScene(data) {
  addToSceneOnParent(data);
}

function addToSceneOnParent(data, parent=null, parentData=null){
  if (data.isBlock) {
    
    const { position, scale } = data;
    
    let mass = 0;
    
    //threeJS Section
    let blockPlane = new THREE.Mesh(
      new THREE.BoxBufferGeometry(),
      new THREE.MeshPhongMaterial({ color: data.color })
    );

    blockPlane.position.set(position.x, position.y, position.z);
    blockPlane.scale.set(scale.x, scale.y, scale.z);
    
    const euler = data.rotation;
    const eulerAngle = new THREE.Euler(euler.x, euler.y, euler.z, 'XYZ');
    let motionAngle = eulerAngle;
    blockPlane.quaternion.setFromEuler(eulerAngle);

    blockPlane.castShadow = true;
    blockPlane.receiveShadow = true;

    if (parent) {
      parent.add(blockPlane);
    } else {
      scene.add(blockPlane);
    }
  
    if (data.isRigidBody) {
      
      if (parent) {
        parent.updateMatrixWorld();
      }
      
      //Ammojs Section
      let transform = new Ammo.btTransform();
      transform.setIdentity();

      let p = new THREE.Vector3();
      blockPlane.getWorldPosition(p);
      transform.setOrigin( new Ammo.btVector3( p.x, p.y, p.z ) );  

      let q = new THREE.Quaternion();
      blockPlane.getWorldQuaternion(q);
      transform.setRotation( new Ammo.btQuaternion( q.x, q.y, q.z, q.w ) );
      let motionState = new Ammo.btDefaultMotionState( transform );        
      
      let colShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
      colShape.setMargin( 0.05 );

      let localInertia = new Ammo.btVector3( 0, 0, 0 );
      colShape.calculateLocalInertia( mass, localInertia );

      let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
      let body = new Ammo.btRigidBody( rbInfo );

      body.setFriction(4);
      body.setRollingFriction(10);

      physicsWorld.addRigidBody( body );
      
    }
    
  }
  
  if (data.isGroup && data.children) {
    const { position, scale } = data;
    const euler = data.rotation;
    
    const group = new THREE.Group();
    group.position.set(position.x, position.y, position.z);
    // group.scale.set(scale.x, scale.y, scale.z);
    let eulerAngle = new THREE.Euler(euler.x, euler.y, euler.z, 'XYZ');
    group.quaternion.setFromEuler(eulerAngle);
    
    data.children.forEach((childData) => {
      addToSceneOnParent(childData, group, data);
    });
    
    scene.add(group);
  }
}

function createHole(data) {
  // let position = {x: 0, y: -.4, z: 4};
  // let scale = {x: 40, y: .1, z: 40};
  // let quaternion =  {x: 0, y: 0, z: 0, w: 1};
  const { position, scale } = data;
  let mass = 0;
  
  //threeJS Section
  let blockPlane = new THREE.Mesh(
    new THREE.BoxBufferGeometry(),
    new THREE.MeshBasicMaterial({color: 0x000000})
  );

  blockPlane.position.set(position.x, position.y - 0.4, position.z);
  blockPlane.scale.set(scale.x, scale.y, scale.z);

  blockPlane.castShadow = true;
  blockPlane.receiveShadow = true;

  scene.add(blockPlane);
  
  scene.updateWorldMatrix();

  //Ammojs Section
  let transform = new Ammo.btTransform();
  transform.setIdentity();
  
  let p = new THREE.Vector3();
  blockPlane.getWorldPosition(p);
  transform.setOrigin( new Ammo.btVector3( p.x, p.y, p.z ) );  
  // transform.setOrigin( new Ammo.btVector3( position.x, position.y, position.z ) );
  
  let q = new THREE.Quaternion();
  blockPlane.getWorldQuaternion(q);
  transform.setRotation( new Ammo.btQuaternion( q.x, q.y, q.z, q.w ) );
  let motionState = new Ammo.btDefaultMotionState( transform );
  // transform.setRotation( new Ammo.btQuaternion( quaternion.x, quaternion.y, quaternion.z, quaternion.w ) );

  let colShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
  colShape.setMargin( 0.05 );

  let localInertia = new Ammo.btVector3( 0, 0, 0 );
  colShape.calculateLocalInertia( mass, localInertia );

  let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
  let body = new Ammo.btRigidBody( rbInfo );

  body.setFriction(4);
  body.setRollingFriction(10);

  physicsWorld.addRigidBody( body );
  
  blockPlane.userData.tag = 'hole';
  // make circular reference
  blockPlane.userData.physicsWorld = body;
  body.threeObject = blockPlane;
  
  // Add ring around hole
  {
    const geometry = new THREE.RingGeometry(0.45, 0.75, 32);
    const material = new THREE.MeshPhongMaterial({ color: data.color, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geometry, material);
    const { x, y, z } = position;
    ring.position.set(x, y + 0.05, z);
    ring.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ'));
    scene.add(ring);
  }
  
  // Add flag pole in hole
  {
    const geometry = new THREE.CylinderGeometry(0.025, 0.025, 5, 32);
    const material = new THREE.MeshBasicMaterial({ color: 'white' });
    const pole = new THREE.Mesh(geometry, material);
    const { x, y, z } = position;
    pole.position.set(x, y + 2.5, z);
    scene.add(pole);
  }
  
  // Add flag triangle on pole
  {
    const geometry = new THREE.Geometry();
    const triangle = new THREE.Triangle(
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(-0.25, -0.5, 0),
      new THREE.Vector3(0.25, -0.5, 0)
    );
    let normal = new THREE.Vector3();
    triangle.getNormal(normal);
    geometry.vertices.push(triangle.a);
    geometry.vertices.push(triangle.b);
    geometry.vertices.push(triangle.c);
    geometry.faces.push(new THREE.Face3(0, 1, 2, normal));
    const material = new THREE.MeshBasicMaterial({ color: '#EE6C4D', side: THREE.DoubleSide });
    const flag = new THREE.Mesh(geometry, material);
    const { x, y, z } = position;
    flag.position.set(x + 0.5, y + 4.75, z);
    flag.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / -2, 'XYZ'));
    scene.add(flag);
  }
  
}

function createBall(playerId, pos) {
  let position = new THREE.Vector3(pos.x, pos.y, pos.z);
  let radius = 1;
  let mass = 1;
  
  // Three.js
  let ball = new THREE.Mesh(
    new THREE.SphereBufferGeometry(1),
    new THREE.MeshPhongMaterial({ color: state.players[playerId].color })
  );

  ball.position.set(position.x, position.y, position.z);
  ball.scale.set(radius*.25, radius*.25, radius*.25);
  
  ball.castShadow = true;
  ball.receiveShadow = true;
  
  ball.userData.tag = 'ball';
  ball.userData.playerId = playerId;
  scene.add(ball);
  
  // for click events
  interactables.push(ball);
  if (playerId === myPlayerId) {
    ballRef = ball;  
  }
  
  // Ammo.js - needs refactor
  addPhysics(ball, 'sphere', 'dynamic');
  
  state.balls[playerId] = ball;
}

function updatePhysics(deltaTime) {

  physicsWorld.stepSimulation(deltaTime, 10);

  for ( let i = 0; i < rigidBodies.length; i++ ) {
    let objThree = rigidBodies[i];
    let objAmmo = objThree.userData.physicsBody;
    let ms = objAmmo.getMotionState();
    if ( ms ) {
      ms.getWorldTransform( tmpTransform );
      let p = tmpTransform.getOrigin();
      let q = tmpTransform.getRotation();
      objThree.position.set( p.x(), p.y(), p.z() );
      objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
    }
  }

}

function animate() {
  let deltaTime = clock.getDelta();
  updatePhysics(deltaTime);
  renderer.render( scene, camera );
  controls.update(deltaTime);
  requestAnimationFrame( animate );
  debug.update();
};

// rewrite a separate function for static plane physics that works - not sure why
function addPlane(mesh) {
  let pos = mesh.position.clone();

  let up = new THREE.Vector3(0, 1, 0);
  let output = up.applyQuaternion(mesh.quaternion);
  output.normalize();

  let shape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(output.x, output.y, output.z), 0);

  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));

  let mass = 0;
  let localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(mass, localInertia);

  let motionState = new Ammo.btDefaultMotionState(transform);
  let rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  let body = new Ammo.btRigidBody(rigidBodyInfo);
  // this.addBodyPhysicsConfig(body, "plane");
  physicsWorld.addRigidBody(body);//, this.groupPlane, this.maskPlane);
  body.activate();

  return body;
}

let mouseDown = false, mouseEventA, mouseEventB, mouseEvent, lineObj, raycastLine;

function onMouseDown(event) {
  const freeToShoot = state.currentPlayer === null;
  if (!freeToShoot) { return }
  
  // sets the mouse position with a coordinate system where the center of the screen is the origin
  raycastMouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  raycastMouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  // set the picking ray from the camera position and mouse coordinates
  raycaster.setFromCamera( raycastMouse, camera );

  var intersects = raycaster.intersectObjects( interactables );

  for ( var i = 0; i < intersects.length; i++ ) {
    // console.log(intersects);
    if (intersects[i].object.uuid === ballRef.uuid) {
      // controls.enabled = false;
      mouseDown = true;
      mouseEventA = event;
      // intersects[i].object.material.color.set( 0x0000ff );
      // applyImpulse(intersects[i].object);
      pushEventToRoom({ type: 'started_shot' });
      break;
    }
    /*
      An intersection has the following properties :
        - object : intersected object (THREE.Mesh)
        - distance : distance from camera to intersection (number)
        - face : intersected face (THREE.Face3)
        - faceIndex : intersected face index (number)
        - point : intersection point (THREE.Vector3)
        - uv : intersection point in the object's UV coordinates (THREE.Vector2)
    */
  }
}

function onMouseMove(event) {
  mouseEvent = event;
  if (mouseDown) {
    controls.enabled = false;
    const vec = getShotVector(mouseEventA, mouseEvent);
    const mag = Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.z, 2));
    const isValidShot = mag >= 0.1;
    if (isValidShot) {
      const { x, y, z } = ballRef.position;
      pushAimToRoom({ x, y, z }, vec);
    } else {
      releaseAimFromRoom();
    }
  }
}

function onMouseUp(event) {
  if (mouseDown) {
    controls.enabled = true;
    mouseDown = false;
    mouseEventB = mouseEvent;
    const vec = getShotVector(mouseEventA, mouseEventB);
    const mag = Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.z, 2));
    releaseAimFromRoom();
    const isValidShot = mag >= 0.1;
    if (!isValidShot) {
      pushEventToRoom({ type: 'cancelled_shot' });
      return;
    }
    const { x, y, z } = ballRef.position.clone();
    const se = {
      type: 'shot_ball',
      x: vec.x,
      y: vec.y,
      z: vec.z,
      px: x,
      py: y,
      pz: z,
      ix: x,
      iy: y,
      iz: z
    };
    pushEventToRoom(se);
    resetBody(ballRef);
    resetPosition(ballRef, { x, y, z });
    applyImpulse(ballRef, vec);
    hideShotVector();
    waitForAllBallsToStop(() => {
      // console.log('All balls at rest after shot by', myPlayerId, 'at', Date.now());
      for (let pid in state.balls) {
        const playerBall = state.balls[pid];
        const { x, y, z } = playerBall.position;
        pushPositionToRoom(pid, { x, y, z });
        resetBody(playerBall);
        resetPosition(playerBall, { x, y, z });
      }
      pushEventToRoom({ type: 'finished_shot' });
      checkContact();
    });
  }
}

function registerEventListener() {
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  
  window.addEventListener('resize', onWindowResize);
  
  document.addEventListener('keydown', (e) => {
    // Place ball back at starting point
    if (e.code === 'KeyP' || e.key === 'p') {
      resetBody(ballRef);
      resetPosition(ballRef, defaultPos);
      pushPositionToRoom(myPlayerId, {
        x: defaultPos.x,
        y: defaultPos.y,
        z: defaultPos.z
      });
    }
    // Teleport to my ball
    if (e.code === 'KeyT' || e.key === 't') {
      const { x, y, z } = ballRef.position;
      camera.position.set(x, y + 5, z + 4);
    }
    if (e.code === 'Space' || e.key === ' ') {
      // isAiming = false;
      mouseDown = false;
      // camera.setAttribute('look-controls', { enabled: true });
      releaseAimFromRoom();
      pushEventToRoom({
        type: 'cancelled_shot'
      });
      // console.log('Cancelled shot.');
    }
    if (e.code === 'KeyK' || e.key === 'k') {
      // useLoopShotInteraction = !useLoopShotInteraction;
      // localStorage.setItem('minigolf_use_loop_shot', useLoopShotInteraction);
      // const newShootMode = useLoopShotInteraction
      //   ? 'Hold space bar, then release.'
      //   : 'Pull on ball, then release.';
      // toggleShootEl.innerText = `To Putt: ${newShootMode}`;
    }
  });
}

function waitForAllBallsToStop(callback) {
  const interval = setInterval(() => {
    let stillMoving = false;
    // Check all balls to see if even one is still moving.
    for (let pid in state.balls) {
      const playerBall = state.balls[pid];
      if (playerBall.userData.physicsBody.isActive()) {
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

const MIN_VALID_DIST = 5;
const MAX_MAG = 90;

function getShotVector(posA, posB) {
  const k = 0.2;
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
  const theta = controls.camera.rotation.z;
  const dir = {
    x: (drag.x * Math.cos(theta)) + (drag.z * Math.sin(theta)),
    y: drag.y,
    z: (-1 * drag.x * Math.sin(theta)) + (drag.z * Math.cos(theta))
  };
  // Ignore this attempt to scale down the magnitude
  const maxMag = 65;

  const vec = new THREE.Vector3(dir.x, dir.y, dir.z);
  
  // increase grainularity by allowing user to drag longer before reaching the max length
  // vec.multiplyScalar(0.05);
  // clamp the length/magnitude of the vector
  // vec.clampLength(0.5, 20);
  
  const mag = (vec.length()) - MIN_VALID_DIST;
  vec.normalize();
  const out = vec.multiplyScalar(k * Math.min(Math.max(0, mag), MAX_MAG));

  return out;
}

function displayShotVector(aim) {
  const from = new THREE.Vector3(aim.fx, aim.fy, aim.fz);
  const to = new THREE.Vector3(aim.fx + aim.vx, aim.fy + aim.vy, aim.fz + aim.vz);
  
  lineObj.geometry.setFromPoints([from, to])  
  lineObj.visible = true;
}

function hideShotVector() {
  lineObj.visible = false;
}

function hideSelectVector() {
  raycastLine.visible = false;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function resetPosition(ball, position) {
  if ('userData' in ball && 'physicsBody' in ball.userData) {
    let quaternion = {x: 0, y: 0, z: 0, w: 1};
    let transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3(position.x, position.y, position.z) );
    transform.setRotation( new Ammo.btQuaternion( quaternion.x, quaternion.y, quaternion.z, quaternion.w ) );
    // let motionState = new Ammo.btDefaultMotionState( transform );  
    ball.userData.physicsBody.setWorldTransform(transform);
    ball.userData.physicsBody.activate();
  }
}

function resetBody(ball) {
  if ('userData' in ball && 'physicsBody' in ball.userData) {
    ball.userData.physicsBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    ball.userData.physicsBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
  }
}

function applyImpulse(body, force) {
  if ('physicsBody' in body.userData) {
    let forceVector = new Ammo.btVector3(force.x, force.y, force.z);
    body.userData.physicsBody.activate();
    body.userData.physicsBody.applyCentralImpulse(forceVector);
  } else {
    // console.log('Cannot find physics body of the given mesh');
  }
}

// collision contact
let contactResult;
function setupContactCallback() {
  contactResult = new Ammo.ConcreteContactResultCallback();
  contactResult.result = false;
  contactResult.addSingleResult = function(contactPt, collisionObj0Wrap, partId0, index0, collisionObj1Wrap, partId1, index1) {
    const contactPoint = Ammo.wrapPointer(contactPt, Ammo.btManifoldPoint);
    const distance = contactPoint.getDistance();
    if (distance > 0) return;
    
    const collisionWrapper0 = Ammo.wrapPointer(collisionObj0Wrap, Ammo.btCollisionObjectWrapper);
    const rigidbody0 = Ammo.castObject(collisionWrapper0.getCollisionObject(), Ammo.btRigidBody);
    
    const collisionWrapper1 = Ammo.wrapPointer(collisionObj1Wrap, Ammo.btCollisionObjectWrapper);
    const rigidbody1 = Ammo.castObject(collisionWrapper1.getCollisionObject(), Ammo.btRigidBody);
    
    if ('threeObject' in rigidbody0 && 'threeObject' in rigidbody1) {
      const threeObject0 = rigidbody0.threeObject;
      const threeObject1 = rigidbody1.threeObject;

      let tag, localPosition, worldPosition;
      
      if (threeObject0.userData.tag == 'ball' && threeObject1.userData.tag == 'hole') {
      	console.log('Ball is in the hole!');
        pushEventToRoom({ type: 'completed_hole' });
        contactResult.result = true;
        tag = threeObject0.userData.tag;
			  localPosition = contactPoint.get_m_localPointA();
			  worldPosition = contactPoint.get_m_positionWorldOnA();
      }
      else if (threeObject0.userData.tag == 'ball' && threeObject1.userData.tag == 'hole') {
        contactResult.result = true;
        tag = threeObject1.userData.tag;
        localPosition = contactPoint.get_m_localPointB();
        worldPosition = contactPoint.get_m_positionWorldOnB();
      }
      const localPositionDisplay = {x: localPosition.x(), y: localPosition.y(), z: localPosition.z()};
      const worldPositionDisplay = {x: worldPosition.x(), y: worldPosition.y(), z: worldPosition.z()};

      // console.log( { tag, localPositionDisplay, worldPositionDisplay } );
    }
  }
}

function checkContact() {
  physicsWorld.contactTest( ballRef.userData.physicsBody , contactResult );
}
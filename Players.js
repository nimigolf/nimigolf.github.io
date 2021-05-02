/* global THREE */
/* global Ammo */


function Players(cameraRef, threeScene, sceneRenderer, physicsWorld) {
  
  const rollingFriction = 0.0025;
  const ballRadius = 0.25;
  const ballMass = 1;
  
  const allPlayers = {};

  let currentPlayer;
  
  
  const aimMaterial = new THREE.LineBasicMaterial( { color: 0x0000ff } );
  const aimPoints = [new THREE.Vector3( -10, 0, 0 ), new THREE.Vector3( 0, 10, 0 )];
  const aimGeometry = new THREE.BufferGeometry().setFromPoints( aimPoints );
  const aimLine = new THREE.Line( aimGeometry, aimMaterial );
  threeScene.add(aimLine);
  
  
  function createBall(playerId) {
    let position = {x: 1, y: 5, z: 1};

    // Three.js
    let ball = new THREE.Mesh(new THREE.SphereBufferGeometry(1), new THREE.MeshPhongMaterial({color: 0xff0505}));

    ball.position.set(position.x, position.y, position.z);
    ball.scale.set(ballRadius, ballRadius, ballRadius);

    ball.castShadow = true;
    ball.receiveShadow = true;

    threeScene.add(ball);
    
    return ball;
  }
  
  function addPhysics(mesh) {
    let position = mesh.position.clone();
    let scale = mesh.scale.clone();
    let quaternion = {x: 0, y: 0, z: 0, w: 1};

    let transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3(position.x, position.y, position.z) );
    transform.setRotation( new Ammo.btQuaternion( quaternion.x, quaternion.y, quaternion.z, quaternion.w ) );
    let motionState = new Ammo.btDefaultMotionState( transform );

    const localInertia = new Ammo.btVector3( 0, 0, 0 );
    const colliderShape = new Ammo.btSphereShape( ballRadius ); 
    colliderShape.calculateLocalInertia( ballMass, localInertia );  
    
    const rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo( ballMass, motionState, colliderShape, localInertia );
    const body = new Ammo.btRigidBody( rigidBodyInfo );
  
    body.setRollingFriction(rollingFriction);
    mesh.userData.physicsBody = body;
    physicsWorld.addRigidBody( body );
    body.activate();
    
    return body;
  };
  
  function displayShotVector(event) {
    let fromVec = currentPlayer.position.clone();
    let toVec = THREE
  }
  
  function onMouseDown(event) {
    
  }
  
  const api = {
    registerListener: () => {
      sceneRenderer.domElement.addEventListener('mousedown', onMouseDown);
      sceneRenderer.domElement.addEventListener('mouseup', onMouseUp);
      sceneRenderer.domElement.addEventListener('mousemove', onMouseMove);
    },
    getPlayers: () => allPlayers,
    addPlayer: (self, playerId) => {
      let player = createBall();
      addPhysics(player);
      if (self === true) {
        currentPlayer = player;
      }
      allPlayers[playerId ?? player.uuid] = player;
      return player;
    },
    aimingBall: (event) => {
      aimLine.visible = true;
      displayShotVector(event);
    },
    applyImpulse: (playerId) => {
      
    }
  }
}

function applyImpulse(body, force) {
  if ('physicsBody' in body.userData) {
    let forceVector = new Ammo.btVector3(force.x, force.y, force.z);
    body.userData.physicsBody.activate();
    body.userData.physicsBody.applyCentralImpulse(forceVector);
  } else {
    console.log('Cannot find physics body of the given mesh');
  }
}

function displayShotVector(aim) {
  const { x, y, z } = ballRef.position;
  let vec = new THREE.Vector3(x + aim.x, y + aim.y, z + aim.z);
  
  lineObj.geometry.setFromPoints([new THREE.Vector3(x, y, z), vec])  
  lineObj.visible = true;
}

function onMouseMove(event) {
  mouseEvent = event;
  if (mouseDown) {
    const vec = getShotVector(mouseEventA, mouseEvent);
    const mag = Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.z, 2));
    const isValidShot = mag >= 0.1;
    if (isValidShot) {
      displayShotVector(vec);
    } else {
      hideShotVector();
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
    const isValidShot = mag >= 0.1;
    applyImpulse(ballRef, vec);
    hideShotVector();
  }
}

function getShotVector(posA, posB) {
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
  const camRot = camera.rotation;
  const theta = (Math.PI * camRot.y) / 180;
  const dir = {
    x: (drag.x * Math.cos(theta)) + (drag.z * Math.sin(theta)),
    y: drag.y,
    z: (-1 * drag.x * Math.sin(theta)) + (drag.z * Math.cos(theta))
  };
  // Ignore this attempt to scale down the magnitude
  const maxMag = 65;

  const vec = new THREE.Vector3(dir.x, dir.y, dir.z);
  // increase grainularity by allowing user to drag longer before reaching the max length
  vec.multiplyScalar(0.05);
  // clamp the length/magnitude of the vector
  vec.clampLength(0.5, 20);

  return vec;
}
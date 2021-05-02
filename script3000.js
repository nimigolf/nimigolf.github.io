/* global THREE */
/* global Ammo */
/* global AmmoDebugDrawer */
/* */


const clock = new THREE.Clock();

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// const controls = new THREE.MapControls( camera, renderer.domElement );
// const controls = {};
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

const platform = 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2FMonkey.glb?v=1616882973713';
// const platform = 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fplatform.glb?v=1616914522717';
// const platform = 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Ftriangle1.glb?v=1617076191201';

const matrix = [
  {x: 1, y: 2, z: 1},
  {x: 0, y: 0, z: 0},
  {x: 1, y: 1, z: 1},
];

// Ammo.js initialization
Ammo().then( start );

function start() {
  tmpTransform = new Ammo.btTransform();
  setupPhysics();
  setupGraphics();
  
  loadGLB(platform, ...matrix);

  // createBlock();
  createCourse();
  
  createBall();
  createHole();
  
  setupContactCallback();
  
  registerEventListener();
  animate();
}

// load blender objects
function loadGLB(fileURL, position, rotation, scale) {
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
      console.log(mesh);
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

function createCourse() {
  let platform1 = [ {x: 0, y: 0, z: 4}, {x: 40, y: .1, z: 20}, {x: 0, y: 0, z: 0, w: 1} ];
  let platform2 = [ {x: 0, y: 0, z: -11}, {x: 40, y: .1, z: 8}, {x: 0, y: 0, z: 0, w: 1} ];
  let platform3 = [ {x: 10.25, y: 0, z: -6.5}, {x: 19.5, y: .1, z: 1}, {x: 0, y: 0, z: 0, w: 1} ];
  let platform4 = [ {x: -10.25, y: 0, z: -6.5}, {x: 19.5, y: .1, z: 1}, {x: 0, y: 0, z: 0, w: 1} ];
  let wall1 = [ {x: 0, y: 0.5 , z: -15}, {x: 40, y: 1, z: .9}, {x: 0, y: 0, z: 0, w: 1} ];
  let wall2 = [ {x: 20, y: 0.5, z: -0.5}, {x: .9, y: 1, z: 29}, {x: 0, y: 0, z: 0, w: 1} ];
  let wall3 = [ {x: -20, y: 0.5, z: -0.5}, {x: .9, y: 1, z: 29}, {x: 0, y: 0, z: 0, w: 1} ];
  let wall4 = [ {x: 0, y: 0.5, z: 14}, {x: 40, y: 1, z: .9}, {x: 0, y: 0, z: 0, w: 1} ];
  
  createBlock(...platform1);
  createBlock(...platform2);
  createBlock(...platform3);
  createBlock(...platform4);
  
  createBlock(...wall1);
  createBlock(...wall2);
  createBlock(...wall3);
  createBlock(...wall4);
}

function createHole() {
  let position = {x: 0, y: -.4, z: 4};
  let scale = {x: 40, y: .1, z: 40};
  let quaternion =  {x: 0, y: 0, z: 0, w: 1};
  let mass = 0;
  //threeJS Section
  let blockPlane = new THREE.Mesh(new THREE.BoxBufferGeometry(), new THREE.MeshPhongMaterial({color: 0x000000}));

  blockPlane.position.set(position.x, position.y, position.z);
  blockPlane.scale.set(scale.x, scale.y, scale.z);

  blockPlane.castShadow = true;
  blockPlane.receiveShadow = true;

  scene.add(blockPlane); 

  //Ammojs Section
  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin( new Ammo.btVector3( position.x, position.y, position.z ) );
  transform.setRotation( new Ammo.btQuaternion( quaternion.x, quaternion.y, quaternion.z, quaternion.w ) );
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
  
  blockPlane.userData.tag = 'hole';
  // make circular reference
  blockPlane.userData.physicsWorld = body;
  body.threeObject = blockPlane;
}

function addTriangleMesh(mesh) {
  // An object's geometry attributes are store with respect to the orgin
  // w/o any position/rotation/scale vector applied to it
  const getObjectTransformOffset = (x, y, z) => {
    let vertex = [x, y, z];
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
  console.log(`Adding physics for ${type} object of shape ${shape}`);
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
  console.log(shape);
  if (shape == 'convex') {
    console.log(mesh.children[0])
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
    console.log(`Could not find a collider for the shape ${shape}`);
  }
  
  let localInertia = new Ammo.btVector3( 0, 0, 0 );
  if (type == 'dynamic') {
    colliderShape.calculateLocalInertia( mass, localInertia );  
  } else if (type == 'static') {
    colliderShape.calculateLocalInertia( 0, localInertia );  
  } else {
    console.log(`Could not find inertia information for ${type} type`);
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
  
  console.log(mesh);
  console.log(mesh.position);
  console.log(mesh.scale);
  console.log(mesh.quaternion);
  
  return body;
};

function createBlock(position, scale, quaternion){
  let mass = 0;

  //threeJS Section
  let blockPlane = new THREE.Mesh(new THREE.BoxBufferGeometry(), new THREE.MeshPhongMaterial({color: 0xa0afa4}));

  blockPlane.position.set(position.x, position.y, position.z);
  blockPlane.scale.set(scale.x, scale.y, scale.z);

  blockPlane.castShadow = true;
  blockPlane.receiveShadow = true;

  scene.add(blockPlane); 

  //Ammojs Section
  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin( new Ammo.btVector3( position.x, position.y, position.z ) );
  transform.setRotation( new Ammo.btQuaternion( quaternion.x, quaternion.y, quaternion.z, quaternion.w ) );
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

function createBall() {
  let position = {x: 1, y: 5, z: 1};
  let radius = 1;
  let mass = 1;
  
  // Three.js
  let ball = new THREE.Mesh(new THREE.SphereBufferGeometry(1), new THREE.MeshToonMaterial({color: 0xff0505}));

  ball.position.set(position.x, position.y, position.z);
  ball.scale.set(radius*.25, radius*.25, radius*.25);
  
  ball.castShadow = true;
  ball.receiveShadow = true;
  
  ball.userData.tag = 'ball';
  
  scene.add(ball);
  console.log(ball);
  
  // for click events
  interactables.push(ball);
  ballRef = ball;
  
  // Ammo.js
  addPhysics(ball, 'sphere', 'dynamic');
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

function registerEventListener() {
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  
  // window.addEventListener('keydown', panControl);
  window.addEventListener('resize', onWindowResize);
}

let mouseDown = false, mouseEventA, mouseEventB, mouseEvent, lineObj, raycastLine;

function onMouseDown(event) {
  // sets the mouse position with a coordinate system where the center of the screen is the origin
  raycastMouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  raycastMouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  // set the picking ray from the camera position and mouse coordinates
  raycaster.setFromCamera( raycastMouse, camera );

  var intersects = raycaster.intersectObjects( interactables );

  for ( var i = 0; i < intersects.length; i++ ) {
    console.log(intersects);
    if (intersects[i].object.uuid === ballRef.uuid) {
      mouseDown = true;
      mouseEventA = event;
      intersects[i].object.material.color.set( 0x0000ff );
      // applyImpulse(intersects[i].object);
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

function displayShotVector(aim) {
  const { x, y, z } = ballRef.position;
  let vec = new THREE.Vector3(x + aim.x, y + aim.y, z + aim.z);
  
  lineObj.geometry.setFromPoints([new THREE.Vector3(x, y, z), vec])  
  lineObj.visible = true;
}

function displaySelectVector(clicked) {
  
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

// wasd non-smooth camera movements
function panControl(event) {
  if (event.key == 'w') {
    camera.position.z -= 1;
  }
  if (event.key == 'a') {
    camera.position.x -= 1;
  }
  if (event.key == 's') {
    camera.position.z += 1;
  }
  if (event.key == 'd') {
    camera.position.x += 1;
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

setTimeout(() => {
  console.log('Calling timeout');
}, 5000);

// collision contact
let contactResult;
function setupContactCallback() {
  contactResult = new Ammo.ConcreteContactResultCallback();
  contactResult.contact = false;
  contactResult.addSingleResult = function(contactPt, collisionObj0Wrap, partId0, index0, collisionObj1Wrap, partId1, index1) {
    contactResult.contact = false;
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
        contactResult.contact = true;
        tag = threeObject0.userData.tag;
			  localPosition = contactPoint.get_m_localPointA();
			  worldPosition = contactPoint.get_m_positionWorldOnA();
      }
      else if (threeObject1.userData.tag == 'ball' && threeObject0.userData.tag == 'hole') {
        console.log('Ball is in the hole!');
        contactResult.contact = true;
        tag = threeObject1.userData.tag;
        localPosition = contactPoint.get_m_localPointB();
        worldPosition = contactPoint.get_m_positionWorldOnB();
      }
      else {
        console.log('No contact');
      }
      const localPositionDisplay = {x: localPosition.x(), y: localPosition.y(), z: localPosition.z()};
      const worldPositionDisplay = {x: worldPosition.x(), y: worldPosition.y(), z: worldPosition.z()};

      console.log( { tag, localPositionDisplay, worldPositionDisplay } );
    }
  }
}

function checkContact() {
  physicsWorld.contactTest( ballRef.userData.physicsBody , contactResult );
}
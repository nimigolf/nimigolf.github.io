/* global THREE */

/*
  Modified from these scripts
  https://github.com/mrdoob/three.js/blob/master/examples/js/controls/PointerLockControls.js
  https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js
  https://stackoverflow.com/questions/43595101/how-can-i-move-the-camera-in-threejs-relative-to-perspective
*/

THREE.FirstPersonControls = function(camera, domElement) {
  if (domElement === undefined) console.warn( 'THREE.FirstPersonControls: The second parameter "domElement" is now mandatory.' );
	if (domElement === document) console.error( 'THREE.FirstPersonControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.' );
  
  this.camera = camera;
  this.domElement = domElement;
  this.panSpeed = 8;
  this.enabled = true;
  
  // allow nest function to access outer function scope
  const scope = this;
  const PI2 = Math.PI / 2;
  
  let move = {
    up: false,
    down: false,
    forward: false,
    backward: false,
    left: false,
    right: false,
    mouse: false,
  };
  
  let eulerAngle = new THREE.Euler(0, 0, 0, 'YXZ');
  let panVelocity = new THREE.Vector3();
  
  let prevTime = performance.now();
  let cameraDirection = new THREE.Vector3();
  
	this.update = function(deltaClock) {
    let time = performance.now();
    let deltaTime = deltaClock // ( time - prevTime ) / 1000;
    
    // console.log(`clock: ${deltaClock} vs delta: ${deltaTime}`);
    panVelocity.set(0,0,0);
    
    // allows diagonal movements e.g. if up and left key is both pressed
    let zRelAxis = new THREE.Vector3();
    let xRelAxis = new THREE.Vector3();
    
    if (move.forward) {
      zRelAxis.setFromMatrixColumn(this.camera.matrix, 0);
      zRelAxis.crossVectors(this.camera.up, zRelAxis);
      zRelAxis.addScaledVector(zRelAxis, this.panSpeed);
    } 
    if (move.backward) {
      zRelAxis.setFromMatrixColumn(this.camera.matrix, 0);
      zRelAxis.crossVectors(this.camera.up, zRelAxis);
      zRelAxis.addScaledVector(zRelAxis, -this.panSpeed);
    } 
    if (move.left) {
      xRelAxis.setFromMatrixColumn(this.camera.matrix, 0);
      xRelAxis.addScaledVector(xRelAxis, -this.panSpeed);
    } 
    if (move.right) {
      xRelAxis.setFromMatrixColumn(this.camera.matrix, 0);
      xRelAxis.addScaledVector(xRelAxis, this.panSpeed);
    }
    
    if (move.up) {
      panVelocity.y += 400 * deltaTime;
    } 
    else if (move.down) {
      panVelocity.y -= 400 * deltaTime;
    }
    
    panVelocity.z += zRelAxis.z + xRelAxis.z;
    panVelocity.x += zRelAxis.x + xRelAxis.x;
    
    let deltaVelocity = panVelocity.multiplyScalar(deltaTime).clone();
    this.camera.position.add(deltaVelocity);
    
    prevTime = time;
  }
  this.registerListener = function() {
    // mouse movement
    this.domElement.ownerDocument.addEventListener('mousedown', onMouseDown, true);
    this.domElement.ownerDocument.addEventListener('mousemove', onMouseMove, true);
    this.domElement.ownerDocument.addEventListener('mouseup', onMouseUp, true);
    
    // keyboard movement
    this.domElement.ownerDocument.addEventListener('keypress', onKeyPress, true);
    this.domElement.ownerDocument.addEventListener('keyup', onKeyUp, true);
    // this.domElement.ownerDocument.addEventListener('keydown', onKeyDown, true);
  };
  
  // this.dispose = function () {
  //   this.domElement.ownerDocument.removeEventListener('keypress', onKeyPress, true);
  //   this.domElement.ownerDocument.removeEventListener('keyup', onKeyUp, true);
  //   // this.domElement.ownerDocument.removeEventListener('keydown', onKeyDown, true);
  // };
  
  function onMouseDown(event) {
    move.mouse = true;
  };
  
  function onMouseMove(event) {
    if (!move.mouse || !scope.enabled) return;
    let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    
    eulerAngle.setFromQuaternion(camera.quaternion);
    
    eulerAngle.y -= movementX * 0.002;
    eulerAngle.x -= movementY * 0.002;
    
    // eulerAngle.x = Math.max(PI2 - scope.maxPolarAngle, Math.min(PI2 - scope.minPolarAngle, eulerAngle.x));
    
    camera.quaternion.setFromEuler(eulerAngle);
    
  };
  
  function onMouseUp(event) {
    move.mouse = false;
  };
  
  function onKeyPress(event) {
    if (event.key === 'w' || event.key === 'ArrowUp') {
      // setPanVelocity(2, scope.panSpeed);
      move.forward = true;
    }
    else if (event.key === 'a' || event.key === 'ArrowLeft') {
      // setPanVelocity(0, -scope.panSpeed);
      move.left = true;
    }
    else if (event.key === 's' || event.key === 'ArrowDown') {
      // setPanVelocity(2, -scope.panSpeed);
      move.backward = true;
    }
    else if (event.key === 'd' || event.key === 'ArrowRight') {
      // setPanVelocity(0, scope.panSpeed);
      move.right = true;
    }
    else if (event.key === 'e') {
      move.up = true;
    }
    else if (event.key === 'q') {
      move.down = true;
    }
  };
  
  function onKeyUp(event) {
    if (event.key === 'w' || event.key === 'ArrowUp') {
      move.forward = false;
    }
    else if (event.key === 'a' || event.key === 'ArrowLeft') {
      move.left = false;
    }
    else if (event.key === 's' || event.key === 'ArrowDown') {
      move.backward = false;
    }
    else if (event.key === 'd' || event.key === 'ArrowRight') {
      move.right = false;
    }
    else if (event.key === 'e') {
      move.up = false;
    }
    else if (event.key === 'q') {
      move.down = false;
    }
  };
  
  function setPanVelocity(axis, offset) {
    // If index equals 0 set x to value.
    // If index equals 1 set y to value.
    // If index equals 2 set z to value
    let {x, z} = panVelocity;
    scope.camera.getWorldDirection(cameraDirection);
    let velocity = offset > 0 ? Math.max(24, offset) : Math.min(-24, offset);
    if (axis === 0) {
      let xDir = cameraDirection.x === 0 ? 1 : Math.sign(cameraDirection.x);
      panVelocity.setComponent(axis, xDir * (velocity + x));
    }
    else if (axis === 2) {
      let zDir = cameraDirection.z === 0 ? 1 : Math.sign(cameraDirection.z);
      panVelocity.setComponent(axis, zDir * (velocity + z));
    }
  }
  
  this.registerListener();
};


THREE.FirstPersonControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.FirstPersonControls.prototype.constructor = THREE.FirstPersonControls;

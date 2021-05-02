/* global THREE */
/* global Ammo */
/* global AmmoDebugDrawer */
/* global firebase */

const service = {
  // setup functions
  /* setup ammo physics - return physicsWorld, debug (physics debugger) */
  setupPhysics: (scene) => {
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const overlappingPairCache = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    const physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
    physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));
    physicsWorld.debugDrawWorld();
    const debug = new THREE.AmmoDebugDrawer(scene, physicsWorld, { debugDrawMode: 3 });
    debug.enable();
    return { physicsWorld, debug };
  },
  /* setup threejs graphics - return lineObj (aiming line) */
  setupGraphics: (camera, scene, renderer) => {
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
    const ambientLight = new THREE.AmbientLight(0x999999);
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
    const lineObj = new THREE.Line( shotGeometry, shotMaterial );
    hideShotVector();
    scene.add( lineObj );
    
    return { lineObj };
  },
  setupContactCallback: (contactResult) => {
    contactResult = new Ammo.ConcreteContactResultCallback();
    contactResult.contact = false;
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
        } else {
          console.log('No contact');
          contactResult.contact = false;
        }
        const localPositionDisplay = {x: localPosition.x(), y: localPosition.y(), z: localPosition.z()};
        const worldPositionDisplay = {x: worldPosition.x(), y: worldPosition.y(), z: worldPosition.z()};

        console.log( { tag, localPositionDisplay, worldPositionDisplay } );
      }
    }
  },
  checkContact: (ballRef, physicsWorld, contactResult) => {
    physicsWorld.contactTest(ballRef.userData.physicsBody , contactResult);
  }
};
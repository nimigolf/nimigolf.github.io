/* global registerCourse */

const deg = d => d * (Math.PI / 180);

const withPos = p => d => ({
  ...d,
  position: {
    x: 0,
    y: 0,
    z: 0,
    ...d.position,
    ...p
  }
});

const withSize = s => d => ({
  ...d,
  scale: {
    x: s.width,
    y: s.depth,
    z: s.length
  }
});

const withRot = r => d => ({
  ...d,
  rotation: {
    x: 0,
    y: 0,
    z: 0,
    ...d.rotation,
    ...r
  }
});

const withColor = color => d => ({
  ...d,
  color
});

const withName = name => d => ({
  ...d,
  name
});

const withChild = b => d => ({
  ...d,
  children: d.children ? [ ...d.children, b ] : [b]
});

const withChildren = (bs) => d => ({
  ...d,
  children: d.children ? [ ...d.children, ...bs ] : bs
});

const asFloor = d => ({
  color: '#a9de64',
  ...d,
  scale: {
    ...d.scale,
    y: 0.05,
  }
});

const asWall = d => ({
  color: '#a9de64',
  ...d,
  scale: {
    ...d.scale,
    x: d.scale.x || 1,
    y: 0.05
  }
});

const withRigidBody = d => ({
  ...d,
  isRigidBody: true
});

const asBlock = d => ({
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  ...d,
  isBlock: true
});

const asGroup = d => ({
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  color: 0x000000,
  ...d,
  isGroup: true
});

const asHole = d => ({
  color: '#a9de64',
  ...d,
  scale: {
    ...d.scale,
    y: 0.1
  }
});

const asCustom = ({url: fileUrl}) => d => ({
  ...d,
  assetUrl: fileUrl,
  isCustom: true,
});

const facingLeft = d => ({
  ...d,
  rotation: { x: 0, y: 0, z: deg(90) }
});

const facingTop = d => ({
  ...d,
  rotation: { x: 0, y: deg(90), z: deg(90) }
});

const facingRight = facingLeft;
const facingBottom = facingTop;

const makeEntity = (...funcs) => funcs.reduce((y, f) => f(y), {});
const makeBlock = (...funcs) => asBlock(makeEntity(...funcs));
const makeGroup = (...funcs) => asGroup(makeEntity(...funcs));
const makeHole = (...funcs) => asHole(makeEntity(...funcs));
const makeFloor = (...funcs) => makeBlock(
  ...funcs,
  withRigidBody,
  asFloor
);
const makeWall = (...funcs) => makeBlock(
  ...funcs,
  withRigidBody,
  asWall
);

registerCourse('ammo', async (info, helper) => {
  
  helper.setBallSpawn(info.ballSpawn);
  
  const platform1 = { position: {x: 0, y: 0, z: 4}, scale: {x: 40, y: .1, z: 20}, rotation: {x: 0, y: 0, z: 0} };
  const platform2 = { position: {x: 0, y: 0, z: -11}, scale: {x: 40, y: .1, z: 8}, rotation: { x: 0, y: 0, z: 0} };
  const platform3 = { position: {x: 10.25, y: 0, z: -6.5}, scale: {x: 19.5, y: .1, z: 1}, rotation: {x: 0, y: 0, z: 0} };
  const platform4 = { position: {x: -10.25, y: 0, z: -6.5}, scale: {x: 19.5, y: .1, z: 1}, rotation: {x: 0, y: 0, z: 0} };
  const wall1 = { position: {x: 0, y: 0.5 , z: -15}, scale: {x: 40, y: 1, z: .9}, rotation: {x: 0, y: 0, z: 0} };
  const wall2 = { position: {x: 20, y: 0.5, z: -0.5}, scale: {x: .9, y: 1, z: 29}, rotation: {x: 0, y: 0, z: 0} };
  const wall3 = { position: {x: -20, y: 0.5, z: -0.5}, scale: {x: .9, y: 1, z: 29}, rotation: {x: 0, y: 0, z: 0} };
  const wall4 = { position: {x: 0, y: 0.5, z: 14}, scale: {x: 40, y: 1, z: .9}, rotation: {x: 0, y: 0, z: 0} };

  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(platform1))));
  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(platform2))));
  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(platform3))));
  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(platform4))));

  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(wall1))));
  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(wall2))));
  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(wall3))));
  helper.addToScene(asBlock(withRigidBody(withColor('#a9de64')(wall4))));
  
  const hole = { position: {x: 0, y: 0, z: -6.5}, scale: {x: 10, y: .1, z: 10} };
  helper.createHole(asHole(hole));
  
});

registerCourse('ammo-dino', async (info, helper) => {
  
  helper.setBallSpawn({ x: 0, y: 0.3, z: -4 });
  
  const loop = makeEntity(
    withPos({x: -1, y: 0, z: -10}),
    withRot({x: 0, y: 0, z: 0}),
    withSize({width: 2, depth: 2, length: 2}),
    asCustom({ url: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2FLoop.glb?v=1619498287813' }),
  );
  helper.loadGLB(loop);
  
  
  const fairway = makeGroup(
    withPos({ z: -25 }),
    withChildren([
      makeFloor(
        withSize({ width: 20, length: 50 })
      ),
      makeWall(
        withSize({ length: 50 }),
        withPos({ x: -10 }),
        facingLeft
      ),
      makeWall(
        withSize({ length: 30 }),
        withPos({ x: 10, z: 10 }),
        facingRight
      ),
      makeWall(
        withSize({ length: 20 }),
        withPos({ z: -25 }),
        facingTop
      ),
      makeWall(
        withSize({ length: 20 }),
        withPos({ z: 25 }),
        facingBottom
      )
    ])
  );
  helper.addToScene(fairway);
  
  const ramp = makeGroup(
    withName('ramp'),
    withPos({ x: 14.82963, y: 1.29410, z: -40 }),
    withRot({ z: deg(15) }),
    withChildren([
      makeFloor(
        withSize({ width: 10, length: 20 })
      ),
      makeWall(
        withName('ramp-wall-top'),
        withSize({ length: 10 }),
        withPos({ z: -10 }),
        facingTop
      ),
      makeWall(
        withName('ramp-wall-bottom'),
        withSize({ length: 10 }),
        withPos({ z: 10 }),
        facingBottom
      )
    ])
  );
  helper.addToScene(ramp);
  
  const green = makeGroup(
    withPos({ x: 30, z: -40 }),
    withChildren([
      makeFloor(
        withPos({ x: -5.5, }),
        withSize({ width: 10, length: 20 })
      ),
      makeFloor(
        withPos({ x: 5.5, }),
        withSize({ width: 10, length: 20 })
      ),
      makeFloor(
        withPos({ z: -5.25 }),
        withSize({ width: 1, length: 9.5 })
      ),
      makeFloor(
        withPos({ z: 5.25 }),
        withSize({ width: 1, length: 9.5 })
      ),
      makeWall(
        withPos({ z: -10 }),
        withSize({ length: 21 }),
        facingTop
      ),
      makeWall(
        withPos({ z: 10 }),
        withSize({ length: 21 }),
        facingBottom
      ),
      makeWall(
        withPos({ x: -10.5 }),
        withSize({ length: 20 }),
        facingLeft
      ),
      makeWall(
        withPos({ x: 10.5 }),
        withSize({ length: 20 }),
        facingRight
      )
    ])
  );
  helper.addToScene(green);
  
  const hole = makeHole(
    withName('hole'),
    withPos(green.position),
    withSize({ width: 21, length: 20 })
  );
  helper.createHole(hole);
  
});

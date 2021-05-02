// Reset view to take bird's eye view snapshot of course
// To adjust, move with WASD or increase zoom (position y coordinate)

function launchBirdsEyeView(camera, y) {
  document.querySelector('.a-enter-vr-button').style.display = 'none';
  document.querySelector('#help').style.display = 'none';
  camera.setAttribute('rotation', '-90 0 0');
  camera.setAttribute('position', `0 ${y} -25`);
  console.log('Birds aren\'t real.');
}

const DEFAULT_HOLE = 'dino';

const HOLES = {
  'dino': {
    name: 'Dinosaur Island',
    par: 3,
    birdsEyeImage: '../assets/images/dino.png',
  },
  'trap': {
    name: 'It\'s a Trap',
    par: 3,
    birdsEyeImage: '../assets/images/trap.png',
  },
  'spin': {
    name: 'Spin Cycle',
    par: 5,
    birdsEyeImage: '../assets/images/spin.png',
  },
  'black': {
    name: 'Black Box',
    par: 4,
    birdsEyeImage: '../assets/images/black.png',
    ballSpawn: { x: 0, y: 6.8, z: -4 }
  },
  'volcano': {
    name: 'Volcano',
    par: 5,
    birdsEyeImage: '../assets/images/volcano.png',
  },
  'ammo': {
    name: 'Ammo Test Course',
    useDev: true,
    par: 4,
    birdsEyeImage: '../assets/images/ammo.png',
    ballSpawn: { x: 1, y: 0.5, z: 5 }
  },
  'ammo-dino': {
    name: 'Loop-de-Loop (Ammo)',
    useDev: true,
    par: 3,
    birdsEyeImage: '../assets/images/dino.png',
  }
};

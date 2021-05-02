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
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fdino.png?v=1616960058944'
  },
  'trap': {
    name: 'It\'s a Trap',
    par: 3,
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Ftrap.png?v=1616960058679'
  },
  'spin': {
    name: 'Spin Cycle',
    par: 5,
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fspin.png?v=1616960058910'
  },
  'black': {
    name: 'Black Box',
    par: 4,
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fblack.png?v=1616983147963',
    ballSpawn: { x: 0, y: 6.8, z: -4 }
  },
  'volcano': {
    name: 'Volcano',
    par: 5,
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fvolcano.png?v=1617083142439'
  },
  'ammo': {
    name: 'Ammo Test Course',
    useDev: true,
    par: 4,
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fammo.png?v=1618013916647',
    ballSpawn: { x: 1, y: 0.5, z: 5 }
  },
  'ammo-dino': {
    name: 'Loop-de-Loop (Ammo)',
    useDev: true,
    par: 3,
    birdsEyeImage: 'https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2Fdino.png?v=1616960058944'
  }
};

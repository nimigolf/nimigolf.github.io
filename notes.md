# Mini Golf

## It says here in my notes

- Cannonjs most likely does not support concave mesh according to this post: https://stackoverflow.com/questions/30675493/cannon-js-complex-shapes
  - We will need to manually subsitute a concave mesh with multiple convex mesh as the physics collision box
  - For extreme circumstances we could check out this method: https://kmamou.blogspot.com/2011/10/hacd-hierarchical-approximate-convex.html

## Prototyping Sessions


In reverse chronological order.

### Thursday March 18, 2021

Session Goals:

- Create interaction to aim and shoot
- Add support for multiplayer sync

Brainstorm: How should the aiming and shooting interaction work?

- Click and pull to create a shot vector
- Direction of camera determines direction of shot
- Button on screen to determine force of shot
- Button to switch from walking around course to making shot
- Connect to your phone, flicking the phone determines the shot

Interaction Prototype #1: Click and drag ball to create shot vector.

- Detect if cursor fusing with ball, if so, start vector
<!-- - Disable camera movement/rotation when making vector -->x
- Determine vector length from distance dragged
- Determine vector direction from mirror of direction dragged
- When click is released, execute shot

### Tuesday March 16, 2021

Session Goals:

- Implement simple course and ball
- Add physics engine
- Apply a force (programatically) to the ball
- Check if the ball went in the hole

We'll use [A-Frame Physics](https://github.com/n5ro/aframe-physics-system).
This library supports Cannon.js and Ammo.js.
We will make the ball a dynamic body and course obstacles static bodies.

First question, this is the biggest question mark for me:

> If the course is a static body, how do we will A-Frame that the ball can fall through the hole?

Here's one idea, in this sketch below.
We will make a square hole by splitting the basic course into four different components.
Then we will create a donut that will restrict the opening to be circular.

![Sketch](https://cdn.glitch.com/3399fb46-16ab-4b4a-8648-8cddc3091888%2FScreen%20Shot%202021-03-16%20at%208.21.23%20PM.png?v=1615944095852)

We thought of another risk:

> How will this work in real-time, multi-client? Is it possible that clients will diverge?

We could dispatch the shots to each client. Do the same shots result in the same state?

Looking ahead, we might be able to set different friction values for different kinds of terrain.
[Cannon.js Friction Demo](https://github.com/schteppe/cannon.js/blob/master/demos/friction.html)

We achieved all our goals on time!

Concern: The A-Frame Physics library does not work with the latest version of A-Frame.
We fixed this temporarily by downgrading A-Frame to version 0.7.0.

## Log of Decisions

- Decided to prototype in A-Frame to validate whether we should do the game in 3D, once we figure out requirements and interactions, we can consider another library
- Decided to use an existing physics engine for prototyping to avoid investing too much in our own


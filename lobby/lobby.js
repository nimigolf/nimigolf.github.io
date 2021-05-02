/* global firebase */
/* global React */
/* global ReactDOM */
/* global iro */
/* global HOLES */
/* global DEFAULT_HOLE */

const firebaseConfig = {
  apiKey: "AIzaSyA76jCY2eouHaiDOK4iTum7aUBJS_S6b9M",
  authDomain: "minigolf-bdba7.firebaseapp.com",
  databaseURL: "https://minigolf-bdba7-default-rtdb.firebaseio.com",
  projectId: "minigolf-bdba7",
  storageBucket: "minigolf-bdba7.appspot.com",
  messagingSenderId: "1013135860295",
  appId: "1:1013135860295:web:11fa33501c120b670c0762"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const ballColors = [
  '#60AFFF', // blue
  '#EE6C4D', // orange
  '#35CE8D', // green
  '#F9DB6D', // yellow
  '#745C97', // purple
  '#F896D8' // pink
];

/* Helper Methods */

function plur(n, singular, plural=null) {
  const pluralFinal = plural ? plural : `${singular}s`;
  return `${n} ${n === 1 ? singular : pluralFinal}`;
}

let myUserId = null;

function registerUser() {
  return new Promise((resolve, reject) => {
    const userId = localStorage.getItem('minigolf_user_id');
    if (userId === null) {
      db.ref('user').push(true).then((done) => {
        myUserId = done.key;
        localStorage.setItem('minigolf_user_id', done.key);
        resolve(done.key);
      });
    } else {
      myUserId = userId;
      resolve(userId);
    }
  });
}

function createRoom() {
  return new Promise((resolve, reject) => {
    const input = document.getElementById('room-name');
    if (input.value) {
      const userName = localStorage.getItem('minigolf_user_name', name) || 'Name';
      db.ref('rooms').push({
        name: input.value,
        created: firebase.database.ServerValue.TIMESTAMP,
        owner: myUserId,
        hole: DEFAULT_HOLE
      }).then((done) => {
        input.value = '';
        resolve(done.key);
      });
    } else {
      resolve(null);
    }
  });
}

function updateMyName(roomId, name) {
  return db.ref(`rooms/${roomId}/players/${myUserId}/name`).set(name);
}

function updateMyBallColor(roomId, color) {
  return db.ref(`rooms/${roomId}/players/${myUserId}/color`).set(color);
}

function updateHole(roomId, holeId) {
  return db.ref(`rooms/${roomId}/hole`).set(holeId);
}

function updateScore(roomId, roundId, playerId, newScore) {
  return db.ref(`rooms/${roomId}/scores/${roundId}/${playerId}`).set(newScore);
}

function updateRoomStarted(roomId, holeId) {
  const scoresPath = `rooms/${roomId}/scores`;
  const startedPath = `rooms/${roomId}/started`;
  return new Promise((resolve, reject) => {
    db.ref(scoresPath).push({ 'holeId': holeId }).then(() => {
      const p = db.ref(startedPath).set(firebase.database.ServerValue.TIMESTAMP);
      p.then(resolve).catch(reject);
    }).catch(reject);
  });
}

function joinRoom(roomId) {
  return new Promise((resolve, reject) => {
    db.ref(`rooms/${roomId}/players`).once('value', (snap) => {
      const roomPlayers = snap.val() || {};
      if (myUserId in roomPlayers) {
        resolve();
      } else {
        const userName = localStorage.getItem('minigolf_user_name', name) || 'Name';
        const i = Object.keys(roomPlayers).length;
        db.ref(`rooms/${roomId}/players/${myUserId}`).set({
          name: userName,
          joined: firebase.database.ServerValue.TIMESTAMP,
          color: ballColors[i % ballColors.length]
        }).then(resolve).catch(reject);
      }
    });
  });
}

function leaveRoom(roomId) {
  return db.ref(`rooms/${roomId}/players/${myUserId}`).remove();
}

function resetHole(roomId) {
  return Promise.all([
    // Reset room fields
    db.ref(`rooms/${roomId}/hole`).set(DEFAULT_HOLE),
    db.ref(`rooms/${roomId}/started`).remove(),
    // Remove current game data
    db.ref(`positions/${roomId}`).remove(),
    db.ref(`events/${roomId}`).remove(),
    db.ref(`heartbeat/${roomId}`).remove(),
    db.ref(`aim/${roomId}`).remove()
  ]);
}

function deleteRoom(roomId) {
  return Promise.all([
    db.ref(`rooms/${roomId}`).remove(),
    db.ref(`positions/${roomId}`).remove(),
    db.ref(`events/${roomId}`).remove(),
    db.ref(`heartbeat/${roomId}`).remove(),
    db.ref(`aim/${roomId}`).remove()
  ]);
}

/* Components */

function RoomPlayer(props) {
  const p = props.data;
  const [ name, setName ] = React.useState(p.name);
  const [ ballColor, setBallColor ] = React.useState(p.color);
  const colorPickerRef = React.useRef();
  
  React.useEffect(() => {
    if (props.editable) {
      const colorPicker = new iro.ColorPicker(colorPickerRef.current, {
        width: 200,
        color: ballColor
      });
      colorPicker.on('color:change', (color) => {
        setBallColor(color.hexString);
      });
      colorPicker.on('input:end', (color) => {
        updateMyBallColor(props.roomId, color.hexString);
      });
    }
  }, []);
  React.useEffect(() => {
    setName(p.name);
  }, [p.name]);
  React.useEffect(() => {
    setBallColor(p.color);
  }, [p.color]);
  
  function doUpdateName(name) {
    setName(name);
    localStorage.setItem('minigolf_user_name', name);
    updateMyName(props.roomId, name);
  }
  const editableName = (
    <span>
      <input
        type="text"
        value={name}
        onChange={(e) => { doUpdateName(e.target.value) }}
      />
    </span>
  );
  const fixedName = <p>{name}</p>
        
  let parentClasses = ['RoomPlayer'];
  if (props.editable) {
    parentClasses.push('IsEditable');
  }
        
  return (
    <div className={parentClasses.join(' ')}>
      <div className="BallHolder">
        <div className="Ball" style={{ background: ballColor }}></div>
        <div className="BallColorPicker" ref={colorPickerRef}></div>
      </div>
      <div>{props.editable ? editableName : fixedName}</div>
    </div>
  );
}

function HoleOption(props) {
  const hole = props.data;
  const holeId = props.id;
  const isSelected = props.isSelected;
  
  let parentClasses = [ 'HoleOption'];
  if (isSelected) {
    parentClasses.push('IsSelected');
  }
  
  return (
    <div
      className={parentClasses.join(' ')}
      onClick={(e) => props.selectHole(holeId)}
    >
      <h5>{hole.name}</h5>
      <p>Par {hole.par}</p>
      <img src={hole.birdsEyeImage} />
    </div>
  );
}

function ScoreCardCell(props) {
  const [ score, setScore ] = React.useState(props.score);
  
  React.useEffect(() => {
    setScore(props.score);
  }, [props.score]);
  
  const input = (
    <input
        type="text"
        onChange={(e) => {
          const newScore = e.target.value;
          if (!newScore || parseInt(newScore, 10) > 0) {
            setScore(newScore);
            props.updateScore(newScore);
          }
        }}
        value={score}
    />
  );
  
  const el = props.editable ? input : (score || '--');
  
  return (
    <div>{el}</div>
  );
}

function ScoreCard(props) {
  const room = props.data;
  const players = room.players || {};
  const scores = room.scores || {};
  
  if (Object.keys(scores).length < 1) {
    return (
      <p>No holes played yet.</p>
    );
  }
  
  const playerIds = Object.keys(players).map((playerId) => {
    return { ...players[playerId], playerId };
  }).sort((a, b) => {
    return a.joined - b.joined;
  }).map((p) => p.playerId);
  const parTotal = Object.keys(scores).reduce((agg, roundId) => {
    const hole = HOLES[scores[roundId].holeId];
    return agg + hole.par;
  }, 0);
  const playerScores = Object.keys(scores).reduce((agg, roundId) => {
    const hole = HOLES[scores[roundId].holeId];
    playerIds.forEach((playerId) => {
      const raw = scores[roundId][playerId] || '--';
      if (!isNaN(raw)) {
        const score = parseInt(raw, 10);
        const diff = score - hole.par;
        if (!(playerId in agg)) {
          agg[playerId] = { total: score, diff };
        } else {
          agg[playerId].total += score;
          agg[playerId].diff += diff;  
        }
      }
    });
    return agg;
  }, {});
  
  return (
    <div className="ScoreCard">
      <table>
        <tr>
          <th>Hole</th>
          <th>Par</th>
          {playerIds.map((playerId) => {
            const player = players[playerId];
            const ballColor = player.color;
            return (
              <th>
                <span>{player.name}</span>
                <div className="BallHolder">
                  <div className="Ball" style={{ background: ballColor }}></div>
                </div>
              </th>
            );
          })}
        </tr>
        {Object.keys(scores).map((roundId, i) => {
          const scoreMap = scores[roundId];
          const hole = HOLES[scoreMap.holeId];
          return (
            <tr>
              <td>{`${i + 1}. ${hole.name}`}</td>
              <td>{hole.par}</td>
              {playerIds.map((playerId) => {
                return (
                  <td>
                    <ScoreCardCell
                      key={`${roundId}_${playerId}`}
                      playerId={playerId}
                      editable={playerId === myUserId}
                      score={scoreMap[playerId]}
                      updateScore={(newScore) => {
                        props.updateScore(roundId, playerId, newScore);
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
        <tr className="Totals">
          <td>Total Scores</td>
          <td>{parTotal}</td>
          {playerIds.map((playerId) => {
            const r = playerScores[playerId] || null;
            const str = r ? `${r.total} (${r.diff > 0 ? '+' : ''}${r.diff})` : '--';
            return (
              <td>{str}</td>
            );
          })}
        </tr>
      </table>
    </div>
  );
}

function CurrentRoom(props) {
  const roomId = props.id;
  const [ room, setRoom ] = React.useState({});
  
  React.useEffect(() => {
    const listener = db.ref(`rooms/${roomId}`);
    listener.on('value', (snap) => {
      const roomVal = snap.val();
      if (roomVal) {
        setRoom(roomVal);
        const h = HOLES[roomVal.hole] || {};
        if (roomVal.started) {
          document.location = `../${h.useDev ? 'dev.html' : ''}?room=${roomId}`;
        }
      } else {
        props.leaveRoom();
      }
    });
    return function cleanup() {
      listener.off();
    }
  }, []);
  
  function doStartRoom() {
    if (room.owner === myUserId) {
      updateRoomStarted(props.id, room.hole || DEFAULT_HOLE); 
    }
  }
  
  function doDeleteRoom() {
    if (room.owner === myUserId) {
      deleteRoom(roomId);
    }
  }
  
  function doUpdateScore(roundId, playerId, newScore) {
    updateScore(roomId, roundId, playerId, newScore);
  }
  
  const roomPlayers = room.players || {};
  const nPlayers = Object.keys(roomPlayers).length;
  const ifOwnerDisplay = room.owner === myUserId ? 'inline-block' : 'none';
  const currentHole = HOLES[room.hole] || {};
  
  return (
    <div className="CurrentRoom">
      <h3 className="Center">{room.name}</h3>
      <div className="Center">
        <button onClick={doStartRoom} style={{ display: ifOwnerDisplay }}>Start Game</button>
        <button onClick={props.leaveRoom} className="Danger Secondary">Leave Room</button>
        <button
          onClick={doDeleteRoom}
          className="Danger"
          style={{ display: ifOwnerDisplay }}
        >Delete Room</button>
      </div>
      <h4>{plur(nPlayers, 'Player')}</h4>
      <div className="Players">
        {Object.keys(roomPlayers).map((playerId) => {
          return { playerId, p: roomPlayers[playerId] };
        }).sort((a, b) => {
          return a.p.joined - b.p.joined;
        }).map(({playerId, p}) => {
          return (
            <RoomPlayer
              key={playerId}
              id={playerId}
              roomId={props.id}
              data={p}
              editable={playerId === myUserId}
            />
          );
        })}
      </div>
      <h4>Chosen Hole: {currentHole.name || 'None'}</h4>
      <div className="HoleSelector">
        {Object.keys(HOLES).map((holeId) => {
          return (
            <HoleOption
              key={holeId}
              id={holeId}
              data={HOLES[holeId]}
              isSelected={room.hole === holeId}
              selectHole={(newHoleId) => {
                if (room.owner === myUserId) {
                  updateHole(roomId, newHoleId);
                }
              }}
            />
          );
        })}
      </div>
      <h4>Scorecard</h4>
      <ScoreCard
        data={room}
        updateScore={doUpdateScore}
      />
    </div>
  );
}

function LobbyRoom(props) {
  const roomId = props.id;
  const room = props.data;
  const roomPlayers = room.players || {};
  
  // Room management methods
  function doJoinRoom() {
    const h = HOLES[room.hole] || {};
    if (room.started) {
      document.location = `../${h.useDev ? 'dev.html' : ''}?room=${roomId}`;
    } else {
      props.joinRoom();
    }
  }
  function doResetHole() {
    if (room.owner === myUserId) {
      resetHole(roomId).then(() => {
        props.joinRoom();
      });
    }
  }
  
  const notStartedAction = myUserId in roomPlayers ? 'Enter Room' : 'Join Room';
  const startedAction = myUserId in roomPlayers ? 'Go To Game' : 'Spectate';
  const joinAction = room.started ? startedAction : notStartedAction;
  const showResetBtn = room.owner === myUserId ? 'inline-block' : 'none';
  const status = room.started ? 'In Game' : 'In Lobby';
  const statusClass = room.started ? 'InGame' : 'InLobby';
  const nPlayers = Object.keys(roomPlayers).length;
  
  return (
    <div className="LobbyRoom">
      <h3>{room.name}</h3>
      <div className="LobbyRoom__Detail">
        <div className="Half Left">
          <p>
            <span className={`RoomStatus ${statusClass}`}>{status}</span>
            <span>{plur(nPlayers, 'player')}</span>
          </p>
        </div>
        <div className="Half Right">
          <button onClick={doJoinRoom}>{joinAction}</button>
          <button
            onClick={doResetHole}
            className="Danger"
            style={{ display: showResetBtn }}
          >Change Hole</button>
        </div>
      </div>
    </div>
  );
}

function LobbyScreen(props) {
  const [ allRooms, setAllRooms ] = React.useState({});
  const [ currentRoomId, setCurrentRoomId ] = React.useState(null);
  
  // Listen for changes to all rooms
  React.useEffect(() => {
    const listener = db.ref('rooms').orderByChild('started');
    listener.on('value', (roomsSnap) => {
      const roomsVal = roomsSnap.val() || {};
      setAllRooms(roomsVal);
    });
    return function cleanup() {
      listener.off();
    }
  }, []);
  
  // Rejoin room lobby after owner changed course
  React.useEffect(() => {
    const tempRoomId = localStorage.getItem('minigolf_temp_room_id');
    if (tempRoomId) {
      localStorage.removeItem('minigolf_temp_room_id');
      setCurrentRoomId(tempRoomId);
    }
  }, []);
  
  // Room management methods
  function handleJoinRoom(roomId) {
    joinRoom(roomId).then(() => {
      setCurrentRoomId(roomId);
    });
  }
  function handleCreateAndJoinRoom() {
    createRoom().then((roomId) => {
      if (roomId) {
        handleJoinRoom(roomId);
      }
    });
  }
  function handleLeaveCurrentRoom() {
    leaveRoom(currentRoomId).then(() => {
      setCurrentRoomId(null);
    });
  }

  const showRoomSec = currentRoomId === null ? 'none' : 'block';
  
  return (
    <div>
      <section className="transparent">
        <h1>Mini Golf</h1>
      </section>
      <section style={{ display: showRoomSec }}>
        <h2>Lobby</h2>
        <CurrentRoom
          key={currentRoomId}
          id={currentRoomId}
          leaveRoom={handleLeaveCurrentRoom}
        />
      </section>
      <section>
        <h2>Rooms</h2>
        <div className="Center">
          <input id="room-name" type="text" placeholder="Room Name" />
          <button onClick={handleCreateAndJoinRoom}>Create Room</button>
        </div>
        <div>
          {Object.keys(allRooms).map((roomId) => {
            return { roomId, data: allRooms[roomId] };
          }).sort((a, b) => {
            return b.data.created - a.data.created;
          }).map(({ roomId, data }) => {
            return (
              <LobbyRoom
                key={roomId}
                id={roomId}
                data={data}
                joinRoom={() => { handleJoinRoom(roomId) }}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* Main Code */

const mainEl = (
  <LobbyScreen />
);
registerUser().then(() => {
  ReactDOM.render(mainEl, document.getElementById('main'));
});

// Remove rooms older than six hours
const expireAfter = 1000 * 60 * 60 * 6;
const expiredAt = Date.now() - expireAfter;
const oldRooms = db.ref('rooms').orderByChild('created').endAt(expiredAt);
oldRooms.once('value', (oldSnap) => {
  const oldVal = oldSnap.val() || {};
  for (let roomId in oldVal) {
    deleteRoom(roomId);
  }
});

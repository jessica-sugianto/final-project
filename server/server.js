const http = require("./app");
const port = process.env.PORT || 3001;
const io = require("socket.io")(http);

const { stories } = require("./models");

const roomConfiguration = {
  maxUser: 4,
  minUser: 2,
};

const roundConfiguration = {
  timeLimit: 1 * 30,
  timeLimitPerUser: 10,
  timeToStart: 5,
};

const rooms = [];

io.on("connection", (socket) => {
  socket.userName = "";
  socket.joinedRoom = null;
  console.log("a user connected");

  socket.on("disconnect", () => {
    if (socket.userName) {
      console.log(`user ${socket.userName} disconnected`);
    } else {
      console.log("a user disconnected");
    }
    leaveRoom(socket);
  });

  socket.on("set name", (newName) => {
    if (!newName) {
      socket.emit("set name", {
        success: false,
        message: "name must be filled",
      });
    } else {
      socket.userName = newName;
      socket.emit("set name", {
        success: true,
        userName: socket.userName,
        message: "set name success",
      });
      if (socket.joinedRoom) {
        let thisUserInRoom = socket.joinedRoom.users.find(
          (user) => user.id === socket.id
        );
        thisUserInRoom.name = socket.userName;
        io.to(`room-${socket.joinedRoom.id}`).emit(
          "update room data",
          getViewableRoomData(socket.joinedRoom, true)
        );
      }
    }
  });

  socket.on("get rooms", () => {
    socket.emit("get rooms", getRoomsData());
  });

  socket.on("create room", (name, theme, language) => {
    console.log(name, theme, language);
    let result = {
      success: false,
      message: "",
    };
    let createdRoom = null;
    if (socket.joinedRoom) {
      result.message =
        "you have already joined a room, please leave the room first";
    } else if (!name) {
      result.message = "room name must be filled";
    } else if (!theme) {
      result.message = "theme must be selected";
    } else if (!language) {
      result.message = "language must be selected";
    } else {
      createdRoom = createRoom(name, theme, language, socket.id);
      result.success = true;
      result.message = "created room successfully";
    }
    socket.emit("create room", result);
    if (result.success) {
      io.emit("get rooms", getRoomsData());
      joinRoom(socket, createdRoom);
    }

    socket.on("update room data", () => {
      console.log('update room data called');
      socket.emit('update room data', getViewableRoomData(socket.joinedRoom, true));
    });

    socket.on("update round", () => {
      if(socket.joinedRoom) {
        socket.emit('update round', socket.joinedRoom.round);
      } else {
        socket.emit('update round', null);
      }
    });
  });

  socket.on("join room", (roomId) => {
    let roomToJoin = getRoomById(roomId);
    if (!roomToJoin) {
      socket.emit("join room", {
        success: false,
        message: "room doesn't exist",
      });
    } else if (roomToJoin.status !== "waiting") {
      socket.emit("join room", {
        success: false,
        message: "the room has already started",
      });
    } else {
      joinRoom(socket, roomToJoin);
    }
  });

  socket.on("input story", (text) => {
    if (socket.joinedRoom) {
      if (
        socket.joinedRoom.status === "playing" &&
        socket.joinedRoom.users[socket.joinedRoom.round.currentUserIndex].id ===
          socket.id
      ) {
        socket.joinedRoom.round.currentText = text;
        io.to(`room-${socket.joinedRoom.id}`).emit(
          "update round",
          socket.joinedRoom.round
        );
      }
    }
  });

  socket.on("leave room", () => {
    leaveRoom(socket);
  });
});

function createRoom(roomName, roomTheme, roomLanguage, roomMasterId) {
  let roomData = {
    id: getLastRoomId() + 1,
    name: roomName,
    theme: roomTheme,
    language: roomLanguage,
    status: "waiting",
    minUser: roomConfiguration.minUser,
    maxUser: roomConfiguration.maxUser,
    timeLimit: roundConfiguration.timeLimit,
    timeLimitPerUser: roundConfiguration.timeLimitPerUser,
    roomMasterId,
    users: [],
    roundTimerId: null,
    round: {
      countdown: -1,
      globalCountdown: roundConfiguration.timeLimit,
      allText: "",
      currentText: "",
      currentUserIndex: 0,
    },
  };
  rooms.push(roomData);
  return roomData;
}

function joinRoom(socket, room) {
  if (socket.joinedRoom) {
    socket.emit("join room", {
      success: false,
      message: "you have already joined a room, please leave the room first",
    });
  } else if (room.players >= roomConfiguration.maxUser) {
    socket.emit("join room", {
      success: false,
      message: "room is full",
    });
  } else {
    socket.joinedRoom = room;
    socket.join(`room-${socket.joinedRoom.id}`);
    socket.emit("join room", {
      success: true,
      message: "join room success",
    });
    room.users.push({
      id: socket.id,
      name: socket.userName,
    });
    io.to(`room-${socket.joinedRoom.id}`).emit(
      "update room data",
      getViewableRoomData(socket.joinedRoom, true)
    );
    io.emit("get rooms", getRoomsData());
    updateRound(room);
  }
}

function leaveRoom(socket) {
  if (!socket.joinedRoom) {
    socket.emit("leave room", {
      success: false,
      message: "you haven't joined a room",
    });
  } else {
    socket.leave(`room-${socket.joinedRoom.id}`);

    let joinedRoom = socket.joinedRoom;
    socket.joinedRoom = null;
    joinedRoom.users = joinedRoom.users.filter((user) => user.id !== socket.id);
    console.log("roomid" + joinedRoom.id);
    checkRoomEmpty(joinedRoom);
    updateRoomMaster(joinedRoom);
    io.to(`room-${joinedRoom.id}`).emit(
      "update room data",
      getViewableRoomData(joinedRoom, true)
    );
    socket.emit("leave room", {
      success: true,
      message: "leave room success",
    });
    io.emit("get rooms", getRoomsData());
    updateRound(joinedRoom);
  }
}

function getRoomById(roomId) {
  return rooms.find((room) => room.id === roomId);
}

function updateRoomMaster(room) {
  if (room.users.length) {
    if (!room.users.some((user) => user.id === room.roomMasterId)) {
      room.roomMasterId = room.users[0].id;
    }
  }
}

function updateRound(room) {
  if (room) {
    if (room.status === "waiting") {
      if (room.users.length >= room.minUser) {
        if (!room.roundTimerId) {
          room.round.countdown = roundConfiguration.timeToStart;
          room.roundTimerId = setInterval(
            (room) => updateCountdown(room),
            1000,
            room
          );
        }
      } else {
        clearInterval(room.roundTimerId);
        room.roundTimerId = null;
        room.round.countdown = -1;
      }
    }
    io.to(`room-${room.id}`).emit("update round", room.round);
  }
}

function updateCountdown(room) {
  room.round.countdown--;
  if (room.status === "playing") {
    room.round.globalCountdown--;
    if (room.users.length <= room.round.currentUserIndex) {
      room.round.countdown = room.timeLimitPerUser;
      room.round.currentUserIndex = 0;
    }
  }
  if (room.round.countdown <= 0) {
    if (room.status === "waiting") {
      room.status = "playing";
      room.round.currentUserIndex = 0;
      room.round.countdown = roundConfiguration.timeLimitPerUser;
    } else if (room.status === "playing") {
      if (room.round.currentText.trim().length) {
        room.round.allText += `${room.round.currentText}\n`;
      }
      room.round.currentText = "";
      if (room.round.globalCountdown <= 0) {
        room.status = "finished";
        clearInterval(room.roundTimerId);
        saveRoomStory(room);
      } else {
        let newUserIndex = room.round.currentUserIndex + 1;
        if (room.users.length <= newUserIndex) {
          newUserIndex = 0;
        }
        room.round.currentUserIndex = newUserIndex;
        room.round.countdown = room.timeLimitPerUser;
      }
    }
  }
  io.to(`room-${room.id}`).emit(
    "update room data",
    getViewableRoomData(room, true)
  );
  io.to(`room-${room.id}`).emit("update round", room.round);
}

// function userAlreadyInRoom(socket, room) {
//     return room.users.some(roomUser => socket.id === roomUser.id);
// }

function saveRoomStory(room) {
  let obj = {
    title: room.name,
    content: room.round.allText,
    theme: room.theme,
    language: room.language,
    createdBy: room.users.map((user) => user.name).join(", "),
  };
  stories.create(obj).catch((err) => {
    console.error(err);
  });
}

function checkRoomEmpty(room) {
  if (!room.users.length) {
    deleteRoom(room);
  }
}

function deleteRoom(roomToDelete) {
  clearInterval(roomToDelete.roundTimerId);
  rooms.splice(
    rooms.findIndex((room) => roomToDelete.id === room.id),
    1
  );
  io.emit("delete room", {
    id: roomToDelete.id,
    name: roomToDelete.name,
  });
  io.emit("get rooms", getRoomsData());
}

function getLastRoomId() {
  if (rooms.length) {
    return rooms[rooms.length - 1].id;
  } else {
    return 1;
  }
}

function getRoomsData() {
  return rooms.map((room) => getViewableRoomData(room));
}

function getViewableRoomData(room, showPlayers = false) {
  const {
    id,
    name,
    theme,
    language,
    status,
    minUser,
    maxUser,
    timeLimit,
    timeLimitPerUser,
    roomMasterId,
    users,
  } = room;
  let viewableRoomData = {
    id,
    name,
    theme,
    language,
    status,
    minUser,
    maxUser,
    timeLimit,
    timeLimitPerUser,
    roomMasterId,
    usersCount: users.length,
  };
  if (showPlayers) {
    viewableRoomData.users = users;
  }
  return viewableRoomData;
}

http.listen(port, () => console.log(`Server listening on port ${port}`));

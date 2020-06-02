import React, { useState, useEffect } from "react";
import socket from "../socket";
import { useSpeechRecognition } from "react-speech-kit";
import { useHistory } from "react-router-dom";

export default (props) => {
  // console.log(props,"XXXXXXXXXXXXXXXXx")
  const history = useHistory();

  const { listen, listening, stop } = useSpeechRecognition({
    onResult: (result) => {
      console.log(isCurrentUserTurn);
      if (isCurrentUserTurn) {
        setCurrentStoryText(result);
        socket.emit("input story", result);
      }
    },
  });

  const [currentRoom, setCurrentRoom] = useState(null);

  const [currentRound, setCurrentRound] = useState(null);

  const [currentStoryText, setCurrentStoryText] = useState("");

  const [isCurrentUserTurn, setIsCurrentUserTurn] = useState(false);

  useEffect(() => {
    
    socket.on("leave room", (result) => {
      setCurrentRoom(null);
      console.log(result);
    });
    socket.on("update room data", (room) => {
      setCurrentRoom(room);
    });
    socket.on("update round", (round) => {
      setCurrentRound(round);
    });

  }, []);


  useEffect(() => {
    if (
      currentRound &&
      currentRoom &&
      currentRoom.status === "playing" &&
      currentRound.currentUserIndex < currentRoom.users.length &&
      currentRoom.users[currentRound.currentUserIndex].id === socket.id
    ) {
      setIsCurrentUserTurn(true);
    } else {
      setIsCurrentUserTurn(false);
      setCurrentStoryText("");
    }
  }, [currentRoom, currentRound]);

  useEffect(() => {
    if(listening && !isCurrentUserTurn) {
      stop();
    }
  }, [listening, isCurrentUserTurn, stop]);

  useEffect(()=>{
    if(currentRoom && currentRoom.status==="finished"){
        history.push("/story")
    }
  },[currentRoom,history])

  function startListening() {
    if(isCurrentUserTurn) {
      listen({ interimResults: true, continuous: true, lang: "id-ID" });
    }
  }

  function leaveRoom() {
    socket.emit("leave room");
  }

  function inputCurrentStoryText(event) {
    if (isCurrentUserTurn) {
      setCurrentStoryText(event.target.value);
      socket.emit("input story", event.target.value);
    }
  }

  function renderJoinedRoom() {
    if (currentRoom) {
      return (
        <div>
          <h2>User List</h2>
          <ul>
            {currentRoom.users.map((user) => {
              return <li key={user.id}>{user.name}</li>;
            })}
          </ul>
          {renderRoundData()}
          <button onClick={leaveRoom}>Leave room</button>
        </div>
      );
    } else {
      return <h2>Not joined a room</h2>;
    }
  }

  function renderRoundData() {
    if (currentRound) {
      return (
        <>
          <div>Countdown: {currentRound.countdown}</div>
          <div>Global Countdown: {currentRound.globalCountdown}</div>
          {renderStory()}
        </>
      );
    }
  }

  function renderStory() {
    if (currentRound && currentRoom && currentRoom.status === "playing") {
      return (
        <div>
          <div>All Text</div>
          <textarea
            value={`${currentRound.allText}${currentRound.currentText}`}
            readOnly={true}
          />
          <div>current input</div>
          <textarea
            value={currentStoryText}
            onChange={inputCurrentStoryText}
            readOnly={!isCurrentUserTurn}
          />
          <button
            onClick={startListening}
          >
            Start
          </button>
          <button onClick={stop}>Stop</button>
          {listening && <div>Go ahead I'm listening</div>}
          <div>
            current turn:{" "}
            {currentRoom.users[currentRound.currentUserIndex].name}
          </div>
        </div>
      );
    } else if (currentRoom.status === "finished") {
      return (
        <div>
          <h3>Finished</h3>
          <div>All Text</div>
          <textarea value={`${currentRound.allText}`} readOnly={true} />
        </div>
      );
    }
  }


  if(currentRound){
    return(
      <>
          <div>
              <div className="imageBackground"></div>
          
              <div className="timerFiveMinutes">
                <p>Global Countdown: {currentRound.globalCountdown}</p>
              </div>
          
              <div>
                <textarea type="text" className="inputStoryBox input" placeholder="input your story in 30 second" value={currentStoryText}
                onChange={inputCurrentStoryText}
                readOnly={!isCurrentUserTurn}></textarea>
                <button
                onClick={startListening}>
                Start
              </button>
          <button onClick={stop}>Stop</button>
          {listening && <div>Go ahead I'm listening</div>}
              </div>

              <div>
                current turn:{" "}
                {currentRoom.users[currentRound.currentUserIndex].name}
              </div>
          
              <div>
                <p className="timer30Second">Countdown: {currentRound.countdown}</p>
              </div>
          
              <div className="story">
                <h1 className="titleOutputStory"> your story</h1>
                <p className="outputStory">{`${currentRound.allText}${currentRound.currentText}`}</p>
              </div>
          </div>
      </>
    );
  }

  return (
    <>
      {renderJoinedRoom()}
    </>
  );
};
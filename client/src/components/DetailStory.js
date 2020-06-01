import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { CardDeck, Card, Button } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { getStoryDetail } from "../store/actions/storiesAction";
import Speech from "speak-tts";
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import image from '../assets/pinpng.com-pdf-icon-png-200230.png'

export default () => {
  const { id } = useParams();
  const { storyDetail, loading } = useSelector((state) => state.stories);
  //   console.log(storyDetail, loading);

  const speech = new Speech(); // will throw an exception if not browser supported
  if (speech.hasBrowserSupport()) {
    // returns a boolean
    console.log("speech synthesis supported");
  }

  function _init() {
    const speech = new Speech();
    speech
      .init({
        volume: 0.5,
        lang: "id-ID",
        rate: 1,
        pitch: 1,
        //'voice':'Google UK English Male',
        //'splitSentences': false,
        listeners: {
          onvoiceschanged: (voices) => {
            console.log("Voices changed", voices);
          },
        },
      })
      .then((data) => {
        console.log("Speech is ready", data);
        _prepareSpeakButton(speech);
      })
      .catch((e) => {
        console.error("An error occured while initializing : ", e);
      });
  }

  function _prepareSpeakButton(speech) {
    speech
      .speak({
        text: storyDetail.content,
        queue: false,
        listeners: {
          onstart: () => {
            console.log("Start utterance");
          },
          onboundary: (event) => {
            console.log(
              event.name +
                " boundary reached after " +
                event.elapsedTime +
                " milliseconds."
            );
          },
        },
      })
      .then((data) => {
        console.log("Success !", data);
      })
      .catch((e) => {
        console.error("An error occurred :", e);
      });
  }

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getStoryDetail(id));
  }, [dispatch, id]);

  if (loading) {
    return <p>Loading...</p>;
  }

  function exportDocument(){
    const input = document.getElementById('export')
    html2canvas(input)
    .then((canvas) => {
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF()
      pdf.addImage(imgData, 'JPEG', 0, 0)
      pdf.save(storyDetail.title+'.pdf')
    })
  }

  return (
    <>
      <CardDeck>
        <Card>
          <Card.Body id='export' >
            <Card.Title>{storyDetail.title}</Card.Title>
            <Card.Text>{storyDetail.content}</Card.Text>
          </Card.Body>
          <Card.Footer>
            <small className="text-muted">{storyDetail.createdBy}</small>
            <Button onClick={() => _init()} className="mx-3"style={{backgroundColor: 'transparent', color: '#649D66', borderColor:'#649D66'}}>
              Play
            </Button>
            <Button style={{backgroundColor: 'transparent', color: '#649D66', borderColor:'transparent', width: '10%'}} onClick={exportDocument}>
              <img src={image} width='100%'/>
            </Button>
          </Card.Footer>
        </Card>
      </CardDeck>
    </>
  );
};

import React, { useEffect, useState } from "react";
import { useCheetah } from "@picovoice/cheetah-react";

export default function VoiceWidget() {
  const [transcript, setTranscript] = useState("");

  const { result, isLoaded, isListening, error, init, start, stop } =
    useCheetah();

  const initEngine = async () => {
    await init(
      "H7/55L22VemNeFMrd2IFKCK03hcmpDRFYm1NBwlHSgKauAaYl7L1Aw==",
      { publicPath: "../public/cheetah_params.pv" },
      { enableAutomaticPunctuation: true }
    );
  };

  const toggleRecord = async () => {
    if (isListening) {
      await stop();
    } else {
      await start();
    }
  };

  useEffect(() => {
    if (result !== null) {
      setTranscript((prev) => {
        let newTranscript = prev + result.transcript;
        if (result.isComplete) {
          newTranscript += " ";
        }
        return newTranscript;
      });
    }
  }, [result]);

  return (
    <div>
      {error && <p className="error-message">{error.toString()}</p>}
      <br />
      <button onClick={initEngine} disabled={isLoaded}>
        Initialize Rex
      </button>
      <br />
      <br />
      <label htmlFor="audio-record">Record audio to transcribe:</label>
      <button id="audio-record" onClick={toggleRecord} disabled={!isLoaded}>
        {isListening ? "Stop Listening" : "Start Listening"}
      </button>
      <h3>Transcript:</h3>
      <p>{transcript}</p>
    </div>
  );
}

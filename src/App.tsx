import { MapView, useMapData, useMap, Navigation } from "@mappedin/react-sdk";
import "@mappedin/react-sdk/lib/esm/index.css";
import { createClient } from "@supabase/supabase-js";
import {
  Directions,
  TDirectionInstruction,
} from "@mappedin/react-sdk/mappedin-js/src";
import { useEffect, useState } from "react";
import "regenerator-runtime/runtime";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import axios from "axios";
import { AiFillAudio, AiOutlineCloseCircle } from "react-icons/ai";

const voiceSettings = {
  stability: 0,
  similarity_boost: 0,
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? "",
  import.meta.env.VITE_SUPABASE_KEY ?? ""
);

interface VoiceWidgetProps {
  setUserMessage: any;
}

const VoiceWidget: React.FC<VoiceWidgetProps> = ({ setUserMessage }) => {
  const [isListening, setIsListening] = useState(false);

  const toggleListening = async () => {
    if (isListening) {
      SpeechRecognition.stopListening();
      setUserMessage(transcript);
    } else {
      SpeechRecognition.startListening({ continuous: true, language: "en-In" });
    }
    setIsListening(!isListening);
  };

  const { transcript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <div>Your browser does not support speech recognition.</div>;
  }

  return (
    <>
      <div className="voice-widget">
        <div className="microphone-icon" onClick={toggleListening}>
          {isListening ? (
            <AiOutlineCloseCircle style={{ color: "red" }} />
          ) : (
            <AiFillAudio style={{ color: "green" }} />
          )}
        </div>
      </div>
      {transcript && <div className="transcript">{transcript}</div>}
    </>
  );
};

interface MappedinMapProps {
  userMessage: any;
}

async function fetchLatestDestination(): Promise<string | null> {
  const { data, error } = await supabase
    .from("start")
    .select("destination")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching latest row:", error);
    return null;
  }

  return data?.destination || null;
}

const MappedinMap: React.FC<MappedinMapProps> = ({ userMessage }) => {
  const { mapData, mapView } = useMap();
  const [directions, setDirections] = useState<Directions | undefined>(
    undefined
  );

  useEffect(() => {
    const processMapData = async () => {
      if (mapData && mapView && userMessage) {
        await sendToVoiceflowAPI(userMessage);
        const dest = await fetchLatestDestination();
        let destination = "";
        if (dest) destination = dest;
        console.log(destination);
        const pointsOfInterest = mapData.getByType("point-of-interest");
        const spaces = mapData.getByType("space");
        const combinedData = [...pointsOfInterest, ...spaces];

        const firstSpace = mapData
          .getByType("space")
          .find((s) => s.name === "✏️ Judging Room J");
        // const secondSpace = combinedData.find(
        //   (s) =>
        //     s.name.toLowerCase().trim() === destination.toLowerCase().trim()
        // );
        const secondSpace = combinedData.find(
          (s) => s.name === "Gender Neutral Washroom 2914"
        );
        console.log(firstSpace, secondSpace);

        if (firstSpace && secondSpace) {
          const newDirections = mapView.getDirections(firstSpace, secondSpace, {
            accessible: true,
          });

          if (newDirections) {
            console.log(newDirections.instructions);
            setDirections(newDirections);
            const transformedDirections = mapActions(
              newDirections.instructions
            );
            console.log(transformedDirections);

            insertMovementData(transformedDirections);
          }
        }
      }
    };

    processMapData();
  }, [mapData, mapView, userMessage]);

  if (!directions) return null;

  return <Navigation directions={directions} />;
};

async function startVoiceFlow() {
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: import.meta.env.VITE_VOICEFLOW_KEY,
    },
    body: JSON.stringify({
      action: { type: "launch" },
      config: {
        tts: false,
        stripSSML: true,
        stopAll: true,
        excludeTypes: ["block", "debug", "flow"],
      },
      state: { variables: { x_var: 2 } },
    }),
  };

  try {
    const response = await fetch(
      "https://general-runtime.voiceflow.com/state/user/userID/interact?logs=off",
      options
    );
    const data = await response.json();
    console.log("Launch request sent", data);
    return data[0].payload.message;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function sendToVoiceflowAPI(payload: string) {
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: import.meta.env.VITE_VOICEFLOW_KEY,
    },
    body: JSON.stringify({
      action: { type: "text", payload: payload },
      config: {
        tts: false,
        stripSSML: true,
        stopAll: true,
        excludeTypes: ["block", "debug", "flow"],
      },
      state: { variables: { x_var: "hello" } },
    }),
  };

  try {
    const response = await fetch(
      `https://general-runtime.voiceflow.com/state/user/userID/interact?logs=off`,
      options
    );
    const data = await response.json();
    console.log(data[2].payload.message);
    startStreaming(data[2].payload.message);
    return data;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function mapActions(data: TDirectionInstruction[]) {
  return data.flatMap((item) => {
    const actionType = item.action.type;
    const distance = item.distance.toString(); // Round distance to nearest whole number

    if (actionType === "Turn") {
      let direction = item.action.bearing?.toLowerCase();
      if (direction === "slightright") {
        direction = "right";
      } else if (direction === "slightleft") {
        direction = "left";
      }
      return [
        `straight,${distance}`, // Approach point of turn for the calculated distance
        `${direction},0`, // Add turn instruction with distance 0
      ];
    } else if (actionType === "TakeConnection") {
      return [`take elevator,0`]; // Return a string with elevator action and 0 distance
    } else if (actionType === "ExitConnection") {
      return [`exit elevator,0`]; // Return a string with exit action and 0 distance
    } else if (actionType === "Arrival") {
      return [`straight,${distance}`];
    } else if (actionType === "Departure") {
      return [`straight,${distance}`];
    } else {
      return [`straight,${distance}`]; // Default action is to go straight for a distance
    }
  });
}

async function insertMovementData(instructions: any) {
  console.log(instructions);
  const { data, error } = await supabase
    .from("instructions")
    .insert({ instructions: instructions });

  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log("Data inserted successfully:", data);
  }
}

const startStreaming = async (text: string) => {
  const baseUrl = "https://api.elevenlabs.io/v1/text-to-speech";
  const headers = {
    "Content-Type": "application/json",
    "xi-api-key": import.meta.env.VITE_ELEVENLABS_KEY,
  };

  const requestBody = {
    text,
    voice_settings: voiceSettings,
  };

  try {
    const response = await axios.post(
      `${baseUrl}/6FoItX0qlf6tQuuU3iNT`,
      requestBody,
      {
        headers,
        responseType: "blob",
      }
    );

    if (response.status === 200) {
      const audio = new Audio(URL.createObjectURL(response.data));
      audio.play();
    } else {
    }
  } catch (error) {
  } finally {
  }
};

export default function App() {
  const { isLoading, error, mapData } = useMapData({
    key: "mik_Qar1NBX1qFjtljLDI52a60753",
    secret: "mis_CXFS9WnkQkzQmy9GCt4ucn2D68zNRgVa2aiJj5hEIFM8aa40fee",
    mapId: "66ce20fdf42a3e000b1b0545",
  });
  const [userMessage, setUserMessage] = useState("");

  useEffect(() => {
    const initCall = async () => {
      const initialMessage = await startVoiceFlow();
      console.log(initialMessage);
      startStreaming(initialMessage);
    };
    initCall();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error.message}</div>;
  }

  return mapData ? (
    <>
      <VoiceWidget setUserMessage={setUserMessage} />
      <MapView mapData={mapData}>
        <MappedinMap userMessage={userMessage} />
      </MapView>
    </>
  ) : null;
}

import React, { useState } from "react";
import "./App.css";
import { useVisibility } from "../providers/VisibilityProvider";
import { useNuiEvent } from "../hooks/useNuiEvent";
import Craftcha, { CraftchaPayload } from "../components/Craftcha";
import PerfectCircle, { PerfectCirclePayload } from "../components/PerfectCircle";
// import { debugData } from "../utils/debugData";

// debugData([
//   {
//     action: "setVisible",
//     data: true,
//   },
// ]);

type MinigameState =
  | { type: "craftcha"; payload: CraftchaPayload }
  | { type: "perfectCircle"; payload: PerfectCirclePayload }
  | null;

const App: React.FC = () => {
  const { visible, setVisible } = useVisibility();
  const [minigame, setMinigame] = useState<MinigameState>(null);

  // Catch events here in App — always mounted, unlike child components
  useNuiEvent<CraftchaPayload>("openCraftcha", (data) => {
    setMinigame({ type: "craftcha", payload: data });
    setVisible(true);
  });

  useNuiEvent<PerfectCirclePayload>("openPerfectCircle", (data) => {
    setMinigame({ type: "perfectCircle", payload: data });
    setVisible(true);
  });

  return (
    <div className="nui-wrapper">
      {visible && minigame?.type === "craftcha" && (
        <Craftcha payload={minigame.payload} />
      )}
      {visible && minigame?.type === "perfectCircle" && (
        <PerfectCircle payload={minigame.payload} />
      )}
    </div>
  );
};

export default App;

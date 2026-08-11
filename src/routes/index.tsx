import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [Game, setGame] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    import("@/game/GameApp").then((m) => {
      if (alive) setGame(() => m.GameApp);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!Game) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "#0a0c10",
          color: "#3dcc5a",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 800,
          letterSpacing: "0.08em",
        }}
      >
        LOADING STINK KART WARS…
      </div>
    );
  }

  return <Game />;
}

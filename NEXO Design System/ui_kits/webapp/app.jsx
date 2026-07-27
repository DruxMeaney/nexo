/* NEXO UI kit — root app + simple screen router. */

function App() {
  const [screen, setScreen] = React.useState("landing");
  const go = (s) => { setScreen(s); window.scrollTo({ top: 0, behavior: "instant" }); };

  return (
    <div className="shell">
      <Topbar go={go} current={screen} />
      {screen === "landing" && <Landing go={go} />}
      {screen === "start" && <StartScreen go={go} />}
      {screen === "runner" && <Runner go={go} />}
      {screen === "results" && <Results go={go} />}
      <Footer go={go} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

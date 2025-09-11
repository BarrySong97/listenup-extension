export default function Panel() {
  return (
    <div className="container" style={{ height: "100vh", width: "100%" }}>
      <iframe
        src="https://chatgpt.com"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
        allow="microphone; camera; encrypted-media"
      />
    </div>
  );
}

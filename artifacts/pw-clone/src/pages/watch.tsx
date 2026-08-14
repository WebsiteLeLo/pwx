export default function Watch() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "8px",
          }}
        >
          Videos not available now
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Please try again later.
        </div>
      </div>
    </div>
  );
}

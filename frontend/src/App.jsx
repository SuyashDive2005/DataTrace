import { useState } from "react";
import Navbar from "./components/Navbar";
import UploadZone from "./components/UploadZone";
import LoadingSpinner from "./components/LoadingSpinner";
import ResultsView from "./components/ResultsView";
import HistoryTable from "./components/HistoryTable";
import "./index.css";

async function readApiResponse(res) {
  const raw = await res.text();

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {
      error: `Server returned non-JSON response (HTTP ${res.status}).`,
      raw,
    };
  }
}

export default function App() {
  // View state: 'upload' | 'loading' | 'results' | 'history'
  const [view, setView] = useState("upload");
  const [resultData, setResultData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [error, setError] = useState(null);

  /* ── Upload CSV → run full pipeline ─────────────────────────── */
  const handleUpload = async (file) => {
    setView("loading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(
          data.error ||
            `Upload failed (HTTP ${res.status}). Check if backend is running on port 5000.`,
        );
      }

      setResultData(data);
      setView("results");
    } catch (e) {
      setError(e.message);
      setView("upload");
    }
  };

  /* ── Navigation handler ─────────────────────────────────────── */
  const handleNavigate = async (destination) => {
    if (destination === "history") {
      try {
        const res = await fetch("/api/history");
        const data = await readApiResponse(res);

        if (!res.ok) {
          throw new Error(
            data.error || `Failed to load history (HTTP ${res.status}).`,
          );
        }

        setHistoryData(data.runs || []);
        setView("history");
      } catch (e) {
        setError(
          e.message || "Failed to load history — is the Flask server running?",
        );
        setView("upload");
      }
    } else {
      setView(destination);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <Navbar view={view} onNavigate={handleNavigate} />

      <main>
        {view === "upload" && (
          <UploadZone onUpload={handleUpload} error={error} />
        )}
        {view === "loading" && <LoadingSpinner />}
        {view === "results" && resultData && (
          <ResultsView data={resultData} onBack={() => setView("upload")} />
        )}
        {view === "history" && (
          <HistoryTable data={historyData} onBack={() => setView("upload")} />
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function normalizeSerial(value) {
  return (value || "").trim().toUpperCase();
}

const STORAGE_KEY = "serial_scan_dup.current_pallet_v1";

export default function App() {
  const [inputValue, setInputValue] = useState("");
  const [serials, setSerials] = useState([]);         // únicos, en orden de entrada
  const [duplicates, setDuplicates] = useState([]);   // { serial, firstAt, dupAt }
  const [scanCount, setScanCount] = useState(0);      // total de intentos (únicos + duplicados)
  const [lastStatus, setLastStatus] = useState(null);
  const inputRef = useRef(null);

  // ── Persistencia ──────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.serials)) setSerials(parsed.serials);
        if (Array.isArray(parsed.duplicates)) setDuplicates(parsed.duplicates);
        if (typeof parsed.scanCount === "number") setScanCount(parsed.scanCount);
      }
    } catch (e) {
      console.warn("No se pudo leer localStorage:", e);
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ serials, duplicates, scanCount }));
  }, [serials, duplicates, scanCount]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const serialSet = useMemo(() => new Set(serials), [serials]);

  // ── Lógica de escaneo ─────────────────────────────────────────────────────
  function submitSerial() {
    const serial = normalizeSerial(inputValue);

    if (!serial) {
      setLastStatus({ type: "empty", message: "Serial vacío — no se añadió" });
      setInputValue("");
      inputRef.current?.focus();
      return;
    }

    const nextScanCount = scanCount + 1;
    setScanCount(nextScanCount);

    if (serialSet.has(serial)) {
      const firstAt = serials.indexOf(serial) + 1;
      setDuplicates((prev) => [...prev, { serial, firstAt, dupAt: nextScanCount }]);
      setLastStatus({ type: "dup", message: `DUPLICADO detectado: ${serial} (picado antes en #${firstAt})` });
      const errorAudio = new Audio(`${import.meta.env.BASE_URL}Error.mp3`);
      errorAudio.volume = 1.0;
      errorAudio.play().catch(() => { });
      setInputValue("");
      inputRef.current?.focus();
      return;
    }

    setSerials((prev) => [...prev, serial]);
    setLastStatus({ type: "ok", message: `Añadido: ${serial}` });
    const correctAudio = new Audio(`${import.meta.env.BASE_URL}Correct.mp3`);
    correctAudio.volume = 0.5;
    correctAudio.play().catch(() => { });
    setInputValue("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSerial();
    }
  }

  function undoLast() {
    setSerials((prev) => prev.slice(0, -1));
    setScanCount((n) => Math.max(0, n - 1));
    setLastStatus({ type: "info", message: "Último serial eliminado" });
    inputRef.current?.focus();
  }

  function resetAll() {
    setSerials([]);
    setDuplicates([]);
    setScanCount(0);
    setLastStatus({ type: "info", message: "Pallet reiniciado" });
    setInputValue("");
    inputRef.current?.focus();
  }

  async function copyValues() {
    if (serials.length === 0) {
      setLastStatus({ type: "empty", message: "No hay seriales para copiar" });
      return;
    }
    const text = [...serialSet].join(", ");
    try {
      await navigator.clipboard.writeText(text);
      setLastStatus({ type: "ok", message: `${serialSet.size} serial(es) copiados al portapapeles` });
    } catch {
      setLastStatus({ type: "empty", message: "No se pudo acceder al portapapeles" });
    }
    inputRef.current?.focus();
  }

  return (
    <div className="page">
      <header className="header flex">
        <div className="brand-banner__title">Serial Guard</div>
        <div className="brand-banner__sub">by Pulsia Itech</div>

        <p className="sub">
          Escanea o escribe un número de serie y pulsa <b>Enter</b>.
          Los duplicados se detectan al instante.
        </p>
      </header>

      {/* ── Scanner panel ── */}
      <section className="card">
        <label className="label" htmlFor="serialInput">Número de serie</label>

        <div className="row">
          <div className="input-wrap">
            <span className="input-icon">⌸</span>
            <input
              id="serialInput"
              ref={inputRef}
              className="input"
              placeholder="Escanea o escribe aquí…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <button className="btn btn--primary" onClick={submitSerial}>
            Añadir
          </button>
        </div>

        {lastStatus && (
          <div className={`status status--${lastStatus.type}`}>
            {lastStatus.message}
          </div>
        )}

        <div className="stats">
          <div className="stat">
            <span className="stat__label">Total escaneados</span>
            <span className="stat__value">{scanCount}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Únicos</span>
            <span className="stat__value">{serialSet.size}</span>
          </div>
          <div className="stat stat--err">
            <span className="stat__label">Duplicados</span>
            <span className="stat__value">{duplicates.length}</span>
          </div>
        </div>

        <div className="actions">
          <button className="btn btn--secondary" onClick={undoLast} disabled={serials.length === 0}>
            ↩ Deshacer
          </button>
          <button className="btn btn--secondary" onClick={resetAll} disabled={scanCount === 0}>
            ✕ Reiniciar pallet
          </button>
          <button className="btn btn--primary" onClick={copyValues} disabled={serials.length === 0}>
            ⎘ Copiar valores
          </button>
        </div>
      </section>

      {/* ── Seriales únicos ── */}
      <section className="card">
        <h2>Seriales escaneados</h2>

        {serials.length === 0 ? (
          <p className="muted">Aún no hay seriales. Escanea el primero.</p>
        ) : (
          <ol className="list">
            {serials.map((s, idx) => (
              <>
                {idx > 0 && <hr key={`div-${idx}`} className="list__divider" />}
                <li key={`${s}-${idx}`} className="list__item">
                  <span className="list__num">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="list__serial">{s}</span>
                </li>
              </>
            ))}
          </ol>
        )}
      </section>

      {/* ── Duplicados ── */}
      {duplicates.length > 0 && (
        <section className="card card--danger">
          <h2>Duplicados detectados</h2>
          <ol className="list">
            {duplicates.map((d, idx) => (
              <>
                {idx > 0 && <hr key={`ddiv-${idx}`} className="list__divider" />}
                <li key={`dup-${idx}`} className="list__item">
                  <span className="list__num">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="list__serial">{d.serial}</span>
                  <span className="list__dup-info">
                    picado en #{d.dupAt} · original en #{d.firstAt}
                  </span>
                </li>
              </>
            ))}
          </ol>
        </section>
      )}

      <footer className="footer">
        <p className="muted">
          Si el lector añade Enter automáticamente, solo escanea sin tocar nada más.
        </p>
      </footer>

      <div className="copyright">
        © {new Date().getFullYear()} Daniel Gallego
      </div>
    </div>
  );
}
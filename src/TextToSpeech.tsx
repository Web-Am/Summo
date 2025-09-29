import React, { useRef, useState } from "react";
import { APIKEY } from "./apikey";
import jsPDF from "jspdf";

const GEMINI_API_KEY = APIKEY;
const GEMINI_MODEL = "gemini-2.5-flash";

const AudioRecorder: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [summary, setSummary] = useState("");
    const [mode, setMode] = useState("breve");

    const recognitionRef = useRef<any>(null);
    const transcriptBufferRef = useRef<string>("");

    const startRecording = () => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Il tuo browser non supporta la Web Speech API");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = "it-IT";

        recognition.onresult = (event: any) => {
            let newText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                newText += event.results[i][0].transcript + " ";
            }
            transcriptBufferRef.current = (transcriptBufferRef.current + " " + newText).trim();
            setTranscript(transcriptBufferRef.current);
        };

        recognition.onerror = (ev: any) => {
            console.error("SpeechRecognition error:", ev);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
        setIsPaused(false);
    };

    const pauseRecording = () => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
        setIsPaused(true);
    };

    const resumeRecording = () => {
        startRecording();
        setIsPaused(false);
    };

    const stopRecording = async () => {
        const rec = recognitionRef.current;

        const finalTranscript = await new Promise<string>((resolve) => {
            if (!rec) {
                resolve(transcriptBufferRef.current);
                return;
            }

            let settled = false;
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    resolve(transcriptBufferRef.current);
                }
            }, 2000);

            rec.onend = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    resolve(transcriptBufferRef.current);
                }
            };

            rec.onerror = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    resolve(transcriptBufferRef.current);
                }
            };

            rec.stop();
            recognitionRef.current = null;
        });

        setIsRecording(false);
        setIsPaused(false);
        setLoading(true);
        setTranscript(finalTranscript);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Fai un riassunto in modalità "${mode}" del seguente testo:

${finalTranscript}`,
                                    },
                                ],
                            },
                        ],
                    }),
                }
            );

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Nessun risultato.";
            setSummary(aiText);
        } catch (err) {
            console.error("Errore Gemini:", err);
            setSummary("Errore nella generazione del riassunto.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Riassuntore AI", 10, 10);

        doc.setFontSize(12);
        doc.text("Trascrizione:", 10, 25);
        doc.setFontSize(10);
        doc.text(doc.splitTextToSize(transcript, 180), 10, 35);

        doc.setFontSize(12);
        doc.text("Riassunto:", 10, 60);
        doc.setFontSize(10);
        doc.text(doc.splitTextToSize(summary, 180), 10, 70);

        doc.save("riassunto.pdf");
    };

    const renderSummary = () => {
        if (mode === "a punti" || mode === "schematico") {
            const lines = summary.split(/\n|•|-/).filter((l) => l.trim() !== "");
            return (
                <ul>
                    {lines.map((line, idx) => (
                        <li key={idx}>{line.trim()}</li>
                    ))}
                </ul>
            );
        }
        return <p className="card-text">{summary}</p>;
    };

    return (
        <div className="container py-5">

            <div className="d-flex w-100 justify-content-center align-items-center mb-4">
                <h1 className="text-center  fw-bold text-gradient mx-2 mb-0">Summo lime</h1>
                <img src="logo192.png" className="mx-2" style={{ width: 30, height: 30 }}></img>
            </div>

            <div className="card shadow-lg border-0 rounded-4 p-4">
                <div className="card-body text-center">
                    <div className="mb-3">
                        <label className="fw-bold me-2">Modalità riassunto:</label>
                        <select
                            className="form-select w-auto d-inline-block"
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                        >
                            <option value="dettagliato">Dettagliato</option>
                            <option value="breve">Breve</option>
                            <option value="a punti">A punti</option>
                            <option value="schematico">Schematizzato</option>
                            <option value="estremamente sintetico">Estremamente sintetico</option>
                            <option value="critico">Critico</option>
                        </select>
                    </div>

                    {!isRecording && !loading && (
                        <button
                            className="btn btn-lg btn-gradient px-5 py-3 mb-3"
                            onClick={startRecording}
                        >
                            🎤 Avvia Registrazione
                        </button>
                    )}

                    {isRecording && !isPaused && (
                        <div className="d-flex justify-content-center gap-3 mb-3">
                            <button className="btn btn-warning btn-lg px-4" onClick={pauseRecording}>
                                ⏸ Pausa
                            </button>
                            <button className="btn btn-danger btn-lg px-4" onClick={stopRecording}>
                                ⏹ Stop
                            </button>
                        </div>
                    )}

                    {isRecording && isPaused && (
                        <div className="d-flex justify-content-center gap-3 mb-3">
                            <button className="btn btn-success btn-lg px-4" onClick={resumeRecording}>
                                ▶️ Riprendi
                            </button>
                            <button className="btn btn-danger btn-lg px-4" onClick={stopRecording}>
                                ⏹ Stop
                            </button>
                        </div>
                    )}

                    {loading && <p className="mt-3 fs-5">⏳ Sto convertendo e riassumendo...</p>}
                </div>
            </div>

            {transcript && (
                <div className="card mt-4 shadow-sm border-0 rounded-4">
                    <div className="card-body">
                        <h5 className="card-title fw-bold">Trascrizione</h5>
                        <p className="card-text">{transcript}</p>
                    </div>
                </div>
            )}

            {summary && (
                <div className="card mt-4 shadow-sm border-0 rounded-4 bg-light">
                    <div className="card-body">
                        <h5 className="card-title fw-bold">Riassunto AI</h5>
                        {renderSummary()}
                        <button className="btn btn-outline-primary mt-3" onClick={downloadPDF}>
                            📄 Scarica PDF
                        </button>
                    </div>
                </div>
            )}

            <style>
                {`
          .btn-gradient {
            background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            color: white;
            font-size: 1.2rem;
            border: none;
            border-radius: 12px;
            transition: transform 0.2s ease-in-out;
          }
          .btn-gradient:hover {
            transform: scale(1.05);
          }
          .text-gradient {
            background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
        `}
            </style>
        </div>
    );
};

export default AudioRecorder;

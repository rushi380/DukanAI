import { useState, useRef, useCallback, useEffect } from "react";

const ERROR_MAP = {
  "no-speech":          "काही ऐकले नाही — पुन्हा बोला",
  "not-allowed":        "मायक्रोफोनची परवानगी द्या (browser settings मध्ये Allow करा)",
  "audio-capture":      "मायक्रोफोन वापरता येत नाही — तपासा",
  "network":            "नेटवर्क तपासा",
  "aborted":            "रद्द केले",
  "service-not-allowed":"Speech service उपलब्ध नाही",
};

export function useVoice({ onResult, lang = "mr-IN" }) {
  const [listening, setListening]             = useState(false);
  const [transcript, setTranscript]           = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError]                     = useState(null);
  const [isSupported, setIsSupported]         = useState(true);

  const recognitionRef   = useRef(null);
  const silenceTimerRef  = useRef(null);
  const finalRef         = useRef("");          // accumulate final words
  const hasSubmittedRef  = useRef(false);       // prevent double-submit

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    finalRef.current = "";
    hasSubmittedRef.current = false;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError(ERROR_MAP["not-allowed"]); return; }

    const rec = new SR();
    rec.lang            = lang;
    rec.continuous      = true;   // keep listening until stop
    rec.interimResults  = true;   // show live text
    rec.maxAlternatives = 3;      // get multiple guesses, pick best

    rec.onstart = () => setListening(true);

    rec.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // Pick highest-confidence alternative
        let bestText = result[0].transcript;
        let bestConf = result[0].confidence;
        for (let j = 1; j < result.length; j++) {
          if (result[j].confidence > bestConf) {
            bestConf = result[j].confidence;
            bestText = result[j].transcript;
          }
        }

        if (result.isFinal) {
          finalRef.current += bestText + " ";
        } else {
          interim += bestText;
        }
      }

      setTranscript(finalRef.current.trim());
      setInterimTranscript(interim);

      // Reset silence timer on every word
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const full = (finalRef.current + " " + interim).trim();
        if (full.length > 1 && !hasSubmittedRef.current) {
          hasSubmittedRef.current = true;
          rec.stop();
          if (onResult) onResult(full);
        }
      }, 1800); // 1.8 seconds of silence = done speaking
    };

    rec.onerror = (event) => {
      clearTimeout(silenceTimerRef.current);
      setError(ERROR_MAP[event.error] || `Voice error: ${event.error}`);
      setListening(false);
    };

    rec.onend = () => {
      clearTimeout(silenceTimerRef.current);
      setListening(false);
      setInterimTranscript("");

      // If stopped without auto-submit (user clicked stop), submit now
      const full = finalRef.current.trim();
      if (full.length > 1 && !hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        if (onResult) onResult(full);
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [lang, onResult]);

  const stopListening = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
    setListening(false);
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    finalRef.current = "";
    hasSubmittedRef.current = false;
  }, []);

  return {
    listening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    reset,
  };
}
"use client";
import { useState, useRef } from "react";

const mockQuestions = [
  {
    subject: "Mathematics · WAEC 2023",
    question: "If 2x + 5 = 13, what is the value of x?",
    options: ["A. x = 3", "B. x = 4", "C. x = 6", "D. x = 9"],
    correct: 1,
    explanation: "2x = 13 − 5 = 8, so x = 4. Answer is B.",
  },
  {
    subject: "Biology · JAMB 2022",
    question: "Which organelle is responsible for producing energy in a cell?",
    options: ["A. Nucleus", "B. Ribosome", "C. Mitochondria", "D. Golgi body"],
    correct: 2,
    explanation: "Mitochondria is the powerhouse of the cell, producing ATP through cellular respiration.",
  },
  {
    subject: "Chemistry · WAEC 2022",
    question: "What is the chemical formula for water?",
    options: ["A. CO₂", "B. NaCl", "C. H₂O", "D. O₂"],
    correct: 2,
    explanation: "Water is made of 2 hydrogen atoms and 1 oxygen atom — H₂O. Answer is C.",
  },
  {
    subject: "Physics · NECO 2023",
    question: "What is the SI unit of electric current?",
    options: ["A. Volt", "B. Watt", "C. Ohm", "D. Ampere"],
    correct: 3,
    explanation: "The SI unit of electric current is the Ampere (A), named after André-Marie Ampère.",
  },
  {
    subject: "English Language · WAEC 2023",
    question: "Choose the word closest in meaning to 'ELOQUENT'.",
    options: ["A. Silent", "B. Fluent", "C. Angry", "D. Confused"],
    correct: 1,
    explanation: "Eloquent means fluent and persuasive in speaking or writing. Answer is B.",
  },
  {
    subject: "Geography · JAMB 2022",
    question: "Which of these is the largest river in Nigeria?",
    options: ["A. Kaduna River", "B. Benue River", "C. Niger River", "D. Cross River"],
    correct: 2,
    explanation: "The Niger River is the largest river in Nigeria, flowing through the country before emptying into the Atlantic.",
  },
  {
    subject: "History · NECO 2022",
    question: "In what year did Nigeria gain independence?",
    options: ["A. 1955", "B. 1960", "C. 1963", "D. 1966"],
    correct: 1,
    explanation: "Nigeria gained independence from British rule on October 1, 1960. Answer is B.",
  },
  {
    subject: "Economics · WAEC 2023",
    question: "When demand increases and supply remains constant, price will:",
    options: ["A. Fall", "B. Stay the same", "C. Rise", "D. Fluctuate randomly"],
    correct: 2,
    explanation: "When demand rises with constant supply, scarcity increases, pushing prices up. Answer is C.",
  },
  {
    subject: "Accounts · JAMB 2022",
    question: "Which accounting equation is correct?",
    options: ["A. Assets = Liabilities − Capital", "B. Assets = Capital + Liabilities", "C. Capital = Assets + Liabilities", "D. Liabilities = Assets + Capital"],
    correct: 1,
    explanation: "The fundamental accounting equation is Assets = Capital + Liabilities. Answer is B.",
  },
  {
    subject: "CRK · WAEC 2022",
    question: "According to the Bible, who was thrown into the den of lions?",
    options: ["A. Joseph", "B. Elijah", "C. Daniel", "D. Ezekiel"],
    correct: 2,
    explanation: "Daniel was thrown into the den of lions by King Darius but was protected by God. Answer is C.",
  },
  {
    subject: "Agric Science · NECO 2023",
    question: "Which of these is a leguminous crop?",
    options: ["A. Maize", "B. Cassava", "C. Soybean", "D. Yam"],
    correct: 2,
    explanation: "Soybean is a leguminous crop that fixes atmospheric nitrogen into the soil. Answer is C.",
  },
  {
    subject: "Government · WAEC 2023",
    question: "The principle of separation of powers was propounded by:",
    options: ["A. John Locke", "B. Montesquieu", "C. Jean-Jacques Rousseau", "D. Thomas Hobbes"],
    correct: 1,
    explanation: "Baron de Montesquieu propounded the doctrine of separation of powers in 'The Spirit of the Laws'. Answer is B.",
  },
];

export function BotMockup() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      setCurrent((c) =>
        diff > 0
          ? (c + 1) % mockQuestions.length
          : (c - 1 + mockQuestions.length) % mockQuestions.length
      );
    }
    touchStartX.current = null;
  }

  const q = mockQuestions[current];

  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div
        className="overflow-hidden rounded-3xl border-4 border-slate-800 shadow-2xl shadow-slate-900/40"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3 bg-[#2b5278] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white shadow">
            E
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">ExamBuddie</p>
            <p className="text-xs text-green-400">bot · online</p>
          </div>
        </div>

        <div className="min-h-72 space-y-3 bg-[#0d1117] p-3 transition-all duration-300">
          <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#2b5278] p-3">
            <p className="mb-1.5 text-[10px] font-semibold text-blue-300">📝 {q.subject}</p>
            <p className="text-xs leading-relaxed text-white">{q.question}</p>
          </div>

          <div className="space-y-1.5">
            {q.options.map((label, i) => (
              <div
                key={label}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  i === q.correct ? "bg-green-600 text-white" : "bg-[#1e3a5f] text-slate-300"
                }`}
              >
                {label} {i === q.correct && "✓"}
              </div>
            ))}
          </div>

          <div className="max-w-[88%] rounded-xl border border-green-800/40 bg-[#162a1e] p-2.5">
            <p className="mb-1 text-[10px] font-bold text-green-400">💡 Explanation</p>
            <p className="text-[10px] leading-relaxed text-green-200">{q.explanation}</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setCurrent((c) => (c + 1) % mockQuestions.length)}
              className="rounded-full bg-blue-700 px-3 py-1 text-[10px] font-semibold text-white hover:bg-blue-800 transition-colors"
            >
              Next question →
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#0d1117] px-3 pt-1 pb-2">
          <button
            onClick={() => setCurrent((c) => (c - 1 + mockQuestions.length) % mockQuestions.length)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e3a5f] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white text-xs"
          >
            ‹
          </button>
          <div className="flex items-center gap-1">
            {mockQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === current ? "h-1.5 w-3 bg-blue-500" : "h-1.5 w-1.5 bg-slate-600 hover:bg-slate-400"
                }`}
                aria-label={`Question ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrent((c) => (c + 1) % mockQuestions.length)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e3a5f] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white text-xs"
          >
            ›
          </button>
        </div>
        <p className="bg-[#0d1117] pb-3 text-center text-[9px] text-slate-600">click · swipe · tap arrows</p>
      </div>

      <div className="absolute -right-3 -top-3 rounded-full bg-green-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
        Live bot
      </div>
    </div>
  );
}

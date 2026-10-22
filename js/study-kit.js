/**
 * SignAid AI - Post-Class Study Kit Generator
 * Synthesizes classroom transcripts into an executive summary, key takeaways,
 * 3D flip flashcards, and an interactive 5-question comprehension quiz.
 */

const StudyKit = {
  data: null,
  currentCardIndex: 0,
  quizAnswers: {},
  isFlipped: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const genBtn = document.getElementById('generateStudyKitBtn');
    if (genBtn) {
      genBtn.addEventListener('click', () => this.generateKit());
    }

    const prevCardBtn = document.getElementById('prevFlashcardBtn');
    if (prevCardBtn) {
      prevCardBtn.addEventListener('click', () => this.prevCard());
    }

    const nextCardBtn = document.getElementById('nextFlashcardBtn');
    if (nextCardBtn) {
      nextCardBtn.addEventListener('click', () => this.nextCard());
    }

    const flipTrigger = document.getElementById('flashcardWrapper');
    if (flipTrigger) {
      flipTrigger.addEventListener('click', () => this.toggleFlip());
      flipTrigger.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.toggleFlip();
        }
      });
    }

    const retryQuizBtn = document.getElementById('retryQuizBtn');
    if (retryQuizBtn) {
      retryQuizBtn.addEventListener('click', () => this.resetQuiz());
    }
  },

  async generateKit() {
    const transcript = window.CaptionsEngine ? window.CaptionsEngine.getAllTranscriptText() : "";
    const container = document.getElementById('studyKitResultContainer');
    const loadingState = document.getElementById('studyKitLoadingState');
    const emptyState = document.getElementById('studyKitEmptyState');

    if (!transcript || transcript.trim().length < 20) {
      alert("Transcript is too short to generate a study kit. Please record more speech or launch Demo Mode first!");
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (container) container.classList.add('hidden');
    if (loadingState) loadingState.classList.remove('hidden');

    try {
      this.data = await this.fetchAIStudyKit(transcript);
    } catch (err) {
      console.warn("AI Study Kit generation error, falling back to offline kit:", err);
      this.data = this.getFallbackKit(transcript);
    } finally {
      if (loadingState) loadingState.classList.add('hidden');
      if (container) container.classList.remove('hidden');
      this.renderAll();
    }
  },

  async fetchAIStudyKit(transcript) {
    const apiKey = window.CONFIG ? window.CONFIG.GEMINI_API_KEY : "";
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.trim() === "") {
      return this.getFallbackKit(transcript);
    }

    const prompt = `You are SignAid, an AI learning assistant for hearing-impaired students.
Generate a comprehensive Study Kit from the following lecture transcript:
"${transcript}"

Output valid, parseable JSON ONLY with no code fence markdown around it, conforming to this exact JSON schema:
{
  "summary": "2-3 sentence executive summary of the lecture",
  "keyPoints": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3",
    "Key takeaway point 4"
  ],
  "flashcards": [
    { "q": "Concept question 1?", "a": "Clear answer 1" },
    { "q": "Concept question 2?", "a": "Clear answer 2" },
    { "q": "Concept question 3?", "a": "Clear answer 3" },
    { "q": "Concept question 4?", "a": "Clear answer 4" }
  ],
  "quiz": [
    {
      "question": "Multiple choice question 1?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "explanation": "Why this option is correct."
    },
    {
      "question": "Multiple choice question 2?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 1,
      "explanation": "Why this option is correct."
    },
    {
      "question": "Multiple choice question 3?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 2,
      "explanation": "Why this option is correct."
    },
    {
      "question": "Multiple choice question 4?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 3,
      "explanation": "Why this option is correct."
    },
    {
      "question": "Multiple choice question 5?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 1,
      "explanation": "Why this option is correct."
    }
  ]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${window.CONFIG.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1800 }
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No data returned");

    // Clean JSON formatting
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  },

  getFallbackKit(transcript) {
    const textLower = transcript.toLowerCase();
    const fallbackKits = window.FALLBACK_STUDY_KITS || {};
    
    if (textLower.includes('algorithm') || textLower.includes('search') || textLower.includes('big-o')) {
      return fallbackKits.cs;
    }

    // Dynamic smart generator if other text
    const sentences = transcript.split(/[.?!]/).filter(s => s.trim().length > 15);
    return {
      summary: `In this classroom session, the instructor discussed fundamental principles, focusing on: ${sentences.slice(0, 2).join('. ')}. Students explored theoretical foundations and key problem-solving methodologies.`,
      keyPoints: [
        "Core concepts were examined with relevant classroom analogies.",
        "Students learned the strategic importance of optimal solution design.",
        "Key terminology and principles were emphasized for upcoming examinations.",
        "Practical applications and common misconceptions were addressed."
      ],
      flashcards: [
        { q: "What was the central topic introduced in this lecture?", a: sentences[0] || "Foundational classroom concepts and principles." },
        { q: "What should students review prior to the next class?", a: "The highlighted key terms and core problem definitions discussed today." },
        { q: "How can students test their comprehension?", a: "By attempting the 5-question quiz below and reviewing flagged timestamps." }
      ],
      quiz: [
        {
          question: "Which of the following was a primary focus during this lecture segment?",
          options: ["Core theoretical foundations", "Unrelated historical dates", "Purely mechanical memorization", "None of the above"],
          answerIndex: 0,
          explanation: "The lecture emphasized conceptual understanding and underlying theoretical structure."
        },
        {
          question: "Why is active review of classroom transcripts recommended?",
          options: ["To reinforce retention and clarify missed terms", "To waste time", "To avoid homework", "It has no benefit"],
          answerIndex: 0,
          explanation: "Reviewing real-time transcripts bridges comprehension gaps for hearing-impaired learners."
        },
        {
          question: "What tool allows students to get instant simple explanations during lecture?",
          options: ["The 'I Missed That' button", "Closing the laptop", "Leaving the room", "Manual dictionary"],
          answerIndex: 0,
          explanation: "SignAid's 'I Missed That' feature re-explains the last 45 seconds in simple terms."
        },
        {
          question: "How does SignAid alert students to sudden classroom sounds?",
          options: ["Visual flashes and caption alerts", "Vibrating desk", "Water spray", "Audio sirens"],
          answerIndex: 0,
          explanation: "Web Audio API triggers visual flashes and screen-reader assertive alerts."
        },
        {
          question: "What script does the Hinglish toggle convert Hindi to?",
          options: ["Roman (Latin) script", "Cyrillic", "Greek", "Arabic"],
          answerIndex: 0,
          explanation: "Hinglish mode transliterates Devanagari Hindi into readable Roman phonetics."
        }
      ]
    };
  },

  renderAll() {
    this.renderSummary();
    this.renderFlashcards();
    this.renderQuiz();
  },

  renderSummary() {
    const summaryText = document.getElementById('studyKitSummaryText');
    const keyPointsList = document.getElementById('studyKitKeyPointsList');

    if (summaryText && this.data.summary) {
      summaryText.textContent = this.data.summary;
    }

    if (keyPointsList && Array.isArray(this.data.keyPoints)) {
      keyPointsList.innerHTML = this.data.keyPoints.map(pt => `
        <li class="key-point-item">
          <span class="bullet-icon">✨</span>
          <span>${pt}</span>
        </li>
      `).join('');
    }
  },

  renderFlashcards() {
    if (!this.data.flashcards || this.data.flashcards.length === 0) return;

    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.updateCardDisplay();
  },

  updateCardDisplay() {
    const cardWrapper = document.getElementById('flashcardWrapper');
    const frontText = document.getElementById('flashcardFrontText');
    const backText = document.getElementById('flashcardBackText');
    const counter = document.getElementById('flashcardCounter');

    if (!cardWrapper || !this.data.flashcards) return;

    const total = this.data.flashcards.length;
    const card = this.data.flashcards[this.currentCardIndex];

    if (counter) counter.textContent = `Card ${this.currentCardIndex + 1} of ${total}`;

    // Reset flip orientation
    this.isFlipped = false;
    cardWrapper.classList.remove('is-flipped');

    if (frontText) frontText.textContent = card.q;
    if (backText) backText.textContent = card.a;
  },

  toggleFlip() {
    const cardWrapper = document.getElementById('flashcardWrapper');
    if (!cardWrapper) return;
    this.isFlipped = !this.isFlipped;
    if (this.isFlipped) {
      cardWrapper.classList.add('is-flipped');
    } else {
      cardWrapper.classList.remove('is-flipped');
    }
  },

  nextCard() {
    if (!this.data.flashcards) return;
    if (this.currentCardIndex < this.data.flashcards.length - 1) {
      this.currentCardIndex++;
      this.updateCardDisplay();
    }
  },

  prevCard() {
    if (!this.data.flashcards) return;
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
      this.updateCardDisplay();
    }
  },

  renderQuiz() {
    const quizList = document.getElementById('quizQuestionsContainer');
    if (!quizList || !this.data.quiz) return;

    this.quizAnswers = {};
    const quizScoreBanner = document.getElementById('quizScoreBanner');
    if (quizScoreBanner) quizScoreBanner.classList.add('hidden');

    quizList.innerHTML = this.data.quiz.map((qItem, qIdx) => `
      <div class="quiz-card" data-qindex="${qIdx}">
        <div class="quiz-question-header">
          <span class="q-number">Q${qIdx + 1}</span>
          <h4 class="q-title">${qItem.question}</h4>
        </div>
        <div class="quiz-options">
          ${qItem.options.map((opt, optIdx) => `
            <button class="quiz-option-btn" data-q="${qIdx}" data-opt="${optIdx}">
              <span class="opt-letter">${String.fromCharCode(65 + optIdx)}</span>
              <span class="opt-label">${opt}</span>
            </button>
          `).join('')}
        </div>
        <div class="quiz-feedback-box hidden" id="quizFeedback_${qIdx}"></div>
      </div>
    `).join('');

    this.bindQuizOptionButtons();
  },

  bindQuizOptionButtons() {
    const optionBtns = document.querySelectorAll('.quiz-option-btn');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIdx = parseInt(btn.getAttribute('data-q'), 10);
        const optIdx = parseInt(btn.getAttribute('data-opt'), 10);
        this.selectQuizOption(qIdx, optIdx);
      });
    });
  },

  selectQuizOption(qIdx, optIdx) {
    if (this.quizAnswers[qIdx] !== undefined) return; // already answered

    this.quizAnswers[qIdx] = optIdx;
    const qData = this.data.quiz[qIdx];
    const isCorrect = optIdx === qData.answerIndex;

    const quizCard = document.querySelector(`.quiz-card[data-qindex="${qIdx}"]`);
    const allOptBtns = quizCard.querySelectorAll('.quiz-option-btn');
    
    allOptBtns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === qData.answerIndex) {
        btn.classList.add('correct');
      } else if (idx === optIdx && !isCorrect) {
        btn.classList.add('incorrect');
      }
    });

    const feedbackBox = document.getElementById(`quizFeedback_${qIdx}`);
    if (feedbackBox) {
      feedbackBox.classList.remove('hidden');
      feedbackBox.className = `quiz-feedback-box ${isCorrect ? 'is-correct' : 'is-wrong'}`;
      feedbackBox.innerHTML = `
        <div class="feedback-badge">${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</div>
        <p class="feedback-text">${qData.explanation}</p>
      `;
    }

    this.checkQuizCompletion();
  },

  checkQuizCompletion() {
    if (!this.data.quiz) return;
    const total = this.data.quiz.length;
    const answeredCount = Object.keys(this.quizAnswers).length;

    if (answeredCount === total) {
      let correctCount = 0;
      this.data.quiz.forEach((q, idx) => {
        if (this.quizAnswers[idx] === q.answerIndex) correctCount++;
      });

      const scoreBanner = document.getElementById('quizScoreBanner');
      const scoreValue = document.getElementById('quizScoreValue');
      const scoreMsg = document.getElementById('quizScoreMessage');

      if (scoreBanner && scoreValue) {
        scoreBanner.classList.remove('hidden');
        scoreValue.textContent = `${correctCount} / ${total} (${Math.round((correctCount / total) * 100)}%)`;
        if (scoreMsg) {
          if (correctCount === total) {
            scoreMsg.textContent = "🏆 Perfect Score! You mastered today's lecture concepts!";
          } else if (correctCount >= 3) {
            scoreMsg.textContent = "🌟 Great job! Review bookmarked lecture timestamps for full mastery.";
          } else {
            scoreMsg.textContent = "💡 Good effort! Review the flashcards and try again.";
          }
        }
      }
    }
  },

  resetQuiz() {
    this.quizAnswers = {};
    this.renderQuiz();
  }
};

window.StudyKit = StudyKit;
StudyKit.init();

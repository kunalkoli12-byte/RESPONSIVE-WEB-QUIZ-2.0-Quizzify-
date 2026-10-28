(() => {
  'use strict';

  const USERS_KEY = 'quizzify_users_v1';
  const SESSION_KEY = 'quizzify_current_user_v1';
  const TOTAL_QUESTIONS = 10;
  const QUESTIONS_URL = './questions.json';

  const currentUserName = document.querySelector('#current-user-name');
  const loadingState = document.querySelector('#loading-state');
  const loadError = document.querySelector('#load-error');
  const loadErrorText = document.querySelector('#load-error-text');
  const retryButton = document.querySelector('#retry-button');
  const quizPanel = document.querySelector('#quiz-panel');
  const resultsPanel = document.querySelector('#results-panel');
  const questionCounter = document.querySelector('#question-counter');
  const topicBadge = document.querySelector('#topic-badge');
  const progress = document.querySelector('#quiz-progress');
  const progressFill = document.querySelector('#progress-fill');
  const difficultyLabel = document.querySelector('#difficulty-label');
  const questionText = document.querySelector('#question-text');
  const answerList = document.querySelector('#answer-list');
  const quizMessage = document.querySelector('#quiz-message');
  const previousButton = document.querySelector('#previous-button');
  const nextButton = document.querySelector('#next-button');
  const submitButton = document.querySelector('#submit-button');
  const logoutButton = document.querySelector('#logout-button');
  const resultsLogoutButton = document.querySelector('#results-logout-button');
  const restartButton = document.querySelector('#restart-button');

  let user = null;
  let questionBank = [];
  let attemptQuestions = [];
  let selectedAnswers = [];
  let currentIndex = 0;

  function redirectToLogin() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Storage may be blocked. */ }
    window.location.replace('./login.html');
  }

  function getAuthenticatedUser() {
    try {
      const sessionRaw = localStorage.getItem(SESSION_KEY);
      const usersRaw = localStorage.getItem(USERS_KEY);
      if (!sessionRaw || !usersRaw) return null;
      const session = JSON.parse(sessionRaw);
      const users = JSON.parse(usersRaw);
      if (!session || typeof session.userId !== 'string' || !Array.isArray(users)) return null;
      const savedUser = users.find((candidate) => candidate && candidate.id === session.userId);
      if (!savedUser || typeof savedUser.name !== 'string' || typeof savedUser.email !== 'string') return null;
      return { id: savedUser.id, name: savedUser.name, email: savedUser.email };
    } catch {
      return null;
    }
  }

  function logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      window.location.assign('./login.html');
    }
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const otherIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
    }
    return shuffled;
  }

  function validateQuestionBank(data) {
    if (!Array.isArray(data) || data.length !== 40) {
      throw new Error('The question bank must contain exactly 40 questions. Check questions.json and try again.');
    }

    const ids = new Set();
    const normalizedQuestions = new Set();
    const topicCounts = { HTML: 0, CSS: 0 };

    for (const question of data) {
      if (!question || typeof question !== 'object') throw new Error('A question entry is invalid. Check questions.json and retry.');
      if (typeof question.id !== 'string' || !question.id.trim() || ids.has(question.id)) {
        throw new Error('Every question must have a unique, non-empty ID. Check questions.json and retry.');
      }
      ids.add(question.id);
      if (!['HTML', 'CSS'].includes(question.topic)) throw new Error(`Question ${question.id} has an invalid topic.`);
      topicCounts[question.topic] += 1;
      if (typeof question.question !== 'string' || !question.question.trim()) throw new Error(`Question ${question.id} is missing its text.`);
      const normalized = question.question.trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalizedQuestions.has(normalized)) throw new Error('Duplicate question text was found in questions.json.');
      normalizedQuestions.add(normalized);
      if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`Question ${question.id} must have exactly four options.`);
      const optionIds = new Set();
      const optionTexts = new Set();
      for (const option of question.options) {
        if (!option || typeof option.id !== 'string' || typeof option.text !== 'string' || !option.text.trim()) {
          throw new Error(`Question ${question.id} contains an invalid answer option.`);
        }
        if (optionIds.has(option.id) || optionTexts.has(option.text.trim().toLowerCase())) {
          throw new Error(`Question ${question.id} has repeated options.`);
        }
        optionIds.add(option.id);
        optionTexts.add(option.text.trim().toLowerCase());
      }
      if (optionIds.size !== 4 || !optionIds.has(question.correctAnswer)) throw new Error(`Question ${question.id} must have exactly one valid correct answer.`);
      if (typeof question.explanation !== 'string' || !question.explanation.trim()) throw new Error(`Question ${question.id} is missing its explanation.`);
      if (typeof question.difficulty !== 'string' || !question.difficulty.trim()) throw new Error(`Question ${question.id} is missing its difficulty.`);
    }

    if (topicCounts.HTML !== 20 || topicCounts.CSS !== 20) {
      throw new Error(`The bank must contain 20 HTML and 20 CSS questions. Found ${topicCounts.HTML} HTML and ${topicCounts.CSS} CSS.`);
    }
    return data;
  }

  function setLoading(isLoading) {
    loadingState.hidden = !isLoading;
    retryButton.disabled = isLoading;
    if (isLoading) {
      loadError.hidden = true;
      quizPanel.hidden = true;
      resultsPanel.hidden = true;
    }
  }

  function showLoadError(error) {
    loadingState.hidden = true;
    quizPanel.hidden = true;
    resultsPanel.hidden = true;
    loadError.hidden = false;
    loadErrorText.textContent = error instanceof Error ? error.message : 'An unexpected error occurred. Please retry.';
  }

  async function loadQuestions() {
    setLoading(true);
    try {
      const response = await fetch(QUESTIONS_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`The question file could not be loaded (HTTP ${response.status}). Run this project through VS Code Live Server and retry.`);
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('questions.json is not valid JSON. Correct the file and retry.');
      }
      questionBank = validateQuestionBank(data);
      startNewAttempt();
    } catch (error) {
      showLoadError(error);
    }
  }

  function chooseAttemptQuestions() {
    const htmlQuestions = shuffle(questionBank.filter((question) => question.topic === 'HTML')).slice(0, 5);
    const cssQuestions = shuffle(questionBank.filter((question) => question.topic === 'CSS')).slice(0, 5);
    return shuffle([...htmlQuestions, ...cssQuestions]);
  }

  function startNewAttempt() {
    if (questionBank.length !== 40) {
      showLoadError(new Error('Questions are not available yet. Retry loading the question bank.'));
      return;
    }
    attemptQuestions = chooseAttemptQuestions();
    selectedAnswers = new Array(TOTAL_QUESTIONS).fill(null);
    currentIndex = 0;
    loadingState.hidden = true;
    loadError.hidden = true;
    resultsPanel.hidden = true;
    quizPanel.hidden = false;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function createAnswerOption(question, option) {
    const label = document.createElement('label');
    label.className = 'answer-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `answer-${question.id}`;
    input.value = option.id;
    input.checked = selectedAnswers[currentIndex] === option.id;
    const text = document.createElement('span');
    text.className = 'answer-option-text';
    text.textContent = option.text;
    if (input.checked) label.classList.add('is-selected');

    input.addEventListener('change', () => {
      selectedAnswers[currentIndex] = option.id;
      answerList.querySelectorAll('.answer-option').forEach((answerLabel) => answerLabel.classList.remove('is-selected'));
      label.classList.add('is-selected');
      quizMessage.textContent = '';
    });

    label.append(input, text);
    return label;
  }

  function renderQuestion() {
    const question = attemptQuestions[currentIndex];
    if (!question) return;

    questionCounter.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${TOTAL_QUESTIONS}`;
    topicBadge.textContent = question.topic;
    topicBadge.className = `topic-badge ${question.topic === 'HTML' ? 'topic-html' : 'topic-css'}`;
    difficultyLabel.textContent = `${question.difficulty} question`;
    questionText.textContent = question.question;
    answerList.replaceChildren();
    shuffle(question.options).forEach((option) => answerList.append(createAnswerOption(question, option)));

    const progressValue = currentIndex + 1;
    progress.setAttribute('aria-valuenow', String(progressValue));
    progress.setAttribute('aria-valuetext', `Question ${progressValue} of ${TOTAL_QUESTIONS}`);
    progressFill.style.width = `${(progressValue / TOTAL_QUESTIONS) * 100}%`;
    previousButton.disabled = currentIndex === 0;
    nextButton.hidden = currentIndex === TOTAL_QUESTIONS - 1;
    submitButton.hidden = currentIndex !== TOTAL_QUESTIONS - 1;
    quizMessage.textContent = '';
  }

  function goToNextQuestion() {
    if (!selectedAnswers[currentIndex]) {
      quizMessage.textContent = 'Please choose an answer before continuing.';
      const firstOption = answerList.querySelector('input');
      firstOption?.focus();
      return;
    }
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      currentIndex += 1;
      renderQuestion();
      questionText.focus({ preventScroll: true });
    }
  }

  function goToPreviousQuestion() {
    if (currentIndex > 0) {
      currentIndex -= 1;
      renderQuestion();
      questionText.focus({ preventScroll: true });
    }
  }

  function submitAttempt() {
    const firstUnanswered = selectedAnswers.findIndex((answer) => !answer);
    if (firstUnanswered !== -1) {
      currentIndex = firstUnanswered;
      renderQuestion();
      quizMessage.textContent = 'Please answer every question before submitting. We moved to the first unanswered question.';
      questionText.focus({ preventScroll: true });
      return;
    }

    const result = attemptQuestions.reduce((summary, question, index) => {
      const isCorrect = selectedAnswers[index] === question.correctAnswer;
      if (isCorrect) {
        summary.total += 1;
        summary[question.topic] += 1;
      }
      return summary;
    }, { total: 0, HTML: 0, CSS: 0 });

    renderResults(result);
  }

  function appendReviewLine(parent, label, value) {
    const paragraph = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    const content = document.createElement('span');
    content.textContent = value;
    paragraph.append(strong, content);
    parent.append(paragraph);
  }

  function renderResults(result) {
    quizPanel.hidden = true;
    resultsPanel.hidden = false;
    document.querySelector('#results-user-name').textContent = user.name;
    document.querySelector('#score-value').textContent = `${result.total}/${TOTAL_QUESTIONS}`;
    const percentage = Math.round((result.total / TOTAL_QUESTIONS) * 100);
    document.querySelector('#score-percent').textContent = `${percentage}%`;
    const scoreRing = document.querySelector('#score-ring');
    scoreRing.style.setProperty('--score-deg', `${percentage * 3.6}deg`);
    scoreRing.setAttribute('aria-label', `Score ${result.total} out of ${TOTAL_QUESTIONS}, ${percentage} percent`);
    document.querySelector('#score-detail').textContent = `You answered ${result.total} out of ${TOTAL_QUESTIONS} questions correctly.`;
    document.querySelector('#html-score').textContent = `${result.HTML} / 5`;
    document.querySelector('#css-score').textContent = `${result.CSS} / 5`;

    let messageText = 'Keep practising — you are building your skills';
    if (result.total >= 9) messageText = 'Excellent work — you know your fundamentals';
    else if (result.total >= 7) messageText = 'Strong effort — your foundations are growing';
    else if (result.total >= 4) messageText = 'Good start — review the explanations below';
    document.querySelector('#score-message').textContent = messageText;

    const reviewList = document.querySelector('#review-list');
    reviewList.replaceChildren();
    attemptQuestions.forEach((question, index) => {
      const selectedId = selectedAnswers[index];
      const chosenOption = question.options.find((option) => option.id === selectedId);
      const correctOption = question.options.find((option) => option.id === question.correctAnswer);
      const isCorrect = selectedId === question.correctAnswer;

      const details = document.createElement('details');
      details.className = 'review-item';
      if (!isCorrect) details.open = true;
      const summary = document.createElement('summary');
      const status = document.createElement('span');
      status.className = `review-status ${isCorrect ? 'correct' : 'incorrect'}`;
      status.textContent = isCorrect ? '✓' : '×';
      status.setAttribute('aria-label', isCorrect ? 'Correct answer' : 'Incorrect answer');
      const summaryText = document.createElement('span');
      summaryText.className = 'review-summary-text';
      summaryText.textContent = question.question;
      const meta = document.createElement('span');
      meta.className = 'review-meta';
      meta.textContent = `${question.topic} · ${index + 1}/10`;
      summary.append(status, summaryText, meta);

      const detail = document.createElement('div');
      detail.className = 'review-detail';
      appendReviewLine(detail, 'Your answer', chosenOption ? chosenOption.text : 'No answer selected');
      appendReviewLine(detail, 'Correct answer', correctOption ? correctOption.text : 'Not available');
      const explanation = document.createElement('p');
      explanation.className = 'review-explanation';
      const explanationLabel = document.createElement('strong');
      explanationLabel.textContent = 'Explanation: ';
      const explanationText = document.createElement('span');
      explanationText.textContent = question.explanation;
      explanation.append(explanationLabel, explanationText);
      detail.append(explanation);
      details.append(summary, detail);
      reviewList.append(details);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  logoutButton.addEventListener('click', logout);
  resultsLogoutButton.addEventListener('click', logout);
  retryButton.addEventListener('click', loadQuestions);
  previousButton.addEventListener('click', goToPreviousQuestion);
  nextButton.addEventListener('click', goToNextQuestion);
  submitButton.addEventListener('click', submitAttempt);
  restartButton.addEventListener('click', startNewAttempt);

  user = getAuthenticatedUser();
  if (!user) {
    redirectToLogin();
    return;
  }
  currentUserName.textContent = user.name;
  loadQuestions();
})();

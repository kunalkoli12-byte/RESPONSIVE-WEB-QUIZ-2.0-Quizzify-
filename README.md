# Quizzify — HTML & CSS Quiz Application

Quizzify is a beginner-friendly frontend mini project for practising HTML and CSS. It uses **HTML5, CSS3, vanilla JavaScript, JSON, Fetch API, Web Crypto API and localStorage**. There are no frameworks, build tools, databases or external runtime dependencies.

## Project credits

The original mini-project credits are preserved: **Kunal (group leader), Arvind Anand and Abhishek Yadav**.

## Features

- **Sign in and registration:** the entry page (`index.html`) redirects to `login.html`; registration checks required fields, email format and password confirmation.
- **Password hashing for this demo:** passwords are never saved as plaintext. The browser derives a PBKDF2/SHA-256 hash using a per-account random salt and 210,000 iterations.
- **Local demo accounts:** profile and hash records are stored under `quizzify_users_v1`; the current session is stored separately under `quizzify_current_user_v1`.
- **Protected quiz page:** opening `quiz.html` without a matching demo session redirects to sign-in.
- **Question bank:** `questions.json` contains 40 original multiple-choice questions: 20 HTML and 20 CSS, with four options, one correct answer and an explanation per question.
- **Balanced random quiz:** each attempt samples five HTML and five CSS questions without replacement, then shuffles the combined set and each question's option order.
- **Navigation and results:** one question appears at a time; answers persist while navigating; unanswered items must be completed before submission; the result page shows score, percentage, topic breakdown and explanations for every answer.
- **Responsive and accessible styling:** separate login and quiz styles, shared theme tokens, keyboard focus states, semantic form labels, status announcements and reduced-motion support.

## Run on Windows (VS Code Live Server)

1. Extract the `Quizzify` project folder.
2. Open the folder in Visual Studio Code.
3. Install the **Live Server** extension if it is not already installed.
4. Right-click `index.html` (or `login.html`) and choose **Open with Live Server**.
5. Register a demo account, then start the quiz.

Use a local server rather than double-clicking the HTML file. `fetch('./questions.json')` is often blocked when a page is opened directly with a `file://` URL. A modern browser with Web Crypto support is required for account registration and sign-in; localhost servers are treated as secure contexts by modern browsers.

You can also serve the folder with any static HTTP server. Keep `questions.json` beside `quiz.html` and preserve the relative paths when deploying to a subdirectory such as a GitHub Pages project site.

## Storage and security notes

This is a **frontend-only authentication demonstration**, not production authentication. Anyone with access to the browser profile can inspect or modify localStorage, change the demo account records, or bypass the client-side checks. PBKDF2 means plaintext passwords are not stored, but it does not make localStorage a secure user database. For a real application, use a trusted backend, server-side password hashing, secure session cookies and server-side authorization. This demo does not transmit account information to any third-party service.

The app uses these dedicated keys:

- `quizzify_users_v1` — account profile and password-hash records.
- `quizzify_current_user_v1` — current demo session only.

Logging out removes only the current-session key. It does not delete the saved demo account. To remove a demo account completely, clear the `quizzify_users_v1` key from the browser's Application/Storage developer tools.

## Project structure

```text
Quizzify/
├── index.html              # Entry point; redirects to login.html
├── login.html              # Sign-in and registration UI
├── login.css               # Login-specific responsive styling
├── login.js                # Validation, PBKDF2 hashing and demo session
├── quiz.html               # Quiz and results UI
├── quiz.css                # Quiz-specific responsive styling
├── quiz.js                 # Loading, random selection, navigation and scoring
├── questions.json          # 40-question HTML/CSS question bank
├── theme.css               # Shared theme tokens and reusable styles
├── assets/
│   └── lineargradient.jpg  # Existing project visual asset, preserved
├── test.html               # Existing experiment page, preserved unchanged
└── original-backup/        # Original quiz files and README before the upgrade
```

## Test checklist

The deliverable was checked with static validation for JSON parsing and question-bank structure, JavaScript syntax, HTML file references and preservation of the original files. Browser interactions such as registration, refresh sign-in, keyboard navigation, responsive layout and visual rendering should also be exercised in a real browser through Live Server before presenting the project. The demo's localStorage-based authentication should not be described as production-secure.

# Seis. Siete. Setas. 🍄🃏

A high-speed, local-first card game of broken brains, rapid additions, and golden mushrooms. Harvest sums of **6** and **7**, or hunt for the elusive **13** (*Setas!*).

---

## 🎮 The Rules & Mechanics

The game revolves around the **Law of 6 and 7**. Players take turns drawing cards and throwing them onto their discard piles.

### 1. The Goal
Keep your eyes on the **Target Coin** (either **6** or **7**). Be the fastest player to claim when the cards on the board match the target value.

### 2. Claiming
If **one** or **two** of the active cards (top card of each player's discard pile) add up to the current **Target Coin**, press **CLAIM**!
- **Correct claims** award points and give you all the cards in the discard piles.
- **Incorrect claims** cost you **1 Heart**. Lose all hearts and you're eliminated.

### 3. The Void (Sacrifices)
A central pile where cards can be sacrificed to thin out your deck or set up combos. The top card of the Void pile is always active.

### 4. Setas! (13)
If **two** or **three** active cards (including the top card of the Void) add up to exactly **13**, shout **SETAS!** (or press `M` on PC). 
- A correct *Setas!* call triggers a massive **+130 point bonus** and immediately wins the game!

---

## 🚀 Key Features

* **AI Opponents:** Spar against three distinct AI personalities:
  * **The Whisper (Easy):** A faint echo. 7 Hearts to survive.
  * **The Shadow (Normal):** A steady presence. 5 Hearts to survive.
  * **The Ancient (Hard):** The forest itself. Only 3 Hearts.
* **Firebase Leaderboards:** Built-in Google authentication to save your scores and compete on global leaderboards.
* **Keyboard Shortcuts:** Full keyboard support for quick, high-speed reactions.
* **Immersive Audio:** Immersive background tracks and custom sound effects for draw, success, win, and penalty states.

---

## 🛠️ Tech Stack

* **Build Tool:** Vite
* **Frontend:** React 19 & TypeScript
* **Animations:** Motion (Framer Motion)
* **Icons:** Lucide React
* **Styling:** Tailwind CSS v4
* **Database & Auth:** Firebase (Firestore, Firebase Authentication)

---

## 📦 Running Locally

To play the game on your own machine:

### 1. Clone the Repository
```bash
git clone https://github.com/livasbilly/seis-siete-setas-public.git
cd seis-siete-setas-public
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory to hold your Gemini API Key if you use Google AI Studio integrations, or simply rely on the default configurations:
```env
GEMINI_API_KEY="your_api_key_here"
```

### 4. Start the Dev Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start harvesting mushrooms!

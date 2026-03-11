# Aamujää 🏒
🔴 https://d4nyyy.fi/hockey/

Aamujää (Morning Skate) is a real-time, dynamic, and ad-free hockey application that brings together NHL and Finnish Liiga game results, statistics, and team rosters into one sleek user interface. 

The app was developed out of pure passion for ice hockey and software engineering, focusing on delivering a fast, clean, and distraction-free user experience.

## 📸 Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/d6184413-646b-406c-92f1-330732979e58" width="15%" title="Home and Games">
  <img src="https://github.com/user-attachments/assets/ca3e18e8-115e-45ca-9614-7561ccf1b54b" width="15%" title="Stats">
  <img src="https://github.com/user-attachments/assets/cae239e6-8223-4788-b4f6-978ee227a570" width="15%" title="Standings">
  <img src="https://github.com/user-attachments/assets/092116f9-fb44-4854-9c5f-f6e0b3d7d463" width="15%" title="About Predictions">
  <img src="https://github.com/user-attachments/assets/ccb6fd20-72a8-423d-8326-a5a3b51a7b97" width="15%" title="Calendar">
</p>

## ✨ Key Features

- **Real-Time Scores:** Live game results and events for both NHL and Liiga.
- **Smart Favorite Tracking:** The app automatically highlights the user's favorite teams (with golden borders) and players across the schedule and leaderboards.
- **"Crystal Ball" Predictive Analytics:** An advanced statistical math engine that forecasts regular season final standings, player point leaderboards, and win probabilities for individual game outcomes using live and historical data.
- **Custom Data Normalization:** A built-in "favorite radar" that cleanses and unifies heavily fragmented raw data from external APIs (e.g., dynamic and inconsistent Liiga IDs) to ensure a flawless user experience.
- **Tonight's Hot Players:** A custom algorithm that calculates the top scorers of the current game night on the fly from raw game event data.
- **Comprehensive Statistics:** Player cards, league standings, scoring leaders, and live team rosters.
- **Fully Responsive:** Designed to work seamlessly on both desktop and mobile devices.

## 🛠️ Technologies

- **Frontend:** React, JavaScript (ES6+), HTML5, custom CSS3.
- **Backend / Data Fetching:** Node.js, Express (acting as a proxy and caching layer for external APIs).
- **APIs:** NHL API, Liiga API (unofficial).

## 💡 Learnings & Challenges

Developing this project provided deep insights into the pain points of modern web development and how to solve them. Utilizing external, undocumented APIs (especially the Liiga API) required creative problem-solving. 

I had to build complex filters and normalization dictionaries on the frontend to process scattered and inconsistent raw data. This ensured that features like automatic favorite team recognition worked reliably, regardless of the format the API returned at any given time. Additionally, managing asynchronous data fetching and preventing "Race Conditions" in React modals played a central role in stabilizing the app.

Implementing the "Crystal Ball" feature also pushed me to dive deep into statistical mathematics. Building the algorithms to calculate realistic forecasts for leaderboards and match outcomes taught me how to effectively process and analyze large datasets within a React/Node environment.

## 🚀 Project Structure & Getting Started

This repository uses a monorepo structure. It contains both the React frontend and the custom Node.js Express backend. The backend acts as a proxy server to fetch and cache live data from external hockey APIs, effectively bypassing CORS restrictions and preventing rate-limiting issues.

1. Start the Backend (Proxy Server)
Open your terminal in the root directory:
npm install
node server.js

2. Start the Frontend (React App)
Open a second terminal window and navigate to the React application folder:
cd aamujaa-react
npm install
npm run dev

---
*Disclaimer: Aamujää is an unofficial, fan-made application. The app is not affiliated with the National Hockey League (NHL) or the Finnish Liiga. No ads, no tracking.*

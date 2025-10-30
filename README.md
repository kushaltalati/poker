# Poker Web App

A modern, full-stack multiplayer poker game—play Texas Hold'em with friends in your browser! Built with Node.js/Express backend and React frontend.

## Features
- Host/join poker rooms via unique codes
- Add players, assign balances
- Texas Hold'em: betting rounds, community cards, pot management
- Real-time gameplay via WebSockets
- Fold, check, call, raise, and winner selection flows
- Mobile-friendly, interactive UI (React)
- Sit out (temporary leave) or leave table entirely
- No-logins needed—just enter a name and play

## Quick Start

### 1. Backend Setup
```bash
cd poker-backend
npm install
npm start
```
- Runs the Express/Socket.io server on port 5001 by default.
- Requires MongoDB (local or Atlas). Set `MONGODB_URI` in `.env` or default is `mongodb://127.0.0.1:27017/poker-manager`

### 2. Frontend Setup
```bash
cd poker-frontend
npm install
npm start
```
- Runs the React app on port 3000 (default).
- Connects to backend via WebSockets. Ensure ports match CORS settings if you change them.

Open http://localhost:3000 to start playing.

## Tech Stack
- **Backend:** Node.js, Express, Socket.io, MongoDB (Mongoose)
- **Frontend:** React (+ Hooks), plain CSS
- **Real-time:** WebSockets for instant updates

## Gameplay Flow
1. **Create or join a room** (no login required)
2. **Add players**: Choose names, set starting balances
3. **Play poker:**
   - Each betting round: fold/check/call/raise as you would offline
   - Community cards revealed as betting completes (Flop/Turn/River)
   - After the River, select one or more winners to split the pot
4. **Temporary leave:** Sit out a player (returns with Join button)
5. **Permanent leave:** Removes player slot entirely
6. **Repeat as needed!**

## Contribution
Pull requests are welcome! To contribute:
- Fork this repo
- Create a feature branch
- Open a PR with clear description
- For major features/bugs: please open an issue first

**Dev tips:**
- Frontend (`poker-frontend/`): Main logic in `src/pages` and `src/components`
- Backend (`poker-backend/`): Most game logic in `server.js` and models
- Use [MongoDB Atlas](https://www.mongodb.com/atlas) or run Mongo locally for development
- To add new features (e.g. more poker variants, bot players), see TODOs in codebase

## Production & Deployment
- Set environment variables properly in production:
  - `MONGODB_URI` for the DB
  - `CORS_ORIGIN` for the React frontend URL
- Use process managers (PM2, systemd) for backend
- Reverse proxy or serve frontend via Netlify/Vercel etc.
- WebSocket ports must be accessible (check firewall/docker rules)

## Environment Variables
Copy `.env.example` and set:
```sh
MONGODB_URI=mongodb://127.0.0.1:27017/poker-manager
CORS_ORIGIN=http://localhost:3000
```

---

*Enjoy your poker nights!*

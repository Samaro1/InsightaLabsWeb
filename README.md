# Insighta Labs+ Web Portal

A profile search and intelligence platform with secure GitHub login.

## Quick Start

```bash
npm install
npm run dev          # http://localhost:3000
npm run serve        # http://localhost:8080
```

## Features

- 🔑 **GitHub Login** - Secure authentication via GitHub
- 🔍 **Search** - Find profiles using natural language (e.g., "young females from Nigeria")
- 📊 **Dashboard** - View statistics and recent profiles
- 📋 **Filtering** - Filter by gender, country, age, and more
- 📥 **Export** - Download profile data as CSV
- 🎯 **Role-Based** - Admin and Analyst permissions

## Project Structure

```
InsightaLabsWeb/web/
├── index.html              # Login page
├── dashboard.html          # Statistics & overview
├── profiles.html           # Browse all profiles
├── search.html             # Natural language search
├── profile.html            # Single profile details
├── account.html            # User settings
├── auth/
│   └── callback.html       # OAuth redirect handler
├── components/
│   └── navbar.html         # Navigation bar
├── css/
│   ├── styles.css          # Global styles
│   ├── dashboard.css       # Dashboard styles
│   └── profiles.css        # Profiles page styles
└── js/
    ├── config.js           # API configuration
    ├── auth.js             # Login & token management
    ├── utils.js            # API client & helpers
    └── env.js              # Environment variables
```

## Authentication

1. Click "Continue with GitHub"
2. Authorize the app on GitHub
3. Redirected to dashboard
4. Login tokens stored securely (auto-refresh every 3 minutes)
  - Reactive Refresh: Any 401 response → Attempt one silent refresh

Refresh Token Expiry (5 minutes):
  - If refresh fails → User redirected to login
  - Each refresh issues new token pair
  - Old refresh token invalidated immediately
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ (for local development server)
- Backend API running (see Backend README)
- GitHub OAuth App configured

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd insightweb
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your backend API URL
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   npm run serve
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📡 API Endpoints Used

## Environment Setup

Create a `.env` file in the root:

```env
FRONTEND_URL=https://insighta-labs-web.vercel.app/
API_BASE=https://stage1be-production.up.railway.app/
```

Or set these in `config.js`:

```javascript
const CONFIG = {
  API_BASE: 'https://your-backend-domain.com',
  API_VERSION: '1'
};
```

## Scripts

```bash
npm run dev       # Start dev server on port 3000
npm run serve     # Start server on port 8080
npm run format    # Format code with Prettier
npm run lint      # Check code with ESLint
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires JavaScript enabled

## Troubleshooting

**Can't log in?**
- Check browser console (F12) for errors
- Verify backend is running
- Clear cookies and try again

**Getting 404 on GitHub redirect?**
- Verify backend environment variables are set correctly
- Check GitHub app callback URL matches backend config

**Profile searches not working?**
- Make sure you're logged in (check `/auth/me`)
- Verify API base URL is correct

## Support

For issues or questions, check the [backend repository](https://github.com/Samaro1/stage1be) for API documentation.

---

Built with vanilla HTML, CSS, and JavaScript. No frameworks required.
**Contact**: Insighta Labs Team

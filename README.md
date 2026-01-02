# TRF Portal - Quick Start Guide

## 🚀 Project Overview

TRF Portal is a full-stack web application for managing users with:

- ✅ JWT Authentication & Authorization
- ✅ Advanced Data Filtering
- ✅ Analytics Dashboard
- ✅ Real-time Notifications
- ✅ CRUD Operations
- ✅ Bilingual Support (English/Arabic)

## 📋 Requirements

- Node.js (v14 or higher)
- npm (v6 or higher)
- MongoDB (cloud connection via URL)
- Modern web browser

## 🔧 Installation

### 1. Clone/Extract Project

```bash
cd d:\TRF-Portal
```

### 2. Install Dependencies

**Backend:**

```bash
cd backend
npm install
```

**Frontend:**

```bash
cd frontend
npm install
```

### 3. Configure Environment

**Backend (.env):**

```
PORT=5000
URL_DB=mongodb+srv://[username]:[password]@cluster0.9zejq23.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345678901234567890
```

**Frontend (.env - Optional):**

```
VITE_API_URL=http://localhost:5000
```

## ▶️ Starting the Application

### Option 1: Run Both Servers (Recommended)

From project root:

```bash
npm run dev
```

This runs both backend and frontend concurrently.

### Option 2: Run Separately

**Terminal 1 - Backend:**

```bash
cd backend
npm start
```

Backend runs on: **http://localhost:5000**

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

Frontend runs on: **http://localhost:5174**

## 🌐 Accessing the Application

1. Open browser to: **http://localhost:5174**
2. You'll be redirected to login page
3. Create a new account or use demo credentials (if available)

## 📱 Default Routes

| Route        | Purpose                   | Auth Required |
| ------------ | ------------------------- | ------------- |
| `/login`     | Login page                | ❌ No         |
| `/`          | Dashboard with users grid | ✅ Yes        |
| `/register`  | Register new user         | ✅ Yes        |
| `/analytics` | Analytics & charts        | ✅ Yes        |

## 🔑 Demo Login (After Creating User)

```
Email: demo@example.com
Password: password123
```

## 📊 Main Features

### 1. **Authentication**

- User registration with 18 fields
- Secure login with JWT tokens
- Auto-logout on session expiration
- Password hashing with bcryptjs

### 2. **User Management**

- View all users in a DataGrid
- Add new users (registration)
- Edit user information
- Delete users with confirmation
- Multi-language fields (English/Arabic)

### 3. **Advanced Filters**

- Search by name, email, or city
- Filter by category (Student/Teacher/Other)
- Filter by gender (Male/Female)
- Clear filters button
- Live user count

### 4. **Analytics Dashboard**

- Total user metrics
- User distribution by category (pie chart)
- Gender distribution (bar chart)
- Registration timeline (line chart)
- Top cities by users

### 5. **User Experience**

- Toast notifications for all actions
- Responsive design (mobile-friendly)
- Dark theme UI
- Bilingual support
- Loading states

## 🧪 Testing

### Quick Test Flow:

1. Go to http://localhost:5174
2. Click "Register here"
3. Fill registration form
4. Login with created credentials
5. Test filters on dashboard
6. View analytics charts
7. Try editing/deleting users

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Windows - Kill process on port 5000
taskkill /PID [PID] /F

# Alternative - Use different port
PORT=5001 npm start
```

### MongoDB Connection Error

```
Check .env URL_DB variable
Verify IP whitelist in MongoDB Atlas
Check internet connection
```

### Frontend Won't Load

```
Clear browser cache (Ctrl+Shift+Delete)
Check console for errors (F12)
Verify backend is running
```

### Styles Not Loading

```
npm run build  # Rebuild frontend
npm run dev    # Restart dev server
```

## 📚 Documentation

- `API_DOCUMENTATION.md` - Complete API endpoints
- `FEATURES_IMPLEMENTATION.md` - Detailed feature list
- `IMPLEMENTATION_SUMMARY.md` - Full technical overview

## 🔐 Security Notes

- ✅ Passwords hashed before storage
- ✅ JWT tokens expire after 7 days
- ✅ Protected routes require authentication
- ✅ CORS enabled for development

**For Production:**

- Change JWT_SECRET to strong random value
- Enable HTTPS
- Implement rate limiting
- Add IP whitelisting
- Set secure CORS origins

## 📦 Project Structure

```
TRF-Portal/
├── backend/
│   ├── Models/
│   ├── Controllers/
│   ├── Middleware/
│   ├── Routes/
│   ├── server.js
│   ├── package.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   ├── contexts/
    │   └── App.jsx
    ├── package.json
    └── vite.config.js
```

## 🚀 Deployment

### Frontend (Vercel/Netlify)

```bash
npm run build
# Deploy dist folder
```

### Backend (Heroku/Railway)

```bash
npm start
# Set environment variables
```

## 💡 Performance Tips

- Use modern browser (Chrome/Firefox)
- Enable compression in production
- Optimize images
- Implement caching
- Use CDN for static files

## 📞 Support

For issues or questions:

1. Check documentation files
2. Review console error messages
3. Check backend terminal for API errors
4. Verify environment configuration

## 📝 License

This project is for educational and professional use.

## ✨ Version History

- **v2.0** - Added JWT Auth, Analytics, Filters, Notifications
- **v1.0** - Initial CRUD system

---

**Last Updated:** October 24, 2024
**Status:** Production Ready ✅

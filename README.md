# Rifah - Multi-Tenant Salon & Spa Booking Platform

A modern, secure, multi-tenant booking platform for salons and spas in Saudi Arabia.

## 🚀 Quick Start

### One-Command Start

```bash
# Install all dependencies (first time only)
npm run install:all

# Start everything (Docker + Backend + Frontend)
npm run dev
```

**That's it!** Open `http://localhost:3000` in your browser.

See `QUICK_START.md` for detailed instructions.

---

## 📋 What is Rifah?

Rifah is a complete booking platform that allows:
- **Users**: One account to book at ANY salon/spa
- **Salons**: Manage bookings, staff, and services
- **Platform**: Unified user management and analytics

### Key Features

✅ **Multi-Tenant Architecture**
- Browse all salons/spas
- Book at any salon with one account
- Unified booking history

✅ **Smart Booking System**
- AI-powered staff recommendations
- Real-time availability
- Conflict detection

✅ **Secure Authentication**
- JWT-based authentication
- Secure token management
- Protected routes

✅ **Beautiful UI/UX**
- Modern, responsive design
- Premium branding system
- Smooth user experience

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js + Express.js
- PostgreSQL (multi-tenant)
- Sequelize ORM
- JWT Authentication

**Frontend:**
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- Secure API Client

**Infrastructure:**
- Docker Compose
- PostgreSQL
- Redis

---

## 📁 Project Structure

```
BookingSystem/
├── server/          # Backend API
├── client/          # Frontend App
├── docker-compose.yml
├── start.ps1        # Windows start script
├── start.sh         # Mac/Linux start script
├── start.bat        # Windows batch script
└── package.json     # Root package (concurrently)
```

---

## 🎯 Getting Started

### Prerequisites

- Node.js 18+ 
- Docker Desktop
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BookingSystem
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Start everything**
   ```bash
   npm run dev
   ```

4. **Open browser**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5000`

---

## 📚 Documentation

- `QUICK_START.md` - Quick start guide
- `TESTING_GUIDE.md` - Complete testing instructions
- `SYSTEM_COMPLETE.md` - System overview
- `SECURITY_IMPLEMENTATION.md` - Security features
- `PROJECT_ANALYSIS.md` - Project analysis

---

## 🧪 Testing

See `TESTING_GUIDE.md` for complete testing instructions.

**Quick test:**
1. Start services: `npm run dev`
2. Open `http://localhost:3000`
3. Browse salons → Register → Book appointment

---

## 🔐 Security

- JWT authentication
- Password hashing (bcrypt)
- Input validation
- XSS protection
- Secure token storage

See `SECURITY_IMPLEMENTATION.md` for details.

---

## 📊 Current Status

- ✅ **Backend**: 100% Complete
- ✅ **Frontend**: 100% Complete
- ✅ **Security**: Core Implemented
- ✅ **Documentation**: Complete

---

## 🛑 Stopping Services

```bash
# Stop Docker
npm run stop

# Or use stop script (Mac/Linux)
./stop.sh
```

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📄 License

ISC

---

## 🎉 Ready to Test!

Everything is set up and ready. Run `npm run dev` and start testing!

**Happy Testing! 🚀**


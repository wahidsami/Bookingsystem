# Starting the Backend Server - Manual Instructions

The backend server needs to be started manually to see any errors.

## Quick Start

1. **Open a new terminal/command prompt**

2. **Navigate to server directory:**
   ```bash
   cd server
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **You should see:**
   ```
   Database connection established successfully.
   Database synced in correct order.
   Server is running on port 5000
   ```

5. **If you see errors**, check:
   - Docker containers are running (Postgres on port 5434)
   - Database credentials match docker-compose.yml
   - Port 5000 is not already in use

## Troubleshooting

### Error: "Unable to connect to the database"
- Make sure Docker containers are running
- Check Postgres is on port 5434
- Verify credentials: postgres/dev_password

### Error: "Port 5000 already in use"
- Find and kill the process using port 5000
- Or change PORT in server/.env

### Database Connection Issues
- Wait a few seconds after starting Docker
- Check: `docker ps` to see if containers are running
- Check logs: `docker-compose logs postgres`

## Once Server is Running

- Backend API: http://localhost:5000
- Health check: http://localhost:5000/
- Frontend should now be able to connect!


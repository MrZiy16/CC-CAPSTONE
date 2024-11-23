// server.js
const Hapi = require("@hapi/hapi");
const authRoutes = require("./routes");
require('dotenv').config(); // Load variabel lingkungan
const db = require('./db');
const JWT_SECRET = process.env.JWT_SECRET; // Ambil secret dari .env


const init = async () => {
  const server = Hapi.server({
    port: 7000,
    host: process.env.NODE_ENV !== "production" ? "localhost" : "0.0.0.0",
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

  // Daftarkan route
  server.route(authRoutes);

  await server.start();
  console.log("Server running on %s", server.info.uri);
};


init();

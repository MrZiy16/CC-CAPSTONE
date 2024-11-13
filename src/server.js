// server.js
const Hapi = require("@hapi/hapi");
const authRoutes = require("./routes");

const init = async () => {
  const server = Hapi.server({
    port: 3000,
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

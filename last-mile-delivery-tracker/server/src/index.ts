import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import orderRoutes from "./routes/orders";
import zoneRoutes from "./routes/zones";
import areaRoutes from "./routes/areas";
import rateRoutes from "./routes/rates";
import agentRoutes from "./routes/agents";
import adminRoutes from "./routes/admin";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL?.split(",") ?? "*",
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/rates", rateRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Last-Mile Delivery Tracker API listening on port ${PORT}`);
  });
}

export default app;

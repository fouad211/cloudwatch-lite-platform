require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const redis = require("redis");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const REDIS_URL = process.env.REDIS_URL;
const JWT_SECRET = process.env.JWT_SECRET || "cloudwatch_secret_key";

let redisClient;
let totalRequests = 0;

app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  totalRequests++;
  next();
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "admin" },
  createdAt: { type: Date, default: Date.now }
});

const serverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  provider: { type: String, default: "AWS" },
  region: { type: String, default: "eu-west-1" },
  instanceType: { type: String, default: "t3.micro" },
  hourlyRate: { type: Number, default: 0.0104 },
  status: { type: String, default: "up" },
  createdAt: { type: Date, default: Date.now }
});

const metricSchema = new mongoose.Schema({
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: "Server" },
  cpu: Number,
  memory: Number,
  disk: Number,
  networkIn: Number,
  networkOut: Number,
  createdAt: { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: "Server" },
  type: String,
  severity: { type: String, default: "medium" },
  message: String,
  status: { type: String, default: "open" },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Server = mongoose.model("Server", serverSchema);
const Metric = mongoose.model("Metric", metricSchema);
const Alert = mongoose.model("Alert", alertSchema);

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

function severity(value) {
  if (value >= 90) return "critical";
  if (value >= 80) return "high";
  if (value >= 70) return "medium";
  return "low";
}

async function createAlerts(serverId, metric) {
  const checks = [
    { type: "CPU", value: metric.cpu, limit: 80 },
    { type: "Memory", value: metric.memory, limit: 80 },
    { type: "Disk", value: metric.disk, limit: 85 }
  ];

  for (const check of checks) {
    if (check.value >= check.limit) {
      await Alert.create({
        serverId,
        type: check.type,
        severity: severity(check.value),
        message: `${check.type} usage is high: ${check.value}%`
      });
    }
  }
}

async function clearCache() {
  if (!redisClient) return;
  const keys = await redisClient.keys("*");
  if (keys.length) await redisClient.del(keys);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* AUTH */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hash
    });

    res.status(201).json({
      message: "Account created successfully",
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Register failed", error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

/* RESET PASSWORD */
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password reset successfully. You can login now." });
  } catch (err) {
    res.status(500).json({ message: "Reset failed", error: err.message });
  }
});

/* SYSTEM */
app.get("/health", async (req, res) => {
  let redisStatus = "disconnected";

  try {
    await redisClient.ping();
    redisStatus = "connected";
  } catch {}

  res.json({
    status: "OK",
    app: "CloudWatch Lite Platform",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    redis: redisStatus,
    uptime: Math.floor(process.uptime())
  });
});

app.get("/metrics", auth, async (req, res) => {
  const servers = await Server.countDocuments();
  const metrics = await Metric.countDocuments();
  const alerts = await Alert.countDocuments();
  const openAlerts = await Alert.countDocuments({ status: "open" });

  res.json({
    app: "CloudWatch Lite Platform",
    totalRequests,
    uptimeSeconds: Math.floor(process.uptime()),
    stats: { servers, metrics, alerts, openAlerts }
  });
});

/* DASHBOARD */
app.get("/api/dashboard", auth, async (req, res) => {
  const servers = await Server.find().sort({ createdAt: -1 });
  const alerts = await Alert.find()
    .populate("serverId", "name provider region")
    .sort({ createdAt: -1 })
    .limit(10);

  const latestMetrics = [];

  for (const server of servers) {
    const latest = await Metric.findOne({ serverId: server._id }).sort({ createdAt: -1 });

    latestMetrics.push({
      server,
      metric: latest || {
        cpu: 0,
        memory: 0,
        disk: 0,
        networkIn: 0,
        networkOut: 0
      }
    });
  }

  const costs = servers.map((server) => {
    const daily = server.hourlyRate * 24;
    const monthly = daily * 30;

    return {
      name: server.name,
      provider: server.provider,
      instanceType: server.instanceType,
      daily: Number(daily.toFixed(2)),
      monthly: Number(monthly.toFixed(2))
    };
  });

  const totalMonthly = costs.reduce((sum, item) => sum + item.monthly, 0);

  res.json({
    servers,
    latestMetrics,
    alerts,
    costs,
    totalMonthly: Number(totalMonthly.toFixed(2))
  });
});

/* SERVERS */
app.post("/api/servers", auth, async (req, res) => {
  const server = await Server.create(req.body);
  await clearCache();
  res.status(201).json(server);
});

app.get("/api/servers", auth, async (req, res) => {
  const servers = await Server.find().sort({ createdAt: -1 });
  res.json(servers);
});

/* SIMULATION */
app.post("/api/simulate", auth, async (req, res) => {
  let servers = await Server.find();

  if (servers.length === 0) {
    servers = await Server.insertMany([
      { name: "web-server-01", provider: "AWS", region: "eu-central-1", instanceType: "t3.micro", hourlyRate: 0.0104 },
      { name: "api-server-01", provider: "AWS", region: "eu-west-1", instanceType: "t3.small", hourlyRate: 0.0208 },
      { name: "db-server-01", provider: "Azure", region: "westeurope", instanceType: "B1s", hourlyRate: 0.012 }
    ]);
  }

  for (const server of servers) {
    const metric = await Metric.create({
      serverId: server._id,
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 100),
      disk: Math.floor(Math.random() * 100),
      networkIn: Math.floor(Math.random() * 1000),
      networkOut: Math.floor(Math.random() * 1000)
    });

    await createAlerts(server._id, metric);
  }

  await clearCache();

  res.json({
    message: "Simulation completed",
    servers: servers.length
  });
});

/* ALERTS */
app.get("/api/alerts", auth, async (req, res) => {
  const alerts = await Alert.find()
    .populate("serverId", "name provider region")
    .sort({ createdAt: -1 });

  res.json(alerts);
});

app.patch("/api/alerts/:id/resolve", auth, async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { status: "resolved" },
    { new: true }
  );

  res.json(alert);
});

/* COSTS */
app.get("/api/costs", auth, async (req, res) => {
  const servers = await Server.find();

  const data = servers.map((server) => {
    const daily = server.hourlyRate * 24;
    const monthly = daily * 30;

    return {
      name: server.name,
      provider: server.provider,
      instanceType: server.instanceType,
      estimatedDailyCost: Number(daily.toFixed(2)),
      estimatedMonthlyCost: Number(monthly.toFixed(2))
    };
  });

  const totalMonthlyCost = data.reduce((sum, item) => sum + item.estimatedMonthlyCost, 0);

  res.json({
    totalMonthlyCost: Number(totalMonthlyCost.toFixed(2)),
    servers: data
  });
});

async function start() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connected");

    redisClient = redis.createClient({ url: REDIS_URL });
    await redisClient.connect();
    console.log("Redis connected");

    app.listen(PORT, () => {
      console.log(`CloudWatch Lite running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
}

start();

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/api';
import { connectDB } from './config/db';
import { MasterRate, BillingShareRecord } from './models';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api', router);

// Health check
app.get(['/', '/health', '/api/health'], async (_req, res) => {
  try {
    const rateCount = await MasterRate.countDocuments();
    const recordCount = await BillingShareRecord.countDocuments();

    res.json({
      status: 'ok',
      database: 'CONNECTED',
      metrics: {
        masterRates: rateCount,
        billingRecords: recordCount,
      },
      timestamp: new Date(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      database: 'DISCONNECTED',
      error: err.message,
      timestamp: new Date(),
    });
  }
});

async function startServer() {
  await connectDB();

  const server = app.listen(PORT, async () => {
    console.log(`🚀 Pure Share Management Backend running on http://localhost:${PORT}`);
    try {
      const rateCount = await MasterRate.countDocuments();
      const recordCount = await BillingShareRecord.countDocuments();
      console.log(`📊 Loaded: ${rateCount} Master Rates | ${recordCount} Billing Records`);
    } catch (e: any) {
      console.log(`⚠️ Status check error:`, e.message);
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    } else {
      console.error('❌ Server startup error:', err);
    }
    process.exit(1);
  });
}

startServer();

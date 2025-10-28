// server.js
import express from "express";
import { configDotenv } from "dotenv";
import bodyParser from "body-parser";
import cors from 'cors';
import ttsRouter from "./router/ttsRouter.js";

configDotenv();

const PORT = process.env.PORT || 3000;

const app = express();

app.use(bodyParser.json({ limit: "2mb" }));
app.use(cors());

app.use('/api/v1/tts',ttsRouter);

app.listen(PORT, () => console.log("Server listening on", PORT));

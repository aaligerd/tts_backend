import express from 'express';
import { createTts } from'../controller/ttsController-gcp.js';
const ttsRouter=express.Router();

ttsRouter.post('/create',createTts);

export default ttsRouter;
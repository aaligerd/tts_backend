import express from 'express';
import { createTts } from'../controller/ttsController.js';
const ttsRouter=express.Router();

ttsRouter.post('/create',createTts);

export default ttsRouter;
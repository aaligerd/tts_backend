import express from 'express';
import { createTts,saveTtsToDb,getPaginatedTtsRecords } from'../controller/ttsController-gcp.js';
const ttsRouter=express.Router();

ttsRouter.post('/create',createTts);
ttsRouter.post('/save',saveTtsToDb);
ttsRouter.post('/get',getPaginatedTtsRecords);

export default ttsRouter;
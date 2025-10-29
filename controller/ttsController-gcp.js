import textToSpeech from "@google-cloud/text-to-speech";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import { chunkText } from '../utils/chunk.js';
import { randomName } from '../utils/randomName.js';
import { slugify } from '../utils/slug.js';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import example from "../utils/exampleResponse.js";
import { configDotenv } from "dotenv";
configDotenv();

const S3_BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION;
const minmum_char = 10;

const s3 = new S3Client({ region: REGION });

const gcpTTSClient = new textToSpeech.TextToSpeechClient({
  keyFilename: "C:/Users/amerp/Desktop/The Eastern Gazette/TTS/tts_backend/gcp-cred.json"
});

const createTts = async (req, res) => {
     const { title, text, tone = "default", voice = "bn-IN-Wavenet-A", language = "bn-IN", speakingRate = 1.0, pitch = 0.0 } = req.body;
  // try {
 

  //   if (!text || text.length < minmum_char) {
  //     return res.status(400).json({ error: `Minimum ${minmum_char} characters required` });
  //   }

  //   const chunks = chunkText(text); 
  //   const audioBuffers = [];

  //   for (let i = 0; i < chunks.length; i++) {
  //     const input = { text: chunks[i]};

  //     const voiceParams = {
  //       languageCode: language,       
  //       name: voice
  //       //can also set 'ssmlGender' if needed
  //     };

  //     const audioConfig = {
  //       audioEncoding: 'MP3',
  //       speakingRate, 
  //       pitch
  //     };

  //     const request = {
  //       input,
  //       voice: voiceParams,
  //       audioConfig
  //     };
  //     console.log(request.input)

  //     const [response] = await gcpTTSClient.synthesizeSpeech(request);

  //     if (!response || !response.audioContent) {
  //       throw new Error('No audio returned from Google TTS');
  //     }

  //     let chunkBuffer;
  //     if (Buffer.isBuffer(response.audioContent)) {
  //       chunkBuffer = response.audioContent;
  //     } else {
  //       chunkBuffer = Buffer.from(response.audioContent, 'base64');
  //     }

  //     audioBuffers.push(chunkBuffer);
  //   }

  //   const finalAudio = Buffer.concat(audioBuffers);

  //   const audioKey = `audio/${randomName(title ? slugify(title) : "news", "mp3")}`;

  //   await s3.send(new PutObjectCommand({
  //   Bucket: S3_BUCKET,
  //   Key: audioKey,
  //   Body: finalAudio,
  //   ContentType: "audio/mpeg"
  //   }));

  //   const audioUrl = await getSignedUrl(s3, new GetObjectCommand({
  //   Bucket: S3_BUCKET,
  //   Key: audioKey,
  //   }), { expiresIn: 24 * 60 * 60 }); // 1 year

  //   const qrBuffer = await QRCode.toBuffer(audioUrl, { type: "png", width: 400 });

  //   const qrKey = `qr/${randomName("qr", "png")}`;

  //   await s3.send(new PutObjectCommand({
  //   Bucket: S3_BUCKET,
  //   Key: qrKey,
  //   Body: qrBuffer,
  //   ContentType: "image/png"
  //   }));

  //   const qrUrl = await getSignedUrl(s3, new GetObjectCommand({
  //   Bucket: S3_BUCKET,
  //   Key: qrKey,
  //   }), { expiresIn: 24 * 60 * 60 });//1 year


  //   return res.json({
  //     success: true,
  //     audio: { key: audioKey, url: audioUrl },
  //     qr: { key: qrKey, url: qrUrl },
  //   });

  // } catch (err) {
  //   console.error(err);
  //   return res.status(500).json({ error: err.message || "server error" });
  // }

  await new Promise(resolve => setTimeout(resolve, 3000));
  return res.json(example);
};

export { createTts };

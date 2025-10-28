import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import QRCode from "qrcode";
import { configDotenv } from "dotenv";
import {chunkText} from '../utils/chunk.js'
import buildSSML from '../utils/buildSSML.js'
import {randomName} from '../utils/randomName.js'
import {slugify} from '../utils/slug.js'
configDotenv();

// === CONFIG: set via ENV in prod ===
const REGION = process.env.AWS_REGION;
const S3_BUCKET = process.env.S3_BUCKET; // e.g. "my-audio-bucket"
const PRESIGN_EXPIRES = 60 * 60 * 24 * 7; // 7 days (if using presigned)
const polly = new PollyClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const minmum_char=10;

const createTts=async (req, res) => {
  try {
    const { title, text, tone = "newscaster", voice = "Joanna" } = req.body;
    if (!text || text.length < minmum_char) return res.status(400).json({ error: `Minimum ${minmum_char} charachters requried` });

    // 1) chunk text and synthesize each piece (Polly has limits)
    const chunks = chunkText(text, 3000);
    const audioBuffers = [];

    for (let i = 0; i < chunks.length; i++) {
      const ssml = buildSSML(chunks[i], tone);
      const params = {
        OutputFormat: "mp3",
        VoiceId: voice,
        TextType: "ssml",
        Text: ssml,
      };
      const cmd = new SynthesizeSpeechCommand(params);
      const resp = await polly.send(cmd); // returns audio stream
      // resp.AudioStream is a Readable stream; collect into Buffer
      const stream = resp.AudioStream;
      const chunksArr = [];
      for await (const chunk of stream) {
        chunksArr.push(Buffer.from(chunk));
      }
      audioBuffers.push(Buffer.concat(chunksArr));
    }

    // 2) concatenate audio buffers (mp3 concatenation by binary append is acceptable for short pieces)
    const finalAudio = Buffer.concat(audioBuffers);

    // 3) upload to S3
    const audioKey = `audio/${randomName(title ? slugify(title) : "news", "mp3")}`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: audioKey,
      Body: finalAudio,
      ContentType: "audio/mpeg",
      ACL: "private", // or 'public-read' depending on policy
    }));

    // 4) create presigned URL
    const presignedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: audioKey }), // note: presign for GET, below we create GET presign properly
      { expiresIn: PRESIGN_EXPIRES }
    );
    // Actually create presigned GET URL:
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const audioGetUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: audioKey }), { expiresIn: PRESIGN_EXPIRES });

    // 5) generate QR code PNG -> buffer
    const qrBuffer = await QRCode.toBuffer(audioGetUrl, { type: "png", width: 400 });

    // 6) upload QR to S3
    const qrKey = `qr/${randomName("qr", "png")}`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: qrKey,
      Body: qrBuffer,
      ContentType: "image/png",
      ACL: "private",
    }));
    const { GetObjectCommand: GetObj } = await import("@aws-sdk/client-s3");
    const qrUrl = await getSignedUrl(s3, new GetObj({ Bucket: S3_BUCKET, Key: qrKey }), { expiresIn: PRESIGN_EXPIRES });

    // 7) persist metadata to DB here (not included) ...

    return res.json({
      success: true,
      audio: { key: audioKey, url: audioGetUrl },
      qr: { key: qrKey, url: qrUrl },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "server error" });
  }
};

export {createTts};
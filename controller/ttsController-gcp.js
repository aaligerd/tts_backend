import textToSpeech from "@google-cloud/text-to-speech";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import pgClient from "../db/pgClient.js";
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
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const createTts = async (req, res) => {
   const { title, text, tone = "default", voice = "bn-IN-Wavenet-A", language = "bn-IN", speakingRate = 1.0, pitch = 0.0 } = req.body;
  try {
 

    if (!text || text.length < minmum_char) {
      return res.status(400).json({ error: `Minimum ${minmum_char} characters required` });
    }

    const chunks = chunkText(text); 
    const audioBuffers = [];

    for (let i = 0; i < chunks.length; i++) {
      const input = { text: chunks[i]};

      const voiceParams = {
        languageCode: language,       
        name: voice
        //can also set 'ssmlGender' if needed
      };

      const audioConfig = {
        audioEncoding: 'MP3',
        speakingRate, 
        pitch
      };

      const request = {
        input,
        voice: voiceParams,
        audioConfig
      };
      console.log(request.input)

      const [response] = await gcpTTSClient.synthesizeSpeech(request);

      if (!response || !response.audioContent) {
        throw new Error('No audio returned from Google TTS');
      }

      let chunkBuffer;
      if (Buffer.isBuffer(response.audioContent)) {
        chunkBuffer = response.audioContent;
      } else {
        chunkBuffer = Buffer.from(response.audioContent, 'base64');
      }

      audioBuffers.push(chunkBuffer);
    }

    const finalAudio = Buffer.concat(audioBuffers);

    const audioKey = `audio/${randomName(title ? slugify(title) : "news", "mp3")}`;

    await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: audioKey,
    Body: finalAudio,
    ContentType: "audio/mpeg"
    }));

    const audioUrl = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: audioKey,
    }), { expiresIn: 24 * 60 * 60 }); // 1 year

    const qrBuffer = await QRCode.toBuffer(audioUrl, { type: "png", width: 400 });

    const qrKey = `qr/${randomName("qr", "png")}`;

    await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: qrKey,
    Body: qrBuffer,
    ContentType: "image/png"
    }));

    const qrUrl = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: qrKey,
    }), { expiresIn: 24 * 60 * 60 });//1 year


    return res.json({
      success: true,
      audio: { key: audioKey, url: audioUrl },
      qr: { key: qrKey, url: qrUrl },
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "server error" });
  }

  // await new Promise(resolve => setTimeout(resolve, 1000));
  // return res.json(example);
};

/**
 * Saves Text-to-Speech data to the database
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
const saveTtsToDb = async (req, res) => {
  /** 
   * @type {{title: string, text: string, audioKey: string, audioUrl: string, qrKey: string, qrUrl: string}} 
   */
  const { title, text, audioKey, audioUrl, qrKey, qrUrl } = req.body;

  const query = `
    INSERT INTO tbl_tts_record (title, tts_text, audio_key, audio_url, qr_key, qr_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  try {
    await pgClient.query(query, [title, text, audioKey, audioUrl, qrKey, qrUrl]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return res.status(200).json({ msg: "Data Saved"});
  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ msg: 'Database error', error: error.message });
  }
};

/**
 * Fetch paginated TTS records with optional date filtering
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getPaginatedTtsRecords = async (req, res) => {
  try {
    let { start_date, end_date, page_length, page_number } = req.body;

    const limit = Number(page_length) || 10;
    const page = Number(page_number) || 1;
    const offset = (page - 1) * limit;

    let dataQuery = '';
    let countQuery = '';
    let params = [];

    //If date range provided
    if (start_date && end_date) {
      dataQuery = `
        SELECT *
        FROM tbl_tts_record
        WHERE DATE(tts_time) BETWEEN $1 AND $2
        ORDER BY tts_time DESC
        LIMIT $3 OFFSET $4;
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM tbl_tts_record
        WHERE DATE(tts_time) BETWEEN $1 AND $2;
      `;

      params = [start_date, end_date, limit, offset];
    } 
    // No date filter with pagenation
    else {
      dataQuery = `
        SELECT *
        FROM tbl_tts_record
        ORDER BY tts_time DESC
        LIMIT $1 OFFSET $2;
      `;

      countQuery = `
        SELECT COUNT(*) AS total FROM tbl_tts_record;
      `;

      params = [limit, offset];
    }


    // const dataResult = await pgClient.query(dataQuery, params);
        const [dataResult, countResult] = await Promise.all([
      pgClient.query(dataQuery, params),
      pgClient.query(countQuery, start_date && end_date ? [start_date, end_date] : [])
    ]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      msg: 'Data fetched successfully',
      data: dataResult.rows,
      pagination: {
        current_page: page,
        page_length: limit,
        total_pages: totalPages,
        total_records: totalRecords
      },
    });

  } catch (error) {
    console.error('Error fetching paginated records:', error);
    return res.status(500).json({ msg: 'Server error', error: error.message });
  }
};





export { createTts,saveTtsToDb,getPaginatedTtsRecords };

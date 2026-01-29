import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiScanResult {
  questions: {
    que: number;
    type: 'mcq' | 'nat';
    bbox: [ymin: number, xmin: number, ymax: number, xmax: number];
  }[];
}

/**
 * Scans a page image using Google Gemini, extracting question locations.
 * @param base64Image Base64-encoded image (as a data URL or raw base64)
 * @param apiKey Google Generative AI API key
 * @returns Promise<GeminiScanResult | null>
 */
export async function scanPage(
  base64Image: string,
  apiKey: string
): Promise<GeminiScanResult | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imageParts = [
      {
        inlineData: {
          data: base64Image.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png', // adjust if not PNG
        },
      },
    ];

    const systemPrompt =
      `You are an AI that extracts questions from scanned exam pages. ` +
      `Detect each question and return an object strictly in this JSON format: ` +
      `{"questions":[{"que":number, "type":"mcq"|"nat", "bbox":[ymin,xmin,ymax,xmax]]}} \n\n` +
      `- "que": incremental integer (question number, starting from 1)\n` +
      `- "type": "mcq" for multiple choice, "nat" for numeric answer type\n` +
      `- "bbox": bounding box of the question in the order: [ymin, xmin, ymax, xmax] as integers in pixel units\n` +
      `Strictly return only the JSON object, nothing else.`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            ...imageParts,
          ],
        },
      ],
    });

    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      result?.response?.text?.trim() ??
      '';

    // Extract JSON from response, even if model added extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed: GeminiScanResult = JSON.parse(jsonMatch[0]);
    // Check structure
    if (
      parsed &&
      Array.isArray(parsed.questions) &&
      parsed.questions.every(q =>
        typeof q.que === 'number' &&
        (q.type === 'mcq' || q.type === 'nat') &&
        Array.isArray(q.bbox) &&
        q.bbox.length === 4 &&
        q.bbox.every(Number.isFinite)
      )
    ) {
      return parsed;
    }

    return null;
  } catch (err) {
    // Optionally log error
    return null;
  }
}
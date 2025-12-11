import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { apiKey, promptContext } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // [修正點] 將模型改為最穩定的 gemini-pro，避免 404 錯誤
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      You are a financial analyst.
      Target Keyword: "${promptContext || 'US Stock Market'}".
      Analyze current market news based on this keyword.

      Return a STRICT JSON object with this exact structure (no markdown code blocks, just raw JSON):
      {
        "summary": "Brief summary in Traditional Chinese (within 50 words)",
        "hot_sector": "Name of the hottest sector",
        "stocks": [
          { "symbol": "AAPL.US", "name": "Apple", "reason": "Why it's hot" },
          { "symbol": "NVDA.US", "name": "Nvidia", "reason": "Why it's hot" }
        ]
      }
      Important: 
      1. Convert all US stock tickers to "TICKER.US".
      2. Do not include \`\`\`json or \`\`\` markers.
      3. Create believable mock news based on real-world trends if you cannot browse live web.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 清理 Markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("JSON Parse Error:", text);
      return NextResponse.json({
        error: "AI 回傳格式錯誤",
        rawText: text
      }, { status: 500 });
    }

  } catch (error) {
    console.error("API Error Detailed:", error); // 這裡會印出詳細錯誤到 Vercel Log
    return NextResponse.json({
      error: error.message || "Internal Server Error"
    }, { status: 500 });
  }
}

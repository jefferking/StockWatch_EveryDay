import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { apiKey, promptContext } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 400 });
    }

    // [資深開發者 Note]:
    // 這裡我們初始化 SDK 並強制指定使用 'v1beta' API 版本。
    // 這對齊了您的 curl 請求: https://generativelanguage.googleapis.com/v1beta/...
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      apiVersion: 'v1beta' 
    });

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
    `;

    // [資深開發者 Note]:
    // 使用您 curl 測試成功的 'gemini-2.5-flash' 模型。
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    // 取得回應文字
    let text = response.text;

    // 防呆處理：如果 AI 還是習慣性加了 Markdown，我們幫它清乾淨
    if (text) {
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("JSON Parse Error:", text);
      return NextResponse.json({
        error: "AI 回傳格式錯誤，無法解析為 JSON",
        rawText: text
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Gemini API Error:", error);

    // 將 SDK 的錯誤訊息完整回傳，方便前端 Debug
    return NextResponse.json({
      error: error.message || "Internal Server Error"
    }, { status: 500 });
  }
}

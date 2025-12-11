import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { apiKey, promptContext } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 400 });
    }

    // [新版 SDK 初始化]
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = `
      You are a financial analyst.
      Target Keyword: "${promptContext || 'US Stock Market'}".
      Analyze current market news based on this keyword.

      Return a STRICT JSON object with this exact structure (no markdown, just raw JSON):
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

    // [新版 SDK 呼叫方式]
    // 直接透過 ai.models.generateContent 呼叫，不需要先 getModel
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      // 新版 SDK 支援直接設定回應格式 (雖然目前還是建議手動 parse 以防萬一)
      config: {
        responseMimeType: 'application/json',
      }
    });

    // [新版 SDK 取得文字的方式] 直接存取 .text
    let text = response.text;

    // 清理可能殘留的 Markdown 標記
    if (text) {
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

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
    console.error("New SDK Error:", error);
    return NextResponse.json({
      error: error.message || "Internal Server Error"
    }, { status: 500 });
  }
}

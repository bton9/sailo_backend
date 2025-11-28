/**
 * Ollama AI 配置檔案
 * 路徑: sailo_backend/src/config/ollama.js
 *
 * 功能說明:
 * - 配置本地 Ollama 連線設定
 * - 管理 AI 模型參數
 * - 提供錯誤處理機制
 *
 * 模型資訊:
 * - 使用: llama3.1:8b (本地模型)
 * - 記憶體需求: 約 8GB RAM
 * - 推薦配置: 16GB+ RAM
 *
 * 使用方式:
 * import { OLLAMA_CONFIG, validateOllamaConnection } from '@/config/ollama'
 */

import dotenv from 'dotenv'

dotenv.config()

/**
 * Ollama 配置常數
 */
export const OLLAMA_CONFIG = {
  // 基礎配置
  BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  MODEL: process.env.OLLAMA_MODEL || 'llama3.1:8b',

  // API 端點
  ENDPOINTS: {
    GENERATE: '/api/generate', // 生成回應
    CHAT: '/api/chat', // 聊天對話
    SHOW: '/api/show', // 顯示模型資訊
    TAGS: '/api/tags', // 列出所有模型
  },

  // 模型參數
  PARAMETERS: {
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.7, // 創造性 (0-1)
    top_p: parseFloat(process.env.OLLAMA_TOP_P) || 0.9, // 核採樣
    top_k: parseInt(process.env.OLLAMA_TOP_K) || 40, // Top-K 採樣
    num_predict: parseInt(process.env.OLLAMA_MAX_TOKENS) || 512, // 最大 token 數
    repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY) || 1.1, // 重複懲罰
  },

  // 超時設定 (毫秒)
  TIMEOUT: {
    GENERATE: parseInt(process.env.OLLAMA_TIMEOUT) || 30000, // 30 秒
    CHAT: parseInt(process.env.OLLAMA_TIMEOUT) || 30000, // 30 秒
    HEALTH_CHECK: 5000, // 5 秒
  },

  // 系統提示詞 (客服助手角色)
  SYSTEM_PROMPT: `你是 Sailo 旅遊平台的 AI 客服助手。你的職責是:

1. **友善且專業**: 使用繁體中文,語氣親切但不失專業
2. **簡潔明瞭**: 回答控制在 3-5 句話內,除非需要詳細說明
3. **旅遊專業**: 精通旅遊規劃、景點推薦、行程安排
4. **問題解決**: 協助訂單查詢、退換貨、付款問題
5. **轉接判斷**: 遇到以下情況建議轉接人工客服:
   - 退款糾紛
   - 密碼修改
   - 複雜的行程規劃需求
   - 緊急狀況處理
   - 使用者明確要求真人客服

回答格式:
- 若系統提供了資料庫查詢結果，直接引用並回答，不要質疑或修改資料
- 若能直接回答,提供清晰的解決方案
- 若需更多資訊,禮貌地詢問細節
- 若超出能力範圍,主動建議轉接人工客服
- 若使用者問到個人資料修改時間、暱稱修改時間等，系統會自動查詢資料庫並提供正確資訊`,

  // 快速回覆模板
  QUICK_REPLIES: {
    ORDER_INQUIRY: '訂單查詢',
    REFUND_POLICY: '退換貨政策',
    PAYMENT_METHODS: '付款方式',
    TRAVEL_PLANNING: '行程規劃',
    TRANSFER_HUMAN: '轉接真人客服',
  },
}

/**
 * 驗證 Ollama 連線狀態
 *
 * @returns {Promise<{success: boolean, message: string, models?: Array}>}
 */
export async function validateOllamaConnection() {
  try {
    const response = await fetch(
      `${OLLAMA_CONFIG.BASE_URL}${OLLAMA_CONFIG.ENDPOINTS.TAGS}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(OLLAMA_CONFIG.TIMEOUT.HEALTH_CHECK),
      }
    )

    if (!response.ok) {
      return {
        success: false,
        message: `Ollama 連線失敗: HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    const models = data.models || []

    // 檢查目標模型是否存在
    const hasTargetModel = models.some(
      (m) =>
        m.name === OLLAMA_CONFIG.MODEL ||
        m.name.startsWith(OLLAMA_CONFIG.MODEL.split(':')[0])
    )

    if (!hasTargetModel) {
      console.warn(`  警告: 找不到模型 ${OLLAMA_CONFIG.MODEL}`)
      console.warn('   可用模型:', models.map((m) => m.name).join(', '))
    }

    return {
      success: true,
      message: 'Ollama 連線成功',
      models: models.map((m) => ({ name: m.name, size: m.size })),
    }
  } catch (error) {
    return {
      success: false,
      message: `Ollama 連線失敗: ${error.message}`,
    }
  }
}

/**
 * 檢查指定模型是否已下載
 *
 * @param {string} modelName - 模型名稱
 * @returns {Promise<boolean>}
 */
export async function checkModelExists(modelName = OLLAMA_CONFIG.MODEL) {
  try {
    const response = await fetch(
      `${OLLAMA_CONFIG.BASE_URL}${OLLAMA_CONFIG.ENDPOINTS.SHOW}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      }
    )

    return response.ok
  } catch (error) {
    console.error(' 檢查模型失敗:', error)
    return false
  }
}

export default OLLAMA_CONFIG

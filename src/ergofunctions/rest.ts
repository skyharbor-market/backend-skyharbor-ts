import fetch from "node-fetch"
import logger from '../logger'

export async function post(url: any, body = {}, apiKey = '') {
  return await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      api_key: apiKey,
    },
    body: JSON.stringify(body),
  })
}
export async function get(url: any, apiKey = '') {
  try {
    const result = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        api_key: apiKey,
      }
    })

    if (!result.ok) {
      throw new Error(`Response status: ${result.status}`)
    }

    const json = await result.json()
    return json
  } catch (e) {
    logger.error({ message: "rest get call failed", url: url, error: e.message })
    if (e.message === "Response status: 503" || e.message === "Response status: 504" || e.message === "Response status: 520") {
      throw e
    }
    return []
  }
}

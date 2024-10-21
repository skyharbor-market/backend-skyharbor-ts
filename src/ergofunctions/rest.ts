import fetch from "node-fetch"

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
    console.error(e)
    if (e.message === "Response status: 503") {
      throw e
    }
    return []
  }
}

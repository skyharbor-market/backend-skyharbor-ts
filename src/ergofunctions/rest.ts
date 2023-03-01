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
    }).then(res => res.json())
    return result
  } catch (e) {
    console.error(e)
    return []
  }
}
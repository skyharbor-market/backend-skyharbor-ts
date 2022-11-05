export async function post(url: any, body = {}, apiKey = '') {
  return await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      api_key: apiKey,
    },
    body: JSON.stringify(body),
  }).catch((error) => {
    console.log(error)
  });
}
export async function get(url: any, apiKey = '') {
  return await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      api_key: apiKey,
    },
  }).catch((error) => {
    console.log(error)
  });;
}